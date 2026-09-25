# Build context is the monorepo root (see docker-compose.yml).
FROM node:20-alpine AS build
WORKDIR /repo

COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api

RUN npm install --workspaces --include-workspace-root=false --no-audit --no-fund
# @pentest/shared and @pentest/database have no build step: their package
# entrypoints are TypeScript sources (same model as apps/worker/Dockerfile).
RUN npm run build --workspace @pentest/api

FROM node:20-alpine
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json

# Internal workspace packages expose TypeScript sources; register ts-node for
# those imports while the API itself runs from compiled JavaScript.
ENV TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node"}'

EXPOSE 4000
CMD ["node", "-r", "ts-node/register/transpile-only", "apps/api/dist/index.js"]
