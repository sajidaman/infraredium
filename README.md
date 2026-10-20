# Infraredium — Explore the Invisible Universe

Infraredium is a browser-based workspace for exploring infrared sky-survey data. It includes a responsive Next.js interface and a separate FastAPI backend. The sky viewport is a **synthetic demonstration**, not a SPHEREx observation. The backend searches the public IRSA SPHEREx archive for real observation metadata; metadata lookup, FITS cutouts, image visualization, and pixel inspection remain unimplemented and return explicit `501 Not Implemented` responses.

## Requirements

- Node.js 20 or later and npm
- Python 3.11 or later

## Run locally

1. Copy `.env.example` to `.env` and install the frontend:

   ```powershell
   Copy-Item .env.example .env
   npm install
   ```

2. In one terminal, start the frontend:

   ```powershell
   npm run dev
   ```

   Open `http://localhost:3000`.
3. In a second terminal from the repository root, create a virtual environment, install the backend, and start the API:

   ```powershell
   py -3.11 -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r backend\requirements.txt
   python -m uvicorn app.main:app --app-dir backend --reload --port 8000
   ```

   The API health check is at `http://localhost:8000/health`; interactive API documentation is at `http://localhost:8000/docs`.

`NEXT_PUBLIC_API_BASE_URL` is the browser-facing backend origin and defaults to `http://localhost:8000`. `CORS_ORIGINS` is the backend's JSON-encoded allowlist and defaults to `["http://localhost:3000"]`. No IRSA credentials are required; the backend uses a fixed official endpoint and never accepts an upstream URL from the browser.

## Project layout

```text
app/                    Next.js App Router entry point and global styles
components/              Interactive workspace and visualization surfaces
backend/app/             FastAPI routes, settings, and scientific helpers
backend/tests/            API contract and WCS tests
```

## Current API contract

| Method and path | Purpose | Current behavior |
| --- | --- | --- |
| `GET /health` | Backend readiness | Returns `archive: on_demand`; does not make an archive request |
| `GET /api/v1/observations/search` | Search public SPHEREx observations by sky position | Live IRSA SIA2 query; validates coordinates, radius (0–1° exclusive/inclusive), and result count (1–100) |
| `GET /api/v1/observations/{observation_id}` | Observation metadata | `501`; not implemented |
| `GET /api/v1/observations/{observation_id}/cutout` | Request a bounded sky cutout | `501`; not implemented |
| `GET /api/v1/observations/{observation_id}/visualization` | Request one FITS image extension | `501`; not implemented |
| `GET /api/v1/observations/{observation_id}/pixel` | Inspect a pixel in a named extension | `501`; not implemented |

The search returns only archive-provided identifiers, product URLs, and metadata fields that the service supplies. It requests CSV metadata only, caps the response at 4 MiB, uses 5-second connection and 15-second read timeouts, and does not download FITS products. Invalid search parameters return `422`, upstream timeouts return `504`, and upstream HTTP/response failures return `502`; a valid search with no matches returns `200` with an empty `results` list. The WCS helper functions use Astropy and zero-based pixel coordinates; their synthetic-header tests do not imply that any survey FITS file is loaded. FITS extensions such as calibrated flux, variance, and quality flags remain separate future work.

## Verified IRSA service

The backend's fixed upstream is the official IRSA Simple Image Access v2 service at [`https://irsa.ipac.caltech.edu/SIA`](https://irsa.ipac.caltech.edu/SIA). Requests use `POS=CIRCLE <ra> <dec> <radius>`, `INSTRUMENT=SPHEREx`, `MAXREC`, and `RESPONSEFORMAT=csv`. The CSV field mapping is based on the service's returned columns, including `obs_id`, `obs_publisher_did`, `access_url`, `energy_bandpassname`, `em_min`, `em_max`, `s_ra`, `s_dec`, `t_min`, `t_max`, `t_exptime`, and `obs_release_date`; optional/missing columns are not synthesized.

Official references:

- [IRSA SIA2 service endpoint and service metadata](https://irsa.ipac.caltech.edu/SIA)
- [IRSA SPHEREx data documentation](https://irsa.ipac.caltech.edu/data/SPHEREx/docs/)
- [IVOA Simple Image Access specification](https://www.ivoa.net/documents/SIA/)

## Tests and production build

```powershell
npm test
npm run build
```

Backend tests (from the repository root with the virtual environment active):

```powershell
$env:PYTHONPATH = "backend"
python -m pytest backend\tests -q
```

Backend tests mock IRSA and do not depend on live archive availability. The current environment may need Python 3.11+ and the listed requirements installed before they can run.

## Deployment

### Frontend on Vercel

Import this GitHub repository in Vercel, select the Next.js framework preset, and set the project root to the repository root. Configure `NEXT_PUBLIC_API_BASE_URL` to the HTTPS URL of the separately deployed backend. Deploy previews should use a staging backend URL. Do not place server-only archive configuration or credentials in `NEXT_PUBLIC_*` variables.

### Python backend

Deploy `backend/` as a separate Python 3.11+ service. Install `backend/requirements.txt`, then run:

```sh
uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000
```

Configure `CORS_ORIGINS` with the exact frontend origins. No archive credentials or configurable upstream URL are used. Add a platform health check for `/health`. Search is implemented; metadata retrieval, FITS cutouts, visualization, and pixel inspection remain `501`.

### GitHub

Push the repository to GitHub and use the included Actions workflow for frontend tests/build and backend tests. Add repository environments or deployment workflows only after choosing hosting for the Python service; do not store archive credentials in source control.

## Design direction

The interface treats the sky as a scientific workspace rather than a marketing page: a dense, midnight-blue instrument surface, thin coordinate-grid lines, restrained infrared accents, and persistent provenance/status labels. The first screen centers a clearly synthetic sky viewport between IRSA search controls and an observation-inspector rail. Search controls query the backend; the viewport, display toggles, and wavelength control remain interface previews and do not render or analyze survey data.
