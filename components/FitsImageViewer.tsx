export type FitsViewerState =
  | { status: "empty" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; imageUrl: string; alt: string };

type FitsImageViewerProps = {
  state?: FitsViewerState;
};

export default function FitsImageViewer({
  state = { status: "empty" },
}: FitsImageViewerProps) {
  return (
    <section className="fits-panel" aria-labelledby="fits-title">
      <div className="panel-heading">
        <div>
          <h2 id="fits-title">FITS image viewer</h2>
          <p>Image layers stay separate by extension.</p>
        </div>
        <span
          className={`status-pill${state.status === "error" ? " status-pill-warning" : " status-pill-muted"}`}
        >
          {state.status === "empty"
            ? "NO FILE"
            : state.status === "loading"
              ? "LOADING"
              : state.status === "error"
                ? "ERROR"
                : "CUTOUT"}
        </span>
      </div>
      <div className="fits-layers" aria-label="FITS extension layers">
        <span className="layer-chip"><i className="layer-dot flux-dot" />Flux</span>
        <span className="layer-chip"><i className="layer-dot variance-dot" />Variance</span>
        <span className="layer-chip"><i className="layer-dot quality-dot" />Quality</span>
      </div>
      {state.status === "ready" ? (
        <div className="fits-image-stage">
          <img src={state.imageUrl} alt={state.alt} loading="lazy" />
        </div>
      ) : state.status === "loading" ? (
        <div className="fits-state" role="status">
          <span className="loading-mark" aria-hidden="true" />
          <strong>Loading server-generated cutout</strong>
          <span>FITS data remains on the backend.</span>
        </div>
      ) : state.status === "error" ? (
        <div className="fits-state fits-error" role="alert">
          <strong>Cutout unavailable</strong>
          <span>{state.message}</span>
        </div>
      ) : (
        <div className="fits-empty" role="status">
          <div className="fits-empty-icon" aria-hidden="true">
            <svg viewBox="0 0 42 42" fill="none">
              <rect x="6.5" y="7.5" width="29" height="27" rx="2" />
              <circle cx="27.5" cy="16.5" r="3.5" />
              <path d="m9 30 8-8 6 6 4-4 7 7" />
            </svg>
          </div>
          <strong>No FITS image loaded</strong>
          <span>Connect an observation to inspect a server-generated cutout.</span>
        </div>
      )}
    </section>
  );
}
