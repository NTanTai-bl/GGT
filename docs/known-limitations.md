# Known limitations — Phase 1

- **Strix CLI flags/output format are assumed, not verified against the real
  tool.** `packages/strix/src/strix-config.ts` builds
  `strix --target <t> --scan-mode <mode> --non-interactive [--instruction <i>]`
  exactly as specified in the platform spec, and
  `packages/strix/src/strix-result-parser.ts` defensively tries several
  plausible stdout shapes (bare JSON array, `{findings: [...]}`, fenced
  ```json blocks, line-delimited JSON) before giving up. Once you have Strix
  installed, run one real scan and diff its actual stdout against what the
  parser expects — adjust `strix-result-parser.ts` if needed. Do not treat
  "the code compiles" as "Strix execution works."
- **`apps/worker/Dockerfile`'s Strix install command is a placeholder.** It
  assumes `pip install strix-agent` inside a Python 3.12 venv. Confirm the
  real package name/install method from Strix's own docs and update the
  Dockerfile before relying on the container build.
- **Cancelling a `RUNNING` scan is cooperative, not immediate.** `POST
  /api/pentests/:id/cancel` marks the run `CANCELLED` in Postgres right away,
  but the worker process actually executing Strix (in a different
  container) has no live channel to learn about it mid-execution — there's
  no pub/sub between API and worker in Phase 1. In practice: cancelling a
  `QUEUED` run works cleanly (the worker checks status before starting);
  cancelling a `RUNNING` run stops new UI polling but the Strix process
  finishes/times out on its own. Fixing this needs a signal channel (Redis
  pub/sub, or a periodic status check the worker performs during Strix
  execution).
- **Crash recovery re-runs Strix rather than resuming it.** If the worker
  process dies mid-execution and SQS redelivers the message, the run is
  still `RUNNING` (not terminal), so `pentest-processor.ts` executes Strix
  again from scratch. Findings won't duplicate (unique `(run_id,
  fingerprint)` constraint), but a real Strix run costs LLM calls, so a
  worker crash mid-scan is not free to retry.
- **The `/report` endpoint returns JSON, not the `report.pdf` artifact**
  described in the spec's S3 layout — PDF rendering is deferred to Phase 2
  along with Jira/Slack.
- **No live test run yet.** Everything here has been unit-tested with a
  mocked Strix engine and mocked Sequelize models, but no one has run
  `docker compose up` end-to-end against a real target with a real LLM key.
  Do that before calling Phase 1 "done" — see the Definition of Done in the
  platform spec.
