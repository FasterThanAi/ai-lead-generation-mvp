# Security Policy

## Reporting a Vulnerability

Please report suspected security vulnerabilities privately through the
repository's GitHub **Security** tab by selecting **Report a vulnerability**.
Do not open a public issue or include sensitive details in a pull request.

If the Security tab is unavailable, contact the repository maintainers through
GitHub and ask for a private channel before sharing any vulnerability details.

When reporting, include:

- A clear description of the vulnerability and its potential impact.
- The affected component, endpoint, commit, or configuration.
- Reproduction steps or a minimal proof of concept.
- Any relevant logs, screenshots, or suggested remediation.

Please avoid accessing, modifying, or deleting data that does not belong to
you. Stop testing if you encounter personal data or production credentials and
mention that in the report.

We will acknowledge reports as soon as practical, investigate their impact,
and coordinate disclosure and remediation with the reporter. Please allow
maintainers reasonable time to address a report before making it public.

## Secrets and API Keys

This project can use credentials for Gemini, Gmail, Hunter, Apollo, Vapi, and
other integrations. Treat all API keys, OAuth client secrets, access tokens,
webhook secrets, database credentials, and personal data as confidential.

- Never commit secrets to Git, issues, pull requests, logs, screenshots, or
  frontend code.
- Store local credentials in environment variables or an untracked `.env`
  file. Use `backend/.env.example` as the configuration reference.
- Do not put a secret in a `VITE_` variable: frontend build variables are
  exposed to users.
- If a secret is exposed, revoke or rotate it immediately with the relevant
  provider, then notify the maintainers privately.
- Before sharing diagnostic output, remove tokens, authorization headers,
  email contents, phone numbers, and other sensitive data.

Accidental exposure of a secret should be reported privately even if the
secret has already been removed from the working tree; removing a file does
not remove its value from Git history.
