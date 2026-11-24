from unittest import mock

from app.services import lead_discovery_service as discovery


class FakeResponse:
    def __init__(self, status_code=200, location=None, body=b"<html><body>Contact us</body></html>"):
        self.status_code = status_code
        self.headers = {"Location": location, "content-type": "text/html"} if location else {"content-type": "text/html"}
        self.is_redirect = location is not None
        self.is_permanent_redirect = False
        self.encoding = "utf-8"
        self.apparent_encoding = "utf-8"
        self._body = body

    def iter_content(self, chunk_size=16384):
        yield self._body

    def close(self):
        pass


def _public_unless_internal(url):
    return "internal" not in url and "169.254" not in url


def test_redirect_to_internal_address_is_blocked():
    responses = [FakeResponse(302, location="http://169.254.169.254/latest/meta-data/")]
    with mock.patch.object(discovery, "_allowed_by_robots", return_value=(True, None)), \
            mock.patch.object(discovery, "is_public_http_url", side_effect=_public_unless_internal), \
            mock.patch.object(discovery.requests, "get", side_effect=responses) as get:
        result = discovery._fetch_single_url("https://public.example.com/team")
    assert result["status"] == "error"
    assert get.call_count == 1  # the internal hop was never requested


def test_hostname_resolving_to_private_ip_is_blocked():
    with mock.patch.object(discovery, "_allowed_by_robots", return_value=(True, None)), \
            mock.patch.object(discovery, "is_public_http_url", return_value=False), \
            mock.patch.object(discovery.requests, "get") as get:
        result = discovery._fetch_single_url("https://internal.example.com/")
    assert result["status"] == "error"
    get.assert_not_called()


def test_public_redirect_chain_is_followed():
    responses = [FakeResponse(301, location="/contact"), FakeResponse(200)]
    with mock.patch.object(discovery, "_allowed_by_robots", return_value=(True, None)), \
            mock.patch.object(discovery, "is_public_http_url", return_value=True), \
            mock.patch.object(discovery.requests, "get", side_effect=responses):
        result = discovery._fetch_single_url("https://public.example.com/")
    assert result["status"] == "success"
    assert result["url"] == "https://public.example.com/contact"
