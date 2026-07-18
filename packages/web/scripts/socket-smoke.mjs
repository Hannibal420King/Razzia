/* oxlint-disable typescript/no-unsafe-argument, typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access -- Socket.IO smoke data is intentionally runtime-validated. */
import { randomUUID } from "node:crypto"
import { io } from "socket.io-client"

const baseUrl = process.env.RAZZIA_BASE_URL ?? "http://127.0.0.1:3000"
const managerPassword = process.env.RAZZIA_MANAGER_PASSWORD
const smokeQuizId = process.env.RAZZIA_SMOKE_QUIZ_ID ?? "vortex-smoke"
const timeoutMs = 30_000

if (!managerPassword) {
  throw new Error("RAZZIA_MANAGER_PASSWORD is required")
}

const createSocket = () =>
  io(baseUrl, {
    path: "/ws",
    transports: ["websocket"],
    forceNew: true,
    auth: { clientId: randomUUID() },
  })

const waitFor = (socket, event, predicate = () => true) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler)
      reject(new Error(`Timed out waiting for ${event}`))
    }, timeoutMs)
    const handler = (...args) => {
      if (!predicate(...args)) {
        return
      }

      clearTimeout(timer)
      socket.off(event, handler)
      resolve(args.length === 1 ? args[0] : args)
    }

    socket.on(event, handler)
  })

const waitForStatus = (socket, name) =>
  waitFor(socket, "game:status", (status) => status?.name === name)

const waitForConnection = (socket) =>
  socket.connected ? Promise.resolve() : waitFor(socket, "connect")

const manager = createSocket()
const player = createSocket()

try {
  await waitForConnection(manager)

  const configPromise = waitFor(manager, "manager:config")
  manager.emit("manager:auth", managerPassword)
  const config = await configPromise
  const quiz = config.quizz.find((item) => item.id === smokeQuizId)

  if (!quiz) {
    throw new Error(`Smoke quiz ${smokeQuizId} was not found`)
  }

  const createdPromise = waitFor(manager, "manager:gameCreated")
  manager.emit("game:create", quiz.id)
  const created = await createdPromise

  await waitForConnection(player)

  const roomPromise = waitFor(player, "game:successRoom")
  player.emit("player:join", created.inviteCode)
  const playerGameId = await roomPromise

  if (playerGameId !== created.gameId) {
    throw new Error("Player joined an unexpected game")
  }

  const joinedPromise = waitFor(player, "game:successJoin")
  player.emit("player:login", {
    gameId: created.gameId,
    data: { username: "Vortex Smoke" },
  })
  await joinedPromise

  const answeringPromise = waitForStatus(player, "SELECT_ANSWER")
  manager.emit("manager:startGame", { gameId: created.gameId })
  await answeringPromise

  const playerResultPromise = waitForStatus(player, "SHOW_RESULT")
  const managerResultPromise = waitForStatus(manager, "SHOW_RESPONSES")
  player.emit("player:selectedAnswer", {
    gameId: created.gameId,
    data: { answerKeys: [0] },
  })
  const [playerResult] = await Promise.all([
    playerResultPromise,
    managerResultPromise,
  ])

  const playerFinishedPromise = waitForStatus(player, "FINISHED")
  const managerFinishedPromise = waitForStatus(manager, "FINISHED")
  manager.emit("manager:showLeaderboard", { gameId: created.gameId })
  const [playerFinished] = await Promise.all([
    playerFinishedPromise,
    managerFinishedPromise,
  ])

  if (!playerResult.data.correct || playerFinished.data.rank !== 1) {
    throw new Error("Smoke player did not receive the expected scored result")
  }

  console.log(
    JSON.stringify(
      {
        transport: player.io.engine.transport.name,
        gameId: created.gameId,
        inviteCode: created.inviteCode,
        quiz: playerFinished.data.subject,
        correct: playerResult.data.correct,
        rank: playerFinished.data.rank,
        completed: true,
      },
      null,
      2,
    ),
  )
} finally {
  manager.disconnect()
  player.disconnect()
}
