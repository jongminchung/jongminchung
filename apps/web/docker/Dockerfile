FROM node:26.7.0-alpine AS dependencies

WORKDIR /workspace
RUN npm install --global pnpm@12.15.0
COPY . .
RUN pnpm install --frozen-lockfile

FROM dependencies AS builder
RUN pnpm --filter @jongminchung/web run build

FROM node:26.7.0-alpine AS runner

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app/apps/web

COPY --from=builder --chown=node:node /workspace/apps/web/.next/standalone /app
COPY --from=builder --chown=node:node /workspace/apps/web/public ./public
COPY --from=builder --chown=node:node /workspace/apps/web/.next/static ./.next/static

USER node
EXPOSE 3000

CMD ["node", "server.js"]
