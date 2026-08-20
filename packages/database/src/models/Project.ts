import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

type Timestamps = { omit: "createdAt" | "updatedAt" };

export class Project extends Model<
  InferAttributes<Project, Timestamps>,
  InferCreationAttributes<Project, Timestamps>
> {
  declare id: CreationOptional<string>;
  declare name: string;
  declare description: string | null;
  declare createdBy: string;
  declare readonly createdAt: CreationOptional<Date>;
  declare readonly updatedAt: CreationOptional<Date>;
}

export function initProjectModel(sequelize: Sequelize): typeof Project {
  Project.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      name: { type: DataTypes.STRING(200), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      createdBy: { type: DataTypes.UUID, allowNull: false },
    },
    { sequelize, tableName: "pentest_projects", underscored: true }
  );
  return Project;
}
