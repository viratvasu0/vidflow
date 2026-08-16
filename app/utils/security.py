"""
Security helpers: response headers and a lightweight in-memory rate limiter.

NOTE ON RATE LIMITING:
Vercel serverless functions are stateless between invocations (and often
between requests), so a truly in-memory limiter is only a partial defense
in that environment. The implementation below is correct and effective for
local development / a persistent server (e.g. Gunicorn on a single long
running process), and is written behind a small interface so it can be
swapped for a shared store (Redis, Upstash, etc.) in production without
touching route code.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque
from threading import Lock

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-XSS-Protection": "0",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": (
        "default-src 'self'; "
        "img-src 'self' data: https:; "
        "style-src 'self' 'unsafe-inline'; "
        "script-src 'self'; "
        "connect-src 'self'; "
        "frame-ancestors 'none'"
    ),
}


def apply_security_headers(response):
    for key, value in SECURITY_HEADERS.items():
        response.headers.setdefault(key, value)
    return response


class RateLimiter:
    """A simple sliding-window rate limiter keyed by an arbitrary string
    (typically the client IP). Not distributed — see module note above.
    """

    def __init__(self, max_requests: int = 20, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = Lock()

    def allow(self, key: str) -> bool:
        now = time.time()
        with self._lock:
            bucket = self._hits[key]
            while bucket and now - bucket[0] > self.window_seconds:
                bucket.popleft()
            if len(bucket) >= self.max_requests:
                return False
            bucket.append(now)
            return True

    def retry_after(self, key: str) -> int:
        with self._lock:
            bucket = self._hits.get(key)
            if not bucket:
                return 0
            oldest = bucket[0]
            remaining = self.window_seconds - (time.time() - oldest)
            return max(0, int(remaining) + 1)


analyze_limiter = RateLimiter(max_requests=15, window_seconds=60)
download_limiter = RateLimiter(max_requests=5, window_seconds=60)


def client_key(request) -> str:
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr or "unknown"
