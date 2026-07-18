import { randomUUID } from "node:crypto"
import { lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"

const password = process.env.RAZZIA_MANAGER_PASSWORD
const configRoot = resolve(process.env.CONFIG_PATH || "/app/config")
const configPath = join(configRoot, "game.json")

if (password !== undefined) {
  if (
    password.length < 16 ||
    password.length > 128 ||
    /\p{Cc}/u.test(password)
  ) {
    throw new Error(
      "RAZZIA_MANAGER_PASSWORD must be 16 to 128 printable characters",
    )
  }

  await mkdir(configRoot, { recursive: true })
  let config = {}
  try {
    const metadata = await lstat(configPath)
    if (!metadata.isFile()) {
      throw new Error("Razzia game config must be a regular file")
    }
    const parsed = JSON.parse(await readFile(configPath, "utf8"))
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Razzia game config must contain a JSON object")
    }
    config = parsed
  } catch (error) {
    if (error?.code !== "ENOENT") throw error
  }

  const temporary = join(configRoot, `.game.${randomUUID()}.tmp`)
  try {
    await writeFile(
      temporary,
      `${JSON.stringify({ ...config, managerPassword: password }, null, 2)}\n`,
      { encoding: "utf8", flag: "wx", mode: 0o600 },
    )
    await rename(temporary, configPath)
  } finally {
    await rm(temporary, { force: true })
  }
}
