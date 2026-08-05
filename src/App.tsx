import { Dices, Moon, Route, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { ChallengeStrip } from "./components/ChallengeStrip";
import { Dashboard } from "./components/Dashboard";
import { DiceRoller } from "./components/DiceRoller";
import { Reveal } from "./components/Reveal";
import { SecurityPage } from "./components/SecurityPage";
import { ShareBrief } from "./components/ShareBrief";
import { StravaBoard } from "./components/StravaBoard";
import { Button, Card } from "./components/ui/primitives";
import { useChallenge } from "./hooks/useChallenge";
import kurtosysLogo from "../logo-w.svg?url";
import {
  CHALLENGE_LABEL,
  getChallengeDate,
  getChallengeMonth,
  getRollType,
  rollAppliesToChallenge,
  toIsoDate,
  WEEKDAY_DISTANCES,
  WEEKEND_DISTANCES,
} from "./lib/challenge";
import { publishTarget } from "./lib/stravaApi";
import type { Theme } from "./types/challenge";

function initialTheme(): Theme {
  const stored = localStorage.getItem("roll-and-run:theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function currentHashRoute(): string {
  return window.location.hash.replace(/^#/, "").split("?")[0] || "top";
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
  const [route, setRoute] = useState(currentHashRoute);
  const challenge = useChallenge(month);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("roll-and-run:theme", theme);
  }, [theme]);

  useEffect(() => {
    const onHashChange = () => setRoute(currentHashRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (route === "security") {
    return <SecurityPage />;
  }

  const today = new Date();
  const todayChallengeIso = getChallengeDate(today);
  const existingRoll = todayChallengeIso
    ? challenge.rolls.find((roll) => roll.challengeDate === toIsoDate(todayChallengeIso))
    : undefined;

  const canRollToday = getRollType(today) !== null && rollAppliesToChallenge(today);
  const hasRolledToday = challenge.hasRolledFor(today);
  const showRoller = challenge.synced && canRollToday && !hasRolledToday;

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
            {showRoller && (
              <a className="transition hover:text-signal" href="#roller">Dice</a>
            )}
            <a className="transition hover:text-signal" href="#strava">Runs</a>
            <a className="transition hover:text-signal" href="#share">Share</a>
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
                href={showRoller ? "#roller" : "#strava"}
                className="hero-enter hero-enter--5 group mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-signal px-6 text-sm font-bold text-ink transition hover:-translate-y-0.5 hover:bg-white"
              >
                <Route className="size-4 transition-transform group-hover:translate-x-1" />
                {showRoller ? "Record today’s office roll" : "See the runs board"}
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
        {showRoller && (
          <Reveal delay={40}>
            <div id="roller">
              <DiceRoller
                hasRolled={hasRolledToday}
                existingRoll={existingRoll}
                onSave={(value, distance) => {
                  const roll = challenge.rollForDate(today, value, distance);
                  if (!roll) return;
                  void publishTarget({
                    challengeDate: roll.challengeDate,
                    distanceKm: roll.distanceKm,
                    diceValue: roll.diceValue,
                    type: roll.type,
                    publishedBy: "Office dice",
                  }).catch(() => {
                    // Local roll still saved if the shared target publish fails.
                  });
                }}
              />
            </div>
          </Reveal>
        )}
        <Reveal delay={showRoller ? 60 : 40}>
          <StravaBoard />
        </Reveal>
        <Reveal delay={showRoller ? 80 : 60}>
          <ShareBrief rolls={challenge.rolls} logoUrl={kurtosysLogo} />
        </Reveal>
        <Reveal><RuleGrid /></Reveal>
      </main>

      <footer className="mt-16 bg-ink text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-10 text-sm text-white/65 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-4">
            <img src={kurtosysLogo} alt="Kurtosys" className="h-5 w-auto" />
            <span className="h-5 w-px bg-white/25" />
            <p className="font-bold text-white">Roll &amp; Run · {CHALLENGE_LABEL}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <a className="font-semibold text-signal hover:underline" href="#security">
              Security &amp; standards
            </a>
            <p>Run, jog, or walk. Rejoin whenever you can.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
