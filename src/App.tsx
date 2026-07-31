import { Dices, Moon, Route, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { ChallengeCalendar } from "./components/ChallengeCalendar";
import { ChallengeStrip } from "./components/ChallengeStrip";
import { Dashboard } from "./components/Dashboard";
import { DiceRoller } from "./components/DiceRoller";
import { HistoryAndStats } from "./components/HistoryAndStats";
import { Reveal } from "./components/Reveal";
import { ShareBrief } from "./components/ShareBrief";
import { StravaBoard } from "./components/StravaBoard";
import { Button, Card } from "./components/ui/primitives";
import { useChallenge } from "./hooks/useChallenge";
import kurtosysLogo from "../logo-w.svg?url";
import {
  CHALLENGE_LABEL,
  CHALLENGE_YEAR,
  getChallengeDate,
  getChallengeMonth,
  getRollType,
  rollAppliesToChallenge,
  toIsoDate,
  WEEKDAY_DISTANCES,
  WEEKEND_DISTANCES,
} from "./lib/challenge";
import type { Theme } from "./types/challenge";

function initialTheme(): Theme {
  const stored = localStorage.getItem("roll-and-run:theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function RuleGrid() {
  return (
    <section aria-labelledby="rules-title">
      <div className="mb-5">
        <p className="eyebrow">Keep it simple</p>
        <h2 id="rules-title" className="section-title">August 2026 rules</h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lift-card p-5">
          <p className="eyebrow">Monday</p>
          <h3 className="mt-3 font-display text-2xl font-black">Always rest</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            No roll is needed. Recover, reset, and get ready for the week.
          </p>
        </Card>
        <Card className="lift-card p-5 lg:col-span-2">
          <p className="eyebrow">Tuesday to Friday</p>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {(Object.entries(WEEKDAY_DISTANCES) as [string, number | [number, number]][]).map(
              ([face, distance]) => (
                <div key={face} className="rounded-xl bg-muted/65 p-3 text-center">
                  <span className="mx-auto grid size-7 place-items-center rounded-md bg-ink font-display font-black text-white">
                    {face}
                  </span>
                  <p className="mt-2 text-xs font-bold">
                    {Array.isArray(distance)
                      ? `${distance[0]} / ${distance[1]} km`
                      : distance === 0
                        ? "Rest"
                        : `${distance} km`}
                  </p>
                </div>
              ),
            )}
          </div>
        </Card>
        <Card className="lift-card p-5 lg:col-span-2">
          <p className="eyebrow">Friday roll for the weekend</p>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {(Object.entries(WEEKEND_DISTANCES) as [string, number][]).map(([face, distance]) => (
              <div key={face} className="rounded-xl bg-primary/[.07] p-3 text-center">
                <span className="mx-auto grid size-7 place-items-center rounded-md bg-primary font-display font-black text-white">
                  {face}
                </span>
                <p className="mt-2 text-xs font-bold">{distance === 0 ? "Rest" : `${distance} km`}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card className="lift-card p-5">
          <p className="eyebrow">Weekend</p>
          <h3 className="mt-3 font-display text-2xl font-black">One run, two days</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Complete the weekend distance once, on either Saturday or Sunday.
          </p>
        </Card>
      </div>
    </section>
  );
}

export default function App() {
  const month = getChallengeMonth();
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const challenge = useChallenge(month);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("roll-and-run:theme", theme);
  }, [theme]);

  const today = new Date();
  const todayChallengeIso = getChallengeDate(today);
  const existingRoll = todayChallengeIso
    ? challenge.rolls.find((roll) => roll.challengeDate === toIsoDate(todayChallengeIso))
    : undefined;

  const canRollToday = getRollType(today) !== null && rollAppliesToChallenge(today);
  const augustRolls = challenge.rolls.filter((roll) =>
    roll.challengeDate.startsWith(`${CHALLENGE_YEAR}-08`) ||
    (roll.type === "weekend" && roll.challengeDate.startsWith(`${CHALLENGE_YEAR}-07-31`)),
  );

  function clearHistory() {
    if (window.confirm("Clear all August 2026 challenge data from this device?")) {
      challenge.clearHistory();
    }
  }

  function handleGenerateAugust() {
    const hasAugust = challenge.rolls.some(
      (roll) =>
        roll.challengeDate.startsWith(`${CHALLENGE_YEAR}-08`) ||
        (roll.type === "weekend" && roll.challengeDate.startsWith(`${CHALLENGE_YEAR}-07-31`)),
    );
    const confirmed = hasAugust
      ? window.confirm(
          "Reset the August 2026 calendar scaffold? Confirmed office rolls will be replaced with pending slots.",
        )
      : window.confirm(
          "Set up August 2026 with Monday rest days and pending challenge slots? Record each office dice result as it happens.",
        );
    if (!confirmed) return;

    const result = challenge.generateAugust(CHALLENGE_YEAR);
    window.alert(
      `August 2026 ready: ${result.summary.restDays} rest days, ${result.summary.weekdayChallenges} weekday slots, ${result.summary.weekendChallenges} weekend slots. Record office rolls as they happen.`,
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/95 text-white backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6">
          <a href="#top" className="flex items-center gap-4">
            <img src={kurtosysLogo} alt="Kurtosys" className="h-5 w-auto sm:h-6" />
            <span className="hidden h-6 w-px bg-white/30 sm:block" />
            <span className="flex items-center gap-2 text-sm font-bold tracking-tight sm:text-base">
              <span className="grid size-8 place-items-center rounded-full bg-signal text-ink">
                <Dices className="size-5" />
              </span>
              Roll &amp; Run
            </span>
          </a>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-white/70 md:flex">
            <a className="transition hover:text-signal" href="#dashboard">Dashboard</a>
            <a className="transition hover:text-signal" href="#strava">Strava</a>
            <a className="transition hover:text-signal" href="#share">Share</a>
            <a className="transition hover:text-signal" href="#calendar">Calendar</a>
            <a className="transition hover:text-signal" href="#history">History</a>
          </nav>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10 hover:text-signal"
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? <Moon className="size-5" /> : <Sun className="size-5" />}
          </Button>
        </div>
      </header>

      <main id="top" className="mx-auto max-w-7xl space-y-20 px-4 py-8 sm:px-6 sm:py-12">
        <div>
          <section className="hero-panel relative min-h-[34rem] overflow-hidden rounded-[2rem] bg-primary px-6 py-14 text-white sm:px-10 sm:py-20 lg:flex lg:items-center">
            <div className="hero-ring absolute -left-28 -top-44 size-[34rem] rounded-full border border-white/15" />
            <div className="absolute bottom-0 right-0 hidden h-full w-2/5 opacity-60 lg:block runner-lines" />
            <div className="brand-orbit absolute -right-28 top-1/2 hidden size-[28rem] -translate-y-1/2 lg:block" />
            <div className="relative max-w-3xl">
              <div className="hero-enter hero-enter--1 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-white/85 backdrop-blur">
                <span className="size-2 rounded-full bg-signal shadow-[0_0_14px_var(--signal)]" />
                Starts 1 August 2026
              </div>
              <p className="hero-enter hero-enter--2 eyebrow mt-6 text-signal">
                Kurtosys · {CHALLENGE_LABEL}
              </p>
              <h1 className="hero-enter hero-enter--3 mt-5 max-w-3xl font-display text-5xl font-bold leading-[.98] tracking-[-.055em] sm:text-7xl">
                Your next run is <span className="text-signal">up to chance.</span>
              </h1>
              <p className="hero-enter hero-enter--4 mt-6 max-w-xl text-base leading-7 text-white/80 sm:text-lg">
                A one-month office challenge for August 2026. Roll the real dice each
                afternoon, record the result, and plan tomorrow’s run.
              </p>
              <a
                href={canRollToday ? "#roller" : "#calendar"}
                className="hero-enter hero-enter--5 group mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-signal px-6 text-sm font-bold text-ink transition hover:-translate-y-0.5 hover:bg-white"
              >
                <Route className="size-4 transition-transform group-hover:translate-x-1" />
                {canRollToday ? "Record today’s office roll" : "Set up August 2026"}
              </a>
            </div>
          </section>
          <div className="relative z-10 px-3 sm:px-8">
            <ChallengeStrip />
          </div>
        </div>

        <Reveal>
          <div id="dashboard"><Dashboard {...challenge} /></div>
        </Reveal>
        <Reveal delay={40}>
          <StravaBoard />
        </Reveal>
        <Reveal delay={60}>
          <ShareBrief rolls={challenge.rolls} logoUrl={kurtosysLogo} />
        </Reveal>
        <Reveal delay={80}>
          <div id="roller">
            <DiceRoller
              hasRolled={challenge.hasRolledFor(today)}
              existingRoll={existingRoll}
              onSave={(value, distance) => challenge.rollForDate(today, value, distance)}
            />
          </div>
        </Reveal>
        <Reveal>
          <div id="calendar">
            <ChallengeCalendar
              month={month}
              rolls={challenge.rolls}
              augustGeneratedYear={challenge.meta.augustGeneratedYear}
              onGenerateAugust={handleGenerateAugust}
            />
          </div>
        </Reveal>
        <Reveal><RuleGrid /></Reveal>
        <Reveal>
          <div id="history">
            <HistoryAndStats
              rolls={augustRolls}
              stats={challenge.stats}
              onClear={clearHistory}
            />
          </div>
        </Reveal>
      </main>

      <footer className="mt-16 bg-ink text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-10 text-sm text-white/65 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-4">
            <img src={kurtosysLogo} alt="Kurtosys" className="h-5 w-auto" />
            <span className="h-5 w-px bg-white/25" />
            <p className="font-bold text-white">Roll &amp; Run · {CHALLENGE_LABEL}</p>
          </div>
          <p>Run, jog, or walk. Rejoin whenever you can.</p>
        </div>
      </footer>
    </div>
  );
}
