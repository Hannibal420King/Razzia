#!/bin/sh
set -eu

node /app/runtime/write-vortex-config.mjs
exec /usr/bin/supervisord -c /etc/supervisord.conf
