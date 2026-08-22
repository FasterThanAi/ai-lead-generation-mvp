import json
import logging
import re
from typing import Any
from google import genai

from app.core.config import settings

logger = logging.getLogger(__name__)


class AIConfigurationError(RuntimeError):
    pass


class AIServiceError(RuntimeError):
    pass


def clean_value(value):
    if value is None:
        return ""
    return str(value).strip()


def extract_json_from_text(text: str) -> Any:
    """
    Extracts valid JSON array or object from an LLM response string.
    Handles Markdown ```json fenced code blocks and un-fenced substrings.
    """
    cleaned_text = (text or "").strip()

    if cleaned_text.startswith("```"):
        cleaned_text = re.sub(r"^```(?:json)?", "", cleaned_text, flags=re.IGNORECASE).strip()
        cleaned_text = re.sub(r"```$", "", cleaned_text).strip()

    try:
        return json.loads(cleaned_text)
    except json.JSONDecodeError:
        pass

    array_match = re.search(r"\[.*\]", cleaned_text, flags=re.DOTALL)
    if array_match:
        try:
            return json.loads(array_match.group(0))
        except json.JSONDecodeError:
            pass

    object_match = re.search(r"\{.*\}", cleaned_text, flags=re.DOTALL)
    if object_match:
        try:
            return json.loads(object_match.group(0))
        except json.JSONDecodeError:
            pass

    raise ValueError("No JSON object or array found in LLM response.")
