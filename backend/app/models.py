from pydantic import BaseModel, ConfigDict


class ObservationRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    observation_id: str
    publisher_id: str | None = None
    product_url: str | None = None
    collection: str | None = None
    target_name: str | None = None
    proposal_title: str | None = None
    instrument: str | None = None
    band: str | None = None
    data_product_type: str | None = None
    calibration_level: int | None = None
    ra_deg: float | None = None
    dec_deg: float | None = None
    wavelength_min_m: float | None = None
    wavelength_max_m: float | None = None
    start_time_mjd: float | None = None
    end_time_mjd: float | None = None
    exposure_seconds: float | None = None
    release_date: str | None = None
    access_format: str | None = None
    access_size_kbyte: int | None = None


class ObservationSearchResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    results: list[ObservationRecord]
    count: int
    limit: int
    truncated: bool
