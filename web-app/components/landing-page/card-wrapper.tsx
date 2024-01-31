import { Box, Button, Container, Flex, Heading, Icon, Stack, Text, useColorModeValue } from "@chakra-ui/react"
import { ReactElement } from "react"
import { FcAbout, FcAssistant, FcCollaboration, FcDonate, FcManager } from "react-icons/fc"

interface CardProps {
  heading: string
  description: string
  icon: ReactElement
  href: string
}

const Card = ({ heading, description, icon, href }: CardProps) => {
  return (
    <Box maxW={{ base: "full", md: "275px" }} w={"full"} borderWidth="1px" borderRadius="lg" overflow="hidden" p={5}>
      <Stack align={"start"} spacing={2}>
        <Flex
          w={16}
          h={16}
          align={"center"}
          justify={"center"}
          color={"white"}
          rounded={"full"}
          bg={useColorModeValue("gray.100", "gray.700")}
        >
          {icon}
        </Flex>
        <Box mt={2}>
          <Heading size="md">{heading}</Heading>
          <Text mt={1} fontSize={"sm"}>
            {description}
          </Text>
        </Box>
      </Stack>
    </Box>
  )
}

export default function GridListWith() {
  return (
    <Box p={4}>
      <Stack spacing={4} as={Container} maxW={"3xl"} textAlign={"center"}>
        <Heading fontSize={{ base: "2xl", sm: "4xl" }} fontWeight={"bold"}>
          Decentralized Market Maker Strategies (DMMS)
        </Heading>
        <Text color={"gray.600"} fontSize={{ base: "sm", sm: "lg" }}>
          Decentralized Market Maker Strategies (DMMS) revolutionize the financial trading landscape by leveraging
          blockchain technology to offer transparent, autonomous, and efficient market-making solutions. By
          democratizing access to sophisticated market-making algorithms, DMMS empower traders and investors to
          participate in financial markets with greater confidence and reduced barriers, fostering a more scalable and
          dynamic trading environment.
        </Text>
      </Stack>

      <Container maxW={"5xl"} mt={12}>
        <Flex flexWrap="wrap" gridGap={6} justify="center">
          <Card
            heading={"Decentralized Trading"}
            icon={<Icon as={FcAssistant} w={10} h={10} />}
            description={
              "Harness the power of blockchain to engage in transparent and autonomous trading with our Decentralized Market Maker Strategies."
            }
            href={"#"}
          />
          <Card
            heading={"Efficient Market Algorithms"}
            icon={<Icon as={FcCollaboration} w={10} h={10} />}
            description={
              "Leverage sophisticated market-making algorithms designed for decentralized environments to optimize your trading strategies."
            }
            href={"#"}
          />
          <Card
            heading={"Empower Your Investments"}
            icon={<Icon as={FcDonate} w={10} h={10} />}
            description={
              "Participate in the financial markets with confidence, utilizing cutting-edge, decentralized tools to enhance your investment decisions."
            }
            href={"#"}
          />
        </Flex>
      </Container>
    </Box>
  )
}
