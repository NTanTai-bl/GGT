import type { Sequelize } from "sequelize";
import { initUserModel, User } from "./User";
import { initProjectModel, Project } from "./Project";
import { initTargetModel, Target } from "./Target";
import { initRunModel, Run } from "./Run";
import { initFindingModel, Finding } from "./Finding";
import { initIntegrationConfigModel, IntegrationConfig } from "./IntegrationConfig";

export { User, Project, Target, Run, Finding, IntegrationConfig };

export function initModels(sequelize: Sequelize) {
  initUserModel(sequelize);
  initProjectModel(sequelize);
  initTargetModel(sequelize);
  initRunModel(sequelize);
  initFindingModel(sequelize);
  initIntegrationConfigModel(sequelize);

  Project.belongsTo(User, { foreignKey: "createdBy", as: "creator" });
  Project.hasMany(Target, { foreignKey: "projectId", as: "targets" });
  Project.hasMany(Run, { foreignKey: "projectId", as: "runs" });
  Project.hasMany(IntegrationConfig, { foreignKey: "projectId", as: "integrations" });

  Target.belongsTo(Project, { foreignKey: "projectId", as: "project" });
  Target.hasMany(Run, { foreignKey: "targetId", as: "runs" });

  Run.belongsTo(Project, { foreignKey: "projectId", as: "project" });
  Run.belongsTo(Target, { foreignKey: "targetId", as: "target" });
  Run.hasMany(Finding, { foreignKey: "runId", as: "findings" });

  Finding.belongsTo(Run, { foreignKey: "runId", as: "run" });

  IntegrationConfig.belongsTo(Project, { foreignKey: "projectId", as: "project" });

  return { User, Project, Target, Run, Finding, IntegrationConfig };
}
