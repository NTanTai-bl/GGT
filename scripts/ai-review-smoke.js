/*
 * AI review smoke test — runs the real GGT reviewer (packages/reviewer) against
 * one synthetic finding using the worker's own environment (AI_REVIEW_*, Bedrock
 * auth). Costs a single small model call. Run it inside the worker container:
 *
 *   Get-Content scripts\ai-review-smoke.js | docker compose -f docker-compose.local-rds.yml exec -T worker node -r ts-node/register/transpile-only -
 *
 * Prints the resolved config (no secrets), the model decision and token usage.
 * Exit code 0 = the reviewer reached the model and got a valid decision.
 */
const root = process.env.GGT_REPO_ROOT || "/repo";
const reviewer = require(`${root}/packages/reviewer/src/index.ts`);

(async () => {
  const config = reviewer.loadReviewerConfigFromEnv();
  console.log("config:", JSON.stringify({
    enabled: config.enabled,
    provider: config.provider,
    model: config.model,
    region: config.region,
    bedrockEndpoint: config.provider === "bedrock" ? reviewer.bedrockEndpoint(config.region) ?? "(SDK default)" : undefined,
    bearerTokenSet: Boolean(process.env.AWS_BEARER_TOKEN_BEDROCK),
  }));
  if (!config.enabled) {
    console.error("AI_REVIEW_ENABLED is not true in this container — check .env.worker-docker and recreate the worker.");
    process.exit(2);
  }

  const artifact = await reviewer.reviewRunFindings({
    runId: "smoke-test",
    rawFindings: [{
      id: "vuln-0001",
      title: "SQL injection in GET /users",
      severity: "high",
      description: "The id query parameter is concatenated into a SQL statement.",
      code_locations: [{
        file: "src/db.js",
        start_line: 3,
        end_line: 3,
        snippet: "app.get('/users', (req, res) => db.query(\"SELECT * FROM users WHERE id = \" + req.query.id));",
      }],
    }],
    workspaceDir: "/nonexistent",
    runtime: { config, reviewer: reviewer.createAiReviewer(config) },
  });

  const item = artifact.acceptedFindings[0] || artifact.rejectedFindings[0];
  console.log("status:", artifact.reviewMetadata.status,
    "| decision:", item && item.aiReview.decision,
    "| tokens in/out:", artifact.reviewMetadata.inputTokens, "/", artifact.reviewMetadata.outputTokens,
    "| est. cost USD:", artifact.reviewMetadata.estimatedCostUsd);
  if (artifact.reviewMetadata.errors.length > 0) {
    console.error("errors:", artifact.reviewMetadata.errors.join(" | ").slice(0, 800));
    process.exit(1);
  }
  console.log("AI review OK");
})().catch((err) => {
  console.error("FAILED:", err && err.message);
  process.exit(1);
});
