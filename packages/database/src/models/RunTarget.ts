import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

type Timestamps = { omit: "createdAt" };

/** Join table: a run may cover multiple targets (e.g. WHITE_BOX = SOURCE + WEB). */
export class RunTarget extends Model<
  InferAttributes<RunTarget, Timestamps>,
  InferCreationAttributes<RunTarget, Timestamps>
> {
  declare id: CreationOptional<string>;
  declare runId: string;
  declare targetId: string;
  declare readonly createdAt: CreationOptional<Date>;
}

export function initRunTargetModel(sequelize: Sequelize): typeof RunTarget {
  RunTarget.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      runId: { type: DataTypes.UUID, allowNull: false },
      targetId: { type: DataTypes.UUID, allowNull: false },
    },
    { sequelize, tableName: "pentest_run_targets", underscored: true, updatedAt: false }
  );
  return RunTarget;
}
