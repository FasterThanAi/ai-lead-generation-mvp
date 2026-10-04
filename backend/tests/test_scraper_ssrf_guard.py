import socket
import unittest
from unittest import mock

from app.services import scraper_service


def fake_resolver(address):
    def resolve(host, port, *args, **kwargs):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (address, 0))]

    return resolve


class FakeResponse:
    def __init__(self, status_code=200, text="", location=None):
        self.status_code = status_code
        self.text = text
        self.headers = {"Location": location} if location else {}
        self.is_redirect = location is not None
        self.is_permanent_redirect = False

    def raise_for_status(self):
        if self.status_code >= 400:
            raise scraper_service.requests.HTTPError(str(self.status_code))


class PublicUrlTests(unittest.TestCase):
    def test_rejects_non_http_schemes_and_missing_hosts(self):
        self.assertFalse(scraper_service.is_public_http_url("file:///etc/passwd"))
        self.assertFalse(scraper_service.is_public_http_url("ftp://example.org"))
        self.assertFalse(scraper_service.is_public_http_url("https://"))

    def test_rejects_localhost_names_without_resolving(self):
        with mock.patch("socket.getaddrinfo") as resolver:
            self.assertFalse(scraper_service.is_public_http_url("http://localhost:8000"))
            self.assertFalse(scraper_service.is_public_http_url("http://api.localhost"))
            resolver.assert_not_called()

    def test_rejects_hosts_resolving_to_internal_addresses(self):
        for address in ("127.0.0.1", "10.0.0.5", "192.168.1.10", "169.254.169.254", "100.64.0.1"):
            with mock.patch("socket.getaddrinfo", fake_resolver(address)):
                self.assertFalse(
                    scraper_service.is_public_http_url("http://internal.example.org"),
                    address,
                )

    def test_rejects_unresolvable_hosts(self):
        with mock.patch("socket.getaddrinfo", side_effect=socket.gaierror):
            self.assertFalse(scraper_service.is_public_http_url("http://nope.invalid"))

    def test_accepts_public_addresses(self):
        with mock.patch("socket.getaddrinfo", fake_resolver("93.184.216.34")):
            self.assertTrue(scraper_service.is_public_http_url("https://example.org"))


class FetchPageHtmlTests(unittest.TestCase):
    def setUp(self):
        scraper_service.robots_cache.clear()

    def test_internal_target_is_never_requested(self):
        with mock.patch("socket.getaddrinfo", fake_resolver("127.0.0.1")), \
                mock.patch.object(scraper_service.requests, "get") as http_get:
            html, error = scraper_service.fetch_page_html("http://127.0.0.1:8000/api/health")

        self.assertEqual(html, "")
        self.assertEqual(error, "Website URL is not allowed")
        http_get.assert_not_called()

    def test_redirect_to_internal_address_is_blocked(self):
        def resolve(host, port, *args, **kwargs):
            address = "169.254.169.254" if host == "metadata.internal" else "93.184.216.34"
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (address, 0))]

        def http_get(url, **kwargs):
            if url.endswith("/robots.txt"):
                return FakeResponse(404)
            return FakeResponse(302, location="http://metadata.internal/latest")

        with mock.patch("socket.getaddrinfo", resolve), \
                mock.patch.object(scraper_service.requests, "get", side_effect=http_get) as mocked_get:
            html, error = scraper_service.fetch_page_html("https://example.org/contact")

        self.assertEqual(html, "")
        self.assertEqual(error, "Website URL is not allowed")
        requested = [call.args[0] for call in mocked_get.call_args_list]
        self.assertNotIn("http://metadata.internal/latest", requested)

    def test_public_page_is_returned(self):
        def http_get(url, **kwargs):
            if url.endswith("/robots.txt"):
                return FakeResponse(404)
            return FakeResponse(200, text="<p>hello@example.org</p>")

        with mock.patch("socket.getaddrinfo", fake_resolver("93.184.216.34")), \
                mock.patch.object(scraper_service.requests, "get", side_effect=http_get):
            html, error = scraper_service.fetch_page_html("https://example.org/contact")

        self.assertIsNone(error)
        self.assertIn("hello@example.org", html)


if __name__ == "__main__":
    unittest.main()
