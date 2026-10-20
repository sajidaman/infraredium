import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FitsImageViewer from "@/components/FitsImageViewer";

describe("FitsImageViewer", () => {
  it("renders explicit empty, loading, and error states", () => {
    const { rerender } = render(<FitsImageViewer />);
    expect(screen.getByText("No FITS image loaded")).toBeInTheDocument();

    rerender(<FitsImageViewer state={{ status: "loading" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading server-generated cutout");

    rerender(
      <FitsImageViewer
        state={{ status: "error", message: "The cutout service is unavailable." }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The cutout service is unavailable.",
    );
  });

  it("renders a server-provided cutout image without loading a FITS file", () => {
    render(
      <FitsImageViewer
        state={{
          status: "ready",
          imageUrl: "/api/v1/cutouts/example.png",
          alt: "Server-generated observation cutout",
        }}
      />,
    );

    expect(screen.getByRole("img", { name: "Server-generated observation cutout" }))
      .toHaveAttribute("src", "/api/v1/cutouts/example.png");
  });
});
