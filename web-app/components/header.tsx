import { MenuIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/router"
import ConnectWalletButton from "@/components/connect-wallet-button"
import { cn } from "@/utils/cn"
import { IconButton } from "./ui/icon-button"
import { Typography } from "./ui/typography"
import { Image } from "@chakra-ui/react"

const MenuItems = [
  {
    text: "Home",
    href: "/",
  },
  {
    text: "Strategies",
    href: "/coming-soon",
  },
  // {
  //   text: "About",
  //   href: "/about",
  // },
]

export default function Header() {
  const { asPath } = useRouter()

  return (
    <header className="fixed left-0 top-0 z-20 w-full border-b border-gray-200 bg-white">
      <div className="container mx-auto flex items-center p-4 md:px-6">
        <a href="/" className="flex items-center">
          <Typography as="span" level="h6" className="hidden whitespace-nowrap font-semibold md:inline-block">
            <Image src="assets/murk-logo.png" alt="murk" width={150} height={30} />
          </Typography>
        </a>

        <ul className="ml-10 hidden items-center gap-6 md:flex">
          {MenuItems.map((item) => (
            <li key={item.text}>
              <Link
                href={item.href}
                className={cn("text-gray-600 hover:underline", {
                  "text-gray-900": item.href === "/" ? asPath === item.href : asPath.startsWith(item.href),
                })}
              >
                <Typography level="body4" className="font-semibold">
                  {item.text}
                </Typography>
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex flex-1 items-center justify-end gap-2">
          <ConnectWalletButton />
          <IconButton className="md:hidden">
            <MenuIcon />
          </IconButton>
        </div>
      </div>
    </header>
  )
}
