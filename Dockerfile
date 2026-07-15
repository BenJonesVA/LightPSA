# Multi-stage build for a production-style image. Local day-to-day dev still
# uses `npm run dev` on the host (fast, hot reload) — this is for testing
# prod parity and eventual deployment, not for editing code inside a
# container. See docker-compose.yml for how this plugs into the rest of the
# stack, and the `migrate` service (which reuses the `builder` stage) for how
# migrations get applied without bloating this runtime image with the full
# Prisma CLI.

FROM node:22-alpine AS base
# Prisma's query engine is linked against OpenSSL; alpine doesn't ship it.
RUN apk add --no-cache openssl
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Needs the schema to generate the client; doesn't need a live DATABASE_URL.
RUN npx prisma generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
# Unprivileged — the standalone server doesn't need root.
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3131
ENV PORT=3131
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
