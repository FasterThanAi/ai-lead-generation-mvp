# Deployment guide

Three supported setups. All of them use PostgreSQL in production; SQLite is for local
development only and the API refuses to boot in production with it.

| Setup | Best for | Pieces |
|---|---|---|
| [Local development](#1-local-development) | Working on the code | uvicorn + Vite, SQLite |
| [Docker Compose](#2-docker-compose-single-server) | One VM / on-prem | nginx web, API, Postgres (pgvector), Redis |
| [Render + Vercel](#3-render--vercel-managed) | Managed hosting | `render.yaml` blueprint + `frontend/vercel.json` |

## 1. Local development

```bash
cd backend
python3.12 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
cp .env.example .env            # add GEMINI_API_KEY etc. as needed
.venv/bin/uvicorn app.main:app --reload --port 8000
```

```bash
cd frontend
cp .env.example .env
npm ci --ignore-scripts
npm run dev                     # http://localhost:5173
```

Open the app: the first account you create becomes the workspace admin.

Checks before pushing (CI runs the same):

```bash
python3 scripts/security_scan.py
cd backend && .venv/bin/ruff check app tests && .venv/bin/pytest
cd frontend && npm run lint && npm test && npm run build
```

## 2. Docker Compose (single server)

```bash
cp .env.docker.example .env
# set SECRET_KEY (openssl rand -hex 32) and POSTGRES_PASSWORD, plus any API keys
docker compose up --build -d
open http://localhost:8080
```

- The web container (nginx, non-root, port 8080) serves the SPA and proxies `/api` to
  the API, so browser and API share one origin and no CORS is involved.
- The API container runs `python -m app.cli migrate` and then `uvicorn` with
  `WEB_CONCURRENCY` workers. Migrations are locked, so scaling the service is safe:
  `docker compose up -d --scale backend=3`.
- Put TLS in front (Caddy, Traefik, a cloud load balancer) and set
  `PUBLIC_WEB_URL=https://your-domain` in `.env`.
- Gmail OAuth redirect URI: `https://your-domain/api/gmail/oauth/callback`.

Operational commands:

```bash
docker compose exec backend python -m app.cli create-admin you@company.com
docker compose exec backend python -m app.cli migrate
docker compose exec db pg_dump -U leadgen leadgen > backup.sql
docker compose logs -f backend          # JSON logs with request ids
```

## 3. Render + Vercel (managed)

1. **Render**: New → Blueprint → select this repo. `render.yaml` creates the API, a
   PostgreSQL database and a Key Value (Redis) instance, and generates `SECRET_KEY`,
   `TOKEN_ENCRYPTION_KEY` and `VAPI_WEBHOOK_SECRET`.
2. Fill the `sync: false` variables in the Render dashboard: `PUBLIC_API_URL`
   (the service URL, e.g. `https://leadgen-api.onrender.com`), `ADMIN_EMAIL` /
   `ADMIN_PASSWORD` for the first admin, and any integration keys.
3. **Vercel**: import the repo with root directory `frontend`, set
   `VITE_API_BASE_URL=https://<your-render-api>/api`, deploy.
4. Make sure the API's `FRONTEND_URLS` contains the exact Vercel origin.
5. In Google Cloud Console set the OAuth redirect URI to
   `https://<your-render-api>/api/gmail/oauth/callback`.

**n8n Lead Agent:** create an API key under *Team & API keys* and add an HTTP header
`X-API-Key: <key>` to the n8n node that calls `POST /api/leads/create`. Requests
without it now get `401`.

## Environment variables

Full list with comments: [`backend/.env.example`](../backend/.env.example). The ones
that matter most in production:

| Variable | Required | Notes |
|---|---|---|
| `APP_ENV` | yes | `production` enables boot-time safety checks, HSTS and JSON logs |
| `SECRET_KEY` | yes | ≥ 32 random chars. Signs sessions and unsubscribe links |
| `DATABASE_URL` | yes | PostgreSQL. `postgres://` URLs are normalised automatically |
| `FRONTEND_URLS` | yes | Comma-separated exact origins allowed by CORS |
| `REDIS_URL` | with >1 replica | Shares rate-limit counters across instances |
| `PUBLIC_API_URL` | recommended | Enables unsubscribe links + `List-Unsubscribe` headers |
| `TOKEN_ENCRYPTION_KEY` | recommended | Encrypts Gmail OAuth tokens at rest |
| `VAPI_WEBHOOK_SECRET` | if Vapi on | Boot fails in production without it |
| `METRICS_TOKEN` | recommended | Protects `/metrics` |
| `TRUSTED_HOSTS` | optional | Rejects requests with unexpected `Host` headers |

## Production checklist

- [ ] `APP_ENV=production`, strong `SECRET_KEY`, PostgreSQL `DATABASE_URL`
- [ ] HTTPS everywhere; `FRONTEND_URLS` lists only your real origins
- [ ] First admin created; `ALLOW_REGISTRATION=false`
- [ ] `PUBLIC_API_URL` set so every email carries an unsubscribe link
- [ ] `GMAIL_DAILY_LIMIT` matches your sending reputation (start low)
- [ ] Load balancer health check on `/api/health/ready`
- [ ] `/metrics` scraped (and protected with `METRICS_TOKEN`)
- [ ] Daily Postgres backups with a tested restore
- [ ] n8n uses an API key; Vapi uses `VAPI_WEBHOOK_SECRET`
- [ ] Secrets rotated if anyone built commits `203fd38`..`c1e3769` (see SECURITY.md)

## Upgrading an existing deployment

This release adds authentication. After deploying:

1. Create the first admin (sign up in the UI, or set `ADMIN_EMAIL`/`ADMIN_PASSWORD`).
2. Give n8n an API key (see above).
3. Existing Gmail tokens keep working and are re-saved encrypted on next refresh.
4. New tables (`users`, `api_keys`, `audit_logs`, `suppressed_emails`) and indexes
   are created automatically by the migration step.
