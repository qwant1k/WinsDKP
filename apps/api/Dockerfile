FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/
COPY packages/ ./packages/
RUN pnpm install --shamefully-hoist --frozen-lockfile || pnpm install --shamefully-hoist

FROM base AS development
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/apps/api/node_modules ./apps/api/node_modules
COPY . .
WORKDIR /app/apps/api
RUN npx prisma generate
EXPOSE 3000
CMD ["pnpm", "dev"]

FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/apps/api/node_modules ./apps/api/node_modules
COPY . .
WORKDIR /app/apps/api
RUN npx prisma generate
ENV NODE_OPTIONS="--max-old-space-size=512"
RUN pnpm build

FROM base AS pruner
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/pnpm-lock.yaml* ./
RUN pnpm prune --prod --no-optional 2>/dev/null || true && \
    rm -rf node_modules/.cache node_modules/.pnpm/*/node_modules/typescript \
    node_modules/.pnpm/*/node_modules/@types \
    node_modules/.pnpm/*/node_modules/prettier \
    node_modules/.pnpm/*/node_modules/eslint* \
    node_modules/.pnpm/*/node_modules/@swc/core-linux-arm64* \
    node_modules/.pnpm/*/node_modules/@swc/core-win32* \
    node_modules/.pnpm/*/node_modules/@swc/core-darwin*

FROM node:24-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=pruner /app/node_modules ./node_modules
COPY --from=pruner /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/pnpm-workspace.yaml /app/pnpm-workspace.yaml
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
