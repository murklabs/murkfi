import { Pool, QueryResult } from "pg"

const pool = new Pool({
  host: process.env.NEXT_PRIVATE_PGHOST,
  user: process.env.NEXT_PRIVATE_PGUSER,
  password: process.env.NEXT_PRIVATE_PGPASSWORD,
  database: process.env.NEXT_PRIVATE_PGDATABASE,
  port: parseInt(process.env.NEXT_PRIVATE_PORT || "5432", 10),
  ssl: {
    rejectUnauthorized: false,
  },
})

export async function query(text: string, params?: any[]): Promise<QueryResult<any>> {
  const client = await pool.connect()

  try {
    const res = await client.query(text, params)
    return res
  } finally {
    client.release()
  }
}

export async function insertEmail(userEmail: string) {
  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    const insertEmail = `
        INSERT INTO emails (email)
        VALUES ($1);
      `

    await client.query(insertEmail, [userEmail])

    await client.query("COMMIT")
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    client.release()
  }
}
