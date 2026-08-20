import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

type Timestamps = { omit: "createdAt" };

/** One row per timeline entry shown on the Pentest Run Detail page (spec §18). */
export class RunEvent extends Model<InferAttributes<RunEvent, Timestamps>, InferCreationAttributes<RunEvent, Timestamps>> {
  declare id: CreationOptional<string>;
  declare runId: string;
  declare event: string;
  declare message: string | null;
  declare readonly createdAt: CreationOptional<Date>;
}

export function initRunEventModel(sequelize: Sequelize): typeof RunEvent {
  RunEvent.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      runId: { type: DataTypes.UUID, allowNull: false },
      event: { type: DataTypes.STRING(200), allowNull: false },
      message: { type: DataTypes.TEXT, allowNull: true },
    },
    { sequelize, tableName: "pentest_run_events", underscored: true, updatedAt: false }
  );
  return RunEvent;
}
