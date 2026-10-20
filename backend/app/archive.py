import csv
import io
import math
from urllib.parse import urlsplit

import httpx

from app.models import ObservationRecord, ObservationSearchResponse

SIA2_ENDPOINT = "https://irsa.ipac.caltech.edu/SIA"
SIA2_HOST = "irsa.ipac.caltech.edu"
MAX_RESPONSE_BYTES = 4 * 1024 * 1024
MAX_RESULT_COUNT = 100
ARCHIVE_TIMEOUT = httpx.Timeout(connect=5, read=15, write=5, pool=5)


class ArchiveTimeoutError(Exception):
    pass


class ArchiveHTTPError(Exception):
    def __init__(self, status_code: int):
        self.status_code = status_code


class ArchiveUnavailableError(Exception):
    pass


class ArchiveResponseError(Exception):
    pass


def create_http_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=ARCHIVE_TIMEOUT, follow_redirects=False)


async def _read_limited_response(response: httpx.Response) -> bytes:
    content_length = response.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_RESPONSE_BYTES:
                raise ArchiveResponseError("The archive response exceeded the size limit.")
        except ValueError as error:
            raise ArchiveResponseError("The archive returned an invalid response size.") from error

    body = bytearray()
    async for chunk in response.aiter_bytes():
        body.extend(chunk)
        if len(body) > MAX_RESPONSE_BYTES:
            raise ArchiveResponseError("The archive response exceeded the size limit.")
    return bytes(body)


async def _download_csv(params: dict[str, str]) -> bytes:
    try:
        async with create_http_client() as client:
            async with client.stream(
                "GET",
                SIA2_ENDPOINT,
                params=params,
                headers={"Accept": "text/csv"},
            ) as response:
                if response.status_code != 200:
                    raise ArchiveHTTPError(response.status_code)
                media_type = response.headers.get("content-type", "").split(";", 1)[0].strip().lower()
                if media_type not in {"text/csv", "application/csv", "text/plain"}:
                    raise ArchiveResponseError("The archive returned an unsupported response format.")
                return await _read_limited_response(response)
    except httpx.TimeoutException as error:
        raise ArchiveTimeoutError from error
    except httpx.DecodingError as error:
        raise ArchiveResponseError("The archive returned an unreadable response body.") from error
    except httpx.RequestError as error:
        raise ArchiveUnavailableError from error


def _text(row: dict[str | None, str | None], column: str) -> str | None:
    value = row.get(column)
    if value is None:
        return None
    value = value.strip()
    return value if value and value.lower() not in {"null", "none", "nan"} else None


def _number(row: dict[str | None, str | None], column: str) -> float | None:
    value = _text(row, column)
    if value is None:
        return None
    try:
        result = float(value)
    except ValueError:
        return None
    return result if math.isfinite(result) else None


def _integer(row: dict[str | None, str | None], column: str) -> int | None:
    value = _number(row, column)
    if value is None or not value.is_integer():
        return None
    return int(value)


def _product_url(value: str | None) -> str | None:
    if value is None:
        return None
    try:
        parsed = urlsplit(value)
        port = parsed.port
    except ValueError:
        return None
    if (
        parsed.scheme != "https"
        or parsed.hostname != SIA2_HOST
        or parsed.username is not None
        or parsed.password is not None
        or port not in {None, 443}
    ):
        return None
    return value


def _parse_records(body: bytes, limit: int) -> tuple[list[ObservationRecord], bool]:
    try:
        text = body.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text, newline=""), strict=True)
        headers = reader.fieldnames
        if not headers:
            raise ArchiveResponseError("The archive response did not contain CSV columns.")
        normalized_headers = [header.strip().lower() for header in headers]
        if len(normalized_headers) != len(set(normalized_headers)):
            raise ArchiveResponseError("The archive response contained duplicate CSV columns.")
        if not {"obs_id", "obs_publisher_did"}.intersection(normalized_headers):
            raise ArchiveResponseError("The archive response is missing observation identifier columns.")
        cloud_access_index = (
            normalized_headers.index("cloud_access")
            if "cloud_access" in normalized_headers
            else -1
        )
        mapped_columns = {
            "obs_id",
            "obs_publisher_did",
            "access_url",
            "obs_collection",
            "target_name",
            "proposal_title",
            "instrument_name",
            "energy_bandpassname",
            "dataproduct_type",
            "calib_level",
            "s_ra",
            "s_dec",
            "em_min",
            "em_max",
            "t_min",
            "t_max",
            "t_exptime",
            "obs_release_date",
            "access_format",
            "access_estsize",
        }
        last_mapped_index = max(
            index
            for index, column in enumerate(normalized_headers)
            if column in mapped_columns
        )

        records: list[ObservationRecord] = []
        for row in reader:
            if None in row:
                if cloud_access_index <= last_mapped_index:
                    raise ArchiveResponseError("The archive response contained a malformed CSV row.")
                # IRSA's cloud_access JSON may contain unquoted commas in CSV output.
                del row[None]
            normalized = {
                (key.strip().lower() if key is not None else None): value
                for key, value in row.items()
            }
            observation_id = _text(normalized, "obs_id") or _text(
                normalized, "obs_publisher_did"
            )
            if observation_id is None:
                raise ArchiveResponseError("The archive response contained a row without an observation ID.")
            records.append(
                ObservationRecord(
                    observation_id=observation_id,
                    publisher_id=_text(normalized, "obs_publisher_did"),
                    product_url=_product_url(_text(normalized, "access_url")),
                    collection=_text(normalized, "obs_collection"),
                    target_name=_text(normalized, "target_name"),
                    proposal_title=_text(normalized, "proposal_title"),
                    instrument=_text(normalized, "instrument_name"),
                    band=_text(normalized, "energy_bandpassname"),
                    data_product_type=_text(normalized, "dataproduct_type"),
                    calibration_level=_integer(normalized, "calib_level"),
                    ra_deg=_number(normalized, "s_ra"),
                    dec_deg=_number(normalized, "s_dec"),
                    wavelength_min_m=_number(normalized, "em_min"),
                    wavelength_max_m=_number(normalized, "em_max"),
                    start_time_mjd=_number(normalized, "t_min"),
                    end_time_mjd=_number(normalized, "t_max"),
                    exposure_seconds=_number(normalized, "t_exptime"),
                    release_date=_text(normalized, "obs_release_date"),
                    access_format=_text(normalized, "access_format"),
                    access_size_kbyte=_integer(normalized, "access_estsize"),
                )
            )
            if len(records) > limit:
                return records[:limit], True
        return records, False
    except (csv.Error, UnicodeDecodeError) as error:
        raise ArchiveResponseError("The archive returned malformed CSV data.") from error


async def search_spherex_observations(
    ra: float,
    dec: float,
    radius: float,
    limit: int,
) -> ObservationSearchResponse:
    params = {
        "POS": f"CIRCLE {ra:.12g} {dec:.12g} {radius:.12g}",
        "INSTRUMENT": "SPHEREx",
        "MAXREC": str(limit + 1),
        "RESPONSEFORMAT": "csv",
    }
    body = await _download_csv(params)
    results, truncated = _parse_records(body, limit)
    return ObservationSearchResponse(
        results=results,
        count=len(results),
        limit=limit,
        truncated=truncated,
    )
