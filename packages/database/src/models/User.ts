import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";
import { USER_ROLES, type UserRole } from "@pentest/shared";

type Timestamps = { omit: "createdAt" | "updatedAt" };

export class User extends Model<InferAttributes<User, Timestamps>, InferCreationAttributes<User, Timestamps>> {
  declare id: CreationOptional<string>;
  declare email: string;
  declare passwordHash: string;
  declare displayName: string;
  declare role: CreationOptional<UserRole>;
  declare isActive: CreationOptional<boolean>;
  declare sessionVersion: CreationOptional<number>;
  declare readonly createdAt: CreationOptional<Date>;
  declare readonly updatedAt: CreationOptional<Date>;
}

export function initUserModel(sequelize: Sequelize): typeof User {
  User.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
      passwordHash: { type: DataTypes.STRING(255), allowNull: false },
      displayName: { type: DataTypes.STRING(200), allowNull: false },
      role: { type: DataTypes.ENUM(...USER_ROLES), allowNull: false, defaultValue: "VIEWER" },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      sessionVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      sequelize,
      tableName: "users",
      underscored: true,
      defaultScope: { attributes: { exclude: ["passwordHash"] } },
      scopes: { withPassword: { attributes: { include: ["passwordHash"] } } },
    }
  );
  return User;
}
