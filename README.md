# Where Is Waldo

Where Is Waldo is a browser-based hidden-object game built with a vanilla JavaScript frontend and an Express + Prisma backend. Players choose a level, start a timed run, click on the image to guess a character's location, and submit their completion time to a leaderboard when they finish.

## Features

- Browse available levels from the home page
- Start or resume a timed game session
- Validate image clicks against server-side character coordinates
- Track found characters during an active session
- Expire inactive or over-time sessions
- Submit finished runs to a leaderboard
- View the top scores overall or per level

## Tech stack

### Frontend

- HTML
- CSS
- Vanilla JavaScript modules

### Backend

- Node.js
- Express
- Express Session
- Prisma ORM
- PostgreSQL

## Project structure

```text
where_is_waldo/
|-- backend/
|   |-- src/
|   |   |-- app.js
|   |   |-- config/
|   |   |-- controllers/
|   |   |-- prisma/
|   |   |-- routes/
|   |   `-- services/
|   |-- tests/
|   |-- package.json
|   `-- .env
|-- frontend/
|   |-- assets/
|   |-- css/
|   |-- js/
|   |-- game.html
|   |-- index.html
|   |-- leaderboard.html
|   `-- vercel.json
`-- DEPLOYMENT.md
```

## How the app works

### Home page

The frontend requests available levels from `GET /levels` and renders a card for each level. Choosing a level starts or resumes a game session, then redirects the player to `game.html`.

### Game flow

When a level starts, the backend creates or resumes a `GameSession`. Each click sent to `POST /levels/:levelId/click` is validated on the server against the stored coordinates and radius for the selected character.

### Leaderboard flow

When all characters are found, the player can submit their name. The backend stores the score as a `LeaderboardEntry`, and the frontend redirects to the leaderboard page.

## Database models

The Prisma schema includes the following core models:

- `Level`: a playable Waldo scene
- `Character`: a target to find inside a level
- `GameSession`: a timed play session for one level
- `FoundCharacter`: a join record tracking which characters were found in a session
- `LeaderboardEntry`: a finished score tied to one completed session
- `Session`: persisted Express session records used by `express-session`

## Prerequisites

Install these before running the project locally:

- Node.js 18 or newer
- npm
- PostgreSQL

## Environment variables

Create `backend/.env` with values for your local setup.

```env
DATABASE_URL=postgresql://USERNAME:PASSWORD@localhost:5432/waldo_db?schema=public
DATABASE_URL_TEST=postgresql://USERNAME:PASSWORD@localhost:5432/waldo_db_test?schema=public
NODE_ENV=development
SECRET=replace-with-a-long-random-session-secret
PORT=3000
```

Notes:

- `DATABASE_URL` is the development database used by the app
- `DATABASE_URL_TEST` is used by the test suite
- `SECRET` is used to sign the session cookie
- `PORT` defaults to `3000`, which matches the frontend API expectation in local development

## Run locally

### 1. Install backend dependencies

From the project root:

```powershell
cd backend
npm install
```

### 2. Create the databases

Create two PostgreSQL databases:

- `waldo_db`
- `waldo_db_test`

You can use pgAdmin, the PostgreSQL shell, or any database GUI you prefer.

### 3. Run Prisma migrations

From the `backend` directory:

```powershell
npx prisma migrate deploy
```

If you are starting fresh in local development and want Prisma to generate the schema from migrations:

```powershell
npx prisma generate
```

### 4. Seed data if needed

If your levels and characters are not already in the database, run the seed scripts in `backend/src/models/` using the workflow you already use for populating the app.

### 5. Start the backend

From the `backend` directory:

```powershell
npm run dev
```

The backend will run at `http://localhost:3000`.

### 6. Open the frontend

For this project, the simplest local setup is to use the backend server to serve the frontend files as well.

Open:

```text
http://localhost:3000/frontend/index.html
```

This keeps the frontend and backend on the same origin during development and avoids local CORS/session issues.

## Running tests

From the `backend` directory:

```powershell
npm test
```

If tests fail because the database tables do not exist, make sure your test database matches the Prisma schema and migrations have been applied.

## API overview

### `GET /levels`

Returns all available levels.

### `POST /levels/:levelId/start`

Starts a new session or resumes an existing session for the level.

### `POST /levels/:levelId/click`

Validates a click attempt for a selected character.

### `GET /leaderboard`

Returns leaderboard entries. Supports filtering by `levelId`.

### `POST /leaderboard`

Submits a completed run to the leaderboard.

## Local development notes

- The backend uses `express-session` with a Prisma-backed session store
- Session data is stored in the database, not only in memory
- Frontend production API calls are routed through `/api`
- Frontend local API calls target `http://localhost:3000`
- Use `localhost`, not `www.localhost`, for local development URLs

## Deployment

This project is prepared for a two-project Vercel setup:

- a frontend Vercel project with root directory `frontend`
- a backend Vercel project with root directory `backend`

The frontend includes a Vercel rewrite so `/api/*` can proxy to the backend deployment.

See `DEPLOYMENT.md` for deployment notes and environment configuration.

## Important security note

Do not commit real database passwords or production secrets to the repository. Replace local credentials in `backend/.env` with your own values and keep production secrets in your hosting provider's environment variable settings.
