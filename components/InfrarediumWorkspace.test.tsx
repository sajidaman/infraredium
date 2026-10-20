import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InfrarediumWorkspace from "@/components/InfrarediumWorkspace";
import { searchObservations, type ObservationSearchResponse } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  searchObservations: vi.fn(),
}));

const mockSearchObservations = vi.mocked(searchObservations);
const productUrl =
  "https://irsa.ipac.caltech.edu/ibe/data/spherex/qr2/level2/2025W51_1A/l2b-v21-2025-354/3/level2_2025W51_1A_0219_2D3_spx_l2b-v21-2025-354.fits";
const successfulSearch: ObservationSearchResponse = {
  results: [
    {
      observation_id: "2025W51_1A_0219_2",
      publisher_id: "ivo://irsa.ipac/spherex_qr2?2025W51_1A_0219_2/D3",
      product_url: productUrl,
      collection: "spherex_qr2",
      proposal_title: "SPHEREx LVF Survey Data",
      instrument: "SPHEREx",
      band: "SPHEREx-D3",
      ra_deg: 1.2079989,
      dec_deg: -1.3445334,
      exposure_seconds: 113.5826,
    },
  ],
  count: 1,
  limit: 25,
  truncated: false,
};

function fillSearchForm() {
  fireEvent.change(screen.getByLabelText(/Right ascension/), {
    target: { value: "12.5" },
  });
  fireEvent.change(screen.getByLabelText(/Declination/), {
    target: { value: "-4.25" },
  });
}

describe("InfrarediumWorkspace", () => {
  beforeEach(() => {
    mockSearchObservations.mockReset();
  });

  it("labels the sky as a synthetic demonstration", () => {
    render(<InfrarediumWorkspace />);

    expect(screen.getByText("SIMULATED FIELD")).toBeInTheDocument();
    expect(screen.getByText("NOT SPHEREx DATA")).toBeInTheDocument();
    expect(screen.getByText("No FITS image loaded")).toBeInTheDocument();
    expect(
      screen.getByText("Demonstration only · not SPHEREx observations"),
    ).toBeInTheDocument();
  });

  it("keeps workspace navigation working", () => {
    render(<InfrarediumWorkspace />);

    fireEvent.click(screen.getByRole("button", { name: "Data" }));
    expect(screen.getByRole("heading", { name: "Data access" })).toBeInTheDocument();
    expect(screen.getByText("GET /api/v1/observations/search")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Science Lab" }));
    expect(screen.getByRole("heading", { name: "Science lab" })).toBeInTheDocument();
    expect(screen.getByText("No measurements loaded")).toBeInTheDocument();
  });

  it("shows loading and renders archive-provided results and links", async () => {
    let resolveSearch!: (response: ObservationSearchResponse) => void;
    const pendingSearch = new Promise<ObservationSearchResponse>((resolve) => {
      resolveSearch = resolve;
    });
    mockSearchObservations.mockReturnValue(pendingSearch);
    render(<InfrarediumWorkspace />);
    fillSearchForm();

    fireEvent.click(screen.getByRole("button", { name: /Search SPHEREx archive/ }));

    expect(
      screen.getByText("Searching the public IRSA SPHEREx archive…"),
    ).toBeInTheDocument();
    expect(mockSearchObservations).toHaveBeenCalledWith(
      { ra: 12.5, dec: -4.25, radius: 0.1, limit: 25 },
      expect.any(AbortSignal),
    );

    await act(async () => {
      resolveSearch(successfulSearch);
      await pendingSearch;
    });
    expect(screen.getByText("2025W51_1A_0219_2")).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "Open archive product for 2025W51_1A_0219_2",
      }),
    ).toHaveAttribute("href", productUrl);

    fireEvent.click(screen.getByRole("button", { name: /2025W51_1A_0219_2/ }));
    expect(screen.getAllByText("SPHEREx LVF Survey Data")).toHaveLength(2);
  });

  it("shows a distinct empty state for a successful search with no matches", async () => {
    mockSearchObservations.mockResolvedValue({
      results: [],
      count: 0,
      limit: 25,
      truncated: false,
    });
    render(<InfrarediumWorkspace />);
    fillSearchForm();

    fireEvent.click(screen.getByRole("button", { name: /Search SPHEREx archive/ }));

    expect(
      await screen.findByText("No SPHEREx observations matched this search area."),
    ).toBeInTheDocument();
  });

  it("does not render a link for an untrusted product URL", async () => {
    mockSearchObservations.mockResolvedValue({
      ...successfulSearch,
      results: [
        { ...successfulSearch.results[0], product_url: "https://evil.example/file.fits" },
      ],
    });
    render(<InfrarediumWorkspace />);
    fillSearchForm();

    fireEvent.click(screen.getByRole("button", { name: /Search SPHEREx archive/ }));

    expect(await screen.findByText("2025W51_1A_0219_2")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Open archive product/ }),
    ).not.toBeInTheDocument();
  });

  it("shows service errors without presenting them as empty results", async () => {
    mockSearchObservations.mockRejectedValue(
      new Error("The IRSA archive search timed out. Try again shortly."),
    );
    render(<InfrarediumWorkspace />);
    fillSearchForm();

    fireEvent.click(screen.getByRole("button", { name: /Search SPHEREx archive/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The IRSA archive search timed out. Try again shortly.",
    );
  });

  it("rejects invalid parameters before calling the archive API", () => {
    render(<InfrarediumWorkspace />);
    fillSearchForm();
    fireEvent.change(screen.getByLabelText(/Right ascension/), {
      target: { value: "360" },
    });
    fireEvent.change(screen.getByLabelText("Search radius in degrees"), {
      target: { value: "1.1" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Search SPHEREx archive/ }));

    expect(screen.getByRole("alert")).toHaveTextContent("Check the search parameters");
    expect(mockSearchObservations).not.toHaveBeenCalled();
  });

  it("collapses and restores the controls sidebar", () => {
    render(<InfrarediumWorkspace />);

    fireEvent.click(
      within(screen.getByLabelText("Sky explorer controls")).getByRole("button", {
        name: "Collapse search sidebar",
      }),
    );
    expect(screen.getByRole("button", { name: /Controls/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Controls/ }));
    expect(screen.getByRole("heading", { name: "Coordinates" })).toBeInTheDocument();
  });
});
