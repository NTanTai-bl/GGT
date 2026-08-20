import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";
import {
  RUN_STATUSES,
  SCAN_MODES,
  SCAN_TYPES,
  type RunStatus,
  type ScanMode,
  type ScanType,
} from "@pentest/shared";

type Timestamps = { omit: "createdAt" | "updatedAt" };

export class Run extends Model<InferAttributes<Run, Timestamps>, InferCreationAttributes<Run, Timestamps>> {
  declare id: CreationOptional<string>;
  declare projectId: string;
  declare status: CreationOptional<RunStatus>;
  declare scanType: ScanType;
  declare scanMode: ScanMode;
  declare instruction: string | null;
  declare credentialSecretArn: string | null;
  declare authorizationConfirmedBy: string;
  declare authorizationConfirmedAt: Date;
  declare currentStage: string | null;
  declare strixRunId: string | null;
  declare startedAt: Date | null;
  declare finishedAt: Date | null;
  declare errorMessage: string | null;
  declare createdBy: string;
  declare readonly createdAt: CreationOptional<Date>;
  declare readonly updatedAt: CreationOptional<Date>;
}

export function initRunModel(sequelize: Sequelize): typeof Run {
  Run.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      projectId: { type: DataTypes.UUID, allowNull: false },
      status: { type: DataTypes.ENUM(...RUN_STATUSES), allowNull: false, defaultValue: "QUEUED" },
      scanType: { type: DataTypes.ENUM(...SCAN_TYPES), allowNull: false },
      scanMode: { type: DataTypes.ENUM(...SCAN_MODES), allowNull: false },
      instruction: { type: DataTypes.TEXT, allowNull: true },
      credentialSecretArn: { type: DataTypes.STRING(500), allowNull: true },
      authorizationConfirmedBy: { type: DataTypes.UUID, allowNull: false },
      authorizationConfirmedAt: { type: DataTypes.DATE, allowNull: false },
      currentStage: { type: DataTypes.STRING(200), allowNull: true },
      strixRunId: { type: DataTypes.STRING(200), allowNull: true },
      startedAt: { type: DataTypes.DATE, allowNull: true },
      finishedAt: { type: DataTypes.DATE, allowNull: true },
      errorMessage: { type: DataTypes.TEXT, allowNull: true },
      createdBy: { type: DataTypes.UUID, allowNull: false },
    },
    { sequelize, tableName: "pentest_runs", underscored: true }
  );
  return Run;
}
