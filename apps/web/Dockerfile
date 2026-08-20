# Local-dev image only — runs the Vite dev server. Production deployment
# would build static assets and serve them behind a CDN/ALB (out of scope
# for Phase 1; see docs/known-limitations.md).
FROM node:20-alpine
WORKDIR /repo

COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/web ./apps/web

RUN npm install --workspaces --include-workspace-root=false --no-audit --no-fund

WORKDIR /repo/apps/web
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]
