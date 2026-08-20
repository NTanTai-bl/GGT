import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";
import { FINDING_STATUSES, SEVERITIES, type FindingStatus, type Severity } from "@pentest/shared";

type Timestamps = { omit: "createdAt" | "updatedAt" };

export class Finding extends Model<
  InferAttributes<Finding, Timestamps>,
  InferCreationAttributes<Finding, Timestamps>
> {
  declare id: CreationOptional<string>;
  declare runId: string;
  declare fingerprint: string;
  declare title: string;
  declare severity: Severity;
  declare category: string;
  declare cwe: string | null;
  declare description: string;
  declare endpoint: string | null;
  declare method: string | null;
  declare sourceFile: string | null;
  declare sourceLine: number | null;
  declare evidence: string | null;
  declare poc: string | null;
  declare impact: string | null;
  declare recommendation: string | null;
  declare status: CreationOptional<FindingStatus>;
  declare jiraIssueKey: string | null;
  declare readonly createdAt: CreationOptional<Date>;
  declare readonly updatedAt: CreationOptional<Date>;
}

export function initFindingModel(sequelize: Sequelize): typeof Finding {
  Finding.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      runId: { type: DataTypes.UUID, allowNull: false },
      fingerprint: { type: DataTypes.STRING(64), allowNull: false },
      title: { type: DataTypes.STRING(500), allowNull: false },
      severity: { type: DataTypes.ENUM(...SEVERITIES), allowNull: false },
      category: { type: DataTypes.STRING(200), allowNull: false },
      cwe: { type: DataTypes.STRING(20), allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: false },
      endpoint: { type: DataTypes.STRING(500), allowNull: true },
      method: { type: DataTypes.STRING(10), allowNull: true },
      sourceFile: { type: DataTypes.STRING(500), allowNull: true },
      sourceLine: { type: DataTypes.INTEGER, allowNull: true },
      evidence: { type: DataTypes.TEXT, allowNull: true },
      poc: { type: DataTypes.TEXT, allowNull: true },
      impact: { type: DataTypes.TEXT, allowNull: true },
      recommendation: { type: DataTypes.TEXT, allowNull: true },
      status: { type: DataTypes.ENUM(...FINDING_STATUSES), allowNull: false, defaultValue: "OPEN" },
      jiraIssueKey: { type: DataTypes.STRING(50), allowNull: true },
    },
    { sequelize, tableName: "pentest_findings", underscored: true }
  );
  return Finding;
}
