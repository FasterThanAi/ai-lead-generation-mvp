import os
from pathlib import Path
import runpy
import unittest
from unittest import mock


CONFIG_PATH = Path(__file__).resolve().parents[1] / "app" / "core" / "config.py"


class DatabaseUrlConfigTests(unittest.TestCase):
    def load_database_url(self, value=None):
        environment = {} if value is None else {"DATABASE_URL": value}
        # Settings reads environment variables at class definition time. Execute
        # a fresh module for each case without loading the developer's .env file.
        with mock.patch.dict(os.environ, environment, clear=True), \
                mock.patch("dotenv.load_dotenv"):
            config = runpy.run_path(str(CONFIG_PATH))
        return config["settings"].DATABASE_URL

    def test_missing_database_url_uses_sqlite(self):
        self.assertEqual(self.load_database_url(), "sqlite:///./leadgen.db")

    def test_empty_database_url_uses_sqlite(self):
        self.assertEqual(self.load_database_url(""), "sqlite:///./leadgen.db")

    def test_whitespace_only_database_url_uses_sqlite(self):
        self.assertEqual(self.load_database_url(" \t\n "), "sqlite:///./leadgen.db")

    def test_custom_sqlite_url_is_preserved(self):
        url = "sqlite:///./custom.db"
        self.assertEqual(self.load_database_url(url), url)

    def test_postgresql_url_is_preserved(self):
        url = "postgresql://test_user:test_password@localhost/test_db"
        self.assertEqual(self.load_database_url(url), url)

    def test_surrounding_whitespace_is_removed(self):
        url = "postgresql://test_user:test_password@localhost/test_db"
        self.assertEqual(self.load_database_url(f" \t{url}\n "), url)


if __name__ == "__main__":
    unittest.main()
