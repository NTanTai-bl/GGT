require("dotenv").config({ path: require("path").resolve(__dirname, "../../../.env") });

const base = {
  username: process.env.DB_USER || "pentest",
  password: process.env.DB_PASSWORD || "pentest",
  database: process.env.DB_NAME || "pentest_platform",
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  dialect: "postgres",
};

module.exports = {
  development: base,
  test: { ...base, database: `${base.database}_test` },
  production: base,
};
