import { CalendarDays, CircleDot, Footprints, MoonStar } from "lucide-react";

const facts = [
  { icon: CalendarDays, value: "31 days", label: "August only" },
  { icon: CircleDot, value: "1 real die", label: "Rolled in-office" },
  { icon: Footprints, value: "3–10 km", label: "Run, jog, or walk" },
  { icon: MoonStar, value: "Mondays", label: "Guaranteed recovery" },
];

export function ChallengeStrip() {
  return (
    <section
      className="challenge-strip relative -mt-14 grid overflow-hidden rounded-2xl border border-white/15 bg-ink text-white shadow-2xl sm:grid-cols-2 lg:grid-cols-4"
      aria-label="Challenge highlights"
    >
      <span className="challenge-strip__runner" aria-hidden="true" />
      {facts.map(({ icon: Icon, value, label }) => (
        <div
          key={value}
          className="relative flex items-center gap-3 border-b border-white/10 px-5 py-5 last:border-b-0 sm:[&:nth-child(odd)]:border-r lg:border-b-0 lg:border-r lg:last:border-r-0"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-signal/10 text-signal">
            <Icon className="size-5" />
          </span>
          <div>
            <p className="text-sm font-bold">{value}</p>
            <p className="mt-0.5 text-xs text-white/55">{label}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
