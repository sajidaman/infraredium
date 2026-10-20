export type ObservationRecord = {
  observation_id: string;
  publisher_id?: string;
  product_url?: string;
  collection?: string;
  target_name?: string;
  proposal_title?: string;
  instrument?: string;
  band?: string;
  data_product_type?: string;
  calibration_level?: number;
  ra_deg?: number;
  dec_deg?: number;
  wavelength_min_m?: number;
  wavelength_max_m?: number;
  start_time_mjd?: number;
  end_time_mjd?: number;
  exposure_seconds?: number;
  release_date?: string;
  access_format?: string;
  access_size_kbyte?: number;
};

export type ObservationSearchResponse = {
  results: ObservationRecord[];
  count: number;
  limit: number;
  truncated: boolean;
};

export type ObservationSearchParams = {
  ra: number;
  dec: number;
  radius: number;
  limit: number;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

function isObservationSearchResponse(
  value: unknown,
): value is ObservationSearchResponse {
  if (typeof value !== "object" || value === null) return false;
  const response = value as Record<string, unknown>;
  const isObservationRecord = (record: unknown): record is ObservationRecord => {
    if (typeof record !== "object" || record === null) return false;
    const item = record as Record<string, unknown>;
    const stringFields: (keyof ObservationRecord)[] = [
      "observation_id",
      "publisher_id",
      "product_url",
      "collection",
      "target_name",
      "proposal_title",
      "instrument",
      "band",
      "data_product_type",
      "release_date",
      "access_format",
    ];
    const numberFields: (keyof ObservationRecord)[] = [
      "calibration_level",
      "ra_deg",
      "dec_deg",
      "wavelength_min_m",
      "wavelength_max_m",
      "start_time_mjd",
      "end_time_mjd",
      "exposure_seconds",
      "access_size_kbyte",
    ];
    return (
      typeof item.observation_id === "string" &&
      stringFields.every(
        (field) => item[field] === undefined || typeof item[field] === "string",
      ) &&
      numberFields.every(
        (field) =>
          item[field] === undefined ||
          (typeof item[field] === "number" && Number.isFinite(item[field])),
      )
    );
  };
  return (
    Array.isArray(response.results) &&
    Number.isInteger(response.count) &&
    Number.isInteger(response.limit) &&
    typeof response.truncated === "boolean" &&
    response.results.every(isObservationRecord)
  );
}

export async function searchObservations(
  params: ObservationSearchParams,
  signal?: AbortSignal,
): Promise<ObservationSearchResponse> {
  const query = new URLSearchParams({
    ra: String(params.ra),
    dec: String(params.dec),
    radius: String(params.radius),
    limit: String(params.limit),
  });
  const response = await fetch(
    `${API_BASE_URL.replace(/\/+$/, "")}/api/v1/observations/search?${query}`,
    { headers: { Accept: "application/json" }, signal },
  );

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("The Infraredium API returned an invalid response.");
  }

  if (!response.ok) {
    const detail =
      typeof payload === "object" &&
      payload !== null &&
      "detail" in payload &&
      typeof payload.detail === "string"
        ? payload.detail
        : `The Infraredium API returned HTTP ${response.status}.`;
    throw new Error(detail);
  }
  if (!isObservationSearchResponse(payload)) {
    throw new Error("The Infraredium API returned an invalid search result.");
  }
  return payload;
}
