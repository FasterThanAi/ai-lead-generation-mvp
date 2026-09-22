# Security Policy

## Supported versions

Only the latest code on the `main` branch receives security fixes.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report them privately instead:

1. Go to the **Security** tab of this repository.
2. Click **Report a vulnerability**.
3. Describe the problem, the affected file or endpoint, and the steps to reproduce it.

We aim to reply within 7 days and will keep you updated until the issue is fixed.

## What to report

- Leaked credentials, API keys or tokens in the code or git history
- Ways to read or change data without permission
- Injection issues (SQL, prompt injection that leaks data, command injection)
- Ways to send email or start calls without the user approving them

## Keeping secrets safe

This project talks to several paid services (Gemini, Gmail, Hunter.io, Apollo, Vapi, n8n). When contributing:

- Keep real keys in your local `.env` files only. They are git-ignored.
- Use `.env.example` for variable **names**, never real values.
- If you commit a secret by accident, tell a maintainer straight away so it can be rotated. Deleting the commit is not enough, because the key stays in git history.
