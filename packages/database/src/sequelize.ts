import { Sequelize } from "sequelize";

export function createSequelize(): Sequelize {
  return new Sequelize(
    process.env.DB_NAME || "pentest_platform",
    process.env.DB_USER || "pentest",
    process.env.DB_PASSWORD || "pentest",
    {
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 5432),
      dialect: "postgres",
      logging: false,
    }
  );
}

export const sequelize = createSequelize();
