import {
  Alert,
  AlertIcon,
  Badge,
  Button,
  ButtonGroup,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Flex,
  Heading,
  Link,
} from "@chakra-ui/react"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js"
import { useState } from "react"
import { Typography } from "@/components/ui/typography"
import useSolanaBalance from "@/utils/hooks/useSolanaBalance"

const vault0ReceiverAddress = "MURkx3GDZYpk9ibdB6xpRjD1aJRXpfvRE8yfVZ7NAg9" // Murk hot wallet #1
type ResultStatus = "idle" | "success" | "failed"

export const StrategyCollection = () => {
  const [isDepositView, setIsDepositView] = useState<boolean>(false)
  const toggleDepositView = (f: boolean) => () => setIsDepositView(f)

  const [amount, setAmount] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ResultStatus>("idle")
  const [signature, setSignature] = useState("")

  const { connected, publicKey, sendTransaction } = useWallet()
  const { connection } = useConnection()
  const solanaBalance = useSolanaBalance(publicKey)
  const vault0SolanaBalance = useSolanaBalance(new PublicKey(vault0ReceiverAddress))
  return <div></div>
}
