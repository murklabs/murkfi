import Link from "next/link"
import { siteConfig } from "@/config/site"

export default function Footer() {
  return (
    <footer>
      <div className="container mx-auto w-full p-4 md:py-8">
        <div className="sm:flex sm:items-center sm:justify-between">
          <a href="/" className="mb-4 flex items-center sm:mb-0">
            <span className="self-center whitespace-nowrap text-2xl font-semibold">{siteConfig.name}</span>
          </a>
          <ul className="mb-6 flex flex-wrap items-center text-sm font-medium text-gray-500 sm:mb-0">
            <li>
              <Link href="/" className="mr-4 hover:underline md:mr-6 ">
                Home
              </Link>
            </li>
            <li>
              <Link href="/vaults" className="mr-4 hover:underline md:mr-6 ">
                Vaults
              </Link>
            </li>
            <li>
              <Link href="/about" className="mr-4 hover:underline md:mr-6 ">
                About
              </Link>
            </li>
            {/* TODO: Privacy Policy */}
            {/* <li>
              <a href="#" className="mr-4 hover:underline md:mr-6">
                Privacy Policy
              </a>
            </li> */}
            {/* TODO: Contact us */}
            <li>
              <a href="#" className="hover:underline">
                Contact
              </a>
            </li>
          </ul>
        </div>
        <hr className="my-6 border-gray-200 sm:mx-auto lg:my-8" />
        <span className="block text-sm text-gray-500 sm:text-center">
          © 2023{" "}
          <Link href="/" className="hover:underline">
            {siteConfig.name}
          </Link>
          . All Rights Reserved.
        </span>
      </div>
    </footer>
  )
}
