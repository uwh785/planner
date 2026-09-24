# Planner

Task planner with visual countdown timers. Built with Go, SvelteKit, and PostgreSQL.

## Tech Stack

- **Backend**: Go + Chi router + pgx + PostgreSQL
- **Frontend**: SvelteKit 5 + Vite + adapter-static
- **Database**: PostgreSQL 16
- **Styling**: Tailwind CSS 4

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Go 1.23+
- Node.js 18+

### 1. Start the database

```bash
docker compose up -d
```

### 2. Run migrations

```bash
cd backend
go run ./cmd/migrate
```

### 3. Start the backend

```bash
cd backend
go run ./cmd/server
```

### 4. Start the frontend

```bash
cd web
npm install
npm run dev
```

The app will be available at http://localhost:5173.

## Environment Variables

### Backend

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://postgres:postgres@localhost:5434/planner` |
| `JWT_SECRET` | Secret key for JWT signing | - |
| `JWT_TTL_HOURS` | JWT token lifetime in hours | `72` |
| `PORT` | Server port | `8080` |

### Frontend

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:8080` |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Current user |
| GET | `/api/lists` | List task lists |
| POST | `/api/lists` | Create list |
| PUT | `/api/lists/:id` | Update list |
| DELETE | `/api/lists/:id` | Delete list |
| GET | `/api/tasks` | List tasks |
| POST | `/api/tasks` | Create task |
| GET | `/api/tasks/:id` | Get task |
| PUT | `/api/tasks/:id` | Update task |
| DELETE | `/api/tasks/:id` | Delete task |
| PUT | `/api/tasks/:id/start` | Start timer |
| PUT | `/api/tasks/:id/pause` | Pause timer |
| PUT | `/api/tasks/:id/complete` | Complete task |
| GET | `/api/tasks/:id/subtasks` | List subtasks |
| POST | `/api/tasks/:id/subtasks` | Create subtask |
| PUT | `/api/tasks/:id/subtasks/:sid` | Update subtask |
| DELETE | `/api/tasks/:id/subtasks/:sid` | Delete subtask |
| GET | `/api/tags` | List tags |
| POST | `/api/tags` | Create tag |
| DELETE | `/api/tags/:id` | Delete tag |
| GET | `/api/dashboard` | Dashboard summary |

## Features

- Tasks with deadlines and priority levels
- Visual countdown timer (SVG ring)
- Start/pause/complete task workflow
- Subtasks
- Task lists (categories)
- Tags
- Calendar view
- Dashboard with active, overdue, and upcoming tasks
- i18n (Spanish/English)
- Dark/light theme support
