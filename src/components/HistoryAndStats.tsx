import { BarChart3, CalendarCheck, Flag, Gauge, Trash2 } from "lucide-react";
import { formatDate, fromIsoDate, getChallengeLabel } from "../lib/challenge";
import type { ChallengeRoll, ChallengeStats } from "../types/challenge";
import { Badge, Button, Card } from "./ui/primitives";

export function HistoryAndStats({
  rolls,
  stats,
  onClear,
}: {
  rolls: ChallengeRoll[];
  stats: ChallengeStats;
  onClear: () => void;
}) {
  const metrics = [
    { label: "Total assigned", value: `${stats.totalKm} km`, icon: BarChart3 },
    { label: "Run days", value: stats.runDays, icon: CalendarCheck },
    { label: "Rest days", value: stats.restDays, icon: Gauge },
    { label: "Average run", value: `${stats.averageDistance.toFixed(1)} km`, icon: BarChart3 },
    { label: "Longest", value: `${stats.longestChallenge} km`, icon: Flag },
    { label: "Weekends", value: stats.weekendChallenges, icon: CalendarCheck },
  ];

  return (
    <section className="grid gap-4 xl:grid-cols-[1fr_2fr]" aria-labelledby="history-title">
      <Card className="p-5 sm:p-6">
        <p className="eyebrow">Performance</p>
        <h2 className="section-title">Statistics</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          {metrics.map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-center justify-between rounded-xl bg-muted/65 p-3.5">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg bg-background text-primary">
                  <Icon className="size-4" />
                </span>
                <span className="text-sm text-muted-foreground">{label}</span>
              </div>
              <strong className="font-display text-xl">{value}</strong>
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border p-5 sm:p-6">
          <div>
            <p className="eyebrow">Saved locally</p>
            <h2 id="history-title" className="section-title">Roll history</h2>
          </div>
          {rolls.length > 0 && (
            <Button variant="ghost" size="sm" onClick={onClear} className="text-destructive">
              <Trash2 className="size-4" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          )}
        </div>
        {rolls.length === 0 ? (
          <div className="grid min-h-64 place-items-center px-6 text-center">
            <div>
              <span className="mx-auto grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
                <BarChart3 className="size-5" />
              </span>
              <p className="mt-3 font-semibold">No rolls yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Generate the August 2026 calendar or record the first office roll.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-muted/45 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-semibold">Roll date</th>
                  <th className="px-5 py-3 font-semibold">Challenge date</th>
                  <th className="px-5 py-3 font-semibold">Dice</th>
                  <th className="px-5 py-3 font-semibold">Assigned</th>
                  <th className="px-5 py-3 font-semibold">Type</th>
                </tr>
              </thead>
              <tbody>
                {rolls.map((roll) => (
                  <tr key={roll.id} className="border-t border-border">
                    <td className="px-5 py-4 text-muted-foreground">
                      {roll.rollDate
                        ? formatDate(fromIsoDate(roll.rollDate), {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })
                        : "—"}
                    </td>
                    <td className="px-5 py-4 font-semibold">
                      {formatDate(fromIsoDate(roll.challengeDate), {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {roll.type === "weekend" && (
                        <span className="mt-1 block text-xs font-normal text-muted-foreground">
                          Sat or Sun
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {roll.diceValue === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className="inline-grid size-8 place-items-center rounded-lg bg-ink font-display font-black text-white">
                          {roll.diceValue}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">{getChallengeLabel(roll.distanceKm, roll.type, roll.diceValue)}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1">
                        <Badge>{roll.type}</Badge>
                        {roll.source === "generated" && <Badge>generated</Badge>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  );
}
