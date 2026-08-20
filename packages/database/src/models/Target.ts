import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";
import { ENVIRONMENTS, TARGET_TYPES, type Environment, type TargetType } from "@pentest/shared";

type Timestamps = { omit: "createdAt" | "updatedAt" };

export class Target extends Model<
  InferAttributes<Target, Timestamps>,
  InferCreationAttributes<Target, Timestamps>
> {
  declare id: CreationOptional<string>;
  declare projectId: string;
  declare type: TargetType;
  declare target: string;
  declare environment: Environment;
  declare authorizationConfirmed: CreationOptional<boolean>;
  declare authorizationConfirmedBy: string | null;
  declare authorizationConfirmedAt: Date | null;
  declare readonly createdAt: CreationOptional<Date>;
  declare readonly updatedAt: CreationOptional<Date>;
}

export function initTargetModel(sequelize: Sequelize): typeof Target {
  Target.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      projectId: { type: DataTypes.UUID, allowNull: false },
      type: { type: DataTypes.ENUM(...TARGET_TYPES), allowNull: false },
      target: { type: DataTypes.STRING(500), allowNull: false },
      environment: { type: DataTypes.ENUM(...ENVIRONMENTS), allowNull: false },
      authorizationConfirmed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      authorizationConfirmedBy: { type: DataTypes.UUID, allowNull: true },
      authorizationConfirmedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { sequelize, tableName: "pentest_targets", underscored: true }
  );
  return Target;
}
