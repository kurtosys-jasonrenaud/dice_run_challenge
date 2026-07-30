import {
  CalendarDays,
  Flag,
  Footprints,
  Gauge,
  MoonStar,
  TrendingUp,
} from "lucide-react";
import { formatDate, fromIsoDate, getChallengeLabel } from "../lib/challenge";
import type { ChallengeRoll, ChallengeStats } from "../types/challenge";
import { Badge, Card } from "./ui/primitives";

function ChallengeCard({
  eyebrow,
  roll,
  fallback,
  accent = false,
}: {
  eyebrow: string;
  roll?: ChallengeRoll;
  fallback: string;
  accent?: boolean;
}) {
  return (
    <Card
      className={`lift-card min-h-52 overflow-hidden p-5 ${
        accent
          ? "relative border-primary/30 bg-primary text-white before:absolute before:-right-10 before:-top-16 before:size-36 before:rounded-full before:border before:border-white/15"
          : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <p className={`eyebrow ${accent ? "text-signal" : ""}`}>{eyebrow}</p>
        {roll && (
          <Badge className={accent ? "bg-white/15 text-white" : ""}>
            {roll.type}
          </Badge>
        )}
      </div>
      <p className="mt-8 font-display text-4xl font-black tracking-tight">
        {roll ? getChallengeLabel(roll.distanceKm, roll.type, roll.diceValue) : fallback}
      </p>
      <p className={`mt-2 text-sm ${accent ? "text-white/75" : "text-muted-foreground"}`}>
        {roll
          ? `${formatDate(fromIsoDate(roll.challengeDate), {
              weekday: "long",
              day: "numeric",
              month: "long",
            })} · ${
              roll.type === "rest"
                ? "Fixed rest day"
                : roll.diceValue
                  ? `Rolled ${roll.diceValue}`
                  : "Assigned"
            }`
          : "Waiting for the previous afternoon’s roll."}
      </p>
    </Card>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  suffix,
}: {
  icon: typeof Gauge;
  label: string;
  value: string | number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted/70 p-3">
      <span className="grid size-9 place-items-center rounded-lg bg-background text-primary">
        <Icon className="size-4" />
      </span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-display text-xl font-black">
          {value}{suffix && <span className="ml-1 text-xs font-semibold text-muted-foreground">{suffix}</span>}
        </p>
      </div>
    </div>
  );
}

export function Dashboard({
  current,
  next,
  weekend,
  stats,
}: {
  current?: ChallengeRoll;
  next?: ChallengeRoll;
  weekend?: ChallengeRoll;
  stats: ChallengeStats;
}) {
  const todayIsMonday = new Date().getDay() === 1;
  return (
    <section aria-labelledby="dashboard-title">
      <div className="mb-5">
        <p className="eyebrow">Challenge dashboard</p>
        <h2 id="dashboard-title" className="section-title">August 2026 at a glance</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ChallengeCard
          eyebrow="Current challenge"
          roll={current}
          fallback={todayIsMonday ? "Rest day" : "Not assigned"}
          accent
        />
        <ChallengeCard eyebrow="Next challenge" roll={next} fallback="Not rolled yet" />
        <ChallengeCard eyebrow="Weekend challenge" roll={weekend} fallback="Rolls on Friday" />
        <Card className="lift-card p-5">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Monthly stats</p>
            <TrendingUp className="size-5 text-primary" />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Metric icon={Footprints} label="Total" value={stats.totalKm} suffix="km" />
            <Metric icon={MoonStar} label="Rest days" value={stats.restDays} />
            <Metric icon={CalendarDays} label="Run days" value={stats.runDays} />
            <Metric icon={Flag} label="Longest" value={stats.longestChallenge} suffix="km" />
          </div>
        </Card>
      </div>
    </section>
  );
}
