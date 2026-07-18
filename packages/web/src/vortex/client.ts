/* oxlint-disable eslint/no-inline-comments -- Vite requires the inline @vite-ignore import directive. */
export interface VortexRuntimeDisabled {
  enabled: false
}

export interface VortexRuntimeEnabled {
  enabled: true
  vortexOrigin: string
  sdkUrl: string
}

export type VortexRuntimeConfig = VortexRuntimeDisabled | VortexRuntimeEnabled

export interface VortexPlayerContext {
  id: string
  handle: string
  displayName: string
  avatarUrl: string | null
}

export interface VortexGameContext {
  user: VortexPlayerContext
  app: {
    id: string
    clientId: string
    slug: string
  }
  playSession: {
    id: string
  }
}

export type VortexEventAttributes = Record<
  string,
  string | number | boolean | null
>

export interface VortexGameClient {
  auth: {
    context: () => Promise<VortexGameContext>
  }
  play: {
    end: (_reason: "quit") => Promise<void>
  }
  events: {
    track: (
      _key: string,
      _attributes?: VortexEventAttributes,
      _options?: { eventId?: string; version?: number },
    ) => string
    flush: () => Promise<unknown>
  }
  navigation: {
    returnToVortex: (_path?: string) => void
  }
}

interface HostedVortexModule {
  createVortexGameClient: (_options: {
    vortexOrigin: string
    onSessionExpired: () => void
    onUnlock: (_unlock: { title: string }) => void
    onError: (_error: unknown) => void
  }) => Promise<VortexGameClient>
}

export interface VortexConnection {
  client: VortexGameClient
  config: VortexRuntimeEnabled
  context: VortexGameContext
}

type FetchRuntime = (
  _input: string,
  _init: {
    cache: "no-store"
    credentials: "same-origin"
    headers: { Accept: "application/json" }
  },
) => Promise<{ ok: boolean; json: () => Promise<unknown> }>

type ImportHostedModule = (_sdkUrl: string) => Promise<HostedVortexModule>

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)

const isLocalHost = (hostname: string): boolean =>
  ["localhost", "127.0.0.1", "[::1]"].includes(hostname)

export const parseVortexRuntimeConfig = (
  input: unknown,
): VortexRuntimeConfig => {
  if (!isRecord(input) || typeof input.enabled !== "boolean") {
    throw new Error("Vortex runtime config is invalid")
  }

  const allowedKeys = input.enabled
    ? ["enabled", "vortexOrigin", "sdkUrl"]
    : ["enabled"]

  if (Object.keys(input).some((key) => !allowedKeys.includes(key))) {
    throw new Error("Vortex runtime config contains unexpected fields")
  }

  if (!input.enabled) {
    return { enabled: false }
  }

  if (
    typeof input.vortexOrigin !== "string" ||
    typeof input.sdkUrl !== "string"
  ) {
    throw new Error("Vortex runtime URLs are missing")
  }

  const vortexOrigin = new URL(input.vortexOrigin)
  const sdkUrl = new URL(input.sdkUrl)
  const originProtocolIsSafe =
    vortexOrigin.protocol === "https:" ||
    (vortexOrigin.protocol === "http:" && isLocalHost(vortexOrigin.hostname))

  if (
    !originProtocolIsSafe ||
    vortexOrigin.username ||
    vortexOrigin.password ||
    vortexOrigin.pathname !== "/" ||
    vortexOrigin.search ||
    vortexOrigin.hash ||
    vortexOrigin.origin !== sdkUrl.origin ||
    sdkUrl.username ||
    sdkUrl.password ||
    !/^\/sdk\/(?:v1\/)?vortex-game-sdk\.js$/u.test(sdkUrl.pathname) ||
    sdkUrl.search ||
    sdkUrl.hash
  ) {
    throw new Error("Vortex supplied an unsafe SDK URL")
  }

  return {
    enabled: true,
    vortexOrigin: vortexOrigin.origin,
    sdkUrl: sdkUrl.href,
  }
}

const defaultFetchRuntime: FetchRuntime = (input, init) => fetch(input, init)

const defaultImportHostedModule: ImportHostedModule = async (sdkUrl) =>
  (await import(/* @vite-ignore */ sdkUrl)) as HostedVortexModule

export const createHostedVortexConnection = async ({
  fetchRuntime = defaultFetchRuntime,
  importHostedModule = defaultImportHostedModule,
  navigate = (href: string) => window.location.assign(href),
  onUnlock = (title: string) =>
    window.dispatchEvent(
      new CustomEvent("vortex:unlock", { detail: { title } }),
    ),
  onError = (error: unknown) => console.error("Vortex SDK error", error),
}: {
  fetchRuntime?: FetchRuntime
  importHostedModule?: ImportHostedModule
  navigate?: (_href: string) => void
  onUnlock?: (_title: string) => void
  onError?: (_error: unknown) => void
} = {}): Promise<VortexConnection | null> => {
  const response = await fetchRuntime("/api/vortex/config", {
    cache: "no-store",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  })

  if (!response.ok) {
    throw new Error("Vortex runtime config is unavailable")
  }

  const config = parseVortexRuntimeConfig(await response.json())

  if (!config.enabled) {
    return null
  }

  const sdk = await importHostedModule(config.sdkUrl)

  if (typeof sdk.createVortexGameClient !== "function") {
    throw new Error("Vortex SDK module is invalid")
  }

  // The hosted SDK defaults autoStart to true. Deliberately do not override it:
  // the SDK owns heartbeat timing and resumes server-acknowledged counters.
  const client = await sdk.createVortexGameClient({
    vortexOrigin: config.vortexOrigin,
    onSessionExpired: () =>
      navigate(new URL("/login", config.vortexOrigin).href),
    onUnlock: ({ title }) => onUnlock(title),
    onError,
  })
  const context = await client.auth.context()

  return Object.freeze({ client, config, context })
}

export const createVortexConnector = (
  factory: () => Promise<VortexConnection | null>,
) => {
  let active: Promise<VortexConnection | null> | undefined = undefined

  return {
    connect: () => {
      active ??= Promise.resolve().then(factory)

      return active
    },
    reset: () => {
      active = undefined
    },
  }
}

const connector = createVortexConnector(createHostedVortexConnection)

export const connectVortex = () => connector.connect()

export const resetVortexConnection = () => connector.reset()

export type RazziaVortexEvent =
  | { key: "lobby.joined"; attributes: Record<string, never> }
  | { key: "quiz.started"; attributes: Record<string, never> }
  | { key: "question.answered"; attributes: { correct: boolean } }
  | { key: "quiz.completed"; attributes: { winner: boolean } }

interface MarkerStorage {
  getItem: (_key: string) => string | null
  setItem: (_key: string, _value: string) => void
}

const browserMarkerStorage = (): MarkerStorage | null => {
  try {
    return globalThis.sessionStorage
  } catch {
    return null
  }
}

export const createVortexEventTracker = ({
  connect,
  storage = browserMarkerStorage(),
  createEventId = () => crypto.randomUUID(),
}: {
  connect: () => Promise<VortexConnection | null>
  storage?: MarkerStorage | null
  createEventId?: () => string
}) => {
  const tracked = new Set<string>()

  return async (
    event: RazziaVortexEvent,
    dedupeKey: string,
  ): Promise<boolean> => {
    const marker = `razzia:vortex:event:${event.key}:${dedupeKey}`

    let stored = false

    try {
      stored = storage?.getItem(marker) !== null
    } catch {
      // Browser storage can be unavailable; in-memory deduplication still works.
    }

    if (tracked.has(marker) || stored) {
      return false
    }

    const connection = await connect()

    if (!connection) {
      return false
    }

    const eventId = createEventId()
    connection.client.events.track(event.key, event.attributes, {
      eventId,
      version: 1,
    })
    tracked.add(marker)

    try {
      storage?.setItem(marker, eventId)
    } catch {
      // The SDK event queue remains durable where available; this marker only
      // protects React remounts from emitting the same gameplay fact twice.
    }

    return true
  }
}

const eventTracker = createVortexEventTracker({ connect: connectVortex })

export const trackVortexEventOnce = async (
  event: RazziaVortexEvent,
  dedupeKey: string,
): Promise<boolean> => {
  try {
    return await eventTracker(event, dedupeKey)
  } catch (error) {
    console.warn("Unable to queue Vortex gameplay event", error)

    return false
  }
}

export const endVortexPlayAndReturn = async (
  connection: VortexConnection,
  reportError: (_error: unknown) => void = () => undefined,
): Promise<void> => {
  try {
    await connection.client.events.flush()
  } catch (error) {
    reportError(error)
  }

  await connection.client.play.end("quit")
  connection.client.navigation.returnToVortex("/")
}

export const toRazziaUsername = (player: VortexPlayerContext): string => {
  const normalized = (
    player.displayName.trim() || player.handle.trim()
  ).replace(/\s+/gu, " ")
  let username = ""

  for (const character of normalized) {
    if (username.length + character.length > 20) {
      break
    }

    username += character
  }

  return username || "Vortex Player"
}
