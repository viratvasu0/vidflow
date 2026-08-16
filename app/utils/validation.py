"""
Input and URL validation utilities.

This module is responsible for making sure any URL a user submits is:
  - well formed
  - using an allowed scheme (http/https only)
  - not pointing at localhost, loopback, link-local, or private/internal
    network ranges (basic SSRF protection)
  - pointing at what looks like a direct, playable media resource

IMPORTANT SCOPE NOTE:
This application only accepts *direct media URLs* (a URL that points
straight at a video file the user is authorized to access/own, e.g. an
mp4/webm/mov file hosted on the user's own storage, CDN, or an authorized
media endpoint). It deliberately does NOT attempt to parse, scrape, or
"resolve" URLs from platforms such as YouTube, since doing so would require
circumventing that platform's access controls, authentication, or terms of
service. Those URLs are explicitly rejected with a clear error message.
"""

from __future__ import annotations

import ipaddress
import re
import socket
from dataclasses import dataclass
from urllib.parse import urlparse

ALLOWED_SCHEMES = {"http", "https"}

# File extensions we consider "direct media" for the purposes of this app.
ALLOWED_MEDIA_EXTENSIONS = {
    ".mp4", ".m4v", ".mov", ".webm", ".mkv", ".avi",
}

# Hostnames / patterns that indicate a known streaming platform. We refuse
# these outright rather than trying to work around their protections.
BLOCKED_PLATFORM_HOSTS = {
    "youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be",
    "music.youtube.com", "youtube-nocookie.com",
    "netflix.com", "www.netflix.com",
    "disneyplus.com", "www.disneyplus.com",
    "hulu.com", "www.hulu.com",
    "primevideo.com", "www.amazon.com",
    "tiktok.com", "www.tiktok.com",
    "instagram.com", "www.instagram.com",
    "facebook.com", "www.facebook.com",
}

# Private / reserved network ranges we refuse to connect to.
_PRIVATE_NETWORKS = [
    ipaddress.ip_network(net)
    for net in (
        "0.0.0.0/8",
        "10.0.0.0/8",
        "100.64.0.0/10",
        "127.0.0.0/8",
        "169.254.0.0/16",
        "172.16.0.0/12",
        "192.0.0.0/24",
        "192.0.2.0/24",
        "192.168.0.0/16",
        "198.18.0.0/15",
        "198.51.100.0/24",
        "203.0.113.0/24",
        "224.0.0.0/4",
        "240.0.0.0/4",
        "::1/128",
        "fc00::/7",
        "fe80::/10",
        "::ffff:0:0/96",
    )
]

_HOSTNAME_RE = re.compile(
    r"^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)"
    r"(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))*\.?$"
)


@dataclass
class ValidationResult:
    ok: bool
    reason: str | None = None
    normalized_url: str | None = None


def _is_ip_blocked(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return True  # if we can't parse it, don't trust it
    if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
        return True
    for net in _PRIVATE_NETWORKS:
        if ip in net:
            return True
    return False


def resolve_and_check_host(hostname: str) -> tuple[bool, str | None]:
    """Resolve a hostname and make sure none of its IPs are internal.

    This mitigates SSRF via DNS rebinding for the *validation* step. The
    HTTP client used later for actual requests should also be configured
    to avoid redirects to internal addresses.
    """
    if hostname.lower() in ("localhost",):
        return False, "Local addresses are not allowed."

    try:
        infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        return False, "Could not resolve host."

    for info in infos:
        ip_str = info[4][0]
        if _is_ip_blocked(ip_str):
            return False, "This host resolves to a restricted network address."

    return True, None


def validate_media_url(raw_url: str) -> ValidationResult:
    if not raw_url or not raw_url.strip():
        return ValidationResult(False, "Please provide a video URL.")

    raw_url = raw_url.strip()

    if len(raw_url) > 2048:
        return ValidationResult(False, "URL is too long.")

    try:
        parsed = urlparse(raw_url)
    except ValueError:
        return ValidationResult(False, "That doesn't look like a valid URL.")

    if parsed.scheme.lower() not in ALLOWED_SCHEMES:
        return ValidationResult(False, "Only http:// and https:// URLs are supported.")

    if not parsed.hostname:
        return ValidationResult(False, "That doesn't look like a valid URL.")

    hostname = parsed.hostname.lower()

    if not _HOSTNAME_RE.match(hostname) and not _looks_like_ip(hostname):
        return ValidationResult(False, "That doesn't look like a valid hostname.")

    if hostname in BLOCKED_PLATFORM_HOSTS or any(
        hostname.endswith("." + h) for h in BLOCKED_PLATFORM_HOSTS
    ):
        return ValidationResult(
            False,
            "Links from this platform aren't supported. VidFlow only processes "
            "direct media URLs you own or are explicitly authorized to use "
            "(for example, a file hosted on your own storage or CDN).",
        )

    if hostname in ("localhost", "0.0.0.0", "::1") or hostname.startswith("127."):
        return ValidationResult(False, "Local addresses are not allowed.")

    if _looks_like_ip(hostname) and _is_ip_blocked(hostname):
        return ValidationResult(False, "This host is on a restricted network range.")

    if not _looks_like_ip(hostname):
        ok, reason = resolve_and_check_host(hostname)
        if not ok:
            return ValidationResult(False, reason)

    path_lower = parsed.path.lower()
    has_known_extension = any(path_lower.endswith(ext) for ext in ALLOWED_MEDIA_EXTENSIONS)

    normalized = parsed.geturl()
    if not has_known_extension:
        # We don't hard-fail here; some authorized/CDN endpoints serve media
        # without a file extension (signed URLs, query-string routing, etc).
        # The metadata service will make the final determination by probing
        # the actual content type of the resource.
        return ValidationResult(True, None, normalized)

    return ValidationResult(True, None, normalized)


def _looks_like_ip(hostname: str) -> bool:
    try:
        ipaddress.ip_address(hostname)
        return True
    except ValueError:
        return False


def validate_format_id(format_id: str) -> bool:
    if not format_id or not isinstance(format_id, str):
        return False
    return bool(re.match(r"^[A-Za-z0-9_\-]{1,64}$", format_id))


def validate_job_id(job_id: str) -> bool:
    if not job_id or not isinstance(job_id, str):
        return False
    return bool(re.match(r"^[A-Za-z0-9_\-]{8,64}$", job_id))
