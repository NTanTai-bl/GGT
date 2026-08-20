# Build context is the monorepo root (see docker-compose.yml).
FROM node:20-alpine AS build
WORKDIR /repo

COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api

RUN npm install --workspaces --include-workspace-root=false --no-audit --no-fund
RUN npm run build --workspace @pentest/shared
RUN npm run build --workspace @pentest/database
RUN npm run build --workspace @pentest/api

FROM node:20-alpine
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json

EXPOSE 4000
CMD ["node", "apps/api/dist/index.js"]
