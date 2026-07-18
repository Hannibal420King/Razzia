#!/bin/sh
set -eu

CONFIG_PATH="${CONFIG_PATH:-/app/config}" node /app/runtime/write-manager-config.mjs
node /app/runtime/write-vortex-config.mjs
exec /usr/bin/supervisord -c /etc/supervisord.conf
