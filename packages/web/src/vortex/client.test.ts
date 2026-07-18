import { describe, expect, test, vi } from "vitest"
import {
  createHostedVortexConnection,
  createVortexConnector,
  createVortexEventTracker,
  endVortexPlayAndReturn,
  parseVortexRuntimeConfig,
  toRazziaUsername,
  type VortexConnection,
  type VortexGameClient,
} from "./client"

const context = {
  user: {
    id: "11111111-1111-4111-8111-111111111111",
    handle: "vortex-player",
    displayName: "Vortex Player",
    avatarUrl: null,
  },
  app: {
    id: "22222222-2222-4222-8222-222222222222",
    clientId: "33333333-3333-4333-8333-333333333333",
    slug: "razzia",
  },
  playSession: { id: "44444444-4444-4444-8444-444444444444" },
}

const client = (): VortexGameClient => ({
  auth: { context: vi.fn().mockResolvedValue(context) },
  play: { end: vi.fn().mockResolvedValue(undefined) },
  events: {
    track: vi.fn().mockReturnValue("event-id"),
    flush: vi.fn().mockResolvedValue({ accepted: 1 }),
  },
  navigation: { returnToVortex: vi.fn() },
})

const connection = (gameClient = client()): VortexConnection => ({
  client: gameClient,
  config: {
    enabled: true,
    vortexOrigin: "https://vortex.example.com",
    sdkUrl: "https://vortex.example.com/sdk/v1/vortex-game-sdk.js",
  },
  context,
})

describe("Vortex runtime config", () => {
  test("supports an explicit standalone fallback", () => {
    expect(parseVortexRuntimeConfig({ enabled: false })).toEqual({
      enabled: false,
    })
  })

  test("accepts only a safe same-origin hosted SDK URL", () => {
    expect(
      parseVortexRuntimeConfig({
        enabled: true,
        vortexOrigin: "https://vortex.example.com",
        sdkUrl: "https://vortex.example.com/sdk/v1/vortex-game-sdk.js",
      }),
    ).toEqual({
      enabled: true,
      vortexOrigin: "https://vortex.example.com",
      sdkUrl: "https://vortex.example.com/sdk/v1/vortex-game-sdk.js",
    })

    expect(() =>
      parseVortexRuntimeConfig({
        enabled: true,
        vortexOrigin: "https://vortex.example.com",
        sdkUrl: "https://evil.example/sdk/v1/vortex-game-sdk.js",
      }),
    ).toThrow("unsafe SDK URL")
    expect(() =>
      parseVortexRuntimeConfig({
        enabled: true,
        vortexOrigin: "http://vortex.example.com",
        sdkUrl: "http://vortex.example.com/sdk/v1/vortex-game-sdk.js",
      }),
    ).toThrow("unsafe SDK URL")
  })

  test("rejects accidental secret exposure", () => {
    expect(() =>
      parseVortexRuntimeConfig({
        enabled: false,
        VORTEX_SERVER_CREDENTIAL: "must-not-leak",
      }),
    ).toThrow("unexpected fields")
  })
})

test("the hosted client initializes once and keeps SDK auto-heartbeats enabled", async () => {
  const gameClient = client()
  const createClient = vi.fn().mockResolvedValue(gameClient)
  const fetchRuntime = vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        enabled: true,
        vortexOrigin: "https://vortex.example.com",
        sdkUrl: "https://vortex.example.com/sdk/v1/vortex-game-sdk.js",
      }),
  })
  const factory = () =>
    createHostedVortexConnection({
      fetchRuntime,
      importHostedModule: () =>
        Promise.resolve({
          createVortexGameClient: createClient,
        }),
      navigate: vi.fn(),
      onUnlock: vi.fn(),
      onError: vi.fn(),
    })
  const connector = createVortexConnector(factory)

  const [first, second] = await Promise.all([
    connector.connect(),
    connector.connect(),
  ])

  expect(first).toBe(second)
  expect(fetchRuntime).toHaveBeenCalledTimes(1)
  expect(createClient).toHaveBeenCalledTimes(1)
  expect(gameClient.auth.context).toHaveBeenCalledTimes(1)
  expect(first?.context.user.id).toBe(context.user.id)
  expect(createClient.mock.calls[0][0]).not.toHaveProperty("autoStart")
})

test("gameplay facts are queued once with exact manifest fields", async () => {
  const gameClient = client()
  const marker = new Map<string, string>()
  const track = createVortexEventTracker({
    connect: () => Promise.resolve(connection(gameClient)),
    storage: {
      getItem: (key) => marker.get(key) ?? null,
      setItem: (key, value) => marker.set(key, value),
    },
    createEventId: () => "55555555-5555-4555-8555-555555555555",
  })

  expect(
    await track(
      { key: "question.answered", attributes: { correct: true } },
      "game-1:question-2",
    ),
  ).toBe(true)
  expect(
    await track(
      { key: "question.answered", attributes: { correct: true } },
      "game-1:question-2",
    ),
  ).toBe(false)
  expect(gameClient.events.track).toHaveBeenCalledTimes(1)
  expect(gameClient.events.track).toHaveBeenCalledWith(
    "question.answered",
    { correct: true },
    {
      eventId: "55555555-5555-4555-8555-555555555555",
      version: 1,
    },
  )
})

test("explicit quit flushes, ends with quit, then returns to Vortex", async () => {
  const order: string[] = []
  const gameClient = client()
  gameClient.events.flush = vi.fn(() => {
    order.push("flush")

    return Promise.resolve()
  })
  gameClient.play.end = vi.fn((reason) => {
    order.push(`end:${reason}`)

    return Promise.resolve()
  })
  gameClient.navigation.returnToVortex = vi.fn((path) => {
    order.push(`return:${path}`)
  })

  await endVortexPlayAndReturn(connection(gameClient))

  expect(order).toEqual(["flush", "end:quit", "return:/"])
})

test("Vortex display names become valid ephemeral Razzia names", () => {
  expect(
    toRazziaUsername({
      ...context.user,
      displayName: "  A very long Vortex player name  ",
    }),
  ).toBe("A very long Vortex p")
})
