import { EVENTS } from "@razzia/common/constants"
import { STATUS } from "@razzia/common/types/game/status"
import Button from "@razzia/web/components/Button"
import Card from "@razzia/web/components/Card"
import Input from "@razzia/web/components/Input"
import Loader from "@razzia/web/components/Loader"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import {
  toRazziaUsername,
  trackVortexEventOnce,
} from "@razzia/web/vortex/client"
import { useVortexSession } from "@razzia/web/vortex/VortexProvider"

import { useNavigate } from "@tanstack/react-router"
import { type KeyboardEvent, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

const Username = () => {
  const { socket } = useSocket()
  const { gameId, login, setStatus } = usePlayerStore()
  const navigate = useNavigate()
  const [username, setUsername] = useState("")
  const { t } = useTranslation()
  const { state: vortexState, retry } = useVortexSession()
  const autoJoinAttempted = useRef(false)
  const submittedUsername = useRef("")

  const vortexUsername =
    vortexState.mode === "connected"
      ? toRazziaUsername(vortexState.connection.context.user)
      : null

  const handleLogin = () => {
    if (!gameId) {
      return
    }

    submittedUsername.current = username
    socket.emit(EVENTS.PLAYER.LOGIN, { gameId, data: { username } })
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      handleLogin()
    }
  }

  useEvent(EVENTS.GAME.SUCCESS_JOIN, (joinedGameId) => {
    setStatus(STATUS.WAIT, { text: "game:waitingForPlayers" })
    login(submittedUsername.current)
    void trackVortexEventOnce(
      { key: "lobby.joined", attributes: {} },
      joinedGameId,
    )

    navigate({ to: "/party/$gameId", params: { gameId: joinedGameId } })
  })

  useEffect(() => {
    if (!gameId || !vortexUsername || autoJoinAttempted.current) {
      return
    }

    autoJoinAttempted.current = true
    submittedUsername.current = vortexUsername
    socket.emit(EVENTS.PLAYER.LOGIN, {
      gameId,
      data: { username: vortexUsername },
    })
  }, [gameId, socket, vortexUsername])

  if (vortexState.mode === "connecting") {
    return (
      <Card className="items-center gap-3 text-center">
        <Loader className="text-primary h-16" />
        <p className="font-semibold">Connecting your Vortex player&hellip;</p>
      </Card>
    )
  }

  if (vortexState.mode === "error") {
    return (
      <Card className="gap-3 text-center">
        <p className="font-semibold">Your Vortex player could not be loaded.</p>
        <Button onClick={retry}>Reconnect Vortex</Button>
      </Card>
    )
  }

  if (vortexState.mode === "connected") {
    return (
      <Card className="items-center gap-2 text-center">
        <Loader className="text-primary h-16" />
        <p className="font-semibold" data-vortex-auto-login>
          Joining as {vortexUsername}&hellip;
        </p>
        <p className="text-sm text-gray-500">
          Using your app-scoped Vortex identity
        </p>
      </Card>
    )
  }

  return (
    <Card>
      <Input
        className="text-center"
        onChange={(e) => setUsername(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t("game:usernamePlaceholder")}
      />
      <Button className="mt-4" onClick={handleLogin}>
        {t("common:submit")}
      </Button>
    </Card>
  )
}

export default Username
