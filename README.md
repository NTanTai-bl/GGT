# AI Pentest Platform — Phase 1

Internal platform for launching AI-driven (Strix-powered) pentests against
applications your team has explicitly authorized for testing. See
[docs/known-limitations.md](docs/known-limitations.md) before treating this
as production-ready.

## Stack

React (Vite) · Node.js/Express API · Postgres (Sequelize) · SQS-compatible
queue (LocalStack locally) · Node.js worker · Strix CLI · S3-compatible
artifact storage (LocalStack locally).

## Local setup

Prerequisites: Node 20+, Docker Desktop.

```bash
cp .env.example .env
# edit .env: set ADMIN_PASSWORD, and LLM_API_KEY if you have an OpenRouter key
# (STRIX_LLM=openrouter/free works with an empty key for basic smoke-testing,
# but a real scan needs a real OpenRouter/Anthropic/Bedrock key)

npm install

# start Postgres + LocalStack (SQS + S3)
docker compose up -d postgres localstack

npm run db:migrate --workspace packages/database
npm run db:seed --workspace packages/database

# in separate terminals:
npm run dev:api
npm run dev:worker
npm run dev:web
```

Then open http://localhost:5173 and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`
from your `.env`.

To run everything in Docker instead of separate terminals:

```bash
docker compose up --build
```

Note: `apps/worker/Dockerfile` installs the Strix CLI — building it requires
network access to PyPI and takes a few minutes the first time.

## Swapping the LLM provider

Nothing in the codebase hard-codes a provider — the worker reads
`STRIX_LLM` / `LLM_API_KEY` / `LLM_API_BASE` at startup (see
`packages/strix/src/strix-config.ts`) and passes them to the Strix process
through its environment, never through argv or the frontend.

```bash
# Dev default — free tier, no Anthropic account needed
STRIX_LLM=openrouter/free
LLM_API_KEY=

# Production, once an Anthropic key is available
STRIX_LLM=anthropic/claude-sonnet-4-6
LLM_API_KEY=sk-ant-...

# Future: AWS Bedrock
STRIX_LLM=bedrock/anthropic.claude-4-5-sonnet-20251022-v1:0
```

Restart the worker after changing these — the API and frontend never see
LLM credentials.

## Running tests / lint / typecheck

```bash
npm run test
npm run lint
npm run typecheck
```

## Repository layout

```
apps/
  web/      React + TypeScript frontend
  api/      Express API (auth, projects, targets, pentests, findings)
  worker/   SQS consumer that drives Strix and normalizes findings
packages/
  shared/   Zod schemas, enums and DTOs shared by api/worker/web
  database/ Sequelize models + migrations
  strix/    PentestEngine abstraction + StrixPentestEngine (the only place
            that spawns the Strix CLI)
  (packages/jira and packages/slack land in Phase 2 — not created yet)
infra/
  aws/      LocalStack bootstrap script
```
