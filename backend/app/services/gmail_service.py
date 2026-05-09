import base64
import json
import os
from datetime import datetime
from email.mime.text import MIMEText

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import GmailToken

GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.send"]
GOOGLE_AUTH_URI = "https://accounts.google.com/o/oauth2/auth"
GOOGLE_TOKEN_URI = "https://oauth2.googleapis.com/token"


class GmailConfigurationError(Exception):
    pass


class GmailConnectionError(Exception):
    pass


def _load_flow_class():
    try:
        from google_auth_oauthlib.flow import Flow
    except ImportError as exc:
        raise GmailConfigurationError(
            "Gmail API dependencies are not installed. Run pip install -r requirements.txt."
        ) from exc

    return Flow


def _load_credentials_class():
    try:
        from google.oauth2.credentials import Credentials
    except ImportError as exc:
        raise GmailConfigurationError(
            "Gmail API dependencies are not installed. Run pip install -r requirements.txt."
        ) from exc

    return Credentials


def _load_google_request_class():
    try:
        from google.auth.transport.requests import Request
    except ImportError as exc:
        raise GmailConfigurationError(
            "Gmail API dependencies are not installed. Run pip install -r requirements.txt."
        ) from exc

    return Request


def _load_gmail_build():
    try:
        from googleapiclient.discovery import build
    except ImportError as exc:
        raise GmailConfigurationError(
            "Gmail API dependencies are not installed. Run pip install -r requirements.txt."
        ) from exc

    return build


def _get_gmail_client_config():
    missing_settings = []

    if not settings.GMAIL_CLIENT_ID:
        missing_settings.append("GMAIL_CLIENT_ID")
    if not settings.GMAIL_CLIENT_SECRET:
        missing_settings.append("GMAIL_CLIENT_SECRET")
    if not settings.GMAIL_REDIRECT_URI:
        missing_settings.append("GMAIL_REDIRECT_URI")

    if missing_settings:
        raise GmailConfigurationError(
            f"Missing Gmail configuration: {', '.join(missing_settings)}."
        )

    return {
        "web": {
            "client_id": settings.GMAIL_CLIENT_ID,
            "client_secret": settings.GMAIL_CLIENT_SECRET,
            "auth_uri": GOOGLE_AUTH_URI,
            "token_uri": GOOGLE_TOKEN_URI,
            "redirect_uris": [settings.GMAIL_REDIRECT_URI],
        }
    }


def _allow_local_oauth_redirects():
    if settings.GMAIL_REDIRECT_URI.startswith(("http://localhost", "http://127.0.0.1")):
        os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "1")


def _build_oauth_flow():
    _allow_local_oauth_redirects()
    Flow = _load_flow_class()

    return Flow.from_client_config(
        _get_gmail_client_config(),
        scopes=GMAIL_SCOPES,
        redirect_uri=settings.GMAIL_REDIRECT_URI,
    )


def build_gmail_oauth_url() -> str:
    flow = _build_oauth_flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes=True,
        prompt="consent",
    )

    return auth_url


def get_connected_gmail_token(db: Session):
    return (
        db.query(GmailToken)
        .order_by(
            GmailToken.updated_at.desc(),
            GmailToken.created_at.desc(),
            GmailToken.id.desc(),
        )
        .first()
    )


def exchange_code_for_token(code: str, db: Session) -> dict:
    flow = _build_oauth_flow()

    try:
        flow.fetch_token(code=code)
    except Exception as exc:
        raise GmailConnectionError(f"Gmail OAuth failed: {exc}") from exc

    credentials = flow.credentials
    sender_email = settings.GMAIL_SENDER_EMAIL.strip() or None
    token_record = get_connected_gmail_token(db)

    if token_record:
        token_record.email = sender_email
        token_record.token_json = credentials.to_json()
        token_record.updated_at = datetime.utcnow()
    else:
        token_record = GmailToken(
            email=sender_email,
            token_json=credentials.to_json(),
        )
        db.add(token_record)

    try:
        db.commit()
        db.refresh(token_record)
    except SQLAlchemyError as exc:
        db.rollback()
        raise GmailConnectionError("Gmail token could not be saved.") from exc

    return {
        "email": token_record.email,
        "scopes": credentials.scopes or GMAIL_SCOPES,
    }


def get_gmail_service(db: Session):
    token_record = get_connected_gmail_token(db)

    if not token_record or not token_record.token_json:
        raise GmailConnectionError("Gmail is not connected. Please connect Gmail first.")

    try:
        token_info = json.loads(token_record.token_json)
        Credentials = _load_credentials_class()
        credentials = Credentials.from_authorized_user_info(token_info, GMAIL_SCOPES)
    except (json.JSONDecodeError, ValueError) as exc:
        raise GmailConnectionError("Stored Gmail token is invalid. Please reconnect Gmail.") from exc

    if credentials.expired:
        if not credentials.refresh_token:
            raise GmailConnectionError("Gmail token expired. Please reconnect Gmail.")

        try:
            Request = _load_google_request_class()
            credentials.refresh(Request())
            token_record.token_json = credentials.to_json()
            token_record.updated_at = datetime.utcnow()
            db.commit()
        except SQLAlchemyError as exc:
            db.rollback()
            raise GmailConnectionError("Refreshed Gmail token could not be saved.") from exc
        except Exception as exc:
            raise GmailConnectionError("Gmail token refresh failed. Please reconnect Gmail.") from exc

    if not credentials.valid:
        raise GmailConnectionError("Gmail token is invalid. Please reconnect Gmail.")

    build = _load_gmail_build()

    return build("gmail", "v1", credentials=credentials, cache_discovery=False)


def create_message(to_email, subject, body, sender_email):
    message = MIMEText(body or "", "plain", "utf-8")
    message["to"] = to_email
    message["subject"] = subject or ""

    if sender_email:
        message["from"] = sender_email

    encoded_message = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")

    return {"raw": encoded_message}


def _format_gmail_api_error(exc: Exception) -> str:
    response = getattr(exc, "resp", None)
    status_code = getattr(response, "status", None)

    if status_code:
        return f"Gmail API error ({status_code}): {exc}"

    return f"Gmail API error: {exc}"


def send_email_via_gmail(db: Session, to_email, subject, body) -> dict:
    cleaned_to_email = (to_email or "").strip()

    if not cleaned_to_email:
        return {
            "success": False,
            "error": "Lead email is missing.",
        }

    try:
        service = get_gmail_service(db)
    except (GmailConfigurationError, GmailConnectionError) as exc:
        return {
            "success": False,
            "error": str(exc),
        }

    token_record = get_connected_gmail_token(db)
    sender_email = (
        (token_record.email if token_record else None)
        or settings.GMAIL_SENDER_EMAIL
        or ""
    ).strip()

    if not sender_email:
        return {
            "success": False,
            "error": "Gmail sender email is not configured.",
        }

    message = create_message(cleaned_to_email, subject, body, sender_email)

    try:
        sent_message = (
            service.users()
            .messages()
            .send(userId="me", body=message)
            .execute()
        )
    except Exception as exc:
        return {
            "success": False,
            "error": _format_gmail_api_error(exc),
        }

    return {
        "success": True,
        "gmail_message_id": sent_message.get("id"),
    }
