"""
Media processing provider interface.

This module defines an abstract interface for "authorized media processing"
(fetching an authorized source, optionally combining separate video/audio
streams with FFmpeg, and producing a downloadable file) plus:

  - `MockMediaProcessor`: a fast, local, no-network implementation used for
    UI development and automated tests. It simulates the processing stages
    without doing any real network access or long-running work, so you can
    build/test the full UI on a laptop with no external worker running.

  - `FFmpegLocalProcessor`: a reference implementation that actually shells
    out to FFmpeg. It's intended for a persistent worker process (NOT for
    a Vercel serverless function — see README/architecture notes), because
    real transcoding/remuxing of large files is long-running and exceeds
    serverless execution limits.

Swap providers via the MEDIA_PROCESSOR_PROVIDER environment variable
without changing any route code.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
import time
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from threading import Lock


class JobStatus(str, Enum):
    QUEUED = "queued"
    PREPARING = "preparing"
    FETCHING = "fetching_media"
    PROCESSING = "processing"
    COMBINING = "combining_streams"
    FINALIZING = "preparing_download"
    COMPLETE = "complete"
    FAILED = "failed"


@dataclass
class Job:
    id: str
    status: JobStatus = JobStatus.QUEUED
    progress: int = 0
    message: str = "Queued"
    output_path: str | None = None
    error: str | None = None
    created_at: float = field(default_factory=time.time)


class MediaProcessor(ABC):
    """Interface every media-processing backend must implement."""

    @abstractmethod
    def start_job(self, source_url: str, format_id: str, format_meta: dict) -> Job:
        ...

    @abstractmethod
    def get_job(self, job_id: str) -> Job | None:
        ...


class _InMemoryJobStore:
    """Simple thread-safe in-memory job store.

    NOTE: on Vercel, each serverless invocation may run in a fresh
    environment, so an in-memory store will not persist between requests
    in production. For a real deployment, back this with a shared store
    (e.g. Redis, a database, or your dedicated worker's own job table) —
    the interface below makes that a drop-in change.
    """

    def __init__(self):
        self._jobs: dict[str, Job] = {}
        self._lock = Lock()

    def put(self, job: Job) -> None:
        with self._lock:
            self._jobs[job.id] = job

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            return self._jobs.get(job_id)


class MockMediaProcessor(MediaProcessor):
    """Simulates processing stages instantly for local UI development.

    Does not touch the network or the filesystem beyond an empty temp file,
    and never claims to have produced a real authorized download — it's a
    development aid only.
    """

    def __init__(self):
        self._store = _InMemoryJobStore()

    def start_job(self, source_url: str, format_id: str, format_meta: dict) -> Job:
        job = Job(id=uuid.uuid4().hex, status=JobStatus.QUEUED, message="Queued")
        self._store.put(job)

        stages = [
            (JobStatus.PREPARING, "Preparing...", 10),
            (JobStatus.FETCHING, "Fetching media...", 35),
            (JobStatus.PROCESSING, "Processing...", 60),
            (JobStatus.COMBINING, "Combining streams...", 80),
            (JobStatus.FINALIZING, "Preparing download...", 95),
            (JobStatus.COMPLETE, "Complete", 100),
        ]
        for status, message, progress in stages:
            job.status = status
            job.message = message
            job.progress = progress
            self._store.put(job)
        job.output_path = None
        return job

    def get_job(self, job_id: str) -> Job | None:
        return self._store.get(job_id)


class FFmpegLocalProcessor(MediaProcessor):
    """Reference real processor for a persistent worker (not serverless).

    Fetches the authorized source and remuxes/transcodes it with FFmpeg
    into the requested resolution's container, writing to a temp file.
    Intended to run in a long-lived process (a small VM, container, or
    background worker service) — NOT inside a Vercel function, which has
    strict execution time limits unsuited to real video processing.
    """

    def __init__(self, max_duration_seconds: int = 600, max_filesize_bytes: int = 2 * 1024 ** 3):
        self._store = _InMemoryJobStore()
        self.max_duration_seconds = max_duration_seconds
        self.max_filesize_bytes = max_filesize_bytes

    def start_job(self, source_url: str, format_id: str, format_meta: dict) -> Job:
        job = Job(id=uuid.uuid4().hex, status=JobStatus.PREPARING, message="Preparing...")
        self._store.put(job)

        if not shutil.which("ffmpeg"):
            job.status = JobStatus.FAILED
            job.error = "FFmpeg is not installed on this worker."
            self._store.put(job)
            return job

        out_dir = tempfile.mkdtemp(prefix="vidflow_")
        out_path = os.path.join(out_dir, f"{job.id}.{format_meta.get('format', 'mp4')}")

        try:
            job.status = JobStatus.FETCHING
            job.message = "Fetching media..."
            self._store.put(job)

            job.status = JobStatus.PROCESSING
            job.message = "Processing..."
            self._store.put(job)

            cmd = [
                "ffmpeg", "-y",
                "-timeout", str(self.max_duration_seconds * 1_000_000),
                "-i", source_url,
                "-t", str(self.max_duration_seconds),
                "-c", "copy",
                out_path,
            ]
            subprocess.run(
                cmd,
                check=True,
                capture_output=True,
                timeout=self.max_duration_seconds + 30,
            )

            job.status = JobStatus.COMBINING
            job.message = "Combining streams..."
            self._store.put(job)

            if os.path.getsize(out_path) > self.max_filesize_bytes:
                raise RuntimeError("Output file exceeds the maximum allowed size.")

            job.status = JobStatus.FINALIZING
            job.message = "Preparing download..."
            self._store.put(job)

            job.output_path = out_path
            job.status = JobStatus.COMPLETE
            job.message = "Complete"
            job.progress = 100
            self._store.put(job)
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, RuntimeError, OSError) as exc:
            job.status = JobStatus.FAILED
            job.error = str(exc)
            self._store.put(job)

        return job

    def get_job(self, job_id: str) -> Job | None:
        return self._store.get(job_id)


def get_media_processor() -> MediaProcessor:
    provider = os.environ.get("MEDIA_PROCESSOR_PROVIDER", "mock").lower()
    if provider == "ffmpeg_local":
        return FFmpegLocalProcessor()
    return MockMediaProcessor()
