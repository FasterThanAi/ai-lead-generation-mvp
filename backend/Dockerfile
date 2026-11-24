# syntax=docker/dockerfile:1.7
# ---- build: compile wheels once, keep compilers out of the runtime image ----
FROM python:3.12-slim AS build
ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /build
COPY requirements.txt .
RUN pip wheel --wheel-dir /wheels -r requirements.txt

# ---- runtime ----------------------------------------------------------------
FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    APP_ENV=production \
    LOG_JSON=true \
    PORT=8000 \
    WEB_CONCURRENCY=2 \
    RUN_MIGRATIONS_ON_STARTUP=false

RUN groupadd --system app && useradd --system --gid app --home /app app
WORKDIR /app
COPY --from=build /wheels /wheels
RUN pip install --no-index --find-links=/wheels /wheels/* && rm -rf /wheels
COPY --chown=app:app app ./app
COPY --chown=app:app docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import os,urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\",\"8000\")}/api/health/live', timeout=4)"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["serve"]
