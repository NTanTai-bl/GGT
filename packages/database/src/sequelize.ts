import { readFileSync } from "node:fs";
import { Sequelize, type Dialect } from "sequelize";

/**
 * RDS Postgres rejects unencrypted connections by default ("no pg_hba.conf
 * entry ... no encryption") — set DB_SSL=true to opt in. DB_SSL_CA_PATH lets
 * you point at Amazon's RDS CA bundle (https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem)
 * for real certificate verification; without it, DB_SSL_REJECT_UNAUTHORIZED
 * defaults to false so a first connection isn't blocked on cert setup —
 * tighten this for production.
 */
function buildSslOptions(): Record<string, unknown> | undefined {
  if (process.env.DB_SSL !== "true") return undefined;

  const caPath = process.env.DB_SSL_CA_PATH;
  return {
    ssl: {
      require: true,
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === "true",
      ...(caPath ? { ca: readFileSync(caPath, "utf8") } : {}),
    },
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set (see .env.example)`);
  }
  return value;
}

export function createSequelize(): Sequelize {
  return new Sequelize(
    requireEnv("DB_NAME"),
    requireEnv("DB_USER"),
    requireEnv("DB_PASSWORD"),
    {
      host: requireEnv("DB_HOST"),
      port: Number(process.env.DB_PORT || 5432),
      dialect: "postgres" as Dialect,
      logging: false,
      dialectOptions: buildSslOptions(),
    },
  );
}
