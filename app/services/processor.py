"""
Orchestration layer between routes and the pluggable MediaProcessor.

Keeps route handlers thin: this module holds the single shared processor
instance and exposes small, route-friendly functions.
"""

from __future__ import annotations

from app.services.media import Job, get_media_processor

_processor = get_media_processor()


def start_download_job(source_url: str, format_id: str, format_meta: dict) -> Job:
    return _processor.start_job(source_url, format_id, format_meta)


def get_job_status(job_id: str) -> Job | None:
    return _processor.get_job(job_id)
