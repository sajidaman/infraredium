from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from app.archive import (
    MAX_RESULT_COUNT,
    ArchiveHTTPError,
    ArchiveResponseError,
    ArchiveTimeoutError,
    ArchiveUnavailableError,
    search_spherex_observations,
)
from app.models import ObservationSearchResponse

router = APIRouter(prefix="/api/v1")


@router.get("/observations/search", response_model_exclude_none=True)
async def search_observations(
    ra: Annotated[
        float, Query(ge=0, lt=360, allow_inf_nan=False, description="Right ascension in degrees.")
    ],
    dec: Annotated[
        float, Query(ge=-90, le=90, allow_inf_nan=False, description="Declination in degrees.")
    ],
    radius: Annotated[
        float,
        Query(
            gt=0,
            le=1,
            allow_inf_nan=False,
            description="Search radius in degrees; maximum 1 degree.",
        ),
    ] = 0.1,
    limit: Annotated[
        int, Query(ge=1, le=MAX_RESULT_COUNT, description="Maximum records to return.")
    ] = 25,
) -> ObservationSearchResponse:
    """Search public SPHEREx observations through IRSA SIA2."""
    try:
        return await search_spherex_observations(ra, dec, radius, limit)
    except ArchiveTimeoutError as error:
        raise HTTPException(
            status_code=504,
            detail="The IRSA archive search timed out. Try again shortly.",
        ) from error
    except ArchiveHTTPError as error:
        raise HTTPException(
            status_code=502,
            detail=f"The IRSA archive returned HTTP {error.status_code}.",
        ) from error
    except ArchiveUnavailableError as error:
        raise HTTPException(
            status_code=502,
            detail="The IRSA archive could not be reached.",
        ) from error
    except ArchiveResponseError as error:
        raise HTTPException(
            status_code=502,
            detail=str(error),
        ) from error


@router.get("/observations/{observation_id}")
def get_observation_metadata(observation_id: str) -> None:
    """Return metadata for a selected public archive observation."""
    raise HTTPException(
        status_code=501,
        detail="Observation metadata retrieval is not implemented.",
    )


@router.get("/observations/{observation_id}/cutout")
def get_fits_cutout(
    observation_id: str,
    ra: Annotated[float, Query(ge=0, lt=360, description="Right ascension in degrees.")],
    dec: Annotated[float, Query(ge=-90, le=90, description="Declination in degrees.")],
    size_arcsec: Annotated[
        float, Query(gt=0, le=3600, description="Cutout width in arcseconds.")
    ] = 60,
) -> None:
    """Return a bounded cutout; full survey files are not sent to the client."""
    raise HTTPException(
        status_code=501,
        detail="FITS cutout generation is not implemented.",
    )


@router.get("/observations/{observation_id}/visualization")
def get_image_visualization(
    observation_id: str,
    extension: Annotated[
        str, Query(min_length=1, max_length=68, pattern=r"^[A-Za-z0-9_+-]+$")
    ] = "flux",
) -> None:
    """Return one named FITS extension without combining scientific layers."""
    raise HTTPException(
        status_code=501,
        detail=f"FITS {extension} visualization is not implemented.",
    )


@router.get("/observations/{observation_id}/pixel")
def inspect_pixel(
    observation_id: str,
    x: Annotated[int, Query(ge=0)],
    y: Annotated[int, Query(ge=0)],
    extension: Annotated[
        str, Query(min_length=1, max_length=68, pattern=r"^[A-Za-z0-9_+-]+$")
    ],
) -> None:
    """Inspect one zero-based pixel in one explicit FITS extension."""
    raise HTTPException(
        status_code=501,
        detail=f"FITS {extension} pixel inspection is not implemented.",
    )
