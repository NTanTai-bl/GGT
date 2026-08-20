"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("users", "role", {
      type: Sequelize.ENUM("ADMIN", "SECURITY", "DEVELOPER", "VIEWER"),
      allowNull: false,
      defaultValue: "VIEWER",
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn("users", "role");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_role";');
  },
};
