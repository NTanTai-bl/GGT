"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("users", "is_active", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
    await queryInterface.addColumn("users", "session_version", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addIndex("users", ["role", "is_active"]);
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex("users", ["role", "is_active"]);
    await queryInterface.removeColumn("users", "session_version");
    await queryInterface.removeColumn("users", "is_active");
  },
};
