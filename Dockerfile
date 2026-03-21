# ── Stage 1: Server Dependencies ──
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Stage 2: Client Build ──
FROM node:22-slim AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client ./
RUN npm run build

# ── Stage 3: Production ──
FROM node:22-slim AS production
WORKDIR /app

# node-pty needs these at runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY server ./server
COPY shared ./shared
COPY --from=client-build /app/client/dist ./client/dist

ENV NODE_ENV=production
ENV PORT=8765
EXPOSE 8765

CMD ["node", "server/index.js"]
