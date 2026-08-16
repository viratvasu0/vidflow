from __future__ import annotations

from flask import Blueprint, jsonify, render_template, request

from app.services.media import JobStatus
from app.services.metadata import MetadataError, fetch_metadata
from app.services.processor import get_job_status, start_download_job
from app.utils.security import analyze_limiter, client_key, download_limiter
from app.utils.validation import validate_format_id, validate_job_id, validate_media_url

bp = Blueprint("main", __name__)

MAX_JSON_BODY_BYTES = 8 * 1024  # analyze/download bodies are tiny; reject anything huge


def _bad_request(message: str, status: int = 400):
    return jsonify({"success": False, "error": message}), status


@bp.get("/")
def index():
    return render_template("index.html")


@bp.get("/api/health")
def health():
    return jsonify({"success": True, "status": "ok"})


@bp.post("/api/analyze")
def analyze():
    if request.content_length and request.content_length > MAX_JSON_BODY_BYTES:
        return _bad_request("Request body too large.", 413)

    if not request.is_json:
        return _bad_request("Expected a JSON body with a 'url' field.")

    key = client_key(request)
    if not analyze_limiter.allow(key):
        resp = jsonify({
            "success": False,
            "error": "Too many requests. Please slow down and try again shortly.",
        })
        resp.headers["Retry-After"] = str(analyze_limiter.retry_after(key))
        return resp, 429

    data = request.get_json(silent=True) or {}
    raw_url = data.get("url", "")

    result = validate_media_url(raw_url)
    if not result.ok:
        return _bad_request(result.reason or "Invalid URL.")

    try:
        metadata = fetch_metadata(result.normalized_url)
    except MetadataError as exc:
        return _bad_request(exc.message, exc.status_code)
    except Exception:
        return _bad_request("An unexpected error occurred while analyzing the video.", 500)

    if not metadata.formats:
        return _bad_request("No supported resolutions were found for this source.", 422)

    return jsonify(metadata.to_dict())


@bp.post("/api/download")
def download():
    if request.content_length and request.content_length > MAX_JSON_BODY_BYTES:
        return _bad_request("Request body too large.", 413)

    if not request.is_json:
        return _bad_request("Expected a JSON body with 'url' and 'format_id'.")

    key = client_key(request)
    if not download_limiter.allow(key):
        resp = jsonify({
            "success": False,
            "error": "Too many download requests. Please wait a moment and try again.",
        })
        resp.headers["Retry-After"] = str(download_limiter.retry_after(key))
        return resp, 429

    data = request.get_json(silent=True) or {}
    raw_url = data.get("url", "")
    format_id = data.get("format_id", "")
    format_meta = data.get("format", {}) if isinstance(data.get("format"), dict) else {}

    result = validate_media_url(raw_url)
    if not result.ok:
        return _bad_request(result.reason or "Invalid URL.")

    if not validate_format_id(format_id):
        return _bad_request("Invalid or missing format selection.")

    job = start_download_job(result.normalized_url, format_id, format_meta)

    if job.status == JobStatus.FAILED:
        return _bad_request(job.error or "Processing failed.", 500)

    return jsonify({
        "success": True,
        "job_id": job.id,
        "status": job.status.value,
        "progress": job.progress,
        "message": job.message,
    })


@bp.get("/api/status/<job_id>")
def status(job_id: str):
    if not validate_job_id(job_id):
        return _bad_request("Invalid job id.", 404)

    job = get_job_status(job_id)
    if job is None:
        return _bad_request("Job not found. It may have expired.", 404)

    payload = {
        "success": True,
        "job_id": job.id,
        "status": job.status.value,
        "progress": job.progress,
        "message": job.message,
    }
    if job.status == JobStatus.FAILED:
        payload["error"] = job.error or "Processing failed."
    return jsonify(payload)



