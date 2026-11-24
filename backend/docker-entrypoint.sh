#!/bin/sh
# serve   : run migrations once, then start N uvicorn workers
# migrate : only run migrations (use as a release / pre-deploy step)
# *       : run any other command, e.g. `python -m app.cli create-admin you@x.com`
set -e

case "$1" in
  serve)
    if [ "${SKIP_MIGRATIONS:-false}" != "true" ]; then
      python -m app.cli migrate
    fi
    exec uvicorn app.main:app \
      --host 0.0.0.0 \
      --port "${PORT:-8000}" \
      --workers "${WEB_CONCURRENCY:-2}" \
      --proxy-headers \
      --forwarded-allow-ips "${FORWARDED_ALLOW_IPS:-*}" \
      --timeout-graceful-shutdown 25 \
      --limit-max-requests "${MAX_REQUESTS:-5000}" \
      --no-server-header
    ;;
  migrate)
    exec python -m app.cli migrate
    ;;
  *)
    exec "$@"
    ;;
esac
