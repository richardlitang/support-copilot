FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src
COPY --from=builder /app/lib ./lib
# demo/ holds the bundled sample doc the app ingests at runtime
# (src/server/ingestion/sampleDocument.ts reads demo/docs/...).
COPY --from=builder /app/demo ./demo
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY package.json ./
EXPOSE 3000
CMD ["npm", "run", "start"]
