#!/bin/bash

# Required external env variables:
# EXT_CLOUDFLARE_API_TOKEN: Cloudflare API token for certbot to verify certs.
# EXT_DOTENV_KEY: Key to unlock webserver's env.vault file
# EXT_CERTBOT_EMAIL: Email for certbot registration.

set -e

if [ $(id -u) -eq 0 ]; then
  echo "Error: Do not run as root"
  exit 1
fi

if [ -z "${EXT_CLOUDFLARE_API_TOKEN}" ]; then
  echo "ERROR: EXT_CLOUDFLARE_API_TOKEN REQUIRED"
  exit 1
fi

if [ -z "${EXT_DOTENV_KEY}" ]; then
  echo "ERROR: EXT_DOTENV_KEY REQUIRED"
  exit 1
fi

if [ -z "${EXT_CERTBOT_EMAIL}" ]; then
  echo "ERROR: EXT_CERTBOT_EMAIL REQUIRED"
  exit 1
fi

# Create this directory structure:
# $HOME/
# └── liars/
#     ├── certbot/
#     │   ├── conf/
#     │   ├── logs/
#     │   └── renew-certs.sh
#     ├── nginx/
#     │   ├── conf/
#     │       └── default.conf
#     │   └── ssl/
#     └── webserver/
#         ├── conf/
#         └── var/

echo "Setting up Home Directory..."
mkdir -p "$HOME/liars/certbot/conf"
mkdir -p "$HOME/liars/certbot/logs"
mkdir -p "$HOME/liars/nginx/conf"
mkdir -p "$HOME/liars/nginx/ssl"
mkdir -p "$HOME/liars/webserver/conf"
mkdir -p "$HOME/liars/webserver/var"
echo "Done!"

echo "Collecting files from GitHub..."
# With more complex deployment, probably want to pass this in.
LIARS_BRANCH="main"
curl -o "$HOME/liars/certbot/renew-certs.sh" "https://raw.githubusercontent.com/spenceryr/liars-poker-webapp/${LIARS_BRANCH}/deploy/renew-certs.sh"
curl -o "$HOME/liars/nginx/conf/default.conf" "https://raw.githubusercontent.com/spenceryr/liars-poker-webapp/${LIARS_BRANCH}/deploy/nginx/default.conf"
curl -o "$HOME/liars/nginx/cloudflare-sync-ips.sh" "https://raw.githubusercontent.com/spenceryr/liars-poker-webapp/${LIARS_BRANCH}/deploy/nginx/cloudflare-sync-ips.sh"
echo "Done!"

chmod +x "$HOME/liars/certbot/renew-certs.sh"
chmod +x "$HOME/liars/nginx/cloudflare-sync-ips.sh"

echo "Setting up cloudflare secret in podman..."
CLOUDFLARE_TOKEN_SECRET="cloudflare-credentials"
if podman secret inspect "${CLOUDFLARE_TOKEN_SECRET}" &> /dev/null; then
  podman secret rm "${CLOUDFLARE_TOKEN_SECRET}"
fi
echo "dns_cloudflare_api_token = ${EXT_CLOUDFLARE_API_TOKEN}" | podman secret create "${CLOUDFLARE_TOKEN_SECRET}" -
echo "Done!"

echo "Creating and starting liars-certbot container..."
podman create \
  --name "liars-certbot" \
  --replace \
  -v "$HOME/liars/certbot/conf/:/etc/letsencrypt/:U,rw" \
  -v "$HOME/liars/certbot/logs/:/var/log/letsencrypt/:U,rw" \
  -u "$UID" \
  --secret "${CLOUDFLARE_TOKEN_SECRET},type=mount,mode=0400,uid=${UID}" \
  docker.io/certbot/dns-cloudflare:latest \
  certonly \
    --dns-cloudflare \
    --dns-cloudflare-credentials '/run/secrets/cloudflare-credentials' \
    --keep-until-expiring \
    -d 'spenzor.com,*.spenzor.com' \
    --agree-tos \
    -n \
    --email "${EXT_CERTBOT_EMAIL}"

podman start "liars-certbot"

CERTBOT_SUCCESS="$(podman wait --condition "exited" "liars-certbot")"
if [ "${CERTBOT_SUCCESS}" -ne 0 ]; then
  echo "Error: Certbot failed!"
  exit 1
fi
echo "Done!"

echo "Creating liars pod..."
POD_NAME="liars-pod"
podman pod create \
  --name "${POD_NAME}" \
  --replace \
  --network slirp4netns:port_handler=slirp4netns \
  -p 80:8080 \
  -p 443:4343 \
  --userns "keep-id"
echo "Done!"

echo "Setting up DotEnv podman secret..."
DOTENV_KEY_SECRET="webserver-dotenv-key"
if podman secret inspect "${DOTENV_KEY_SECRET}" &> /dev/null; then
  podman secret rm "${DOTENV_KEY_SECRET}"
fi
podman secret create --env "${DOTENV_KEY_SECRET}" EXT_DOTENV_KEY
echo "Done!"

echo "Creating internal ssl cert for webserver..."
WEBSERVER_SSL_LOCATION="$HOME/liars/webserver/conf"
openssl req -x509 \
  -newkey rsa:4096 \
  -keyout "$WEBSERVER_SSL_LOCATION/key.pem" \
  -out "$WEBSERVER_SSL_LOCATION/cert.pem" \
  -sha256 \
  -days 365 \
  -nodes \
  -subj '/CN=localhost' > /dev/null
echo "Done!"

echo "Creating container for webserver..."
LIARS_PORT=3333 \
podman create \
  --name "liars-webserver" \
  --replace \
  --pod "${POD_NAME}" \
  -u "$UID" \
  -v "$WEBSERVER_SSL_LOCATION:/etc/liars-webserver/:U,rw" \
  -v "$HOME/liars/webserver/var/:/var/liars-webserver/:U,rw" \
  --env 'NODE_ENV=production' \
  --env 'LIARS_PORT' \
  --secret "${DOTENV_KEY_SECRET},type=env,target=DOTENV_KEY" \
  --expose "${LIARS_PORT}" \
  "docker.io/spenzor/liars-ws:latest"
echo "Done!"

echo "Creating internal ssl cert for nginx..."
NGINX_SSL_LOCATION="$HOME/liars/nginx/ssl"
openssl req -x509 \
  -newkey rsa:4096 \
  -keyout "$NGINX_SSL_LOCATION/key.pem" \
  -out "$NGINX_SSL_LOCATION/cert.pem" \
  -sha256 \
  -days 365 \
  -nodes \
  -subj '/CN=localhost' > /dev/null
echo "Done!"

"$HOME/liars/nginx/cloudflare-sync-ips.sh" "$HOME/liars/nginx/conf/cloudflare"

echo "Creating container for nginx..."
podman create \
  --name "liars-nginx" \
  --replace \
  --pod "${POD_NAME}" \
  --requires "liars-webserver" \
  -u "$UID" \
  -v "$HOME/liars/nginx/conf/:/etc/nginx/conf.d/:U,rw" \
  -v "$NGINX_SSL_LOCATION:/etc/nginx/ssl/upstream/:U,ro" \
  -v "$WEBSERVER_SSL_LOCATION/cert.pem:/etc/nginx/trusted_ca_cert.crt:U,ro" \
  -v "$HOME/liars/certbot/conf/:/etc/letsencrypt/:U,ro" \
  docker.io/nginxinc/nginx-unprivileged:stable-alpine3.17
echo "Done!"

echo "Starting pod..."
podman pod start "${POD_NAME}"
echo "Done!"

echo "Creating cron jobs..."
# Create cron job to renew certs
CRON_CMD="$HOME/liars/certbot/renew-certs.sh"
CRON_JOB="0 12 * * * ${CRON_CMD}"
# https://stackoverflow.com/a/17975418
( crontab -l | grep -v -F "${CRON_CMD}" || : ; echo "${CRON_JOB}" ) | crontab -

CRON_CMD="$HOME/liars/nginx/cloudflare-sync-ips.sh"
CRON_JOB="30 2 * * * ${CRON_CMD} >/dev/null 2>&1"
( crontab -l | grep -v -F "${CRON_CMD}" || : ; echo "${CRON_JOB}" ) | crontab -
echo "Done!"
