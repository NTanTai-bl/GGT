"use strict";

const bcrypt = require("bcryptjs");

module.exports = {
  up: async (queryInterface) => {
    const email = process.env.ADMIN_EMAIL || "admin@example.com";
    const password = process.env.ADMIN_PASSWORD;
    if (!password) {
      throw new Error(
        "ADMIN_PASSWORD must be set in the environment before seeding the admin user."
      );
    }

    const [existing] = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE email = :email`,
      { replacements: { email } }
    );
    if (existing.length > 0) {
      return; // idempotent — running the seeder twice must not fail or duplicate
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await queryInterface.bulkInsert("users", [
      {
        id: queryInterface.sequelize.literal("gen_random_uuid()"),
        email,
        password_hash: passwordHash,
        display_name: "Admin",
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },
  down: async (queryInterface) => {
    const email = process.env.ADMIN_EMAIL || "admin@example.com";
    await queryInterface.bulkDelete("users", { email });
  },
};
