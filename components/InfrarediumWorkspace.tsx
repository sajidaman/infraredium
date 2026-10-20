"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import FitsImageViewer from "@/components/FitsImageViewer";
import SkyViewport from "@/components/SkyViewport";
import SpectralPlot from "@/components/SpectralPlot";
import {
  searchObservations,
  type ObservationRecord,
  type ObservationSearchParams,
} from "@/lib/api";

type Section = "Sky Explorer" | "Data" | "Science Lab";

const sections: Section[] = ["Sky Explorer", "Data", "Science Lab"];
const MAX_SEARCH_RESULTS = 100;

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "validation-error"; message: string }
  | { status: "service-error"; message: string }
  | { status: "success"; data: Awaited<ReturnType<typeof searchObservations>> };

function safeProductUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname === "irsa.ipac.caltech.edu" &&
      (url.port === "" || url.port === "443") &&
      !url.username &&
      !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

function DataWorkspace() {
  return (
    <div className="subpage-wrap">
      <div className="subpage-title">
        <div>
          <h1>Data access</h1>
          <p>Search public SPHEREx observations by sky position.</p>
        </div>
        <span className="status-pill status-pill-warning">
          <i /> SEARCH ONLY
        </span>
      </div>
      <div className="data-service">
        <div className="service-mark" aria-hidden="true">SIA²</div>
        <div className="service-copy">
          <h2>IRSA spatial search</h2>
          <p>
            Search the public IRSA SIA2 service for SPHEREx products. Search
            results include archive-provided metadata; FITS files are not
            downloaded by a search.
          </p>
          <code>GET /api/v1/observations/search</code>
        </div>
        <span className="service-state">FITS / ANALYSIS NOT IMPLEMENTED</span>
      </div>
      <div className="data-contract" aria-label="Planned data endpoints">
        <div className="contract-title">
          <h2>Backend surface</h2>
          <span>METADATA AND FITS ENDPOINTS · CURRENTLY 501</span>
        </div>
        <div className="contract-row"><code>GET</code><span>Observation metadata</span><code>/observations/{`{id}`}</code></div>
        <div className="contract-row"><code>GET</code><span>Bounded FITS cutout</span><code>/observations/{`{id}`}/cutout</code></div>
        <div className="contract-row"><code>GET</code><span>Flux / variance / quality visualization</span><code>/observations/{`{id}`}/visualization</code></div>
        <div className="contract-row"><code>GET</code><span>Pixel inspection</span><code>/observations/{`{id}`}/pixel</code></div>
      </div>
      <p className="data-note">
        Archive search is live through IRSA SIA2. Observation details, FITS
        cutouts, visualization, and scientific analysis are not implemented.
      </p>
    </div>
  );
}

function ScienceWorkspace() {
  return (
    <div className="science-page">
      <div className="subpage-title">
        <div>
          <h1>Science lab</h1>
          <p>Tools for examining measurements from a selected observation.</p>
        </div>
        <span className="status-pill status-pill-muted">AWAITING DATA</span>
      </div>
      <SpectralPlot />
      <section className="science-note">
        <span className="science-note-icon" aria-hidden="true">λ</span>
        <div>
          <h2>Analysis starts with provenance</h2>
          <p>
            A real spectrum, observation identifier, and FITS extension will be
            required before scientific values can be displayed here.
          </p>
        </div>
      </section>
    </div>
  );
}

export default function InfrarediumWorkspace() {
  const [activeSection, setActiveSection] = useState<Section>("Sky Explorer");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [ra, setRa] = useState("");
  const [dec, setDec] = useState("");
  const [radius, setRadius] = useState("0.1");
  const [resultLimit, setResultLimit] = useState("25");
  const [searchState, setSearchState] = useState<SearchState>({ status: "idle" });
  const [searchParams, setSearchParams] = useState<ObservationSearchParams | null>(
    null,
  );
  const [selectedObservation, setSelectedObservation] =
    useState<ObservationRecord | null>(null);
  const [notice, setNotice] = useState("");
  const [wavelength, setWavelength] = useState(2.5);
  const [showGrid, setShowGrid] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const activeSearch = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      activeSearch.current?.abort();
    },
    [],
  );

  async function runSearch(params: ObservationSearchParams) {
    activeSearch.current?.abort();
    const controller = new AbortController();
    activeSearch.current = controller;
    setSearchParams(params);
    setSelectedObservation(null);
    setSearchState({ status: "loading" });
    try {
      const data = await searchObservations(params, controller.signal);
      if (!controller.signal.aborted) setSearchState({ status: "success", data });
    } catch (error) {
      if (!controller.signal.aborted) {
        setSearchState({
          status: "service-error",
          message:
            error instanceof TypeError
              ? "Could not reach the Infraredium API. Check that the backend is running, then retry."
              : error instanceof Error
                ? error.message
                : "The Infraredium API request failed. Try again.",
        });
      }
    }
  }

  function handleCoordinateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raDegrees = Number(ra);
    const decDegrees = Number(dec);
    const radiusDegrees = Number(radius);
    const maxResults = Number(resultLimit);
    if (
      !ra.trim() ||
      !dec.trim() ||
      !Number.isFinite(raDegrees) ||
      raDegrees < 0 ||
      raDegrees >= 360 ||
      !Number.isFinite(decDegrees) ||
      decDegrees < -90 ||
      decDegrees > 90 ||
      !Number.isFinite(radiusDegrees) ||
      radiusDegrees <= 0 ||
      radiusDegrees > 1 ||
      !Number.isInteger(maxResults) ||
      maxResults < 1 ||
      maxResults > MAX_SEARCH_RESULTS
    ) {
      activeSearch.current?.abort();
      setSearchParams(null);
      setSelectedObservation(null);
      setSearchState({
        status: "validation-error",
        message:
          "Enter RA from 0° to less than 360°, Dec from −90° to +90°, a radius above 0° and no more than 1°, and a result limit from 1 to 100.",
      });
      return;
    }
    void runSearch({
      ra: raDegrees,
      dec: decDegrees,
      radius: radiusDegrees,
      limit: maxResults,
    });
  }

  return (
    <div className="app-frame min-h-screen">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Infraredium home">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 34 34" fill="none">
              <circle cx="17" cy="17" r="11.5" />
              <ellipse cx="17" cy="17" rx="15" ry="6.5" transform="rotate(-32 17 17)" />
              <circle className="brand-star" cx="25.4" cy="9.6" r="1.8" />
            </svg>
          </span>
          <span className="brand-word">INFRAREDIUM<span>.</span></span>
          <span className="brand-divider" />
          <span className="brand-product">SPHEREx EXPLORER</span>
        </a>

        <nav className="main-nav" aria-label="Main navigation">
          {sections.map((section) => (
            <button
              key={section}
              type="button"
              className={`nav-item${activeSection === section ? " is-active" : ""}`}
              aria-current={activeSection === section ? "page" : undefined}
              onClick={() => {
                setActiveSection(section);
                setNotice("");
              }}
            >
              {section}
            </button>
          ))}
        </nav>

        <div className="topbar-right">
          <span className="connection-status"><i /> SKY PREVIEW</span>
          {activeSection === "Sky Explorer" && (
            <button
              className="icon-button mobile-sidebar-toggle"
              type="button"
              aria-label={sidebarOpen ? "Collapse search sidebar" : "Expand search sidebar"}
              onClick={() => setSidebarOpen((open) => !open)}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14" /></svg>
            </button>
          )}
          <span className="version-label">v0.1</span>
        </div>
      </header>

      {activeSection === "Sky Explorer" ? (
        <main className={`explorer-layout${sidebarOpen ? " controls-open" : " sidebar-collapsed"}`}>
          <aside className="search-sidebar" aria-label="Sky explorer controls">
            <div className="sidebar-header">
              <div>
                <span className="section-index">WORKSPACE</span>
                <h1>Sky Explorer</h1>
              </div>
              <button
                className="icon-button sidebar-toggle"
                type="button"
                aria-label="Collapse search sidebar"
                onClick={() => setSidebarOpen(false)}
              >
                <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12 4-6 6 6 6" /></svg>
              </button>
            </div>

            <form
              id="archive-search-form"
              className="control-section"
              noValidate
              onSubmit={handleCoordinateSubmit}
            >
              <div className="control-title">
                <span className="control-icon coordinate-icon" aria-hidden="true">⌖</span>
                <h2>Coordinates</h2>
              </div>
              <label className="field-label" htmlFor="ra-input">
                Right ascension <span>RA · DEGREES</span>
              </label>
              <input
                id="ra-input"
                className="text-input coordinate-input"
                value={ra}
                onChange={(event) => setRa(event.target.value)}
                type="number"
                min="0"
                max="359.999999999"
                step="any"
                placeholder="0° to <360°"
                required
                autoComplete="off"
                aria-invalid={searchState.status === "validation-error"}
                aria-describedby="coordinate-help"
              />
              <label className="field-label" htmlFor="dec-input">
                Declination <span>DEC · DEGREES</span>
              </label>
              <input
                id="dec-input"
                className="text-input coordinate-input"
                value={dec}
                onChange={(event) => setDec(event.target.value)}
                type="number"
                min="-90"
                max="90"
                step="any"
                placeholder="−90° to +90°"
                required
                autoComplete="off"
                aria-invalid={searchState.status === "validation-error"}
                aria-describedby="coordinate-help"
              />
              <p className="control-hint" id="coordinate-help">
                RA 0° to &lt;360° · Dec −90° to +90°
              </p>
              <button
                className="primary-button"
                type="submit"
                disabled={searchState.status === "loading"}
              >
                {searchState.status === "loading" ? "Searching IRSA…" : "Search SPHEREx archive"}
                <span aria-hidden="true">↗</span>
              </button>
            </form>

            <section className="control-section">
              <div className="control-title">
                <span className="control-icon archive-icon" aria-hidden="true">⌕</span>
                <h2>Search bounds</h2>
              </div>
              <label className="field-label" htmlFor="search-radius">
                Search radius <span>DEGREES · MAX 1</span>
              </label>
              <div className="search-field">
                <input
                  id="search-radius"
                  form="archive-search-form"
                  className="text-input"
                  type="number"
                  min="0"
                  max="1"
                  step="any"
                  value={radius}
                  onChange={(event) => setRadius(event.target.value)}
                  aria-label="Search radius in degrees"
                  aria-describedby="search-radius-help"
                  aria-invalid={searchState.status === "validation-error"}
                />
              </div>
              <label className="field-label" htmlFor="result-limit">Maximum results</label>
              <select
                id="result-limit"
                form="archive-search-form"
                className="text-input result-limit-select"
                value={resultLimit}
                onChange={(event) => setResultLimit(event.target.value)}
                aria-invalid={searchState.status === "validation-error"}
              >
                <option value="10">10 records</option>
                <option value="25">25 records</option>
                <option value="50">50 records</option>
                <option value="100">100 records</option>
              </select>
              <p className="control-hint" id="search-radius-help">
                Public IRSA SIA2 · maximum radius 1 degree · results include metadata only
              </p>
            </section>

            <section className="control-section wavelength-section">
              <div className="control-title">
                <span className="control-icon wavelength-icon" aria-hidden="true">λ</span>
                <h2>Wavelength preview</h2>
                <span className="control-readout">{wavelength.toFixed(2)} μm</span>
              </div>
              <input
                className="wavelength-range"
                type="range"
                min="0.75"
                max="5"
                step="0.01"
                value={wavelength}
                aria-label="Wavelength interface preview"
                onChange={(event) => setWavelength(Number(event.target.value))}
              />
              <div className="range-labels"><span>0.75 μm</span><span>5.0 μm</span></div>
              <p className="control-hint">Control preview · no spectrum displayed</p>
            </section>

            <section className="control-section display-section">
              <div className="control-title">
                <span className="control-icon display-icon" aria-hidden="true">◫</span>
                <h2>Display</h2>
              </div>
              <label className="toggle-row">
                <span>Coordinate grid</span>
                <input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} />
                <i aria-hidden="true" />
              </label>
              <label className="toggle-row">
                <span>Field labels</span>
                <input type="checkbox" checked={showLabels} onChange={(event) => setShowLabels(event.target.checked)} />
                <i aria-hidden="true" />
              </label>
            </section>
            <div className="sidebar-foot">
              <span className="sidebar-foot-mark">i</span>
              <span>Synthetic sky preview only.<br />Archive searches use real IRSA metadata.</span>
            </div>
          </aside>

          <section className="workspace-main" aria-label="Sky visualization workspace">
            {!sidebarOpen && (
              <button
                className="collapsed-sidebar-button"
                type="button"
                onClick={() => setSidebarOpen(true)}
              >
                <span aria-hidden="true">☷</span> Controls
              </button>
            )}
            <div className="view-toolbar">
              <div className="view-title">
                <span className="live-indicator"><i /></span>
                <div>
                  <h2>All-sky preview</h2>
                  <span>Full-sky projection <b>·</b> Synthetic interface layer</span>
                </div>
              </div>
              <div className="view-actions">
                <span className="view-coordinate">{searchParams ? "SEARCH CENTER" : "NO SEARCH"}</span>
                <button type="button" className="square-tool" aria-label="Center view" onClick={() => setNotice("View is already centered on the synthetic preview.")}>
                  <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.5" /><circle cx="10" cy="10" r="2" /><path d="M10 1v3M10 16v3M1 10h3m12 0h3" /></svg>
                </button>
                {!sidebarOpen && (
                  <button type="button" className="square-tool" aria-label="Expand controls" onClick={() => setSidebarOpen(true)}>
                    <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 5h12M4 10h12M4 15h12" /></svg>
                  </button>
                )}
              </div>
            </div>
            <div className={`viewport-wrap${showGrid ? "" : " grid-hidden"}${showLabels ? "" : " labels-hidden"}`}>
              <SkyViewport />
            </div>
            <div className="viewport-caption">
              <span><i className="caption-dot" /> Synthetic preview field</span>
              <span>Demonstration only · not SPHEREx observations</span>
            </div>
            <section
              className="search-results"
              aria-labelledby="search-results-title"
              aria-live="polite"
              aria-busy={searchState.status === "loading"}
            >
              <div className="search-results-heading">
                <div>
                  <h2 id="search-results-title">IRSA archive results</h2>
                  {searchParams && (
                    <p>
                      Center {searchParams.ra.toFixed(4)}°, {searchParams.dec.toFixed(4)}°
                      {" · "}radius {searchParams.radius}°
                    </p>
                  )}
                </div>
                {searchState.status === "success" && (
                  <span className="status-pill status-pill-muted">
                    {searchState.data.count} RECORD{searchState.data.count === 1 ? "" : "S"}
                  </span>
                )}
              </div>
              {searchState.status === "idle" && (
                <p className="search-state-copy" role="status">
                  Enter sky coordinates and search to retrieve observation metadata from IRSA.
                </p>
              )}
              {searchState.status === "loading" && (
                <div className="search-state-loading" role="status">
                  <span className="loading-mark" aria-hidden="true" />
                  <span>Searching the public IRSA SPHEREx archive…</span>
                </div>
              )}
              {(searchState.status === "validation-error" ||
                searchState.status === "service-error") && (
                <p className="search-state-error" role="alert">
                  <strong>
                    {searchState.status === "validation-error"
                      ? "Check the search parameters"
                      : "Archive search failed"}
                  </strong>
                  {searchState.message}
                </p>
              )}
              {searchState.status === "success" &&
                (searchState.data.count === 0 ? (
                  <p className="search-state-empty" role="status">
                    No SPHEREx observations matched this search area.
                  </p>
                ) : (
                  <>
                    <p className="search-state-copy" role="status">
                      Showing {searchState.data.count} archive record
                      {searchState.data.count === 1 ? "" : "s"}
                      {searchState.data.truncated ? " (additional matches omitted)." : "."}
                      {" "}Selecting a record does not download its FITS product.
                    </p>
                    <ul className="search-result-list">
                      {searchState.data.results.map((record, index) => {
                        const productUrl = safeProductUrl(record.product_url);
                        const productName = productUrl
                          ? new URL(productUrl).pathname.split("/").pop()
                          : undefined;
                        const details = [
                          record.band,
                          record.instrument,
                          record.ra_deg !== undefined && record.dec_deg !== undefined
                            ? `${record.ra_deg.toFixed(4)}°, ${record.dec_deg.toFixed(4)}°`
                            : undefined,
                          record.exposure_seconds !== undefined
                            ? `${record.exposure_seconds.toFixed(1)} s`
                            : undefined,
                          record.start_time_mjd !== undefined
                            ? `MJD ${record.start_time_mjd}${record.end_time_mjd !== undefined ? `–${record.end_time_mjd}` : ""}`
                            : undefined,
                          record.release_date ? `Released ${record.release_date}` : undefined,
                        ].filter(Boolean);
                        return (
                          <li
                            className={`search-result${selectedObservation === record ? " is-selected" : ""}`}
                            key={record.publisher_id ?? record.product_url ?? `${record.observation_id}-${index}`}
                          >
                            <button
                              type="button"
                              className="search-result-select"
                              aria-pressed={selectedObservation === record}
                              onClick={() => setSelectedObservation(record)}
                            >
                              <strong>{record.observation_id}</strong>
                              {productName && <span>{productName}</span>}
                              {details.length > 0 && (
                                <small>{details.join(" · ")}</small>
                              )}
                              {record.proposal_title && (
                                <small>{record.proposal_title}</small>
                              )}
                            </button>
                            {productUrl && (
                              <a
                                href={productUrl}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`Open archive product for ${record.observation_id}`}
                              >
                                Product ↗
                              </a>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ))}
            </section>
            {notice && <p className="workspace-notice" role="status">{notice}</p>}

            <div className="lower-panels">
              <FitsImageViewer />
              <section className="target-panel" aria-labelledby="target-title">
                <div className="panel-heading">
                  <div>
                    <h2 id="target-title">Search center</h2>
                    <p>Requested coordinates · not a viewport measurement</p>
                  </div>
                  <span className="status-pill status-pill-muted">{searchParams ? "SEARCHED" : "NO SEARCH"}</span>
                </div>
                <div className="target-coordinates">
                  <span className="data-label">RIGHT ASCENSION</span>
                  <strong>{searchParams?.ra.toFixed(4) ?? "—"}</strong>
                  <span className="data-label">DECLINATION</span>
                  <strong>{searchParams?.dec.toFixed(4) ?? "—"}</strong>
                </div>
                <div className="target-metadata">
                  <div><span>Observation</span><strong>{selectedObservation?.observation_id ?? "Not selected"}</strong></div>
                  <div><span>Source details</span><strong>{selectedObservation?.band ?? selectedObservation?.collection ?? "Not available"}</strong></div>
                </div>
              </section>
            </div>
          </section>
          <aside className="inspector-sidebar" aria-label="Observation information">
            <div className="inspector-header">
              <div>
                <span className="section-index">INSPECTOR</span>
                <h2>Observation</h2>
              </div>
              <span className="inspector-dot" />
            </div>
            <div className="inspector-empty">
              {selectedObservation ? (
                <>
                  <div className="inspector-orbit" aria-hidden="true">
                    <span /><span /><span />
                  </div>
                  <h3>{selectedObservation.observation_id}</h3>
                  <p>
                    {selectedObservation.proposal_title ??
                      selectedObservation.target_name ??
                      "Archive-provided SPHEREx observation record."}
                  </p>
                </>
              ) : (
                <>
                  <div className="inspector-orbit" aria-hidden="true">
                    <span /><span /><span />
                  </div>
                  <h3>No observation selected</h3>
                  <p>Search results and archive-provided metadata appear here when you select a record.</p>
                </>
              )}
            </div>
            <div className="inspector-block">
              <div className="inspector-label"><span>SEARCH CENTER</span><span>DEGREES</span></div>
              <div className="inspector-value">
                {searchParams
                  ? `${searchParams.ra.toFixed(4)} / ${searchParams.dec.toFixed(4)}`
                  : "— / —"}
              </div>
            </div>
            <div className="inspector-block">
              <div className="inspector-label"><span>ARCHIVE RECORD</span><span>IRSA</span></div>
              <div className="inspector-placeholder">
                {selectedObservation?.band ?? selectedObservation?.instrument ?? "Select a search result"}
              </div>
            </div>
            <div className="inspector-block">
              <div className="inspector-label"><span>OBSERVATION METADATA</span></div>
              <div className="inspector-placeholder">
                {selectedObservation?.collection ??
                  selectedObservation?.data_product_type ??
                  "Only supplied archive fields are shown"}
              </div>
              {safeProductUrl(selectedObservation?.product_url) && (
                <a
                  className="inspector-product-link"
                  href={safeProductUrl(selectedObservation?.product_url)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open archive product ↗
                </a>
              )}
            </div>
            <div className="inspector-footer">
              <span className="status-line"><i /> IRSA SIA2 · METADATA SEARCH</span>
              <p>Archive search does not download or render FITS products.</p>
            </div>
          </aside>
        </main>
      ) : activeSection === "Data" ? (
        <main className="subpage-main"><DataWorkspace /></main>
      ) : (
        <main className="subpage-main"><ScienceWorkspace /></main>
      )}
      <footer className="app-footer">
        <span>Infraredium <b>·</b> Explore the invisible universe.</span>
        <span>IRSA metadata search <b>·</b> FITS not loaded</span>
      </footer>
      <div className="screen-reader-status" aria-live="polite" aria-atomic="true">
        {notice}
      </div>
    </div>
  );
}
