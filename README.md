# Roll & Run Challenge

Kurtosys company run challenge for **August 2026**. Static React app with localStorage persistence, plus a Strava auth test API for shared runs.

Live site: https://kurtosys-jasonrenaud.github.io/dice_run_challenge/

## Stack

- React and TypeScript
- Vite
- Tailwind CSS
- shadcn/ui-style reusable primitives
- Lucide icons
- LocalStorage persistence for the challenge calendar
- Hono API for Strava OAuth and a shared run store

## Architecture

```text
src/
├── components/
│   ├── ui/                  Reusable Button, Card, and Badge primitives
│   ├── ChallengeCalendar.tsx
│   ├── Dashboard.tsx
│   ├── DiceRoller.tsx
│   └── HistoryAndStats.tsx
├── hooks/
│   └── useChallenge.ts      State and LocalStorage persistence
├── lib/
│   ├── challenge.ts         Rules, dates, calendar, and statistics
│   ├── share.ts             Share brief helpers
│   ├── stravaApi.ts         Client for the Strava test API
│   └── utils.ts             Class name helper
├── pages/
│   └── StravaTestPage.tsx   Connect Strava, pick activity, shared board
├── types/
│   └── challenge.ts         Domain types
├── App.tsx                  Challenge UI
├── index.css                Tailwind theme and global styles
└── main.tsx                 Entry + hash routing

server/
├── index.ts                 Strava OAuth + shared runs/leaderboard API
├── store.ts                 Central JSON store
└── strava.ts                Strava OAuth helpers
```

Office dice rolls are recorded manually in the app. August setup creates rest days and pending challenge slots.

The Strava test page (`#/strava-test`) signs users in with Strava, lets them pick an activity, and writes it to a central store used for the shared leaderboard and run feed.

## Local development

```bash
npm install
cp .env.example .env
```

Fill in Strava credentials in `.env` from [strava.com/settings/api](https://www.strava.com/settings/api):

- Authorization Callback Domain: `localhost`
- `STRAVA_REDIRECT_URI=http://localhost:5173/api/auth/callback`

Run the UI and API together in two terminals:

```bash
npm run dev:api
npm run dev
```

Open:

- Challenge app: http://localhost:5173/dice_run_challenge/
- Strava test page: http://localhost:5173/dice_run_challenge/#/strava-test

Vite proxies `/api/*` to the Hono server on port `8787`, so session cookies stay on the app origin.

## Strava test API

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

Shared data is written to `server/data/store.json` (gitignored). Anyone using the same running API instance sees the same leaderboard and uploads.

## Build

```bash
npm run build
```

Static output is written to `dist/`.

## GitHub Pages

Pushes to `main` trigger `.github/workflows/deploy-pages.yml`, which builds and deploys `dist/` to GitHub Pages.

Challenge calendar data remains device-specific in the browser. The Strava shared board only works while the API is running (local for now, or a hosted API later).
