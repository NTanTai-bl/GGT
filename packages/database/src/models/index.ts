import type { Sequelize } from "sequelize";
import { initUserModel, User } from "./User";
import { initProjectModel, Project } from "./Project";
import { initProjectMemberModel, ProjectMember } from "./ProjectMember";
import { initTargetModel, Target } from "./Target";
import { initRunModel, Run } from "./Run";
import { initRunTargetModel, RunTarget } from "./RunTarget";
import { initRunEventModel, RunEvent } from "./RunEvent";
import { initFindingModel, Finding } from "./Finding";
import { initIntegrationConfigModel, IntegrationConfig } from "./IntegrationConfig";
import { initAuditLogModel, AuditLog } from "./AuditLog";

export {
  User,
  Project,
  ProjectMember,
  Target,
  Run,
  RunTarget,
  RunEvent,
  Finding,
  IntegrationConfig,
  AuditLog,
};

export function initModels(sequelize: Sequelize) {
  initUserModel(sequelize);
  initProjectModel(sequelize);
  initProjectMemberModel(sequelize);
  initTargetModel(sequelize);
  initRunModel(sequelize);
  initRunTargetModel(sequelize);
  initRunEventModel(sequelize);
  initFindingModel(sequelize);
  initIntegrationConfigModel(sequelize);
  initAuditLogModel(sequelize);

  Project.belongsTo(User, { foreignKey: "createdBy", as: "creator" });
  User.hasMany(ProjectMember, { foreignKey: "userId", as: "memberships" });
  User.hasMany(AuditLog, { foreignKey: "actorId", as: "auditLogs" });
  Project.hasMany(Target, { foreignKey: "projectId", as: "targets" });
  Project.hasMany(Run, { foreignKey: "projectId", as: "runs" });
  Project.hasMany(IntegrationConfig, { foreignKey: "projectId", as: "integrations" });
  Project.hasMany(ProjectMember, { foreignKey: "projectId", as: "memberships" });

  ProjectMember.belongsTo(Project, { foreignKey: "projectId", as: "project" });
  ProjectMember.belongsTo(User, { foreignKey: "userId", as: "user" });

  Target.belongsTo(Project, { foreignKey: "projectId", as: "project" });
  Target.belongsToMany(Run, { through: RunTarget, foreignKey: "targetId", otherKey: "runId", as: "runs" });

  Run.belongsTo(Project, { foreignKey: "projectId", as: "project" });
  Run.belongsToMany(Target, { through: RunTarget, foreignKey: "runId", otherKey: "targetId", as: "targets" });
  Run.hasMany(RunTarget, { foreignKey: "runId", as: "runTargets" });
  Run.hasMany(RunEvent, { foreignKey: "runId", as: "events" });
  Run.hasMany(Finding, { foreignKey: "runId", as: "findings" });
  Run.belongsTo(User, { foreignKey: "createdBy", as: "requestedBy" });

  RunTarget.belongsTo(Run, { foreignKey: "runId", as: "run" });
  RunTarget.belongsTo(Target, { foreignKey: "targetId", as: "target" });

  RunEvent.belongsTo(Run, { foreignKey: "runId", as: "run" });

  Finding.belongsTo(Run, { foreignKey: "runId", as: "run" });

  IntegrationConfig.belongsTo(Project, { foreignKey: "projectId", as: "project" });

  AuditLog.belongsTo(User, { foreignKey: "actorId", as: "actor" });

  return {
    User,
    Project,
    ProjectMember,
    Target,
    Run,
    RunTarget,
    RunEvent,
    Finding,
    IntegrationConfig,
    AuditLog,
  };
}
