"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("integration_configs", {
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
      type: { type: Sequelize.ENUM("JIRA", "SLACK"), allowNull: false },
      // Ciphertext of the provider config (base URL, token, etc) — never
      // store integration secrets in plaintext. Encryption lands with the
      // Phase 2 Jira/Slack adapters that populate this table.
      encrypted_config: { type: Sequelize.TEXT, allowNull: false },
      enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex("integration_configs", ["project_id", "type"], {
      unique: true,
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable("integration_configs");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_integration_configs_type";');
  },
};
