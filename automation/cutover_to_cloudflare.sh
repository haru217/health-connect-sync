#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo 'usage: cutover_to_cloudflare.sh <CF_TUNNEL_TOKEN> [CF_ACCESS_EMAIL]'
  exit 1
fi

TOKEN="$1"
EMAIL="${2:-}"
ENV_FILE="/opt/health-ai/.env"
COMPOSE="docker compose -f /opt/health-ai/docker-compose.yml"

if [ ! -f "$ENV_FILE" ]; then
  touch "$ENV_FILE"
fi

set_kv() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

set_kv CF_TUNNEL_TOKEN "$TOKEN"
set_kv CF_ACCESS_EMAIL "$EMAIL"

$COMPOSE up -d --build api
$COMPOSE up -d cloudflared

sleep 5
$COMPOSE logs --tail=60 cloudflared || true

if docker ps --format '{{.Names}}' | grep -q '^health-ai-caddy-1$'; then
  docker stop health-ai-caddy-1 || true
  docker rm health-ai-caddy-1 || true
fi

$COMPOSE ps

echo 'cutover complete'
