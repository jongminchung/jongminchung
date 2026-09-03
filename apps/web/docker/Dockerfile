FROM oven/bun:1.4.0-alpine AS dependencies

WORKDIR /workspace
RUN apk add --no-cache nodejs
COPY . .
RUN bun install --frozen-lockfile

FROM dependencies AS builder
RUN bun run --filter @jongminchung/web build

FROM oven/bun:1.4.0-alpine AS runner

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app/apps/web

COPY --from=builder --chown=bun:bun /workspace/apps/web/.next/standalone /app
COPY --from=builder --chown=bun:bun /workspace/apps/web/public ./public
COPY --from=builder --chown=bun:bun /workspace/apps/web/.next/static ./.next/static

USER bun
EXPOSE 3000

CMD ["bun", "server.js"]
