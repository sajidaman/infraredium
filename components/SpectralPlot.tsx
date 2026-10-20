export default function SpectralPlot() {
  return (
    <section className="spectrum-panel" aria-labelledby="spectrum-title">
      <div className="panel-heading spectrum-heading">
        <div>
          <h2 id="spectrum-title">Spectral profile</h2>
          <p>Measurements appear when a real observation is loaded.</p>
        </div>
        <span className="status-pill status-pill-muted">NO SPECTRUM</span>
      </div>
      <div
        className="spectrum-empty"
        role="img"
        aria-label="Empty spectral plot; no measurements are loaded"
      >
        <svg viewBox="0 0 720 116" preserveAspectRatio="none" aria-hidden="true">
          <path d="M44 12V91H705" className="spectrum-axis" />
          <path d="M44 31H705M44 51H705M44 71H705" className="spectrum-grid" />
          <path d="M176 12V91M308 12V91M440 12V91M572 12V91" className="spectrum-grid" />
          <text x="44" y="108">0.75 μm</text>
          <text x="666" y="108">5.0 μm</text>
          <text x="9" y="22">Flux</text>
        </svg>
        <div className="spectrum-empty-copy">
          <span className="empty-glyph" aria-hidden="true">∿</span>
          <span>No measurements loaded</span>
        </div>
      </div>
      <div className="spectrum-footnote">
        <span>WAVELENGTH</span>
        <span>Plot axes are a UI placeholder, not a measured spectrum.</span>
      </div>
    </section>
  );
}
