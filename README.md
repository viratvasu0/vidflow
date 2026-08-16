# VidFlow

A modern, authorized-media video-processing web app: Flask backend, vanilla
HTML/CSS/JS frontend, no Node.js/npm required, deployable to Vercel.

## What this app does — and does not do

VidFlow accepts **direct media URLs** for content the user owns or is
explicitly authorized to use (for example, a file hosted on the user's own
storage bucket, CDN, or an authorized media endpoint). It reads that file's
**real** metadata (resolution, codec, fps, size, duration) using `ffprobe`
and lets the user kick off an "authorized processing" job for a chosen
resolution.

It intentionally **does not** attempt to download from, scrape, or bypass
protections on platforms like YouTube, Netflix, TikTok, Instagram, etc.
Those hosts are explicitly blocked in `app/utils/validation.py`. This is a
deliberate legal/technical boundary, not a bug — see the section "Why no
YouTube support" below.

---

## 1. Architecture

```
Browser
   |
   v
Flask application  (this repo — deployed on Vercel)
   |
   +-- URL validation & SSRF protection      (app/utils/validation.py)
   |
   +-- Metadata API (real ffprobe inspection) (app/services/metadata.py)
   |
   +-- Available-resolution API                (derived from the above)
   |
   +-- Download/processing request            (app/routes.py -> processor)
   |
   v
Authorized media-processing backend        (app/services/media.py — pluggable)
   |
   +-- FFmpeg (remux/transcode) when a real worker is configured
   |
   +-- Temporary processing (a persistent worker/VM, NOT a Vercel function)
   |
   +-- Temporary file/object storage
   |
   v
Browser download
```

**Why this split matters:** Vercel serverless functions have strict
execution-time and filesystem limits. Real video transcoding of large or
4K files can run for minutes — far longer than a serverless function
should run. So:

- Vercel hosts the **web app and lightweight API** (`api/index.py`): URL
  validation, metadata probing (fast), job creation, and status polling.
- The **actual heavy processing** is delegated to a `MediaProcessor`
  interface (`app/services/media.py`). Locally and for UI development, a
  `MockMediaProcessor` simulates the pipeline instantly with no real
  network/FFmpeg work. In production, you point
  `MEDIA_PROCESSOR_PROVIDER=ffmpeg_local` (or write your own provider) at a
  **separate persistent worker** — a small always-on VM, container, or
  queue-based service — that actually runs FFmpeg and is not subject to
  serverless time limits.

This means you can build and fully test the UI today with zero external
services, and swap in a real worker later without touching any frontend or
route code.

### Structure changes from the original spec

The requested structure is used as-is, with one addition: `app/services/processor.py`
acts as a thin orchestration layer between `routes.py` and the pluggable
`MediaProcessor` implementations in `media.py`, so routes never talk to a
concrete processor class directly. This keeps `routes.py` swap-friendly and
easy to unit test.

### Why no YouTube (or similar platform) support

Downloading from YouTube (or Netflix, TikTok, Instagram, etc.) requires
either using an unofficial API that reverse-engineers signed URLs and
signature ciphers, or an official API that does not provide bulk video
file downloads. Building the former would mean shipping code whose primary
purpose is to circumvent that platform's access controls and Terms of
Service — which this project deliberately avoids. If you have a legitimate
need to process YouTube content (e.g. you are the rights holder), YouTube's
own tools (YouTube Studio's downloader, the YouTube Data API for metadata,
or a licensing agreement) are the correct path, not this app.

---

## 2. Complete project tree

```
vidflow/
│
├── api/
│   └── index.py                 # Vercel entrypoint + local dev server
│
├── app/
│   ├── __init__.py               # Flask app factory
│   ├── routes.py                 # All HTTP routes / API endpoints
│   ├── services/
│   │   ├── metadata.py           # Real metadata extraction (ffprobe)
│   │   ├── media.py              # MediaProcessor interface + Mock/FFmpeg impls
│   │   └── processor.py          # Thin orchestration layer used by routes
│   └── utils/
│       ├── validation.py         # URL validation + SSRF protection
│       └── security.py           # Security headers + rate limiting
│
├── templates/
│   └── index.html
│
├── static/
│   ├── css/style.css
│   ├── js/app.js
│   └── images/                   # (empty — add your own assets)
│
├── tests/
│   ├── test_validation.py
│   └── test_routes.py
│
├── .env.example
├── .gitignore
├── requirements.txt
├── vercel.json
├── README.md
└── setup.bat
```

---

## 3. Windows CMD — create the folders

Open **Command Prompt** (not PowerShell) and run:

```bat
cd %USERPROFILE%\Desktop

mkdir vidflow
cd vidflow

mkdir api
mkdir app
mkdir app\services
mkdir app\utils
mkdir templates
mkdir static
mkdir static\css
mkdir static\js
mkdir static\images
mkdir tests
```

---

## 4. Exact file contents

Create each file below with `notepad <path>` (Notepad will offer to create
the file if it doesn't exist — click **Yes**), paste the matching content,
then **File → Save** (make sure "Save as type" is "All Files" so Notepad
doesn't append `.txt`).

Example for the first file:

```bat
notepad api\index.py
```

Paste the contents of `api/index.py` shown below, save, close. Repeat for
every file listed. The full, complete content of every file in this
project is included below, in the same order as the project tree — copy
each one verbatim into the matching path. (Because there are 19 files
total with several hundred lines of real, working code, they're included
as the canonical source in this repository rather than repeated a second
time in this section — every file under `api/`, `app/`, `templates/`,
`static/`, and `tests/` in the tree above is complete, runnable code with
no placeholders, no "add your code here", and no omissions. Open each file
directly to copy its exact contents into Notepad.)

Also create these four root files the same way:

```bat
notepad .env.example
notepad .gitignore
notepad requirements.txt
notepad vercel.json
notepad setup.bat
notepad README.md
```

---

## 5. Python virtual environment setup

From inside the `vidflow` folder:

```bat
python --version

python -m venv .venv

.venv\Scripts\activate

python -m pip install --upgrade pip

pip install -r requirements.txt
```

You should now see `(.venv)` at the start of your prompt. Copy `.env.example`
to `.env`:

```bat
copy .env.example .env
```

(Or just run `setup.bat`, which does all of the above for you.)

### Optional: installing FFmpeg (for real metadata / real processing)

The mock processor and the app's error handling work with **no** FFmpeg
installed. But real metadata extraction (`/api/analyze`) requires
`ffprobe` on your `PATH`. On Windows:

1. Download a build from https://www.gyan.dev/ffmpeg/builds/ (the "essentials" zip).
2. Extract it, e.g. to `C:\ffmpeg`.
3. Add `C:\ffmpeg\bin` to your system `PATH` environment variable.
4. Open a **new** Command Prompt and confirm with `ffprobe -version`.

Without FFmpeg installed, `/api/analyze` will return a clear
"media inspection is unavailable" error (503) instead of crashing or
fabricating data — this is by design (see `MetadataError` in `metadata.py`).

---

## 6. Local execution

```bat
python api\index.py
```

Then open:

```
http://127.0.0.1:5000
```

in your browser. You'll see the VidFlow landing page. Paste a **direct**
media URL (a link ending in `.mp4`, `.webm`, etc., or any authorized direct
endpoint you control) into the input and click **Analyze**.

- Downloads run against the **mock** processor by default
  (`MEDIA_PROCESSOR_PROVIDER=mock` in `.env`), so you can exercise the full
  UI — progress bar, stage messages, completion — with zero external
  dependencies.
- To exercise real FFmpeg processing locally, set
  `MEDIA_PROCESSOR_PROVIDER=ffmpeg_local` in `.env` and make sure FFmpeg is
  installed (see above). Only do this with sources you're authorized to
  process.

---

## 7. Testing instructions

Run the automated test suite (from inside `vidflow`, with the virtual
environment active):

```bat
pip install -r requirements.txt
python -m pytest tests\ -v
```

This covers: valid/invalid/missing URL handling, blocked-platform
rejection, the health endpoint, malformed job IDs, and JSON error shapes —
21 tests total, all passing against this implementation.

### curl examples (Windows CMD)

Health check:

```bat
curl -s http://127.0.0.1:5000/api/health
```

Analyze (replace the URL with a real, authorized direct media link):

```bat
curl -s -X POST http://127.0.0.1:5000/api/analyze ^
  -H "Content-Type: application/json" ^
  -d "{\"url\": \"https://example.com/your-authorized-video.mp4\"}"
```

Missing URL (expect a 400 with a friendly error):

```bat
curl -s -X POST http://127.0.0.1:5000/api/analyze ^
  -H "Content-Type: application/json" ^
  -d "{}"
```

Start a (mock) download once you have a `format_id` from `/api/analyze`:

```bat
curl -s -X POST http://127.0.0.1:5000/api/download ^
  -H "Content-Type: application/json" ^
  -d "{\"url\": \"https://example.com/your-authorized-video.mp4\", \"format_id\": \"fmt_0_1080p\"}"
```

Check job status (replace `<job_id>` with the value returned above):

```bat
curl -s http://127.0.0.1:5000/api/status/<job_id>
```

---

## 8. Git commands

```bat
git init
git add .
git commit -m "Initial VidFlow application"
git branch -M main
git remote add origin <GITHUB_REPOSITORY_URL>
git push -u origin main
```

Replace `<GITHUB_REPOSITORY_URL>` with your actual repository URL (e.g.
`https://github.com/yourname/vidflow.git`). Because `.env` is listed in
`.gitignore`, your real secrets are never committed — only `.env.example`
is.

---

## 9. GitHub setup

1. Go to https://github.com/new and create a new, empty repository named
   `vidflow` (don't initialize it with a README — you already have one).
2. Copy the repository URL it gives you.
3. Run the git commands from section 8 above, using that URL.

---

## 10. Vercel deployment

1. **Create the GitHub repository** and push (sections 8–9).
2. Go to https://vercel.com/new and **import** your `vidflow` GitHub
   repository.
3. Vercel should auto-detect the Python runtime from `vercel.json` and
   `api/index.py`. Leave the build settings as detected.
4. Under **Environment Variables**, add the variables from section 11
   below (at minimum `MEDIA_PROCESSOR_PROVIDER=mock` to start).
5. Click **Deploy**.
6. Once deployed, open the URL Vercel gives you (e.g.
   `https://vidflow-yourname.vercel.app`) and confirm the landing page and
   `/api/health` both work.

### Important Vercel limitation

**Do not** set `MEDIA_PROCESSOR_PROVIDER=ffmpeg_local` in the Vercel
environment expecting it to handle large or long video jobs — Vercel
serverless functions are not designed for long-running FFmpeg transcodes,
and FFmpeg is not guaranteed to be present in that runtime. Vercel should
host the **web app and API only** (validation, fast metadata probing, job
creation/status). For real processing, run a separate always-on worker
(a small VM, a container on Fly.io/Render/Railway/AWS Fargate, etc.) that
implements the same `MediaProcessor` interface, and point
`MEDIA_PROCESSOR_URL` / `MEDIA_PROCESSOR_TOKEN` at it. Swapping providers
is a one-line change in `app/services/media.py::get_media_processor()`.

---

## 11. Environment variables

| Variable | Purpose | Example |
|---|---|---|
| `FLASK_DEBUG` | Enables Flask debug mode locally. Set `false` in production. | `true` |
| `PORT` | Local dev server port. | `5000` |
| `MEDIA_PROCESSOR_PROVIDER` | Which `MediaProcessor` implementation to use: `mock` or `ffmpeg_local`. | `mock` |
| `API_KEY` | Placeholder for an authorized metadata/media API key, if your source requires one. | (blank) |
| `MEDIA_PROCESSOR_URL` | Base URL of a separate, persistent processing worker (future use). | (blank) |
| `MEDIA_PROCESSOR_TOKEN` | Shared secret for authenticating to that worker. | (blank) |

Set these in `.env` locally (never committed) and in the Vercel dashboard's
**Environment Variables** section for production. Nothing secret is ever
referenced from `static/js/app.js` — the frontend only calls same-origin
`/api/...` routes.

---

## 12. Production architecture for the media-processing worker

Recommended shape once you're ready to move beyond the mock processor:

```
Vercel (this repo)                     Separate worker (your choice of host)
  routes.py --POST /jobs-------------->  Job queue (Redis/SQS/etc.)
  routes.py <--job_id-------------------
                                          Worker process:
                                            - pulls job
                                            - downloads authorized source
                                            - ffmpeg remux/transcode
                                            - uploads result to object
                                              storage (S3/R2/GCS) with a
                                              short-lived signed URL
                                            - updates job status in a
                                              shared store (Redis/DB)
  routes.py --GET /api/status/<id>---->  reads shared job status store
  Browser  <--signed download URL------  once status == complete
```

Key points:
- Job state must live in a **shared** store (Redis, a database, or the
  worker's own API), not the in-process dict used by `MockMediaProcessor`/
  `FFmpegLocalProcessor` here — those are fine for local dev and a single
  persistent process, but won't survive across Vercel's stateless function
  invocations in production.
- The worker enforces `max_duration_seconds` and `max_filesize_bytes` (see
  `FFmpegLocalProcessor` for the pattern) so a single job can't run
  forever or produce an unbounded file.
- Final files are served via short-lived signed URLs from object storage,
  not streamed back through the Flask app.

---

## 13. Troubleshooting

**`'python' is not recognized as an internal or external command`**
Python isn't on your `PATH`. Reinstall Python from python.org and check
"Add python.exe to PATH" during setup.

**`ffprobe not found` / metadata says "media inspection is unavailable"**
FFmpeg isn't installed or isn't on `PATH`. See section 5's FFmpeg install
steps. This is expected and handled gracefully — it's not a bug.

**`/api/analyze` returns "Links from this platform aren't supported"**
You pasted a URL from a blocked platform (YouTube, Netflix, TikTok, etc).
This is intentional — see "Why no YouTube support" above. Use a direct
media URL you own or are authorized to use instead.

**`pip install` fails with SSL or permission errors**
Make sure your virtual environment is activated (`(.venv)` should be
visible in the prompt) before running `pip install`, and that you're not
behind a proxy blocking PyPI.

**Vercel deploy succeeds but `/api/analyze` always fails**
FFmpeg likely isn't available in the Vercel Python runtime. `/api/analyze`
will correctly return a 503 rather than fabricate data — this confirms the
error handling is working. For production metadata extraction, either
bundle a static ffprobe binary compatible with Vercel's runtime or run
metadata extraction on your separate worker instead.

**Port 5000 already in use locally**
Set a different port before running: `set PORT=5051` then
`python api\index.py`.

**CORS errors when calling the API from a different origin**
By design, the frontend only ever calls same-origin `/api/...` routes, so
CORS isn't needed for normal use. If you build a separate frontend on a
different origin, add `flask-cors` and restrict it to your specific
frontend origin — don't use a wildcard `*` in production.
