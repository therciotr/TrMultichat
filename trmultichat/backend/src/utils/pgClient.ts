import { Pool } from "pg";
import env from "../config/env";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_HOST || env.POSTGRES_HOST,
      port: Number(process.env.DB_PORT || env.POSTGRES_PORT),
      database: process.env.DB_NAME || env.POSTGRES_DB,
      user: process.env.DB_USER || env.POSTGRES_USER,
      password: process.env.DB_PASS || env.POSTGRES_PASSWORD
    });
  }
  return pool;
}

export async function pgQuery<T = any>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  const client = getPool();
  const res = await client.query(sql, params);
  return res.rows as T[];
}


