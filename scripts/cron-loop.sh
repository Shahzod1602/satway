#!/bin/sh
# The scheduler for /api/cron/*.
#
# It lives in compose rather than a host crontab on purpose. A host crontab is invisible
# from the repo, does not deploy with the app, and is the reason the win-back endpoint
# shipped months ago and has — as far as this repo can tell — never once run.
#
#   CRON_TARGET   base URL of the app, as seen from inside the compose network
#   CRON_SECRET   bearer token; the endpoints 503 without it
#   CRON_PATH     path to hit
#   CRON_INTERVAL seconds between runs
#   CRON_JITTER   seconds of random delay before the first run (spreads the services out)
#
# Deliberately dumb: no queue, no state, no catch-up. Every endpoint it calls is
# idempotent within its own window (win-back stamps winbackSentAt, the budget watchdog
# claims each alert once per day), so a missed or duplicated tick costs nothing.

set -eu

: "${CRON_TARGET:=http://app:3000}"
: "${CRON_PATH:?CRON_PATH is required}"
: "${CRON_INTERVAL:?CRON_INTERVAL is required}"
: "${CRON_JITTER:=0}"

if [ -z "${CRON_SECRET:-}" ]; then
  echo "[cron] CRON_SECRET is not set — $CRON_PATH would 503 on every call. Exiting."
  exit 1
fi

[ "$CRON_JITTER" -gt 0 ] && sleep "$CRON_JITTER"

while true; do
  code=$(curl -s -o /tmp/out -w '%{http_code}' \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    "${CRON_TARGET}${CRON_PATH}" || echo 000)
  if [ "$code" = "200" ]; then
    echo "[cron] $(date -u +%FT%TZ) $CRON_PATH ok $(head -c 300 /tmp/out)"
  else
    # Loud, because the failure mode this whole file exists to prevent is a cron that
    # silently stops and shows you zeros — which looks exactly like "nothing happened".
    echo "[cron] $(date -u +%FT%TZ) $CRON_PATH FAILED http=$code $(head -c 300 /tmp/out)" >&2
  fi
  sleep "$CRON_INTERVAL"
done
