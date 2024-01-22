import Link from "next/link"

export default function HomePage() {
  return (
    <>
      <section className="w-full bg-[#ffffff] py-12 md:py-24 lg:py-32 xl:py-48">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
                Welcome to Murk Protocol
              </h1>
              <p className="mx-auto max-w-[700px] text-gray-500 dark:text-gray-400 md:text-xl">
                A decentralized protocol for accessible market making strategies.
              </p>
            </div>
            <Link
              className="inline-flex h-9 items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-gray-50 shadow transition-colors hover:bg-gray-900/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:pointer-events-none disabled:opacity-50 dark:bg-gray-50 dark:text-gray-900 dark:hover:bg-gray-50/90 dark:focus-visible:ring-gray-300"
              href="/vaults"
            >
              Explore Strategies
            </Link>
          </div>
        </div>
      </section>

      <section className="w-full bg-[#f8f9fa] py-12 md:py-24 lg:py-32 xl:py-48">
        <div className="container flex px-4 md:px-6">
          <div className="w-full md:w-1/2">
            <div className="rounded border-8 border-black shadow-lg" style={{ width: "fit-content" }}>
              <img
                alt="Container for Funds"
                className="mx-auto md:mx-0"
                height="300"
                src="/assets/candles_1.png"
                style={{
                  aspectRatio: "500/300",
                  objectFit: "cover",
                }}
                width="500"
              />
            </div>
          </div>

          <div className="flex w-full flex-col space-y-4 md:w-1/2">
            <div className="space-y-2">
              <h2 className="text-left text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl">
                Easily Accessible Strategies
              </h2>
              <p className="mx-auto max-w-[700px] text-left text-gray-500 dark:text-gray-400 md:text-xl">
                The Murk vaults act as containers that hold deposited funds to engage in market-making activities
                facilitated by the protocol. Each vault will have its own market making strategy.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full bg-[#ffffff] py-12 md:py-24 lg:py-32 xl:py-48">
        <div className="container flex px-4 md:px-6">
          <div className="flex w-full flex-col space-y-4 md:w-1/2">
            <div className="space-y-2">
              <h2 className="text-left text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl">
                Market-Making Strategies
              </h2>
              <p className="mx-auto max-w-[700px] text-left text-gray-500 dark:text-gray-400 md:text-xl">
                Within the vault, the deposited USDC is utilized in off-chain market-making strategies. These strategies
                involve actively trading on selected platforms, such as Zeta Markets (other protocols to follow), to
                capture trading spreads, provide liquidity, and optimize yield.
              </p>
            </div>
          </div>

          <div className="w-full md:w-1/2">
            <div className="rounded border-8 border-black shadow-lg" style={{ width: "fit-content" }}>
              <img
                alt="Market-Making Strategies"
                className="mx-auto md:mx-0"
                height="300"
                src="/assets/candles_2.png"
                style={{
                  aspectRatio: "500/300",
                  objectFit: "cover",
                }}
                width="500"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="w-full bg-[#f8f9fa] py-12 md:py-24 lg:py-32 xl:py-48">
        <div className="container flex px-4 md:px-6">
          <div className="w-full md:w-1/2">
            <div className="rounded border-8 border-black shadow-lg" style={{ width: "fit-content" }}>
              <img
                alt="Risk, Size, and Algorithm Preferences"
                className="mx-auto md:mx-0"
                height="300"
                src="/assets/candles_3.png"
                style={{
                  aspectRatio: "500/300",
                  objectFit: "cover",
                }}
                width="500"
              />
            </div>
          </div>

          <div className="flex w-full flex-col space-y-4 md:w-1/2">
            <div className="space-y-2">
              <h2 className="text-left text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl">
                Future: Risk, Size, and Algorithm Preferences
              </h2>
              <p className="mx-auto max-w-[700px] text-left text-gray-500 dark:text-gray-400 md:text-xl">
                Each vault may represent a specific market-making strategy, and users have the flexibility to choose
                vaults based on their risk tolerance, asset pair, desired spread of market-making positions, and
                algorithm preferences. The future of the protocol will enable DeFi participants to find vaults that
                better align with their preferences.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
