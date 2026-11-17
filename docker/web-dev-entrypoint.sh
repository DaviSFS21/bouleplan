#!/bin/sh
# Runs pnpm as the owner of the bind-mounted web/, so files written there (next-env.d.ts)
# belong to the host user on Linux, and the named volumes stay writable for that user.
set -eu

uid=$(stat -c %u /workspace/web)
gid=$(stat -c %g /workspace/web)
chown "$uid:$gid" /workspace/web/node_modules /workspace/web/.next "$HOME"

exec setpriv --reuid="$uid" --regid="$gid" --clear-groups -- "$@"
