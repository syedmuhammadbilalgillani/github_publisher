# ZipShip — GitHub ZIP Publisher

Upload a project ZIP and publish its contents straight to a GitHub repository
in a guided 5-step wizard. Built with **Next.js 16 (App Router)**, TypeScript,
Tailwind CSS, Shadcn-style UI, Prisma + PostgreSQL, NextAuth (Auth.js v5), and
the GitHub Git Data API.

> A user can log in with GitHub, upload a ZIP, preview the file tree, choose or
> create a repository, configure the commit, click **Publish**, and watch the
> files get pushed to GitHub in real time — then receive the repository URL and
> commit hash.

## Features (implemented in this MVP)

- **GitHub OAuth** login/logout via NextAuth (Auth.js v5). No personal access
  tokens — the OAuth access token is **encrypted (AES-256-GCM)** at rest.
- **Dashboard** with repository management, upload wizard, activity history, and
  settings.
- **Upload wizard**
  1. Drag-and-drop / browse ZIP upload with validation and progress.
  2. File-tree preview (nested folders preserved).
  3. Repository selection — create new or pick an existing repo.
  4. Commit configuration (branch + message).
  5. **Real-time publish** via a streaming SSE response.
- **ZIP processing engine** (in-memory, no temp extraction): file count / size
  limits, hidden-file detection, blocked executable extensions, **path-traversal
  guards**, and a **ZIP-bomb** uncompressed-size cap.
- **GitHub publishing engine** using the Git Data API — creates blobs, a tree,
  and a commit, then updates the branch ref. Works for empty repos and existing
  branches. No `git` binary required (serverless-friendly).
- **Activity history** with full logs, commit hashes, statuses, and **retry** of
  failed jobs.
- **Security**: encrypted tokens, per-user rate limiting on upload/publish/repo
  endpoints, and server-side auth checks on every protected route.

## Tech stack

| Layer    | Choice                                            |
| -------- | ------------------------------------------------- |
| Frontend | Next.js 16 App Router, React 19, Tailwind v4      |
| Backend  | Route Handlers + Server Actions                   |
| Auth     | NextAuth / Auth.js v5, GitHub OAuth               |
| Database | PostgreSQL + Prisma 6                             |
| GitHub   | `@octokit/rest` (Git Data API)                    |
| ZIP      | `fflate` (in-memory unzip)                        |
| Deploy   | Docker / docker-compose (also Vercel-compatible)  |

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

You will need:

- A **PostgreSQL** database (`DATABASE_URL`).
- A **GitHub OAuth App** (`AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`). Set the
  Authorization callback URL to `http://localhost:3000/api/auth/callback/github`.
- `AUTH_SECRET` — `openssl rand -base64 32`
- `TOKEN_ENCRYPTION_KEY` — `openssl rand -hex 32` (32 bytes / 64 hex chars).

### 3. Set up the database

```bash
npx prisma migrate deploy   # apply the committed migration
# or, for local iteration:
npx prisma db push
```

### 4. Run

```bash
npm run dev
```

Open http://localhost:3000.

## Docker

```bash
# Provide AUTH_SECRET, AUTH_GITHUB_ID, AUTH_GITHUB_SECRET, TOKEN_ENCRYPTION_KEY
# in your shell or an .env file, then:
docker compose up --build
```

This starts PostgreSQL and the app, runs migrations on boot, and serves on
port 3000.

## Architecture notes

- **Publishing method.** We use the GitHub **Git Data API** (blobs → tree →
  commit → ref) rather than spawning a local `git` process, so publishing works
  in serverless environments and never needs the repo checked out to disk.
- **Progress streaming.** `/api/publish` returns a `text/event-stream` and emits
  `progress` / `completed` / `failed` events as the job runs, persisting status
  and logs to `PublishJob`. This delivers real-time progress without requiring
  Redis/WebSockets for the MVP.
- **Temp ZIP storage.** Uploaded archives are held in the OS temp directory
  between the upload and publish steps (`lib/storage.ts`). This suits a single
  long-running server. For multi-instance / serverless, swap it for object
  storage (S3 / Cloudinary / UploadThing) — only `lib/storage.ts` changes.
- **Rate limiting.** `lib/rate-limit.ts` is an in-memory fixed-window limiter.
  Replace with a Redis-backed limiter for multi-instance deploys.
- **Next.js 16 specifics.** Route protection lives in `proxy.ts` (the v16
  replacement for `middleware.ts`, nodejs runtime). All request APIs
  (`cookies`, `params`, `searchParams`) are async.

## Project layout

```
app/
  page.tsx                      Landing (features / pricing / FAQ / login)
  dashboard/                    Protected dashboard (layout + pages)
  api/
    auth/[...nextauth]/         NextAuth handlers
    upload/                     ZIP upload + validation
    repos/                      List/create/delete repositories
    publish/                    Streaming publish (+ [jobId]/retry)
components/                     UI primitives + feature components
lib/
  auth.ts        NextAuth config            github.ts   GitHub Git Data API
  prisma.ts      Prisma client              zip.ts      Extraction + validation
  crypto.ts      AES-256-GCM token crypto   storage.ts  Temp ZIP storage
  session.ts     Auth helpers               publish-runner.ts  Publish stream
  config.ts      Limits / blocked types     rate-limit.ts      Rate limiting
prisma/schema.prisma             Users, Account, Session, Repository, Upload, PublishJob
proxy.ts                         Route protection (Next.js 16 "proxy")
```

## Roadmap (not in this MVP)

These were intentionally deferred to keep the first cut focused and runnable:

- BullMQ/Redis background queue for very large archives.
- Auto-deploy (Vercel/Netlify/Cloudflare) after push.
- AI analysis (framework detection, README/release-note generation).
- Multi-repository and scheduled publishing.
