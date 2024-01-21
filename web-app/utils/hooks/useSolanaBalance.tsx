import { useConnection } from "@solana/wallet-adapter-react"
import { PublicKey } from "@solana/web3.js"
import { useEffect, useState } from "react"

// useSolanaBalance gets the user's solana balance based on
// the existing wallet connection and public key available
const useSolanaBalance = (publicKey: PublicKey | null) => {
  const { connection } = useConnection()
  const [solBalance, setSolBalance] = useState<number | null>(null)

  useEffect(() => {
    const getSolBalance = async () => {
      try {
        // No wallet connected or public key available
        if (!publicKey) {
          return
        }

        // Fetch the balance
        const balance = await connection.getBalance(publicKey)

        // Convert lamports to SOL
        const solAmount = balance / 10 ** 9

        setSolBalance(solAmount)
      } catch (error) {
        console.error("Error fetching SOL balance:", error)
        setSolBalance(null)
      }
    }

    getSolBalance()
  }, [connection, publicKey])

  return solBalance
}

export default useSolanaBalance
