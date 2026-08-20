import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";
import { INTEGRATION_TYPES, type IntegrationType } from "@pentest/shared";

type Timestamps = { omit: "createdAt" | "updatedAt" };

export class IntegrationConfig extends Model<
  InferAttributes<IntegrationConfig, Timestamps>,
  InferCreationAttributes<IntegrationConfig, Timestamps>
> {
  declare id: CreationOptional<string>;
  declare projectId: string;
  declare type: IntegrationType;
  declare encryptedConfig: string;
  declare enabled: CreationOptional<boolean>;
  declare readonly createdAt: CreationOptional<Date>;
  declare readonly updatedAt: CreationOptional<Date>;
}

export function initIntegrationConfigModel(sequelize: Sequelize): typeof IntegrationConfig {
  IntegrationConfig.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      projectId: { type: DataTypes.UUID, allowNull: false },
      type: { type: DataTypes.ENUM(...INTEGRATION_TYPES), allowNull: false },
      encryptedConfig: { type: DataTypes.TEXT, allowNull: false },
      enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    { sequelize, tableName: "integration_configs", underscored: true }
  );
  return IntegrationConfig;
}
