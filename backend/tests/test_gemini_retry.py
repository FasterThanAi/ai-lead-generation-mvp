from types import SimpleNamespace

import pytest
from google.genai import errors

from app.services.gemini import gemini_generate


class FakeModels:
    def __init__(self, outcomes):
        self.outcomes = list(outcomes)
        self.calls = 0

    def generate_content(self, **kwargs):
        self.calls += 1
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


def client_with(*outcomes):
    models = FakeModels(outcomes)
    return SimpleNamespace(models=models), models


def overloaded():
    return errors.ServerError(503, {"error": {"code": 503, "message": "The model is overloaded", "status": "UNAVAILABLE"}})


def rate_limited():
    return errors.ClientError(429, {"error": {"code": 429, "message": "Resource exhausted", "status": "RESOURCE_EXHAUSTED"}})


def bad_request():
    return errors.ClientError(400, {"error": {"code": 400, "message": "API key not valid", "status": "INVALID_ARGUMENT"}})


def test_retries_transient_errors_then_succeeds():
    ok = SimpleNamespace(text="hello")
    client, models = client_with(overloaded(), rate_limited(), ok)
    delays = []
    assert gemini_generate(client, model="m", contents="x", sleep=delays.append) is ok
    assert models.calls == 3
    assert delays == [1.5, 3.0]


def test_does_not_retry_permanent_errors():
    client, models = client_with(bad_request())
    with pytest.raises(errors.ClientError):
        gemini_generate(client, model="m", contents="x", sleep=lambda _: None)
    assert models.calls == 1


def test_gives_up_after_max_attempts():
    client, models = client_with(overloaded(), overloaded(), overloaded())
    with pytest.raises(errors.ServerError):
        gemini_generate(client, model="m", contents="x", sleep=lambda _: None)
    assert models.calls == 3
