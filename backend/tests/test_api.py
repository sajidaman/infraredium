import httpx
import pytest
from fastapi.testclient import TestClient

from app import archive
from app.main import app

client = TestClient(app)
SIA_HEADERS = (
    "obs_id,obs_publisher_did,access_url,obs_collection,target_name,"
    "proposal_title,instrument_name,energy_bandpassname,dataproduct_type,"
    "calib_level,s_ra,s_dec,em_min,em_max,t_min,t_max,t_exptime,"
    "obs_release_date,access_format,access_estsize"
)
SIA_ROW = (
    "2025W51_1A_0219_2,ivo://irsa.ipac/spherex_qr2?2025W51_1A_0219_2/D3,"
    "https://irsa.ipac.caltech.edu/ibe/data/spherex/qr2/level2/2025W51_1A/"
    "l2b-v21-2025-354/3/level2_2025W51_1A_0219_2D3_spx_l2b-v21-2025-354.fits,"
    "spherex_qr2,SPHEREx,SPHEREx LVF Survey Data,SPHEREx,SPHEREx-D3,"
    "image,2,1.2079989,-1.3445334,1.63010e-06,2.43460e-06,"
    "61024.981701,61024.983033,113.5826,2026-01-27 19:52:50,image/fits,71638"
)


def mock_archive(monkeypatch: pytest.MonkeyPatch, response: httpx.Response | Exception):
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if isinstance(response, Exception):
            raise response
        return response

    monkeypatch.setattr(
        archive,
        "create_http_client",
        lambda: httpx.AsyncClient(
            transport=httpx.MockTransport(handler), follow_redirects=False
        ),
    )
    return requests


def test_health_does_not_probe_archive_connectivity() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "archive": "on_demand"}


def test_archive_search_constructs_a_fixed_irsa_query_and_normalizes_results(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    response = httpx.Response(
        200,
        headers={"content-type": "text/csv"},
        text=f"{SIA_HEADERS}\n{SIA_ROW}\n{SIA_ROW.replace('D3', 'D6')}\n",
    )
    requests = mock_archive(monkeypatch, response)

    response = client.get(
        "/api/v1/observations/search",
        params={"ra": 12.5, "dec": -4.25, "radius": 0.2, "limit": 1},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 1
    assert payload["limit"] == 1
    assert payload["truncated"] is True
    assert payload["results"][0] == {
        "observation_id": "2025W51_1A_0219_2",
        "publisher_id": "ivo://irsa.ipac/spherex_qr2?2025W51_1A_0219_2/D3",
        "product_url": (
            "https://irsa.ipac.caltech.edu/ibe/data/spherex/qr2/level2/2025W51_1A/"
            "l2b-v21-2025-354/3/level2_2025W51_1A_0219_2D3_spx_l2b-v21-2025-354.fits"
        ),
        "collection": "spherex_qr2",
        "target_name": "SPHEREx",
        "proposal_title": "SPHEREx LVF Survey Data",
        "instrument": "SPHEREx",
        "band": "SPHEREx-D3",
        "data_product_type": "image",
        "calibration_level": 2,
        "ra_deg": pytest.approx(1.2079989),
        "dec_deg": pytest.approx(-1.3445334),
        "wavelength_min_m": pytest.approx(1.63010e-06),
        "wavelength_max_m": pytest.approx(2.43460e-06),
        "start_time_mjd": pytest.approx(61024.981701),
        "end_time_mjd": pytest.approx(61024.983033),
        "exposure_seconds": pytest.approx(113.5826),
        "release_date": "2026-01-27 19:52:50",
        "access_format": "image/fits",
        "access_size_kbyte": 71638,
    }
    assert len(requests) == 1
    request = requests[0]
    assert request.url.scheme == "https"
    assert request.url.host == "irsa.ipac.caltech.edu"
    assert request.url.path == "/SIA"
    assert request.url.params["POS"] == "CIRCLE 12.5 -4.25 0.2"
    assert request.url.params["INSTRUMENT"] == "SPHEREx"
    assert request.url.params["MAXREC"] == "2"
    assert request.url.params["RESPONSEFORMAT"] == "csv"


def test_archive_search_returns_empty_success_and_omits_missing_optional_fields(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    headers = "obs_id,access_url"
    response = httpx.Response(
        200,
        headers={"content-type": "text/csv"},
        text=f"{headers}\n",
    )
    mock_archive(monkeypatch, response)

    result = client.get(
        "/api/v1/observations/search",
        params={"ra": 0, "dec": 0},
    )

    assert result.status_code == 200
    assert result.json() == {"results": [], "count": 0, "limit": 25, "truncated": False}


def test_archive_search_accepts_rows_without_optional_product_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    mock_archive(
        monkeypatch,
        httpx.Response(
            200,
            headers={"content-type": "text/csv"},
            text="obs_id\n2025W51_1A_0219_2\n",
        ),
    )

    response = client.get("/api/v1/observations/search", params={"ra": 0, "dec": 0})

    assert response.status_code == 200
    assert response.json()["results"] == [{"observation_id": "2025W51_1A_0219_2"}]


def test_archive_search_does_not_return_untrusted_product_urls(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    mock_archive(
        monkeypatch,
        httpx.Response(
            200,
            headers={"content-type": "text/csv"},
            text="obs_id,access_url\nobservation-1,https://evil.example/file.fits\n",
        ),
    )

    response = client.get("/api/v1/observations/search", params={"ra": 0, "dec": 0})

    assert response.status_code == 200
    assert response.json()["results"] == [{"observation_id": "observation-1"}]


def test_archive_search_tolerates_unquoted_cloud_access_json_commas(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    mock_archive(
        monkeypatch,
        httpx.Response(
            200,
            headers={"content-type": "text/csv"},
            text=(
                "obs_id,access_url,obs_publisher_did,cloud_access,upload_row_id\n"
                "observation-1,https://evil.example/file.fits,ivo://archive/1,"
                '{"aws": {"bucket_name": "bucket", "key":"key", "region": "region"}},,1\n'
            ),
        ),
    )

    response = client.get("/api/v1/observations/search", params={"ra": 0, "dec": 0})

    assert response.status_code == 200
    record = response.json()["results"][0]
    assert record["observation_id"] == "observation-1"
    assert record["publisher_id"] == "ivo://archive/1"
    assert "product_url" not in record


@pytest.mark.parametrize(
    ("params", "invalid_parameter"),
    [
        ({"ra": -0.01, "dec": 0}, "ra"),
        ({"ra": 360, "dec": 0}, "ra"),
        ({"ra": "nan", "dec": 0}, "ra"),
        ({"ra": "inf", "dec": 0}, "ra"),
        ({"ra": 0, "dec": -90.01}, "dec"),
        ({"ra": 0, "dec": 90.01}, "dec"),
        ({"ra": 0, "dec": "nan"}, "dec"),
        ({"ra": 0, "dec": 0, "radius": 0}, "radius"),
        ({"ra": 0, "dec": 0, "radius": 1.01}, "radius"),
        ({"ra": 0, "dec": 0, "limit": 0}, "limit"),
        ({"ra": 0, "dec": 0, "limit": 101}, "limit"),
    ],
)
def test_archive_search_rejects_out_of_range_parameters_without_upstream_request(
    monkeypatch: pytest.MonkeyPatch,
    params: dict[str, int | float | str],
    invalid_parameter: str,
) -> None:
    requests = mock_archive(
        monkeypatch,
        httpx.Response(200, headers={"content-type": "text/csv"}, text=SIA_HEADERS),
    )

    response = client.get("/api/v1/observations/search", params=params)

    assert response.status_code == 422
    assert invalid_parameter in response.text
    assert requests == []


def test_archive_search_ignores_client_supplied_upstream_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    requests = mock_archive(
        monkeypatch,
        httpx.Response(
            200,
            headers={"content-type": "text/csv"},
            text=f"{SIA_HEADERS}\n{SIA_ROW}\n",
        ),
    )

    response = client.get(
        "/api/v1/observations/search",
        params={
            "ra": 0,
            "dec": 0,
            "url": "http://127.0.0.1:8000/private",
        },
    )

    assert response.status_code == 200
    assert requests[0].url.host == "irsa.ipac.caltech.edu"
    assert requests[0].url.path == "/SIA"


def test_archive_timeout_is_reported_as_gateway_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    requests: list[httpx.Request] = []

    def timeout(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        raise httpx.ReadTimeout("private upstream detail", request=request)

    monkeypatch.setattr(
        archive,
        "create_http_client",
        lambda: httpx.AsyncClient(
            transport=httpx.MockTransport(timeout), follow_redirects=False
        ),
    )

    response = client.get("/api/v1/observations/search", params={"ra": 0, "dec": 0})

    assert response.status_code == 504
    assert response.json()["detail"] == "The IRSA archive search timed out. Try again shortly."
    assert "private upstream detail" not in response.text


def test_archive_http_error_is_reported_as_bad_gateway(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    mock_archive(
        monkeypatch,
        httpx.Response(503, text="private upstream detail"),
    )

    response = client.get("/api/v1/observations/search", params={"ra": 0, "dec": 0})

    assert response.status_code == 502
    assert response.json()["detail"] == "The IRSA archive returned HTTP 503."
    assert "private upstream detail" not in response.text


@pytest.mark.parametrize(
    ("content_type", "body"),
    [
        ("text/html", "<html>maintenance page</html>"),
        ("text/csv", "unexpected,column\nno,id\n"),
        ("text/csv", f"{SIA_HEADERS}\nmalformed,\"unterminated"),
    ],
)
def test_malformed_archive_response_is_reported_as_bad_gateway(
    monkeypatch: pytest.MonkeyPatch,
    content_type: str,
    body: str,
) -> None:
    mock_archive(
        monkeypatch,
        httpx.Response(200, headers={"content-type": content_type}, text=body),
    )

    response = client.get("/api/v1/observations/search", params={"ra": 0, "dec": 0})

    assert response.status_code == 502
    assert "archive" in response.json()["detail"].lower()


def test_cutout_validates_coordinates_and_bounds() -> None:
    invalid = client.get(
        "/api/v1/observations/example/cutout",
        params={"ra": 361, "dec": 0},
    )
    valid = client.get(
        "/api/v1/observations/example/cutout",
        params={"ra": 12.5, "dec": 0},
    )

    assert invalid.status_code == 422
    assert valid.status_code == 501


def test_visualization_requests_one_named_fits_extension() -> None:
    response = client.get(
        "/api/v1/observations/example/visualization",
        params={"extension": "variance"},
    )
    invalid = client.get(
        "/api/v1/observations/example/visualization",
        params={"extension": ""},
    )

    assert response.status_code == 501
    assert "FITS variance visualization" in response.json()["detail"]
    assert invalid.status_code == 422


def test_visualization_keeps_other_extensions_independent() -> None:
    response = client.get(
        "/api/v1/observations/example/visualization",
        params={"extension": "custom_quality_map"},
    )

    assert response.status_code == 501
    assert "FITS custom_quality_map visualization" in response.json()["detail"]


def test_metadata_and_pixel_endpoints_are_explicitly_unimplemented() -> None:
    metadata = client.get("/api/v1/observations/example")
    pixel = client.get(
        "/api/v1/observations/example/pixel",
        params={"x": 4, "y": 7, "extension": "quality"},
    )

    assert metadata.status_code == 501
    assert pixel.status_code == 501
    assert "metadata retrieval is not implemented" in metadata.json()["detail"]
    assert "FITS quality pixel inspection" in pixel.json()["detail"]
