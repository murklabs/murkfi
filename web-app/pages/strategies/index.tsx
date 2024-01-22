import { ExternalLinkIcon } from "@chakra-ui/icons"
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
import { WalletNotConnectedError } from "@solana/wallet-adapter-base"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js"
import { useState } from "react"
import ConnectWalletButton from "@/components/connect-wallet-button"
import { Input } from "@/components/ui/input"
import { Typography } from "@/components/ui/typography"
import useSolanaBalance from "@/utils/hooks/useSolanaBalance"

type ResultStatus = "idle" | "success" | "failed"

const vault0ReceiverAddress = "MURkx3GDZYpk9ibdB6xpRjD1aJRXpfvRE8yfVZ7NAg9" // Murk hot wallet #1
const vault0Max = 10000

export default function VaultPage() {
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

  const submitTransaction = async () => {
    if (!publicKey) throw new WalletNotConnectedError()

    try {
      setLoading(true)
      setResult("idle")
      setSignature("")
      const ix = SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: new PublicKey(vault0ReceiverAddress),
        lamports: parseFloat(amount) * LAMPORTS_PER_SOL,
      })
      const tx = new Transaction().add(ix)
      const signature = await sendTransaction(tx, connection)
      await connection.confirmTransaction(signature, "processed")
      setSignature(signature)
      setResult("success")
    } catch (error) {
      console.error(error)
      setResult("failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Vault0Hero />

      <div className="container grid grid-cols-2 gap-4 px-4 md:px-6">
        <Card>
          <CardHeader>
            <Flex justifyContent="space-between">
              <Heading size="md">Vault V0: Delta Neutral Market Maker</Heading>
              <Badge colorScheme="green">New</Badge>
            </Flex>
          </CardHeader>
          {!isDepositView ? (
            <>
              <CardBody className="grid grid-cols-2 gap-4 border-y py-4">
                <div>
                  <p className="text-sm/relaxed">Estimated APR</p>
                  <p className="font-bold">--</p>
                </div>
                <div>
                  <p className="text-sm/relaxed">Available</p>
                  <p className="font-bold">{vault0SolanaBalance ? vault0Max - vault0SolanaBalance : 0} SOL</p>
                </div>
                <div>
                  <p className="text-sm/relaxed">Market(s)</p>
                  <Badge>
                    <Link href="https://dex.zeta.markets/">Zeta Markets</Link>
                  </Badge>
                </div>
                <div>
                  <p className="text-sm/relaxed">Total Deposits</p>
                  <p className="font-bold">{vault0SolanaBalance} SOL</p>
                </div>
              </CardBody>
              <CardFooter>
                <Button size="sm">
                  <Link href="/vaults/0">View</Link>
                </Button>
              </CardFooter>
            </>
          ) : (
            <>
              <CardBody className="grid grid-cols-2 gap-4 border-y py-4">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-4">
                    <Typography level="body4" color="secondary">
                      Balance
                    </Typography>
                    <Typography level="body4" className="font-semibold">
                      {solanaBalance ? solanaBalance : "N/A"}
                    </Typography>
                  </div>

                  <Input
                    type="number"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="Amount"
                  />

                  {result !== "idle" && result === "success" && (
                    <Alert status="success">
                      <AlertIcon />
                      <Link href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`} isExternal>
                        View success transaction <ExternalLinkIcon mx="2px" />
                      </Link>
                    </Alert>
                  )}
                  {result !== "idle" && result === "failed" && (
                    <Alert status="error">
                      <AlertIcon />
                      Transaction failed! Please try again.
                    </Alert>
                  )}
                </div>
              </CardBody>
              <CardFooter>
                <ButtonGroup spacing="2">
                  {connected ? (
                    <Button isLoading={loading} disabled={!amount} onClick={submitTransaction}>
                      Transfer
                    </Button>
                  ) : (
                    <ConnectWalletButton />
                  )}
                  <Button onClick={toggleDepositView(false)}>Cancel</Button>
                </ButtonGroup>
              </CardFooter>
            </>
          )}
        </Card>
        <Vault0ComingSoon />
      </div>
    </>
  )
}

const Vault0Hero = () => {
  return (
    <section className="w-full py-8 md:py-16 lg:py-20 xl:py-24">
      <div className="container px-4 md:px-6">
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="space-y-2">
            <div className="flex justify-center">
              <div className="text-9xl font-extrabold tracking-tighter">
                <span>STRATEGY</span>
              </div>
              <div className="mt-4 block text-4xl">
                <span>V</span>
                <span>0</span>
              </div>
            </div>

            <p className="mx-auto max-w-[700px] text-gray-500 dark:text-gray-400 md:text-xl">
              The V0 Strategy is the first incantation of the Murk Protocol market making strategy. It is set on a fixed
              asset, spread and profit factor. More vaults will be added soon.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

const Vault0ComingSoon = () => {
  return (
    <Card>
      <CardHeader>
        <Flex justifyContent="space-between">
          <Heading size="md">Strategy V0: Grid Market Maker</Heading>
          <Badge>Unavailable</Badge>
        </Flex>
      </CardHeader>

      <CardBody className="grid grid-cols-2 gap-4 border-y py-4">
        <div>
          <p className="text-sm/relaxed">Estimated APR</p>
          <p className="font-bold">--</p>
        </div>
        <div>
          <p className="text-sm/relaxed">Available</p>
          <p className="font-bold">--</p>
        </div>
        <div>
          <p className="text-sm/relaxed">Market(s)</p>
          <Badge>
            <Link href="https://app.drift.trade/">Drift Protocol</Link>
          </Badge>
        </div>
        <div>
          <p className="text-sm/relaxed">Total Deposits</p>
          <p className="font-bold">--</p>
        </div>
      </CardBody>
      <CardFooter>
        <Button disabled size="sm">
          Coming Soon
        </Button>
      </CardFooter>
    </Card>
  )
}
