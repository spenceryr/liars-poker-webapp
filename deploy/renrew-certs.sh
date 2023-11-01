#!/bin/bash

set -e

podman start liars-certbot
CERTBOT_RETURN="$(podman wait --condition "exited" "liars-certbot")"
[ CERTBOT_RETURN -eq 0 ]
podman exec "liars-nginx" nginx -s reload
