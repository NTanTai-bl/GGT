# Build context is the monorepo root (see docker-compose.yml).
FROM node:22-bookworm AS build
WORKDIR /repo

COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/worker ./apps/worker

RUN npm install --workspaces --include-workspace-root=false --no-audit --no-fund
RUN npm run build --workspace @pentest/worker

# Strix requires Python 3.12+. Debian Bookworm's default apt repositories
# provide Python 3.11, so use the official Python 3.12 Bookworm image and copy
# the Node.js runtime from the build stage.
FROM python:3.12-bookworm
WORKDIR /repo
ENV NODE_ENV=production
# Strix 1.3.0 marks 25 function tools as strict. AWS Bedrock Claude accepts at
# most 20 strict tools, so Bedrock scans fail before inference starts. 1.6.1
# keeps the full toolset but disables strict schemas for incompatible routes.
ARG STRIX_AGENT_VERSION=1.6.1

COPY --from=build /usr/local/bin/node /usr/local/bin/node

# Strix drives sandboxed tooling containers through the Docker CLI. The
# Docker socket itself is bind-mounted at runtime by Docker Compose.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      docker.io ca-certificates curl libstdc++6 \
 && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/strix-venv \
 && /opt/strix-venv/bin/pip install --no-cache-dir --upgrade pip \
 && /opt/strix-venv/bin/pip install --no-cache-dir "strix-agent==${STRIX_AGENT_VERSION}"
ENV PATH="/opt/strix-venv/bin:${PATH}"
ENV STRIX_BIN="/opt/strix-venv/bin/strix"

# Internal workspace packages currently expose their TypeScript source as the
# package entrypoint. Register ts-node for those package imports while the
# worker itself continues to run from compiled JavaScript.
ENV TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node"}'

# Per-run temp workspaces (source snapshots, staged credentials) live under
# here and are deleted after each run — see apps/worker/src/workspace.ts.
RUN mkdir -p /opt/ggt/workspaces

RUN python --version \
 && node --version \
 && /opt/strix-venv/bin/strix --version \
 && /opt/strix-venv/bin/python -c "from strix.config.models import supports_strict_tool_schemas; assert not supports_strict_tool_schemas('bedrock/us.anthropic.claude-sonnet-4-5-20250929-v1:0')" \
 && docker --version

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/apps/worker/dist ./apps/worker/dist
COPY --from=build /repo/apps/worker/package.json ./apps/worker/package.json

CMD ["node", "-r", "ts-node/register/transpile-only", "apps/worker/dist/index.js"]
