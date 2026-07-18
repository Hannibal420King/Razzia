<p align="center">
  <img width="450" height="120" align="center" src=".github/logo.svg">
  <br>
  <div align="center">
    <img alt="Visitor Badge" src="https://api.visitorbadge.io/api/visitors?path=https://github.com/Ralex91/Razzia/edit/main/README.md&countColor=%23FF9900">
    <img src="https://img.shields.io/docker/pulls/ralex91/razzia?style=for-the-badge&color=FF9900" alt="Docker Pulls">
  </div>
</p>

## 🧩 What is this project?

Razzia is a straightforward and open-source quiz platform, allowing users to host it on their own server for smaller events.

> **Disclaimer**: Razzia is an independent, open-source software project. It is not affiliated with, endorsed by, or sponsored by any third-party quiz platform or service. Any resemblance to other quiz platforms is purely incidental.

<p align="center">
  <img width="30%" src=".github/previews/1.png" alt="Login">
  <img width="30%" src=".github/previews/2.png" alt="Manager Room">
  <img width="30%" src=".github/previews/3.png" alt="Question Screen">
</p>

## ⚙️ Prerequisites

Choose one of the following deployment methods:

### Without Docker

- Node.js : version 24 or higher
- PNPM : version 10.16 or higher (learn more [here](https://pnpm.io/))

### With Docker

- Docker and Docker Compose

## 📖 Getting Started

Choose your deployment method:

### 🐳 Using Docker (Recommended)

Using Docker Compose (recommended):
You can find the docker compose configuration in the repository:
[docker-compose.yml](/compose.yml)

```bash
docker compose up -d
```

Or using Docker directly:

```bash
docker run -d \
  -p 3000:3000 \
  -v ./config:/app/config \
  ralex91/razzia:latest
```

The image is also published on the GitHub Container Registry, if you prefer using it instead of Docker Hub:

```bash
docker run -d \
  -p 3000:3000 \
  -v ./config:/app/config \
  ghcr.io/ralex91/razzia:latest
```

**Configuration Volume:**
The `-v ./config:/app/config` option mounts a local `config` folder to persist your game settings and quizzes. This allows you to:

- Edit your configuration files directly on your host machine
- Keep your settings when updating the container
- Easily backup your quizzes and game configuration

The folder will be created automatically on first run with an example quiz to get you started.

The application will be available at http://localhost:3000

### 🛠️ Without Docker

1. Clone the repository:

```bash
git clone https://github.com/Ralex91/Razzia.git
cd ./Razzia
```

2. Install dependencies:

```bash
pnpm install
```

3. Build and start the application:

```bash
# Development mode
pnpm dev

# Production mode
pnpm build
pnpm start
```

## ⚙️ Configuration

**⚠️ Required:** set a manager password in `config/game.json` before going live.

```json
{
  "managerPassword": "PASSWORD"
}
```

`managerPassword` **must be changed** from the default `"PASSWORD"` value, otherwise manager access is blocked.

The Vortex image can provision and rotate this value without replacing quiz or result data. Configure `RAZZIA_MANAGER_PASSWORD` as a Vortex runtime secret with a printable 16-128 character value; the entrypoint writes it atomically to the persistent `config/game.json` before the socket service starts.

## Vortex v2 integration

The `vortex-v2` branch includes a hosted Vortex Game SDK adapter and a
versioned `vortex.manifest.json`. A managed deployment injects
`VORTEX_PUBLIC_URL` and `VORTEX_SDK_URL`; the container exposes only those two
safe public values from `/api/vortex/config`. Server credentials and event
signing secrets are never included in the browser response or bundle.

Vortex players use their app-scoped display identity as their ephemeral Razzia
name. The SDK owns play-session heartbeats, and the visible **Return to Vortex**
action explicitly ends the play session with the `quit` reason before
navigating back. When the two public Vortex variables are absent, Razzia keeps
its normal standalone username flow.

The manifest declares the truthful client-session events `lobby.joined`,
`quiz.started`, `question.answered`, and `quiz.completed`. The deployment stack
runs Nginx and Socket.IO together behind the APP gateway on port 3000, persists
`/app/config`, and uses an ephemeral `/tmp` mount so the remaining root
filesystem can stay read-only.

Fork/source and license details are recorded in
[`VORTEX_SOURCE_AND_ATTRIBUTION.md`](VORTEX_SOURCE_AND_ATTRIBUTION.md).

## 📚 Documentation

- [Configuration](docs/configuration.md): manager password, via the `config` folder.
- [Quiz](docs/quiz.md): creating and structuring quizzes.
- [Branding](docs/branding.md): optional custom theming.
- [Reverse Proxy](docs/reverse-proxy.md): running behind Traefik, Nginx, Caddy, or another reverse proxy.
- [WebSocket Protocol](docs/websocket-protocol.md): build a custom client (e.g. an ESP32 physical buzzer).

Full index in [docs/](docs/README.md).

## 🎮 How to Play

1. Access the manager interface at http://localhost:3000/manager
2. Enter the manager password (defined in `config/game.json`)
3. Share the game URL (http://localhost:3000) and room code with participants
4. Wait for players to join
5. Click the start button to begin the game

## 📝 Contributing

Contributions are welcome! Please read the [CONTRIBUTING.md](.github/CONTRIBUTING.md) guide before submitting a pull request.

For bug reports or feature requests, please [create an issue](https://github.com/Ralex91/Razzia/issues).

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Ralex91/Razzia&type=date&logscale=&legend=bottom-right)](https://www.star-history.com/#Ralex91/Razzia&type=date&logscale=&legend=bottom-right)
