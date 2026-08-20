# Known limitations — GGT v1

## Confirmed against a real `strix --help` (2026-08-21)

The following are no longer guesses — a real `strix --help` was captured
from an actual installed binary and the code was updated to match:

- **`-n`/`--non-interactive`, repeated `-t`/`--target <target>`,
  `-m`/`--scan-mode {quick,standard,deep}`, and `--instruction <text>`
  are all real flags**, exactly as `strix-command-builder.ts` builds them.
  `--instruction` in particular turned out to be real even though it
  didn't appear in the spec's own worked examples.
- **Strix writes `./strix_runs/<run-name>/` relative to its own cwd**
  (per the `--resume RUN_NAME` description). `strix-client.ts` now sets
  `cwd` to the run's workspace directory when spawning, and
  `strix-result-parser.ts`'s `resolveSearchDirs` looks inside
  `<workspace>/strix_runs/*/` (then `strix_runs/`, then the workspace
  root) for structured result files — before, it only checked the
  workspace root directly, which would never have found anything.
- Target types are richer than GGT's SOURCE/WEB/API split suggests — a
  `--target` can be a URL, git repo, local directory, domain, IP, an
  OpenAPI/Postman spec, or a live Postman collection. GGT v1 only exercises
  the URL/local-directory cases; the rest are simply unused, not broken.
- **Install method**: `--update`'s help text ("Self-updates the standalone
  binary install; for pip/pipx/uv installs, prints the matching upgrade
  command instead") confirms pip is one of Strix's real supported install
  methods for Linux/EC2 — so `apps/worker/Dockerfile`'s `pip install` step
  is the right *shape*. The exact PyPI package name (`strix-agent`) is
  still a guess; the person who captured this `--help` output has it
  installed as a standalone `strix.exe` on Windows, which doesn't confirm
  the pip package name either.

## Still unverified

- **How Strix is told which LLM to use — THE big remaining unknown.**
  `--help` shows a `--config CONFIG` flag documented as "instead of
  ~/.strix/cli-config.json", which suggests LLM provider selection may be
  config-file-based rather than env-var-based — `--help` neither confirms
  nor denies that `STRIX_LLM`/`LLM_API_KEY`/`LLM_API_BASE` env vars (what
  this codebase currently sets) are read at all. If they aren't, Bedrock/
  OpenRouter selection silently does nothing and Strix falls back to
  whatever `~/.strix/cli-config.json` already contains. **To resolve:**
  run a cheap real scan (`strix -n -t https://example.com -m quick`) with
  a known `STRIX_LLM`/`LLM_API_KEY` set and see whether it actually uses
  that provider, or inspect `~/.strix/cli-config.json` after any
  interactive run for its schema, or check Strix's own README/docs for an
  env-var section `--help` doesn't surface.
- **Exit codes.** 0 = clean, 1 = execution error, 2 = vulnerabilities
  found — `--help` doesn't document exit codes at all, so this remains
  the spec's own hedged assumption ("if the installed version uses...").
  Confirm with `echo $?` after a real run.
- **Result file names** (`run.json`, `vulnerabilities.json`,
  `findings.sarif`, etc.) inside `strix_runs/<run-name>/` — the directory
  location is now confirmed, its contents are not.
- **AUTHENTICATED credential mechanism.** The worker stages the Secrets
  Manager secret to a `0600` file and passes its path via an invented env
  var, `GGT_CREDENTIAL_FILE` (see README). Nothing in `--help` suggests a
  native credential flag, so this fallback (explicitly anticipated by
  spec §5.3) is likely what's needed — but it's untested against a real
  authenticated target.
- **`apps/worker/Dockerfile`'s Strix install command** (`pip install
  strix-agent` in a Python 3.12 venv) is a placeholder pending the real
  install instructions — worth checking now that a real binary exists
  somewhere (how was *that* one installed?).

## Bedrock has not been exercised end-to-end

LocalStack Community emulates SQS, S3, and Secrets Manager well enough for
this repo's needs, but not Bedrock model invocation. Nothing in this repo
has actually called Bedrock. The `bedrock/` code path (env validation
rejecting `LLM_API_KEY`, env passthrough for IAM-role auth) is written and
unit-tested for the *config* logic, but a live Claude-via-Bedrock scan is
untested. Do that before calling this production-ready.

## Cooperative cancellation only

`POST /api/pentests/:id/cancel` sets the run to `CANCELLED` in RDS
immediately (spec §29 wants no duplicate Strix launches, which this
satisfies — the worker's `Run.update` claim-guard won't start a *new*
Strix process for a cancelled run). But there's no live channel from the
API to a worker process that's already mid-`RUNNING` on a different
container/instance, so an in-flight Strix child process is not killed —
it runs to completion, and the worker simply declines to overwrite the
`CANCELLED` status with its own result afterward. Real interruption needs
a signal channel (e.g. a Redis/SNS fanout the worker polls, or the API
calling a worker-exposed control endpoint) that doesn't exist yet.

## Crash recovery does not resume — it also doesn't retry

Per spec §29's explicit test list, a run can only be *started* from
`QUEUED`. If the worker crashes mid-`RUNNING`, a redelivered SQS message
for that run is treated as a no-op (not a resume, not a retry) — the run
is stuck in `RUNNING` until an operator manually resets its status. This
is a deliberate reading of §29 ("do not launch a duplicate Strix process"
for an already-`RUNNING` run), traded off against Phase 1's more lenient
crash-recovery behavior. Revisit if stuck runs turn out to be common.

## RBAC interpretation

Spec §25 grants SECURITY "create pentest / cancel pentest / review
findings / update finding status" without saying whether that's global or
per-project — but starting a pentest requires projects/targets to already
exist, which nothing else grants SECURITY the ability to create. This repo
resolves that by also giving SECURITY `PROJECT_MANAGE`/`TARGET_MANAGE`
(see `packages/shared/src/rbac.ts`). ADMIN and SECURITY are treated as
acting across all projects; DEVELOPER/VIEWER are scoped to projects they're
an explicit member of. Revisit if that's not the intended shape.

## Not implemented

- **`report.md` / a rendered PDF report** — `GET /api/pentests/:id/report`
  returns JSON. Nothing generates the Markdown/PDF the spec's S3 layout
  example names; writing an empty placeholder file would be worse than
  omitting it.
- **User management endpoints.** Spec §24's endpoint list has no
  `/api/users` routes, so provisioning SECURITY/DEVELOPER/VIEWER accounts
  is DB/seeder-only in v1 — there's no in-app way to invite a teammate yet.
- **Jira/Slack** — absent from this spec's endpoint list entirely (unlike
  the platform's earlier Phase 1 draft); not built.

## Verified live end-to-end (2026-08-21), against real Postgres + LocalStack

Docker Desktop came up and the full stack was actually run — migrations,
seed, API, worker, and web all executed for real, not just unit-tested.
Confirmed live: all 16 migrations (including the enum renames/swaps) apply
cleanly to Postgres; login + JWT role claim; RBAC (a DEVELOPER got a real
403 on pentest creation and an empty project list for a project they're
not a member of); the authorization gate (schema-level rejection of an
unconfirmed target); all 4 scan-type validation rules against real
targets (SOURCE_REVIEW/BLACK_BOX/AUTHENTICATED accept and reject cases);
a real Secrets Manager secret fetched, staged to a `0600` file, and
deleted again after the run; a real S3 source tarball downloaded and
extracted; SQS publish → consume → idempotent claim → delete (queue
depth returns to 0); the run-event timeline and audit log both persisting
real rows; and the full web UI click path (login → dashboard → project
detail with targets/members/runs → the 4-mode Start Pentest wizard with
correct conditional fields → run detail with timeline/findings/artifacts).

**Two real bugs were caught this way (neither was visible from unit tests alone) and are now fixed:**

1. **`apps/worker/src/workspace.ts`'s S3 client was missing
   `forcePathStyle`.** Without it, the AWS SDK defaults to virtual-hosted
   addressing (`https://<bucket>.<endpoint>/<key>`), which LocalStack
   doesn't route correctly — a download against
   `s3://ggt-pentest-artifacts/foo.tar.gz` came back `NoSuchBucket` with
   the **key** reported as the bucket name. `artifact-store.ts` and
   `artifact.service.ts` already had this set; `workspace.ts` didn't.
   Fixed, and now covered by `apps/worker/src/__tests__/workspace.test.ts`.
2. **The admin seeder's idempotency check silently preserved a stale
   `role`.** A `users` row created before the `role` column existed (or
   before this seeder set it) got stuck on the column's `VIEWER` default
   forever, because "user with this email already exists → skip" never
   reconciled drift. Fixed to be self-healing: it now updates `role` to
   `ADMIN` on an existing row too, not just on insert.

Since none of that Strix binary exists in this sandbox, `spawn strix
ENOENT` at the actual execution step is expected and was itself useful
confirmation: the error propagates correctly into `FAILED` + a timeline
entry + an audit log row, exactly as designed. The success path (parsing
a real exit code + findings into persisted rows) remains covered only by
the Jest suite (`pentest-processor.test.ts`, `strix-result-parser.test.ts`)
— attempting to fake it live hit a real Windows constraint: `spawn` with
`shell: false` correctly refuses to execute `.cmd` wrapper scripts
(`EINVAL`), which is confirmation the shell-injection-safe design is
doing its job, not a bug.

What's *still* not verified: an actual Strix binary run, and Bedrock.
