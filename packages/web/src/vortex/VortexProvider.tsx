import {
  connectVortex,
  endVortexPlayAndReturn,
  resetVortexConnection,
  type VortexConnection,
} from "@razzia/web/vortex/client"
import { LogOut, RefreshCw } from "lucide-react"
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import toast from "react-hot-toast"

type VortexState =
  | { mode: "connecting" }
  | { mode: "standalone" }
  | { mode: "connected"; connection: VortexConnection }
  | { mode: "error" }

interface VortexSessionValue {
  state: VortexState
  quitting: boolean
  retry: () => void
  quit: () => Promise<void>
}

const VortexSessionContext = createContext<VortexSessionValue>({
  state: { mode: "connecting" },
  quitting: false,
  retry: () => undefined,
  quit: () => Promise.resolve(),
})

export const useVortexSession = () => useContext(VortexSessionContext)

const VortexStatus = () => {
  const { state, quitting, retry, quit } = useVortexSession()

  if (state.mode === "standalone") {
    return null
  }

  if (state.mode === "connecting") {
    return (
      <div
        className="fixed right-4 bottom-16 z-100 rounded-full bg-black/80 px-3 py-2 text-sm font-semibold text-white shadow-xl backdrop-blur"
        data-vortex-state="connecting"
        role="status"
      >
        Connecting to Vortex&hellip;
      </div>
    )
  }

  if (state.mode === "error") {
    return (
      <div
        className="fixed right-4 bottom-16 z-100 flex items-center gap-3 rounded-xl border border-red-300/30 bg-black/90 px-3 py-2 text-sm text-white shadow-xl backdrop-blur"
        data-vortex-state="error"
        role="alert"
      >
        <span>Vortex session unavailable</span>
        <button
          className="flex items-center gap-1 rounded-lg bg-white px-2 py-1 font-semibold text-black"
          onClick={retry}
          type="button"
        >
          <RefreshCw className="size-4" />
          Retry
        </button>
      </div>
    )
  }

  const { user } = state.connection.context

  return (
    <div
      className="fixed right-4 bottom-16 z-100 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-xl border border-white/15 bg-black/85 px-3 py-2 text-white shadow-xl backdrop-blur"
      data-vortex-player-id={user.id}
      data-vortex-state="connected"
    >
      {user.avatarUrl ? (
        <img
          alt=""
          className="size-8 rounded-full object-cover"
          height="32"
          src={user.avatarUrl}
          width="32"
        />
      ) : (
        <div className="bg-primary flex size-8 items-center justify-center rounded-full font-bold">
          {user.displayName.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-xs text-white/65">Playing through Vortex</p>
        <p className="truncate text-sm font-semibold">{user.displayName}</p>
      </div>
      <button
        className="flex shrink-0 items-center gap-1 rounded-lg bg-white px-2 py-1 text-sm font-semibold text-black disabled:opacity-60"
        disabled={quitting}
        onClick={() => void quit()}
        type="button"
      >
        <LogOut className="size-4" />
        {quitting ? "Returning…" : "Return to Vortex"}
      </button>
    </div>
  )
}

export const RazziaVortexProvider = ({ children }: PropsWithChildren) => {
  const [state, setState] = useState<VortexState>({ mode: "connecting" })
  const [quitting, setQuitting] = useState(false)

  const start = useCallback(() => {
    let cancelled = false
    setState({ mode: "connecting" })

    void connectVortex()
      .then((connection) => {
        if (cancelled) {
          return
        }

        setState(
          connection
            ? { mode: "connected", connection }
            : { mode: "standalone" },
        )
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.error("Unable to initialize Vortex", error)
          setState({ mode: "error" })
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(start, [start])

  useEffect(() => {
    const onUnlock = (event: Event) => {
      const { detail } = event as CustomEvent<{ title?: string }>
      const { title } = detail

      if (title) {
        toast.success(title)
      }
    }

    window.addEventListener("vortex:unlock", onUnlock)

    return () => window.removeEventListener("vortex:unlock", onUnlock)
  }, [])

  const retry = useCallback(() => {
    resetVortexConnection()
    start()
  }, [start])

  const quit = useCallback(async () => {
    if (state.mode !== "connected" || quitting) {
      return
    }

    setQuitting(true)

    try {
      await endVortexPlayAndReturn(state.connection, (error) =>
        console.warn("Vortex event flush failed during quit", error),
      )
    } catch (error) {
      console.error("Unable to end the Vortex play session", error)
      toast.error("Could not return to Vortex. Please try again.")
      setQuitting(false)
    }
  }, [quitting, state])

  const value = useMemo(
    () => ({ state, quitting, retry, quit }),
    [quit, quitting, retry, state],
  )

  return (
    <VortexSessionContext.Provider value={value}>
      {children}
      <VortexStatus />
    </VortexSessionContext.Provider>
  )
}
