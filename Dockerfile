FROM node:26-alpine AS dependencies

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /workspace
RUN npm install --global pnpm@11.15.1
COPY . .
RUN pnpm install --frozen-lockfile --filter @jongminchung/web...

FROM dependencies AS builder
RUN pnpm --filter @jongminchung/web run build

FROM node:26-alpine AS runner

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app/apps/web

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /workspace/apps/web/.next/standalone /app
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/web/public ./public
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/web/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
