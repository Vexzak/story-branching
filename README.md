# Branching Story Adventures — PWA

An installable Progressive Web App where students play interactive branching
stories, and administrators manage story content, review student performance,
and approve password-reset requests.

This repository currently contains **Phase 1 (Foundation)**. See
[Development phases](#development-phases) for what is implemented and what is
planned.

---

## What is implemented in Phase 1

- React + Vite client with React Router and a PWA manifest/service worker.
- Express REST API with authentication and admin-authorization middleware.
- Supabase Auth for identity; Supabase PostgreSQL for data.
- Database schema for the full application (profiles, stories, scenes, choices,
  story versions, game sessions, choice logs, password-reset tables, audit log)
  with Row Level Security policies.
- Seed data: **four complete, playable placeholder stories**.
- Student registration (server-validated, always creates a student).
- Student/admin login with role-based redirects.
- Protected routes on both the client and the server.
- A secure, script-based first-administrator bootstrap (never public signup).
- Real admin dashboard statistics from the database.
- Published-story listing and detail endpoints used by the student home page.

The admin-approved password recovery workflow is implemented. Other planned
features may still be in progress.

---

## Required software

- **Node.js 20 or newer** (this project was built and tested on Node 24) and npm.
- A **Supabase** account and project (free tier is fine).
- A code editor such as **Visual Studio Code**.
- A terminal (PowerShell, Terminal, or the VS Code integrated terminal).

---

## Installation

```bash
# 1. From the repository root, install both apps:
cd client && npm install
cd ../server && npm install
```

Or, from the root, run each in turn. There is no root package.json on purpose —
keeping the client and server separate keeps the setup simple.

---

## Environment variables

1. Copy the example file:

   ```bash
   cp .env.example .env
   ```

   On Windows PowerShell: `Copy-Item .env.example .env`

2. Open `.env` and fill in your Supabase values (see the next section).
3. Never commit `.env`. It is already listed in `.gitignore`.

`client/vite.config.js` sets `envDir` to the repository root, so the client reads
`VITE_*` values from this one file. `server/env.js` loads the same file.

---

## Supabase configuration

1. Create a project at <https://supabase.com>.
2. Open **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL` and `VITE_SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY` and `VITE_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (server only — never
     expose it to the browser or commit it)
3. Optional but recommended: in **Authentication → Providers → Email**, turn off
   "Confirm email" so student accounts work immediately. The signup endpoint
   already creates users with a confirmed email, so this is only relevant if you
   change that behaviour.
4. Configure **Authentication -> URL Configuration** so the Site URL and
   Redirect URLs include the deployed client origin and `/reset-password`.
   Password reset emails use this redirect. Configure Supabase email delivery
   (custom SMTP for production) so approved requests can reach students.

---

## Database schema and migrations

All schema lives in `database/schema.sql`. To apply it:

1. In Supabase, open **SQL Editor → New query**.
2. Paste the entire contents of `database/schema.sql` and click **Run**.
3. Open a new query, paste `database/seed.sql`, and click **Run**.

If the database was set up before this recovery flow was added, run
`database/migrations/20261109_password_reset_tracking.sql` in the SQL Editor.
For offline gameplay progress syncing, also run
`database/migrations/20261111_offline_choice_sync.sql` in the SQL Editor.

### Password recovery

Students submit their username on the forgot-password page. Their request
appears on the admin dashboard, where an administrator can approve or reject
it. Rejected requests show the decision on the student's recovery-status page.
Approved requests send a Supabase password-reset email to the email address
already registered to that account. The email link opens the new-password page.
The student can keep the recovery-status page open to see decision updates.

`database/seed.sql` creates four placeholder stories, each with a start scene, a
decision scene, one correct choice, failure scenes for the wrong choices, and an
ending. It also publishes an immutable version of each story. It is safe to
re-run: it does nothing if stories already exist.

### Schema highlights

- `profiles` — one row per Supabase Auth user, with a case-insensitive unique
  username. Passwords are never stored here.
- `stories` / `scenes` / `choices` — mutable draft content. Branching uses
  `destination_scene_id`, never choice text. Composite foreign keys guarantee
  choices only point at scenes in the same story. A partial unique index allows
  at most one correct choice per scene.
- `story_versions` — immutable JSON snapshot created by
  `publish_story_version(story_id, published_by)`. Active sessions bind to a
  version so later edits do not change an in-progress playthrough.
- `game_sessions`, `choice_logs` — playthroughs and every selection, with text
  snapshots so old reports stay readable after content edits.
- `password_reset_requests`, `password_reset_tokens` — approval workflow and
  single-use token hashes (used in Phase 5).
- `audit_logs` — administrative action history.
- Row Level Security is enabled on every table. The Express backend uses the
  service-role key, which bypasses RLS; the policies protect any direct client
  access.

---

## Seed data

Four placeholder stories are inserted by `database/seed.sql`. Replace their text
and images later through the admin story editor (Phase 3).

---

## Secure admin bootstrap

The first administrator is created only through a script — never through the
public signup form.

1. Set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_USERNAME`, and optionally
   `ADMIN_DISPLAY_NAME` in `.env`.
2. Run:

   ```bash
   cd server
   npm run bootstrap-admin
   ```

The script creates (or updates) the Supabase Auth user, confirms the email, and
upserts a `profiles` row with `role = 'admin'`. It is idempotent, so you can
re-run it to reset the admin password. The password is read from the environment
and is never printed or stored in plaintext.

After running it, remove the `ADMIN_*` lines from `.env` if you like.

---

## Development commands

Run the API and the client in **two terminals**.

Terminal 1 — backend:

```bash
cd server
npm run dev        # http://localhost:4000  (node --watch restarts on changes)
```

Terminal 2 — frontend:

```bash
cd client
npm run dev        # http://localhost:5173
```

Open <http://localhost:5173>. Vite proxies `/api/*` to the backend on port 4000,
so no CORS setup is needed in development.

Other commands:

```bash
cd client && npm run build     # production build -> client/dist
cd client && npm run preview   # preview the production build
cd server && npm start         # run the API without watch mode
```

When `client/dist` exists, the Express server serves it automatically, so a
single `npm start` in `server/` runs the whole app in production.

---

## Testing

Phase 1 acceptance checks you can run manually:

1. **Registration** — create an account at `/signup`. Try a duplicate username
   and a duplicate email; both must be rejected.
2. **Login** — sign in at `/login`. Students land on `/home`; an admin lands on
   `/admin`.
3. **Protected routes** — while logged out, visiting `/home` or `/admin`
   redirects to `/login`. A student visiting `/admin` is redirected to `/home`.
4. **Admin authorization** — a student calling `GET /api/admin/dashboard` with
   their token receives `403`.
5. **Story listing** — the student home page shows the four seeded stories
   loaded from the database.
6. **Dashboard** — the admin dashboard shows live counts (no fabricated values).
7. **PWA** — run `npm run build` in `client/`, then `npm run preview`; the app
   is installable from a supported browser.

There is no automated test suite yet; it will be added alongside later phases.

---

## Deployment

Deployment is intentionally flexible until the hosting provider is confirmed.

- **Backend** (Render, Railway, Fly.io, a VPS, etc.): deploy `server/`, set the
  environment variables from `.env.example`, and run `npm start`. Build the
  client first (`cd client && npm run build`) and include `client/dist` so the
  server can serve it, or host the client separately and set `CLIENT_ORIGIN` to
  the client's URL.
- **Static client** (Netlify, Vercel, Cloudflare Pages, Supabase Storage): build
  `client/` and point `/api` at the deployed backend.
- Set `NODE_ENV=production` and a strong, unique `SUPABASE_SERVICE_ROLE_KEY`
  managed through the host's secret store — never in the repository.

---

## Project structure

```
branching-story-pwa/
├── client/                  React + Vite PWA
│   ├── public/
│   │   ├── icons/           App icons for installability
│   │   └── images/          Placeholder sprites and backgrounds
│   └── src/
│       ├── pages/           One file per page (Login, Signup, StudentHome, ...)
│       ├── App.jsx          Routing, auth context, route guards, layout
│       ├── main.jsx         Entry point
│       ├── api.js           Fetch wrapper that attaches the auth token
│       ├── supabase.js      Browser Supabase client (anon key only)
│       └── index.css        All styles
├── server/                  Express API
│   ├── routes/              auth, me, stories, admin
│   ├── middleware/          auth (requireAuth/requireAdmin), error handling
│   ├── scripts/             bootstrap-admin.js
│   ├── app.js               Express app + server bootstrap
│   ├── env.js               Environment loading and validation
│   └── supabase.js          Privileged (service-role) Supabase client
├── database/
│   ├── schema.sql           Full schema, functions, RLS
│   └── seed.sql             Four placeholder stories
├── .env.example
├── .gitignore
└── README.md
```

---

## Development phases

| Phase | Scope | Status |
| ----- | ----- | ------ |
| 1 | Foundation: auth, schema, seed, protected routes, admin bootstrap | **Done** |
| 2 | Reusable branching-story engine, sessions, choice logs, replay | Planned |
| 3 | Admin story/scene/choice editor, image upload, validate + publish | Planned |
| 4 | Student analytics, session histories, attempt reports | Planned |
| 5 | Admin-approved password recovery | Planned |
| 6 | Character sprites and animation triggers | Planned |
| 7 | PWA polish and full QA | Planned |

---

## Known limitations

- Gameplay, story editing, detailed analytics, and password recovery are not
  implemented yet (Phases 2–5). Their routes exist and clearly say so.
- Placeholder artwork only. Characters and backgrounds are simple placeholders
  until final assets are supplied.
- Published stories and their media can be downloaded for offline play.
  Offline selections are saved on the device and synchronized when the app
  reconnects while open or returns to the foreground. Apply
  `database/migrations/20261111_offline_choice_sync.sql` before using this
  feature. Offline progress remains on that device until it syncs; it is not
  browser background sync.
- No automated test suite yet.
- Story versioning is implemented at the database level
  (`publish_story_version`); the admin publishing endpoint arrives in Phase 3.

---

## Troubleshooting

- **"Missing required environment variable"** — `.env` is missing or incomplete.
  Copy `.env.example` to `.env` and fill in the Supabase values.
- **Client shows a Supabase config error in the console** — `VITE_SUPABASE_URL`
  or `VITE_SUPABASE_ANON_KEY` is empty. Restart `npm run dev` after editing
  `.env`; Vite only reads env files at startup.
- **`Invalid or expired session`** — sign out and sign in again; the access
  token may have expired.
- **`No profile is linked to this account`** — the auth user exists without a
  `profiles` row. Re-run `npm run bootstrap-admin`, or re-register the student.
- **API not reachable** — confirm the backend is running on port 4000 and that
  the Vite proxy in `client/vite.config.js` still points there.
