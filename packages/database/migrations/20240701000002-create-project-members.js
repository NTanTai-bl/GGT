"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("project_members", {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },
      project_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "pentest_projects", key: "id" },
        onDelete: "CASCADE",
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
      },
      added_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex("project_members", ["project_id", "user_id"], { unique: true });

    // The project creator is implicitly a member — backfill so existing
    // projects (created before this table existed) aren't orphaned.
    await queryInterface.sequelize.query(`
      INSERT INTO project_members (id, project_id, user_id, added_by, created_at)
      SELECT gen_random_uuid(), id, created_by, created_by, created_at FROM pentest_projects
    `);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable("project_members");
  },
};
