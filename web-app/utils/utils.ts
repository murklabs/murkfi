import { Toast } from "@chakra-ui/react"

export const emailSubscribe = async (
  email: string,
  setEmail: React.Dispatch<React.SetStateAction<string>>,
  toast: typeof Toast
): Promise<void> => {
  if (!email) {
    toast({
      title: "Please enter an email address.",
      status: "warning",
      duration: 3000,
      isClosable: true,
    })
    return
  }

  try {
    const response = await fetch("/api/capture-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    })

    if (response.ok) {
      toast({
        title: "Subscription successful!",
        description: "We've added your email to our notification list.",
        status: "success",
        duration: 5000,
        isClosable: true,
      })
    } else {
      toast({
        title: "Error",
        description: `Something went wrong. ${response.statusText}`,
        status: "error",
        duration: 3000,
        isClosable: true,
      })
    }
  } catch (error) {
    toast({
      title: "Error",
      description: "Something went wrong. Please try again.",
      status: "error",
      duration: 3000,
      isClosable: true,
    })
  }

  setEmail("")
}
