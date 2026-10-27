import oracledb, { type Connection, type Result } from "oracledb";

const user = process.env.ORACLE_USER;
const password = process.env.ORACLE_PASSWORD;
const connectString = process.env.ORACLE_CONNECT_STRING;

if (!user || !password || !connectString) {
  throw new Error(
    "Set ORACLE_USER, ORACLE_PASSWORD, and ORACLE_CONNECT_STRING before starting the API.",
  );
}

oracledb.fetchAsString = [oracledb.CLOB];

export const pool = await oracledb.createPool({
  user,
  password,
  connectString,
  poolMin: 1,
  poolMax: 10,
  poolIncrement: 1,
});

export type OracleRow = Record<string, unknown>;
export type OracleBinds = Record<string, string | number | boolean | Date | null>;

export async function query<T extends OracleRow = OracleRow>(
  sql: string,
  binds: OracleBinds = {},
  connection: Connection | undefined = undefined,
): Promise<T[]> {
  if (connection) {
    const result = await connection.execute<T>(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    });
    return result.rows ?? [];
  }
  const acquired = await pool.getConnection();
  try {
    const result = await acquired.execute<T>(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    });
    return result.rows ?? [];
  } finally {
    await acquired.close();
  }
}

export async function execute(
  sql: string,
  binds: OracleBinds = {},
  connection: Connection | undefined = undefined,
): Promise<Result<OracleRow>> {
  if (connection) {
    return connection.execute<OracleRow>(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    });
  }
  const acquired = await pool.getConnection();
  try {
    return await acquired.execute<OracleRow>(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      autoCommit: true,
    });
  } finally {
    await acquired.close();
  }
}

export async function transaction<T>(
  action: (connection: Connection) => Promise<T>,
): Promise<T> {
  const connection = await pool.getConnection();
  try {
    const result = await action(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        "Oracle transaction failed and rollback also failed",
      );
    }
    throw error;
  } finally {
    await connection.close();
  }
}
