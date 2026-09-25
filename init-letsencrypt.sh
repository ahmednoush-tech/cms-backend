#!/bin/bash
# ============================================================
# Run ONCE per domain, before the first `docker compose up`, or
# whenever switching to a new domain. Solves a real bootstrapping
# problem: Nginx's config references
# /etc/letsencrypt/live/$DOMAIN/fullchain.pem via ssl_certificate,
# and Nginx REFUSES TO START if that file doesn't exist — but
# Certbot's HTTP-01 challenge (the standard way to prove domain
# ownership to Let's Encrypt) needs Nginx already running and
# reachable on port 80 to serve the challenge file. This script
# breaks that cycle: create a temporary self-signed cert so Nginx
# can start → start Nginx → request the REAL cert from Let's
# Encrypt (Nginx is now up and can serve the challenge) → discard
# the temporary cert → reload Nginx with the real one.
#
# Usage: DOMAIN=example.com EMAIL=you@example.com ./init-letsencrypt.sh
# ============================================================
set -e

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  echo "Usage: DOMAIN=example.com EMAIL=you@example.com ./init-letsencrypt.sh"
  exit 1
fi

echo "### Step 1/5: creating a temporary self-signed certificate so Nginx can start at all ..."
mkdir -p "./certbot-data/conf/live/$DOMAIN"
# Uses alpine/openssl directly (NOT the certbot image) — certbot's
# own Docker image is not guaranteed to have the openssl CLI
# binary available, only Python's internal crypto libraries, which
# are not the same thing as a shell-invokable `openssl` command.
# alpine/openssl is a well-established, dedicated image for
# exactly this kind of one-off openssl CLI operation.
docker run --rm \
  -v "$(pwd)/certbot-data/conf:/etc/letsencrypt" \
  alpine/openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
  -keyout "/etc/letsencrypt/live/$DOMAIN/privkey.pem" \
  -out "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" \
  -subj "/CN=localhost"

echo "### Step 2/5: starting Nginx with the temporary certificate ..."
docker compose up -d frontend

echo "### Step 3/5: deleting the temporary certificate so Certbot writes the real one cleanly ..."
# --entrypoint takes a single executable name, NOT a shell command
# line — passing a multi-word string directly (as an earlier draft
# of this script did) fails with "executable file not found",
# since Docker tries to exec the whole string, spaces included, as
# one literal command name. Explicitly routing through `sh -c`
# is what actually lets a multi-word command run.
docker compose run --rm --entrypoint sh certbot -c "\
  rm -rf /etc/letsencrypt/live/$DOMAIN /etc/letsencrypt/archive/$DOMAIN /etc/letsencrypt/renewal/$DOMAIN.conf"

echo "### Step 4/5: requesting the REAL certificate from Let's Encrypt ..."
docker compose run --rm --entrypoint sh certbot -c "\
  certbot certonly --webroot -w /var/www/certbot \
  -d $DOMAIN \
  --email $EMAIL --rsa-key-size 4096 --agree-tos --non-interactive"

echo "### Step 5/5: reloading Nginx with the real certificate ..."
docker compose exec frontend nginx -s reload

echo "Done. $DOMAIN is now served over HTTPS with a real Let's Encrypt certificate."
echo "Renewal (certificates expire every 90 days) is handled automatically by the 'certbot' service's own renewal loop in docker-compose.yml, as long as the stack keeps running."
