import withBundleAnalyzer from "@next/bundle-analyzer"
import withPlugins from "next-compose-plugins"

function throwEnv(envVar) {
  if (!process.env[envVar]) {
    throw new Error(`Missing environment variable: ${envVar}`)
  }
  return process.env[envVar]
}

/**
 * @type {import('next').NextConfig}
 */
const config = withPlugins([[withBundleAnalyzer({ enabled: false })]], {
  reactStrictMode: true,
  env: {
    NEXT_PRIVATE_PGHOST: throwEnv("NEXT_PRIVATE_PGHOST"),
    NEXT_PRIVATE_PGUSER: throwEnv("NEXT_PRIVATE_PGUSER"),
    NEXT_PRIVATE_PGPASSWORD: throwEnv("NEXT_PRIVATE_PGPASSWORD"),
    NEXT_PRIVATE_PGDATABASE: throwEnv("NEXT_PRIVATE_PGDATABASE"),
    NEXT_PRIVATE_PORT: throwEnv("NEXT_PRIVATE_PORT"),
  },
})

export default config
