import type { NextApiRequest, NextApiResponse } from "next"
import { insertEmail } from "../../utils/db"

export default async function handler(req: NextApiRequest, res: NextApiResponse<{ message: string }>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    res.status(405).end(`Method ${req.method} Not Allowed`)
    return
  }

  const email = req.body.email

  try {
    await insertEmail(email)
    res.status(200).json({ message: "Email added successfully" })
  } catch (error) {
    console.error("Error inserting user email:", error)
    res.status(500).json({ message: "Error adding user email" })
  }
}
