# ---- BASE ----
FROM node:26-alpine AS base
RUN npm install --global pnpm@11.9.0

# ---- BUILDER ----
FROM base AS builder
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/common/package.json ./packages/common/
COPY packages/web/package.json ./packages/web/
COPY packages/socket/package.json ./packages/socket/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

# ---- RUNNER ----
FROM alpine:3.24.1 AS runner

RUN apk add --no-cache nginx nodejs supervisor

RUN addgroup -S -g 10001 app \
    && adduser -S -D -H -u 10001 -G app app \
    && mkdir -p /app/config /app/runtime /usr/share/licenses/razzia \
    && chown -R app:app /app /usr/share/licenses/razzia

COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/supervisord.conf /etc/supervisord.conf

COPY --chown=app:app --from=builder /app/packages/web/dist /app/web
COPY --chown=app:app --from=builder /app/packages/socket/dist/index.cjs /app/socket/index.cjs
COPY --chown=app:app docker/entrypoint.sh docker/write-vortex-config.mjs /app/runtime/
COPY --chown=app:app LICENSE VORTEX_SOURCE_AND_ATTRIBUTION.md /usr/share/licenses/razzia/

RUN chmod 0555 /app/runtime/entrypoint.sh

LABEL org.opencontainers.image.title="Razzia for Vortex" \
      org.opencontainers.image.source="https://github.com/Hannibal420King/Razzia" \
      org.opencontainers.image.url="https://github.com/Ralex91/Razzia" \
      org.opencontainers.image.licenses="MIT AND ISC"

ENV HOME=/tmp

USER app

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=6 \
  CMD wget -q -T 2 -O - http://127.0.0.1:3000/healthz >/dev/null || exit 1

ENTRYPOINT ["/app/runtime/entrypoint.sh"]
