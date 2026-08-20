import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

type Timestamps = { omit: "createdAt" | "updatedAt" };

export class User extends Model<InferAttributes<User, Timestamps>, InferCreationAttributes<User, Timestamps>> {
  declare id: CreationOptional<string>;
  declare email: string;
  declare passwordHash: string;
  declare displayName: string;
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
    },
    { sequelize, tableName: "users", underscored: true }
  );
  return User;
}
