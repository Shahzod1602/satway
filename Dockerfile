# syntax=docker/dockerfile:1

# ---------- Builder ----------
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# openssl for Prisma engines
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Prisma client generation needs a DATABASE_URL present (placeholder; not used at build)
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN npx prisma generate
RUN npm run build

# ---------- Runner ----------
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Next.js standalone server + assets
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Prisma generated client + engines (ensure available at runtime)
COPY --from=builder /app/src/generated/prisma ./src/generated/prisma
# Full node_modules: the Prisma 7 CLI pulls in many transitive deps (effect,
# @prisma/config, dotenv, …) needed for `migrate deploy` at startup. This
# overrides the slim standalone node_modules with the complete set.
COPY --from=builder /app/node_modules ./node_modules
# Schema + migrations + config for `migrate deploy`.
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
