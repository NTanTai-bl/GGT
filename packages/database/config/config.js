require("dotenv").config({
  path: require("path").resolve(__dirname, "../../../.env"),
});
const fs = require("fs");

// RDS Postgres rejects unencrypted connections by default — see
// packages/database/src/sequelize.ts for the full explanation of these vars.
function buildSslOptions() {
  if (process.env.DB_SSL !== "true") return undefined;

  const caPath = process.env.DB_SSL_CA_PATH;
  return {
    ssl: {
      require: true,
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === "true",
      ...(caPath ? { ca: fs.readFileSync(caPath, "utf8") } : {}),
    },
  };
}

const base = {
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  dialect: "postgres",
  dialectOptions: buildSslOptions(),
};

module.exports = {
  development: base,
  test: { ...base, database: `${base.database}_test` },
  production: base,
};
