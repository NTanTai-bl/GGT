import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

type Timestamps = { omit: "createdAt" };

export class ProjectMember extends Model<
  InferAttributes<ProjectMember, Timestamps>,
  InferCreationAttributes<ProjectMember, Timestamps>
> {
  declare id: CreationOptional<string>;
  declare projectId: string;
  declare userId: string;
  declare addedBy: string | null;
  declare readonly createdAt: CreationOptional<Date>;
}

export function initProjectMemberModel(sequelize: Sequelize): typeof ProjectMember {
  ProjectMember.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      projectId: { type: DataTypes.UUID, allowNull: false },
      userId: { type: DataTypes.UUID, allowNull: false },
      addedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { sequelize, tableName: "project_members", underscored: true, updatedAt: false }
  );
  return ProjectMember;
}
