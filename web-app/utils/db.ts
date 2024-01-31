import { Pool, QueryResult } from "pg"

interface PostgreSqlError extends Error {
  code: string
}

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
  if (!isValidEmail(userEmail)) {
    throw new Error("Invalid email address")
  }
  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    const insertEmail = `
        INSERT INTO email_signups (email)
        VALUES ($1);
      `

    await client.query(insertEmail, [userEmail])

    await client.query("COMMIT")
  } catch (err) {
    if ((err as PostgreSqlError).code === "23505") {
      throw new Error("Email already registered")
    }
    await client.query("ROLLBACK")
    throw err
  } finally {
    client.release()
  }
}

function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return regex.test(email)
}
