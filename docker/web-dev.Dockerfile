# Development image for web/. The source is bind-mounted at run time, so nothing is copied in.
FROM node:22-bookworm-slim

ENV NEXT_TELEMETRY_DISABLED=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    HOME=/home/dev \
    npm_config_store_dir=/workspace/web/node_modules/.pnpm-store

# corepack installs the pnpm version pinned in package.json on first use.
RUN corepack enable && mkdir -p /workspace/web/node_modules /workspace/web/.next /home/dev

COPY web-dev-entrypoint.sh /usr/local/bin/web-dev-entrypoint
WORKDIR /workspace/web

ENTRYPOINT ["web-dev-entrypoint"]
CMD ["sh", "-c", "pnpm install --frozen-lockfile && pnpm dev --hostname 0.0.0.0"]
