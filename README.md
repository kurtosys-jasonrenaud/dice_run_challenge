# Roll & Run Challenge

Kurtosys company run challenge for **August 2026**. Static React app with localStorage persistence, plus a Strava auth API for shared runs and leaderboard.

Live site: https://kurtosys-jasonrenaud.github.io/dice_run_challenge/

Strava section: https://kurtosys-jasonrenaud.github.io/dice_run_challenge/#strava

## Stack

- React and TypeScript
- Vite
- Tailwind CSS
- shadcn/ui-style reusable primitives
- Lucide icons
- LocalStorage persistence for the challenge calendar
- Hono API for Strava OAuth and a shared run store
- Cloudflare Worker + KV for the hosted API

## Architecture

```text
src/
├── components/
│   └── StravaBoard.tsx      Connect Strava, upload runs, shared leaderboard
├── hooks/
├── lib/
│   └── stravaApi.ts         Client for the Strava API (Bearer session)
├── App.tsx
└── main.tsx

server/
├── app.ts                   Shared Hono routes
├── index.ts                 Local Node server
├── worker.ts                Cloudflare Worker entry
├── store.ts                 Memory + KV store adapters
├── file-store.ts            Local JSON persistence
└── strava.ts                Strava OAuth helpers
```

## Local development

```bash
npm install
cp .env.example .env
```

Fill Strava credentials in `.env` from [strava.com/settings/api](https://www.strava.com/settings/api):

- Authorization Callback Domain: `localhost`
- `STRAVA_REDIRECT_URI=http://localhost:5173/api/auth/callback`

```bash
npm run dev:api
npm run dev
```

- Challenge app: http://localhost:5173/dice_run_challenge/
- Strava section: http://localhost:5173/dice_run_challenge/#strava

Leave `VITE_API_BASE_URL` empty locally so Vite proxies `/api` to port `8787`.

## Host the API on Cloudflare (required for GitHub Pages)

1. Log in once:

```bash
npx wrangler login
```

2. Create KV and put the id into `wrangler.toml`:

```bash
npm run cf:kv
```

3. Set Worker vars/secrets:

```bash
# After you know the workers.dev URL, update STRAVA_REDIRECT_URI in wrangler.toml vars
# or set it with:
npx wrangler secret put STRAVA_CLIENT_ID
npx wrangler secret put STRAVA_CLIENT_SECRET
```

Also set these Worker vars (in `wrangler.toml` or dashboard):

- `APP_ORIGIN=https://kurtosys-jasonrenaud.github.io/dice_run_challenge/`
- `STRAVA_REDIRECT_URI=https://<worker-name>.<account>.workers.dev/api/auth/callback`
- `ALLOWED_ORIGINS=https://kurtosys-jasonrenaud.github.io,http://localhost:5173`

4. Deploy:

```bash
npm run cf:deploy
```

5. In Strava API settings, set Authorization Callback Domain to:

```text
<worker-name>.<account>.workers.dev
```

6. In the GitHub repo, add Actions variable `VITE_API_BASE_URL` =
`https://<worker-name>.<account>.workers.dev`

Then push to `main` (or re-run the Pages workflow) so the frontend talks to the hosted API.

## Strava API

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | API status and credential check |
| `GET /api/auth/strava` | Start Strava OAuth |
| `GET /api/auth/callback` | OAuth callback |
| `GET /api/auth/me` | Current session athlete |
| `POST /api/auth/logout` | Clear session |
| `GET /api/strava/activities` | Recent Strava activities for the signed-in athlete |
| `POST /api/runs` | Publish a selected activity to the shared store |
| `GET /api/runs` | All uploaded runs |
| `GET /api/leaderboard` | Ranked totals from the shared store |

Local shared data: `server/data/store.json` (gitignored).  
Hosted shared data: Cloudflare KV binding `STORE`.

Sessions use a Bearer token stored in the browser after OAuth redirect.

## Build

```bash
npm run build
```

## GitHub Pages

Pushes to `main` trigger `.github/workflows/deploy-pages.yml`.

Challenge calendar data remains device-specific in the browser. The Strava shared board uses the hosted Worker API when `VITE_API_BASE_URL` is set.
