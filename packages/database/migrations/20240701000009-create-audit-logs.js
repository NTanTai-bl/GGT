"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("audit_logs", {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },
      // Nullable: some events (e.g. a failed login with an unknown email)
      // have no resolvable actor, but still need to be on record.
      actor_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
      },
      action: { type: Sequelize.STRING(100), allowNull: false },
      entity_type: { type: Sequelize.STRING(100), allowNull: true },
      entity_id: { type: Sequelize.STRING(100), allowNull: true },
      // Safe metadata only — never passwords, tokens, or secret values.
      metadata: { type: Sequelize.JSONB, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex("audit_logs", ["entity_type", "entity_id"]);
    await queryInterface.addIndex("audit_logs", ["created_at"]);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable("audit_logs");
  },
};
