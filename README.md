# Roll & Run Challenge

Kurtosys company run challenge for **August 2026**. Static React app with localStorage persistence. No backend.

Live site: https://kurtosys-jasonrenaud.github.io/dice_run_challenge/

## Stack

- React and TypeScript
- Vite
- Tailwind CSS
- shadcn/ui-style reusable primitives
- Lucide icons
- LocalStorage persistence

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
│   └── utils.ts             Class name helper
├── types/
│   └── challenge.ts         Domain types
├── App.tsx                  Application composition and theme
├── index.css                Tailwind theme and global styles
└── main.tsx                 React entry point
```

Office dice rolls are recorded manually in the app. August setup creates rest days and pending challenge slots.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:5173/dice_run_challenge/`.

## Build

```bash
npm run build
```

Static output is written to `dist/`.

## GitHub Pages

Pushes to `main` trigger `.github/workflows/deploy-pages.yml`, which builds and deploys `dist/` to GitHub Pages.

All challenge data is device-specific because it is stored in the current browser.
