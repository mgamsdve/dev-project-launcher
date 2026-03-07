# Dev Project Launcher

A local developer dashboard to start, stop, and monitor your development services from a single web UI — replacing the need for multiple open terminals.

---

## Features

- Project cards with live status indicators (running / stopped / starting)
- Start / Stop services with one click
- Real-time logs streamed via Server-Sent Events (SSE)
- Open in browser — jump to http://localhost:PORT instantly
- Auto-polling refreshes project status every 4 seconds
- Security: only commands defined in projects.json can ever be executed

---

## Installation

```bash
npm install
npm run dev
```

Then open **http://localhost:3000**

---

## Configuration

Edit `projects.json` to list the services you want to manage:

```json
[
  {
    "name": "API Server",
    "path": "/Users/you/dev/api",
    "command": "npm run dev",
    "port": 3001,
    "description": "Backend REST API"
  },
  {
    "name": "Frontend",
    "path": "/Users/you/dev/frontend",
    "command": "npm run dev",
    "port": 3002,
    "description": "React frontend"
  },
  {
    "name": "Rust Service",
    "path": "/Users/you/dev/rust-service",
    "command": "cargo run",
    "port": 4000
  }
]
```

| Field         | Type   | Required | Description                        |
|---------------|--------|----------|------------------------------------|
| `name`        | string | Yes      | Unique display name                |
| `path`        | string | Yes      | Absolute path to project root      |
| `command`     | string | Yes      | Command to start the service       |
| `port`        | number | Yes      | Port the service listens on        |
| `description` | string | No       | Optional short description         |

> **Security:** Only commands defined in `projects.json` are executed. Arbitrary user input is never passed to the shell.

---

## Project Structure

```
dev-project-launcher/
├── app/
│   ├── page.tsx                  # Dashboard UI
│   ├── layout.tsx
│   └── api/
│       ├── projects/route.ts     # GET  /api/projects
│       ├── start/route.ts        # POST /api/start
│       ├── stop/route.ts         # POST /api/stop
│       └── logs/route.ts         # GET  /api/logs (SSE)
├── components/
│   ├── Header.tsx
│   ├── ProjectCard.tsx
│   └── LogsPanel.tsx
├── lib/
│   ├── processManager.ts         # child_process + SSE pub/sub
│   └── projects.ts               # Load & validate projects.json
├── types/
│   └── project.ts
├── projects.json                 # Configure your projects here
└── README.md
```

---

## API

| Method | Endpoint            | Description                      |
|--------|---------------------|----------------------------------|
| GET    | `/api/projects`     | All projects with status         |
| POST   | `/api/start`        | Start: `{ "name": "..." }`       |
| POST   | `/api/stop`         | Stop: `{ "name": "..." }`        |
| GET    | `/api/logs?name=..` | SSE stream or JSON log snapshot  |

---

## Usage

1. Open **http://localhost:3000**
2. Click **Start** on a stopped project
3. Click **Logs** for the real-time log panel
4. Click **Open** to open the service in the browser
5. Click **Stop** to terminate the process

---

## Future Features (TODO)

- Docker container support — track containers via Docker SDK
- Auto project detection — scan directories for package.json, Cargo.toml, etc.
- Terminal emulator — interactive PTY via node-pty
- CPU / RAM monitoring per process
- Project groups — start/stop related services together
- Environment switching — .env.development, .env.production, etc.
