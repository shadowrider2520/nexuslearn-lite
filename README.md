# NexusLearn Lite

Study together with an AI tutor. Create a study room, paste any topic, and get a
day-by-day roadmap tailored to how much time you can commit per day. Each step can
generate hands-on tasks and mini-projects, and an AI tutor lives in the room chat to
help the group get unstuck — no more watching random tutorials with zero direction.

Live at **https://nexuslearn-lite-ecru.vercel.app/**

## Features

- **Rooms with invite codes** — create a room, share the 6-character code, and everyone studies in one place
- **AI-generated roadmaps** — paste a topic or notes, choose minutes-per-day and detail level, get a day-wise plan
- **Tasks & mini-projects per step** — generate practice items for any roadmap step, one click
- **Live progress** — see each member's completion % update in real time
- **AI tutor chat** — a warm, hint-first tutor that adapts to the group (it even switches languages, e.g. Tanglish, on request)
- **Realtime collaboration** — members, chat, and progress sync via Supabase Realtime

## Tech stack

- **Next.js 16** (App Router, Server Actions, route handlers)
- **Supabase** — Postgres, Auth, Realtime
- **Groq** — `openai/gpt-oss-120b` powers the roadmap generator, task generator, and tutor (override with the `GROQ_MODEL` env var)
- **Tailwind CSS v4**

## Local setup

1. Clone the repo and install dependencies:

   ```bash
   npm install
   ```

2. Create a Supabase project (https://supabase.com) and apply both migrations in order:

   ```bash
   # run 0001_init.sql and then 0002_production_hardening.sql in the SQL Editor,
   # or with the Supabase CLI: supabase db push
   ```

3. Create a Groq API key at https://console.groq.com

4. Copy the env template and fill it in:

   ```bash
   cp .env.example .env.local
   ```

   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` come from
   Supabase → Settings → API. `GROQ_API_KEY` comes from Groq. Optionally set
   `GROQ_MODEL` to override the AI model (defaults to `openai/gpt-oss-120b`).

5. Run the dev server:

   ```bash
   npm run dev
   ```

   Open http://localhost:3000 — the landing page is at `/`, and the app is at `/dashboard`.

## Database schema

The canonical schema lives in [`supabase/migrations/`](supabase/migrations/):
`profiles`, `rooms`, `room_members`, `roadmaps`, `progress`, `tasks`, `task_progress`,
`messages`, and `documents`, plus row-level-security policies. The hardening migration
also adds secure invite-code joining, a private documents bucket with a 10 MB limit,
and AI request throttling.

## Scripts

```bash
npm run dev      # development server
npm run build    # production build
npm run start    # run the production build
npm run lint     # eslint
npm test         # unit tests (vitest) for the AI helpers
```

## Deploy on Vercel

Before importing the repository, apply `0001_init.sql` and then
`0002_production_hardening.sql` in the Supabase SQL Editor (or run `supabase db push`
from a linked project). After deployment, add the production address to Supabase
Authentication URL Configuration so sign-in redirects work correctly.

1. Push this repo to GitHub and import it at https://vercel.com
2. Add the three env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GROQ_API_KEY`) — optionally `GROQ_MODEL`
3. Deploy — Vercel detects Next.js automatically

## Project structure

```
app/
  api/chat/route.ts        # AI tutor endpoint (saves messages, calls Groq)
  api/roadmap/route.ts     # roadmap generation endpoint
  api/tasks/route.ts       # per-step task generation endpoint
  room/[id]/page.tsx       # room page — all state/logic
  room/components/         # presentational components (navbar, chat, roadmap, members)
  dashboard/page.tsx       # post-login rooms dashboard
  actions.ts               # server actions (create/join room, rename, delete, leave)
lib/
  ai/roadmap.ts            # roadmap prompt + flatten logic (unit-tested)
  ai/tutor-prompt.ts       # tutor system prompt builder (unit-tested)
  supabase/                # browser + server Supabase clients
  types.ts                 # shared domain types
proxy.ts                   # rewrites / to the landing page, refreshes Supabase session
public/landing.html        # marketing landing page served at /
supabase/migrations/       # SQL schema
```
