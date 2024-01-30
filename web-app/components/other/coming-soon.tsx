// components/ComingSoon.js
import React, { useState } from "react"
import { Flex, Heading, Text, Button, Input, Center, FormControl, useToast, Link } from "@chakra-ui/react"
import { emailSubscribe } from "@/utils/utils"

const ComingSoon = () => {
  const [email, setEmail] = useState("")
  const toast = useToast()

  const handleSubscribe = () => {
    emailSubscribe(email, setEmail, toast)
  }

  return (
    <Center minHeight="100vh" bg="gray.100" flexDirection="column" px={6}>
      <Heading as="h1" size="2xl" mb={4}>
        Coming Soon
      </Heading>
      <Text fontSize="lg" mb={8}>
        We're currently building this out. Stay tuned!
      </Text>
      <FormControl maxWidth="400px" width="100%" mx="auto" mb={4}>
        <Input placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} size="md" />
        <Flex justifyContent="center">
          <Button colorScheme="blue" onClick={handleSubscribe} mt={4}>
            Get Updated
          </Button>
        </Flex>
      </FormControl>
      <Link href="/" color="teal.500" mt={4}>
        Go Back to Home
      </Link>
    </Center>
  )
}

export default ComingSoon
