# Along shopper demo — multi-stage production image
# Serves @along/shopper on 0.0.0.0 (compose/CMD override; local npm scripts stay 127.0.0.1)

FROM node:22.18-bookworm-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/shopper/package.json apps/shopper/
COPY apps/web/package.json apps/web/
COPY packages/agent/package.json packages/agent/
COPY packages/contract/package.json packages/contract/
COPY backend/package.json backend/

RUN npm ci

FROM deps AS builder
WORKDIR /app

COPY . .

# Catalog sync + workspace packages required by shopper (skip @coupang/web)
RUN npm run sync:catalog \
  && npm run build -w @concierge/backend \
  && npm run build -w @coupang/contract \
  && npm run build -w @coupang/agent \
  && npm run build -w @along/shopper

FROM node:22.18-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 along \
  && useradd --system --uid 1001 --gid along along

COPY --from=builder --chown=along:along /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=along:along /app/node_modules ./node_modules
COPY --from=builder --chown=along:along /app/apps/shopper ./apps/shopper
COPY --from=builder --chown=along:along /app/packages ./packages
COPY --from=builder --chown=along:along /app/backend ./backend

# apps/web package.json keeps workspace graph intact for npm -w
COPY --from=builder --chown=along:along /app/apps/web/package.json ./apps/web/package.json

USER along
EXPOSE 3000

# Bypass package.json "start" (127.0.0.1) so the container listens on all interfaces
CMD ["npm", "exec", "-w", "@along/shopper", "--", "next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
