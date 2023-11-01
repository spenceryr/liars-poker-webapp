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
#     │   └── conf/
#             └── default.conf
#     └── webserver/
#         └── conf/

mkdir -p "$HOME/liars/certbot/conf"
mkdir -p "$HOME/liars/certbot/logs"
mkdir -p "$HOME/liars/nginx/conf"
mkdir -p "$HOME/liars/webserver/conf"

# With more complex deployment, probably want to pass this in.
LIARS_BRANCH="main"
curl -o "$HOME/liars/certbot/renew-certs.sh" "https://raw.githubusercontent.com/spenceryr/liars-poker-webapp/${LIARS_BRANCH}/deploy/renew-certs.sh"
curl -o "$HOME/liars/nginx/conf/default.conf" "https://raw.githubusercontent.com/spenceryr/liars-poker-webapp/${LIARS_BRANCH}/deploy/nginx/default.conf"

CLOUDFLARE_TOKEN_SECRET="cloudflare-credentials"
echo "dns_cloudflare_api_token = ${EXT_CLOUDFLARE_API_TOKEN}" | podman secret create "${CLOUDFLARE_TOKEN_SECRET}" -

podman create \
  --name "liars-certbot" \
  --replace \
  -v "$HOME/liars/certbot/conf/:/etc/letsencrypt/:U,rw" \
  -v "$HOME/liars/certbot/logs/:/var/log/letsencrypt/:U,rw" \
  -u "$UID"
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

CERTBOT_SUCCESS="$(podman wait --condition "exited" "liars-certbot")"
if [ "${CERTBOT_SUCCESS}" -ne 0 ]; then
  echo "Error: Certbot failed!"
  exit 1
fi

POD_NAME="liars-pod"
podman pod create \
  --name "${POD_NAME}" \
  --replace \
  --network slirp4netns:port_handler=slirp4netns \
  --userns "keep-id"

podman secret create --env true DOTENV_KEY_SECRET EXT_DOTENV_KEY
LIARS_PORT=3333

WEBSERVER_SSL_LOCATION="$HOME/liars/webserver/conf/"
openssl req -x509 \
  -newkey rsa:4096 \
  -keyout "$WEBSERVER_SSL_LOCATION/key.pem" \
  -out "$WEBSERVER_SSL_LOCATION/cert.pem" \
  -sha256 \
  -days 365 \
  -nodes \
  -subj '/CN=localhost'

podman create \
  --name "liars-webserver" \
  --replace \
  --pod "${POD_NAME}" \
  -u "$UID" \
  -v "$WEBSERVER_SSL_LOCATION:/etc/liars-webserver/:U,rw" \
  --env 'NODE_ENV=production' \
  --env 'LIARS_PORT' \
  --secret 'DOTENV_KEY_SECRET,type=env,target=DOTENV_KEY'
  --expose "${LIARS_PORT}" \
  "docker.io/spenzor/liars-ws:latest"

NGINX_SSL_LOCATION="$HOME/liars/nginx/ssl/"
openssl req -x509 \
  -newkey rsa:4096 \
  -keyout "$NGINX_SSL_LOCATION/key.pem" \
  -out "$NGINX_SSL_LOCATION/cert.pem" \
  -sha256 \
  -days 365 \
  -nodes \
  -subj '/CN=localhost'

podman create \
  --name "liars-nginx" \
  --replace \
  --pod "${POD_NAME}" \
  --requires "liars-webserver" \
  -u "$UID" \
  -p 80:80 \
  -p 443:443 \
  -v "$HOME/liars/nginx/conf/:/etc/nginx/conf.d/:U,ro" \
  -v "$NGINX_SSL_LOCATION:/etc/nginx/ssl/upstream/:U,ro"
  -v "$HOME/liars/certbot/conf/:/etc/letsencrypt/:U,ro" \
  docker.io/library/nginx:stable-alpine3.17

podman pod start "${POD_NAME}"

# Create cron job to renew certs
CRON_CMD="$HOME/liars/certbot/renew-certs.sh"
CRON_JOB="0 12 * * * ${CRON_CMD}"
# https://stackoverflow.com/a/17975418
( crontab -l | grep -v -F "${CRON_CMD}" || : ; echo "${CRON_JOB}" ) | crontab -
