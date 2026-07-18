// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-argument, typescript/no-unsafe-call, typescript/no-unsafe-member-access
import { writeFileSync } from "node:fs"

const outputPath = "/tmp/vortex-config.json"
const vortexOrigin = process.env.VORTEX_PUBLIC_URL?.trim()
const sdkUrl = process.env.VORTEX_SDK_URL?.trim()

const isLocalHost = (hostname) =>
  ["localhost", "127.0.0.1", "[::1]"].includes(hostname)

const validate = () => {
  if (!vortexOrigin && !sdkUrl) {
    return { enabled: false }
  }

  if (!vortexOrigin || !sdkUrl) {
    throw new Error(
      "VORTEX_PUBLIC_URL and VORTEX_SDK_URL must be configured together",
    )
  }

  const origin = new URL(vortexOrigin)
  const sdk = new URL(sdkUrl)
  const originProtocolIsSafe =
    origin.protocol === "https:" ||
    (origin.protocol === "http:" && isLocalHost(origin.hostname))

  if (
    !originProtocolIsSafe ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    sdk.origin !== origin.origin ||
    sdk.username ||
    sdk.password ||
    !/^\/sdk\/(?:v1\/)?vortex-game-sdk\.js$/u.test(sdk.pathname) ||
    sdk.search ||
    sdk.hash
  ) {
    throw new Error("The supplied Vortex public runtime URLs are unsafe")
  }

  return {
    enabled: true,
    vortexOrigin: origin.origin,
    sdkUrl: sdk.href,
  }
}

writeFileSync(outputPath, `${JSON.stringify(validate())}\n`, {
  encoding: "utf8",
  mode: 0o600,
})
