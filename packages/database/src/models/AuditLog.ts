import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

type Timestamps = { omit: "createdAt" };

export class AuditLog extends Model<InferAttributes<AuditLog, Timestamps>, InferCreationAttributes<AuditLog, Timestamps>> {
  declare id: CreationOptional<string>;
  declare actorId: string | null;
  declare action: string;
  declare entityType: string | null;
  declare entityId: string | null;
  /** Safe metadata only — never passwords, tokens, or secret values. */
  declare metadata: Record<string, unknown> | null;
  declare readonly createdAt: CreationOptional<Date>;
}

export function initAuditLogModel(sequelize: Sequelize): typeof AuditLog {
  AuditLog.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      actorId: { type: DataTypes.UUID, allowNull: true },
      action: { type: DataTypes.STRING(100), allowNull: false },
      entityType: { type: DataTypes.STRING(100), allowNull: true },
      entityId: { type: DataTypes.STRING(100), allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: true },
    },
    { sequelize, tableName: "audit_logs", underscored: true, updatedAt: false }
  );
  return AuditLog;
}
