import type { NextApiRequest, NextApiResponse } from "next"
import { insertEmail } from "../../utils/db"

interface ApiResponse {
  message?: string
  error?: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    res.status(405).end(`Method ${req.method} Not Allowed`)
    return
  }

  const email = req.body.email

  try {
    await insertEmail(email)
    res.status(200).json({ message: "Email added successfully" })
  } catch (error: any) {
    if (error.message === "Email already registered") {
      res.status(409).json({ error: error.message })
    } else {
      res.status(500).json({ error: "Internal server error" })
    }
  }
}
