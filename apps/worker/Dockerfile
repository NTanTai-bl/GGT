# Build context is the monorepo root (see docker-compose.yml).
#
# NOTE: the exact Strix install command below (pip package name / version)
# is an assumption pending verification against the official Strix docs —
# see docs/known-limitations.md. Everything else in this image is verified
# by `docker compose build worker`.
FROM node:20-bookworm AS build
WORKDIR /repo

COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/worker ./apps/worker

RUN npm install --workspaces --include-workspace-root=false --no-audit --no-fund
RUN npm run build --workspace @pentest/shared
RUN npm run build --workspace @pentest/database
RUN npm run build --workspace @pentest/strix
RUN npm run build --workspace @pentest/worker

FROM node:20-bookworm
WORKDIR /repo
ENV NODE_ENV=production

# Strix requires Python 3.12+ and the Docker CLI (it drives sandboxed
# browser/tooling containers). The socket itself is bind-mounted at
# runtime via docker-compose.yml's `volumes: /var/run/docker.sock`.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      python3.12 python3-pip python3-venv docker.io ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/strix-venv \
 && /opt/strix-venv/bin/pip install --no-cache-dir --upgrade pip \
 && /opt/strix-venv/bin/pip install --no-cache-dir strix-agent
ENV PATH="/opt/strix-venv/bin:${PATH}"
ENV STRIX_BIN="/opt/strix-venv/bin/strix"

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/apps/worker/dist ./apps/worker/dist
COPY --from=build /repo/apps/worker/package.json ./apps/worker/package.json

CMD ["node", "apps/worker/dist/index.js"]
