type SiteConfig = {
  name: string
  description: string
  url: string
  ogImage: string
  links: {
    twitter: string
    github: string
  }
}

export const siteConfig: SiteConfig = {
  name: "Murk Protocol",
  description: "A decentralized protocol for accessible market making strategies.",
  url: "https://murk.finance",
  ogImage: "https://murk.finance/og.jpg",
  links: {
    twitter: "https://twitter.com/murk-finance",
    github: "https://github.com/murklabs",
  },
}
