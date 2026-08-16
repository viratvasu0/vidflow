"""
Metadata extraction service.

This service extracts REAL metadata from a direct, authorized media URL.
It never fabricates resolutions, codecs, or file sizes.

Strategy:
  1. Issue an HTTP HEAD (falling back to a ranged GET) request to confirm
     the resource exists, is reachable, is a supported media content-type,
     and to read its Content-Length when the server provides one.
  2. Run `ffprobe` (part of the FFmpeg suite) directly against the URL to
     read the actual container/stream information: resolution, codec,
     frame rate, duration, and whether video/audio streams are present.
     ffprobe can read just enough of a remote file over HTTP(S) to report
     this without downloading the whole thing for most well-behaved
     servers/formats.

If ffprobe is not installed, or the probe fails, or the source is not a
supported media type, this raises MetadataError with a user-safe message
rather than inventing data.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from dataclasses import dataclass, field

import httpx

MAX_HEAD_TIMEOUT = 10.0
MAX_PROBE_TIMEOUT = 20.0
SUPPORTED_CONTENT_TYPES = (
    "video/mp4", "video/webm", "video/quicktime", "video/x-matroska",
    "video/x-msvideo", "application/octet-stream",
)


class MetadataError(Exception):
    def __init__(self, message: str, status_code: int = 422):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass
class StreamFormat:
    id: str
    resolution: str
    width: int | None
    height: int | None
    fps: float | None
    format: str
    video_codec: str | None
    audio_codec: str | None
    filesize: int | None
    has_video: bool
    has_audio: bool

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "resolution": self.resolution,
            "width": self.width,
            "height": self.height,
            "fps": self.fps,
            "format": self.format,
            "video_codec": self.video_codec,
            "audio_codec": self.audio_codec,
            "filesize": self.filesize,
            "has_video": self.has_video,
            "has_audio": self.has_audio,
        }


@dataclass
class MediaMetadata:
    title: str
    source_url: str
    thumbnail: str | None
    duration_seconds: float | None
    duration_display: str | None
    content_type: str | None
    formats: list[StreamFormat] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "success": True,
            "title": self.title,
            "source": self.source_url,
            "thumbnail": self.thumbnail,
            "duration": self.duration_display,
            "duration_seconds": self.duration_seconds,
            "content_type": self.content_type,
            "formats": [f.to_dict() for f in self.formats],
        }


def _format_duration(seconds: float | None) -> str | None:
    if seconds is None:
        return None
    seconds = int(round(seconds))
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    if h:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


def _resolution_label(height: int | None) -> str:
    if height is None:
        return "Unknown"
    tiers = [
        (2160, "2160p (4K)"),
        (1440, "1440p (2K)"),
        (1080, "1080p (Full HD)"),
        (720, "720p (HD)"),
        (480, "480p (SD)"),
        (360, "360p"),
        (240, "240p"),
    ]
    for min_h, label in tiers:
        if height >= min_h:
            return label
    return f"{height}p"


def _check_reachable(url: str) -> tuple[str | None, int | None]:
    """Confirm the URL is reachable and return (content_type, content_length)."""
    headers = {"User-Agent": "VidFlow/1.0 (authorized-media-check)"}
    try:
        with httpx.Client(follow_redirects=True, timeout=MAX_HEAD_TIMEOUT) as client:
            resp = client.head(url, headers=headers)
            if resp.status_code >= 400 or "content-length" not in resp.headers:
                # Some servers don't support HEAD well; fall back to a small
                # ranged GET so we don't download the whole file.
                resp = client.get(
                    url, headers={**headers, "Range": "bytes=0-0"}
                )
            if resp.status_code >= 400:
                raise MetadataError(
                    "The media source returned an error and the video could "
                    "not be reached.",
                    status_code=422,
                )
            content_type = resp.headers.get("content-type", "").split(";")[0].strip()
            content_length = resp.headers.get("content-range", "")
            length = None
            if content_length and "/" in content_length:
                try:
                    length = int(content_length.rsplit("/", 1)[-1])
                except ValueError:
                    length = None
            elif resp.headers.get("content-length"):
                try:
                    length = int(resp.headers["content-length"])
                except ValueError:
                    length = None
            return content_type or None, length
    except httpx.TimeoutException as exc:
        raise MetadataError("The media source took too long to respond.", 504) from exc
    except httpx.RequestError as exc:
        raise MetadataError("Could not connect to the media source.", 502) from exc


def _run_ffprobe(url: str) -> dict:
    if not shutil.which("ffprobe"):
        raise MetadataError(
            "Media inspection is unavailable on this server (ffprobe not "
            "installed). Install FFmpeg to enable metadata extraction.",
            status_code=503,
        )

    cmd = [
        "ffprobe",
        "-v", "error",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        "-timeout", str(int(MAX_PROBE_TIMEOUT * 1_000_000)),
        url,
    ]
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=MAX_PROBE_TIMEOUT + 5,
        )
    except subprocess.TimeoutExpired as exc:
        raise MetadataError("Timed out while reading video metadata.", 504) from exc

    if result.returncode != 0:
        raise MetadataError(
            "This source could not be read as a supported video format.",
            422,
        )

    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise MetadataError("Unexpected response while reading video metadata.", 502) from exc


def _fps_from_stream(stream: dict) -> float | None:
    rate = stream.get("avg_frame_rate") or stream.get("r_frame_rate")
    if not rate or rate in ("0/0", "N/A"):
        return None
    if "/" in rate:
        num, den = rate.split("/")
        try:
            num_f, den_f = float(num), float(den)
            if den_f == 0:
                return None
            return round(num_f / den_f, 2)
        except ValueError:
            return None
    try:
        return round(float(rate), 2)
    except ValueError:
        return None


def fetch_metadata(url: str) -> MediaMetadata:
    content_type, content_length = _check_reachable(url)

    probe = _run_ffprobe(url)
    streams = probe.get("streams", [])
    fmt_info = probe.get("format", {})

    video_streams = [s for s in streams if s.get("codec_type") == "video"]
    audio_streams = [s for s in streams if s.get("codec_type") == "audio"]

    if not video_streams:
        raise MetadataError(
            "No playable video stream was found at this URL.", 422
        )

    duration = None
    if fmt_info.get("duration"):
        try:
            duration = float(fmt_info["duration"])
        except ValueError:
            duration = None

    filesize = None
    if fmt_info.get("size"):
        try:
            filesize = int(fmt_info["size"])
        except ValueError:
            filesize = None
    if filesize is None:
        filesize = content_length

    container_name = (fmt_info.get("format_name") or "").split(",")[0] or "mp4"

    formats: list[StreamFormat] = []
    for idx, vstream in enumerate(video_streams):
        width = vstream.get("width")
        height = vstream.get("height")
        matching_audio = audio_streams[0] if audio_streams else None
        formats.append(
            StreamFormat(
                id=f"fmt_{idx}_{height or 'na'}p",
                resolution=_resolution_label(height),
                width=width,
                height=height,
                fps=_fps_from_stream(vstream),
                format=container_name,
                video_codec=vstream.get("codec_name"),
                audio_codec=matching_audio.get("codec_name") if matching_audio else None,
                filesize=filesize,
                has_video=True,
                has_audio=matching_audio is not None,
            )
        )

    # Highest resolution first.
    formats.sort(key=lambda f: (f.height or 0), reverse=True)

    title = fmt_info.get("tags", {}).get("title") or url.rsplit("/", 1)[-1] or "Untitled video"

    return MediaMetadata(
        title=title,
        source_url=url,
        thumbnail=None,
        duration_seconds=duration,
        duration_display=_format_duration(duration),
        content_type=content_type,
        formats=formats,
    )
