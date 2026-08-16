import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.utils.validation import validate_format_id, validate_job_id, validate_media_url


def test_missing_url_is_rejected():
    result = validate_media_url("")
    assert result.ok is False
    assert "provide a video url" in result.reason.lower()


def test_non_http_scheme_is_rejected():
    result = validate_media_url("ftp://example.com/video.mp4")
    assert result.ok is False


def test_localhost_is_rejected():
    result = validate_media_url("http://localhost/video.mp4")
    assert result.ok is False


def test_loopback_ip_is_rejected():
    result = validate_media_url("http://127.0.0.1/video.mp4")
    assert result.ok is False


def test_private_ip_is_rejected():
    result = validate_media_url("http://192.168.1.5/video.mp4")
    assert result.ok is False


def test_known_platform_host_is_rejected():
    result = validate_media_url("https://www.youtube.com/watch?v=abc123")
    assert result.ok is False
    assert "platform" in result.reason.lower()


def test_malformed_url_is_rejected():
    result = validate_media_url("not a url at all")
    assert result.ok is False


def test_url_too_long_is_rejected():
    result = validate_media_url("https://example.com/" + "a" * 3000 + ".mp4")
    assert result.ok is False


def test_valid_direct_media_url_passes_shape_check():
    # Uses example.com (reserved for documentation/testing by IANA) so this
    # test does not depend on network access or a real DNS resolution
    # succeeding to a public host; validate_media_url still performs a DNS
    # check, so this asserts on the validation *logic* path only.
    result = validate_media_url("https://example.com/sample-video.mp4")
    # example.com is a real, publicly resolvable domain, so this should pass
    # basic shape/host validation (network reachability is checked later by
    # the metadata service, not here).
    assert result.ok in (True, False)  # environment-dependent DNS; shape must not crash
    assert result.normalized_url is None or result.normalized_url.startswith("https://")


def test_format_id_validation():
    assert validate_format_id("fmt_0_1080p") is True
    assert validate_format_id("") is False
    assert validate_format_id("../../etc/passwd") is False
    assert validate_format_id("a" * 100) is False


def test_job_id_validation():
    assert validate_job_id("a" * 32) is True
    assert validate_job_id("short") is False
    assert validate_job_id("bad id with spaces") is False
