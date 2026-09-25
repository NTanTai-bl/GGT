"use strict";

const bcrypt = require("bcryptjs");

module.exports = {
  up: async (queryInterface) => {
    // Login normalizes emails to lowercase (apps/api/src/services/auth.service.ts),
    // so the seeded account must be stored the same way or it can never sign in.
    const email = (process.env.ADMIN_EMAIL || "admin@example.com").trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (!password) {
      throw new Error(
        "ADMIN_PASSWORD must be set in the environment before seeding the admin user."
      );
    }

    const [existing] = await queryInterface.sequelize.query(
      `SELECT id, role, email FROM users WHERE lower(email) = :email`,
      { replacements: { email } }
    );
    if (existing.length > 0) {
      // Idempotent, but self-healing: a row created before the `role`
      // column existed (or before this seeder set it) would otherwise be
      // stuck on the column's VIEWER default forever.
      if (existing[0].role !== "ADMIN" || existing[0].email !== email) {
        await queryInterface.sequelize.query(
          `UPDATE users SET role = 'ADMIN', email = :email WHERE id = :id`,
          { replacements: { email, id: existing[0].id } }
        );
      }
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await queryInterface.bulkInsert("users", [
      {
        id: queryInterface.sequelize.literal("gen_random_uuid()"),
        email,
        password_hash: passwordHash,
        display_name: "Admin",
        role: "ADMIN",
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },
  down: async (queryInterface) => {
    const email = (process.env.ADMIN_EMAIL || "admin@example.com").trim().toLowerCase();
    await queryInterface.bulkDelete("users", { email });
  },
};
