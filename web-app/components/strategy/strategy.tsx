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

type StrategyProps = {
  name: string
  vaultBalance: number
  vaultMax: number
  market: string
}

export const Strategy = ({ market, name, vaultBalance, vaultMax }: StrategyProps) => {
  return (
    <div>
      <Card>
        <CardHeader>
          <Flex justifyContent="space-between">
            <Heading size="md">{name}</Heading>
            <Badge colorScheme="green">New</Badge>
          </Flex>
        </CardHeader>

        <>
          <CardBody className="grid grid-cols-2 gap-4 border-y py-4">
            <div>
              <p className="text-sm/relaxed">Estimated APR</p>
              <p className="font-bold">--</p>
            </div>
            <div>
              <p className="text-sm/relaxed">Available</p>
              <p className="font-bold">{vaultMax - vaultBalance} SOL</p>
            </div>
            <div>
              <p className="text-sm/relaxed">Market(s)</p>
              <Badge>
                <Link href="https://dex.zeta.markets/">{market}</Link>
              </Badge>
            </div>
            <div>
              <p className="text-sm/relaxed">Total Deposits</p>
              <p className="font-bold">{vaultBalance} SOL</p>
            </div>
          </CardBody>
          <CardFooter>
            <Button size="sm">
              <Link href="/strategies/0">View</Link>
            </Button>
          </CardFooter>
        </>
      </Card>
    </div>
  )
}
