import { CalendarPlus } from "lucide-react";
import {
  CHALLENGE_LABEL,
  formatDate,
  fromIsoDate,
  getCalendarDays,
  getChallengeLabel,
} from "../lib/challenge";
import { cn } from "../lib/utils";
import type { ChallengeRoll } from "../types/challenge";
import { Button, Card } from "./ui/primitives";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function ChallengeCalendar({
  month,
  rolls,
  augustGeneratedYear,
  onGenerateAugust,
}: {
  month: Date;
  rolls: ChallengeRoll[];
  augustGeneratedYear?: number;
  onGenerateAugust: () => void;
}) {
  const days = getCalendarDays(month, rolls);
  const alreadyGenerated = augustGeneratedYear === 2026;

  return (
    <section aria-labelledby="calendar-title">
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="eyebrow">Challenge calendar</p>
            <h2 id="calendar-title" className="mt-1 font-display text-2xl font-black sm:text-3xl">
              {CHALLENGE_LABEL}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {alreadyGenerated
                ? "August 2026 scaffold saved. Distances appear after each office roll is recorded."
                : "This challenge runs for August 2026 only. Set up the calendar, then record office rolls."}
            </p>
          </div>
          <Button
            className="bg-signal text-ink shadow-none hover:bg-ink hover:text-white"
            onClick={onGenerateAugust}
          >
            <CalendarPlus className="size-4" />
            Set up August 2026
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 border-b border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground sm:grid-cols-4 sm:px-6">
          <span><strong className="text-foreground">Rest</strong> Mondays</span>
          <span><strong className="text-sky">Run</strong> weekday distance</span>
          <span><strong className="text-primary">Weekend</strong> Sat or Sun</span>
          <span>Hover a day for roll date</span>
        </div>

        <div className="grid grid-cols-7 border-b border-border bg-muted/45">
          {WEEKDAYS.map((day, index) => (
            <div
              key={day}
              className={cn(
                "px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:text-xs",
                index > 4 && "text-primary",
              )}
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const isRest =
              day.isMonday ||
              day.roll?.type === "rest" ||
              day.roll?.distanceKm === 0;
            const label = day.roll
              ? getChallengeLabel(day.roll.distanceKm, day.roll.type, day.roll.diceValue)
              : day.isMonday
                ? "Rest"
                : "";
            const isPending = day.roll?.type !== "rest" && day.roll?.diceValue === null;
            const titleParts = [
              formatDate(day.date, {
                weekday: "long",
                day: "numeric",
                month: "long",
              }),
            ];
            if (day.roll?.rollDate) {
              titleParts.push(
                `Rolled ${formatDate(fromIsoDate(day.roll.rollDate), {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}`,
              );
            }
            if (day.roll?.type === "weekend") {
              titleParts.push("Complete once on Saturday or Sunday");
            }
            if (day.roll?.diceValue) {
              titleParts.push(`Dice ${day.roll.diceValue}`);
            }

            return (
              <div
                key={day.iso}
                title={titleParts.join(" · ")}
                className={cn(
                  "relative min-h-20 border-b border-r border-border p-1.5 sm:min-h-28 sm:p-2.5",
                  !day.inMonth && "bg-muted/30 text-muted-foreground opacity-45",
                  day.isWeekend && day.inMonth && "bg-primary/[.045]",
                  day.isToday && "ring-2 ring-inset ring-primary",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-full text-xs font-bold sm:size-7 sm:text-sm",
                    day.isToday && "bg-primary text-white",
                  )}
                >
                  {day.date.getDate()}
                </span>
                {day.inMonth && label && (
                  <span
                    className={cn(
                      "mt-2 block rounded-md bg-sky/10 px-1 py-1 text-center text-[9px] font-bold leading-tight text-sky sm:text-xs",
                      isRest && !isPending && "bg-rest/10 text-rest",
                      isPending && "bg-muted text-muted-foreground",
                      day.roll?.type === "weekend" && !isRest && !isPending && "bg-primary/10 text-primary",
                    )}
                  >
                    {label}
                  </span>
                )}
                {day.inMonth && day.roll?.rollDate && day.roll.diceValue !== null && (
                  <span className="mt-1 hidden text-[9px] text-muted-foreground sm:block">
                    Roll {fromIsoDate(day.roll.rollDate).getDate()}/
                    {fromIsoDate(day.roll.rollDate).getMonth() + 1}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </section>
  );
}
