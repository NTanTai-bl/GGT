# GGT — Internal AI Pentest Portal

An internal platform for launching Strix-powered AI pentests against
applications, APIs, and source code your organization has explicitly
authorized for testing. Four scan types (`SOURCE_REVIEW`, `BLACK_BOX`,
`AUTHENTICATED`, `WHITE_BOX`), role-based access, and audit logging.

**Read [docs/known-limitations.md](docs/known-limitations.md) before
treating this as production-ready** — several pieces (the exact Strix CLI
flags, Bedrock end-to-end, the AUTHENTICATED credential mechanism) are
built to spec but not yet verified against a real Strix installation or a
real AWS account.

## Stack

React (Vite) · Node.js/Express API · Postgres (Sequelize) · Amazon SQS
(LocalStack locally) · Node.js worker on EC2 · Strix CLI in a Docker
sandbox · Amazon Bedrock (Claude) · Amazon S3 artifacts · AWS Secrets
Manager for test-account credentials.

## Local setup

Prerequisites: Node 20+, Docker Desktop.

```bash
cp .env.example .env
# edit .env: set ADMIN_PASSWORD.
# STRIX_LLM=openrouter/free is the local-dev default — this machine has no
# EC2/IAM role, so real Bedrock auth isn't available here. See "AWS
# assumptions" below before pointing this at production.

npm install

# start Postgres + LocalStack (SQS + S3 + Secrets Manager)
docker compose up -d postgres localstack

npm run db:migrate --workspace packages/database
npm run db:seed --workspace packages/database

# in separate terminals:
npm run dev:api
npm run dev:worker
npm run dev:web
```

Open http://localhost:5173 and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`
from your `.env` (seeded with role `ADMIN`).

To run everything in Docker instead of separate terminals:

```bash
docker compose up --build
```

`apps/worker/Dockerfile` installs the Strix CLI — building it needs
network access to PyPI and takes a few minutes the first time, and (per
[known-limitations.md](docs/known-limitations.md)) the exact package name
is unverified.

## AWS assumptions

- **Bedrock is the only LLM provider GGT is allowed to call in production**
  (spec §3/§22) — no Anthropic/OpenAI/OpenRouter key. Auth is via the EC2
  instance's IAM role; `LLM_API_KEY` must stay empty for a `bedrock/...`
  `STRIX_LLM` value (enforced — `loadLlmConfigFromEnv` throws otherwise).
- **Locally**, this repo assumes LocalStack for SQS, S3, and Secrets
  Manager (all three are things LocalStack Community actually emulates
  correctly) but Bedrock model invocation cannot be emulated — a real
  scan needs a real AWS account with an approved Claude model.
- **Production** runs the worker on an EC2 instance in a private subnet
  with no public IP, reaching S3/SQS/Bedrock/Secrets Manager/CloudWatch
  ideally through VPC endpoints (spec §3/§4) — this repo provisions none
  of that infrastructure itself; it assumes it already exists.
- **RDS** is just Postgres from the app's point of view — `DATABASE_URL`/
  `DB_*` point at RDS in prod and at the local `postgres` container in dev.

## How each scan type maps to Strix

`packages/strix` is the only place that spawns the Strix CLI
(`packages/strix/src/strix-command-builder.ts` + `strix-engine.ts`).
**The exact flags below are taken from the spec's own "conceptual
execution" examples and are explicitly unverified** — see
[known-limitations.md](docs/known-limitations.md).

| Scan type | Targets required | Command shape |
|---|---|---|
| `SOURCE_REVIEW` | 1+ `SOURCE` | `strix -n -t <workspace>/source --scan-mode <depth>` |
| `BLACK_BOX` | 1+ `WEB`/`API` | `strix -n -t <url> --scan-mode <depth>` |
| `AUTHENTICATED` | 1+ `WEB`/`API` + `credentialSecretArn` | same as `BLACK_BOX`, plus a staged credential file referenced via env (see below) |
| `WHITE_BOX` | `SOURCE` + `WEB`/`API` | `strix -n -t <workspace>/source -t <url> --scan-mode <depth>` |

The worker (`apps/worker/src/pentest-processor.ts`) resolves each
`Target` row into a `SOURCE` (local workspace path, after downloading
from its `s3://` URI) or `WEB`/`API` (its URL) before calling the engine —
the frontend never controls a filesystem path directly.

`AUTHENTICATED`/`WHITE_BOX` credentials: the worker fetches the secret
from Secrets Manager immediately before the scan, writes it to a
`0600`-permission file inside the run's own workspace, and passes only
the **file path** to Strix via an env var (`GGT_CREDENTIAL_FILE`) — never
as a CLI arg, never logged, deleted in a `finally` block after the run.
This env var name is invented pending confirmation of Strix's actual
supported mechanism (spec §5.3 anticipates this may need to change).

## Running the three services

```bash
npm run dev:api      # apps/api    — http://localhost:4000
npm run dev:worker    # apps/worker — polls the pentest-jobs SQS queue
npm run dev:web       # apps/web    — http://localhost:5173
```

## Running tests / lint / typecheck

```bash
npm run test
npm run lint
npm run typecheck
```

## Repository layout

```
apps/
  web/      React + TypeScript frontend — dashboard, projects, 4-mode
            Start Pentest wizard, run timeline, findings
  api/      Express API — auth, RBAC, projects/members, targets,
            pentests, findings, audit logging
  worker/   SQS consumer — workspace/credential lifecycle, drives Strix,
            normalizes findings (including SARIF), stores artifacts
packages/
  shared/   Zod schemas, enums, the scan-type/target validation matrix
            (scan-type-rules.ts), and the RBAC permission table (rbac.ts)
  database/ Sequelize models + migrations (Phase 1 schema evolved in
            place via new migrations, not rewritten)
  strix/    PentestEngine abstraction — strix-command-builder.ts,
            strix-config.ts, strix-client.ts, strix-result-parser.ts,
            strix-engine.ts. No other part of the app spawns the CLI.
infra/
  aws/      LocalStack bootstrap script (queue, bucket, sample secret)
```
