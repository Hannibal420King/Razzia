import assert from "node:assert/strict"
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"
import { fileURLToPath } from "node:url"

const script = fileURLToPath(
  new URL("./write-manager-config.mjs", import.meta.url),
)

const run = (configPath, password) =>
  spawnSync(process.execPath, [script], {
    encoding: "utf8",
    env: {
      ...process.env,
      CONFIG_PATH: configPath,
      ...(password === undefined ? {} : { RAZZIA_MANAGER_PASSWORD: password }),
    },
  })

test("atomically provisions and rotates the manager password without logging it", async () => {
  const configPath = await mkdtemp(join(tmpdir(), "razzia-config-"))
  const first = "Vortex-Razzia-Manager-2026!"
  await writeFile(
    join(configPath, "game.json"),
    JSON.stringify({ managerPassword: "PASSWORD", quizDuration: 30 }),
  )
  const initial = run(configPath, first)
  assert.equal(initial.status, 0, initial.stderr)
  assert.doesNotMatch(initial.stdout + initial.stderr, new RegExp(first, "u"))
  assert.deepEqual(
    JSON.parse(await readFile(join(configPath, "game.json"), "utf8")),
    {
      managerPassword: first,
      quizDuration: 30,
    },
  )

  const second = "Vortex-Razzia-Rotated-2026!"
  const rotated = run(configPath, second)
  assert.equal(rotated.status, 0, rotated.stderr)
  assert.deepEqual(
    JSON.parse(await readFile(join(configPath, "game.json"), "utf8")),
    {
      managerPassword: second,
      quizDuration: 30,
    },
  )
  if (process.platform !== "win32") {
    assert.equal(
      (await stat(join(configPath, "game.json"))).mode & 0o777,
      0o600,
    )
  }
  assert.deepEqual(
    (await readdir(configPath)).filter((entry) => entry.endsWith(".tmp")),
    [],
  )
})

test("rejects weak values and refuses a non-regular game config", async () => {
  const weakPath = await mkdtemp(join(tmpdir(), "razzia-config-"))
  assert.notEqual(run(weakPath, "too-short").status, 0)
  assert.notEqual(
    run(weakPath, `Vortex-Razzia-${String.fromCharCode(0x85)}-Manager`).status,
    0,
  )

  const linkedPath = await mkdtemp(join(tmpdir(), "razzia-config-"))
  try {
    await symlink(
      join(linkedPath, "outside.json"),
      join(linkedPath, "game.json"),
    )
  } catch (error) {
    if (error?.code !== "EPERM") throw error
    await mkdir(join(linkedPath, "game.json"))
  }
  const linked = run(linkedPath, "Vortex-Razzia-Manager-2026!")
  assert.notEqual(linked.status, 0)
  assert.match(linked.stderr, /regular file/u)
})

test("keeps standalone configuration unchanged when no managed secret is supplied", async () => {
  const configPath = await mkdtemp(join(tmpdir(), "razzia-config-"))
  const result = run(configPath, undefined)
  assert.equal(result.status, 0, result.stderr)
  await assert.rejects(readFile(join(configPath, "game.json"), "utf8"), {
    code: "ENOENT",
  })
})
