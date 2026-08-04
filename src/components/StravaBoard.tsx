import {
  Activity,
  Check,
  Link2,
  LoaderCircle,
  LogOut,
  RefreshCw,
  Trophy,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatDate,
  getChallengeDate,
  getDistance,
  getRollType,
  toIsoDate,
} from "../lib/challenge";
import {
  activityToChallengeDate,
  cleanOAuthUrl,
  evaluateTarget,
  fetchActivities,
  fetchHealth,
  fetchLeaderboard,
  fetchMe,
  fetchRuns,
  fetchTargets,
  formatDateLabel,
  formatMovingTime,
  getSessionToken,
  getStravaConnectUrl,
  logout,
  publishTarget,
  readOAuthFeedback,
  setSessionToken,
  submitRun,
  type AuthAthlete,
  type ChallengeTarget,
  type LeaderboardEntry,
  type SharedRun,
  type StravaActivityOption,
} from "../lib/stravaApi";
import { cn } from "../lib/utils";
import type { DiceValue } from "../types/challenge";
import { Button, Card } from "./ui/primitives";

type Status = "idle" | "loading" | "saving" | "error";

const FACES: DiceValue[] = [1, 2, 3, 4, 5, 6];

function TargetBadge({
  distanceKm,
  target,
}: {
  distanceKm: number;
  target: ChallengeTarget | undefined;
}) {
  const result = evaluateTarget(distanceKm, target);
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em]",
        result.status === "met" && "bg-signal/25 text-ink",
        result.status === "short" && "bg-destructive/15 text-destructive",
        (result.status === "rest" || result.status === "no-target") &&
          "bg-muted text-muted-foreground",
      )}
    >
      {result.label}
    </span>
  );
}

export function StravaBoard() {
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [apiReady, setApiReady] = useState(false);
  const [athlete, setAthlete] = useState<AuthAthlete | null>(null);
  const [activities, setActivities] = useState<StravaActivityOption[]>([]);
  const [runs, setRuns] = useState<SharedRun[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [targets, setTargets] = useState<ChallengeTarget[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishFace, setPublishFace] = useState<DiceValue>(2);

  const today = new Date();
  const rollType = getRollType(today);
  const nextChallengeDate = getChallengeDate(today);
  const publishDistance =
    rollType && nextChallengeDate ? getDistance(publishFace, rollType) : null;
  const publishNeedsChoice = Array.isArray(publishDistance);

  const targetsByDate = useMemo(() => {
    const map = new Map<string, ChallengeTarget>();
    for (const target of targets) map.set(target.challengeDate, target);
    return map;
  }, [targets]);

  const latestTarget = targets[0] ?? null;

  const queryMessage = useMemo(() => {
    const feedback = readOAuthFeedback();
    if (feedback.connected) return "Connected to Strava.";
    return feedback.error ? `Strava auth error: ${feedback.error}` : null;
  }, []);

  const refreshShared = useCallback(async () => {
    const [runsPayload, boardPayload, targetsPayload] = await Promise.all([
      fetchRuns(),
      fetchLeaderboard(),
      fetchTargets(),
    ]);
    setRuns(runsPayload.runs);
    setLeaderboard(boardPayload.leaderboard);
    setTargets(targetsPayload.targets);
  }, []);

  const refreshSession = useCallback(async () => {
    setStatus("loading");
    setMessage(queryMessage);
    try {
      await fetchHealth();
      setApiReady(true);

      const me = await fetchMe();
      if (me.authenticated && me.athlete) {
        setAthlete(me.athlete);
        try {
          const activityPayload = await fetchActivities();
          setActivities(activityPayload.activities);
          if (activityPayload.activities[0]) {
            setSelectedId(activityPayload.activities[0].id);
          }
        } catch (activityError) {
          setActivities([]);
          setSelectedId(null);
          setMessage(
            activityError instanceof Error
              ? activityError.message
              : "Connected, but Strava activities could not be loaded.",
          );
        }
      } else {
        if (getSessionToken()) setSessionToken(null);
        setAthlete(null);
        setActivities([]);
        setSelectedId(null);
      }

      await refreshShared();
      setStatus("idle");
    } catch (error) {
      setApiReady(false);
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Could not reach the shared Strava board.",
      );
    }
  }, [queryMessage, refreshShared]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshSession(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshSession]);

  useEffect(() => {
    cleanOAuthUrl();
  }, []);

  async function handleLogout() {
    await logout();
    setAthlete(null);
    setActivities([]);
    setSelectedId(null);
    setMessage("Signed out of Strava.");
  }

  async function handleSubmit() {
    if (!selectedId) return;
    setStatus("saving");
    setMessage(null);
    try {
      const result = await submitRun(selectedId);
      await refreshShared();
      setStatus("idle");
      setMessage(
        result.created
          ? `Added “${result.run.name}” to the shared board.`
          : `Updated “${result.run.name}” on the shared board.`,
      );
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not submit activity");
    }
  }

  async function handlePublishTarget(choice?: 4 | 8) {
    if (!rollType || !nextChallengeDate) return;
    const distance = getDistance(publishFace, rollType, choice);
    if (Array.isArray(distance)) return;

    setPublishing(true);
    setMessage(null);
    try {
      const result = await publishTarget({
        challengeDate: toIsoDate(nextChallengeDate),
        distanceKm: distance,
        diceValue: publishFace,
        type: rollType,
        publishedBy: athlete?.name || "Office",
      });
      await refreshShared();
      setMessage(
        result.target.distanceKm === 0
          ? `Published rest day for ${formatDate(nextChallengeDate)}.`
          : `Published ${result.target.distanceKm} km target for ${formatDate(nextChallengeDate)}.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not publish target");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <section id="strava" aria-labelledby="strava-title">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Shared board</p>
          <h2 id="strava-title" className="section-title">
            Runs and targets
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Publish the office dice target, then see who met the day’s required kilometres.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refreshSession()}>
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </div>

      {message && (
        <p
          className={`mb-5 rounded-2xl border px-4 py-3 text-sm ${
            status === "error"
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-border bg-muted text-foreground"
          }`}
          aria-live="polite"
        >
          {message}
        </p>
      )}

      {!apiReady && status === "error" ? (
        <Card className="lift-card p-5 sm:p-6">
          <p className="text-sm leading-6 text-muted-foreground">
            The shared board is temporarily unavailable. Try again in a moment.
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <Card className="lift-card p-5 sm:p-6">
              <p className="eyebrow">Office target</p>
              <h3 className="mt-2 font-display text-xl font-bold">Publish today’s dice</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                No Strava login needed. Record the office roll here so everyone’s uploads can be
                checked against the target.
              </p>

              {latestTarget && (
                <div className="mt-4 rounded-2xl bg-muted/70 px-4 py-3 text-sm">
                  <p className="font-semibold">
                    Latest: {latestTarget.distanceKm === 0 ? "Rest day" : `${latestTarget.distanceKm} km`}
                    {latestTarget.diceValue ? ` (dice ${latestTarget.diceValue})` : ""}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Challenge day {latestTarget.challengeDate}
                    {latestTarget.publishedBy ? ` · set by ${latestTarget.publishedBy}` : ""}
                  </p>
                </div>
              )}

              {rollType && nextChallengeDate ? (
                <div className="mt-5 space-y-4">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    Dice face for {formatDate(nextChallengeDate)} ({rollType})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {FACES.map((face) => (
                      <button
                        key={face}
                        type="button"
                        onClick={() => setPublishFace(face)}
                        className={cn(
                          "grid size-11 place-items-center rounded-full border text-sm font-bold transition",
                          publishFace === face
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card hover:bg-muted",
                        )}
                        aria-pressed={publishFace === face}
                      >
                        {face}
                      </button>
                    ))}
                  </div>

                  {publishNeedsChoice ? (
                    <div className="flex flex-wrap gap-2">
                      <Button disabled={publishing} onClick={() => void handlePublishTarget(4)}>
                        Publish 4 km
                      </Button>
                      <Button disabled={publishing} onClick={() => void handlePublishTarget(8)}>
                        Publish 8 km
                      </Button>
                    </div>
                  ) : (
                    <Button disabled={publishing} onClick={() => void handlePublishTarget()}>
                      {publishing
                        ? "Publishing…"
                        : `Publish ${publishDistance === 0 ? "rest day" : `${publishDistance} km`}`}
                    </Button>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  Office targets are published Monday to Friday when a roll sets the next challenge
                  day.
                </p>
              )}
            </Card>

            <Card className="lift-card p-5 sm:p-6">
              <p className="eyebrow">Your Strava</p>
              <h3 className="mt-2 font-display text-xl font-bold">Connect and upload</h3>

              {!athlete ? (
                <div className="mt-5 space-y-4">
                  <p className="text-sm leading-6 text-muted-foreground">
                    If Strava is blocked at the office, connect from home or mobile, then upload the
                    run that counts.
                  </p>
                  <a
                    href={getStravaConnectUrl()}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#fc4c02] px-5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:brightness-110"
                  >
                    <Link2 className="size-4" />
                    Connect with Strava
                  </a>
                </div>
              ) : (
                <div className="mt-5 space-y-5">
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/70 p-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <img
                        src={athlete.avatar}
                        alt=""
                        className="size-12 rounded-full object-cover"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{athlete.name}</p>
                        <p className="text-sm text-muted-foreground">Connected</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => void handleLogout()}>
                      <LogOut className="size-4" />
                      Sign out
                    </Button>
                  </div>

                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <Activity className="size-4 text-primary" />
                      <h4 className="font-display text-lg font-bold">Select an activity</h4>
                    </div>

                    {status === "loading" ? (
                      <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" />
                        Loading activities…
                      </p>
                    ) : activities.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No recent activities found for this account.
                      </p>
                    ) : (
                      <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                        {activities.map((activity) => {
                          const selected = selectedId === activity.id;
                          const target = targetsByDate.get(
                            activityToChallengeDate(activity.startDate),
                          );
                          return (
                            <button
                              key={activity.id}
                              type="button"
                              onClick={() => setSelectedId(activity.id)}
                              className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                                selected
                                  ? "border-primary bg-primary/[.08]"
                                  : "border-border bg-card hover:bg-muted/60"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold">{activity.name}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {activity.type} · {formatDateLabel(activity.startDate)}
                                  </p>
                                </div>
                                <p className="text-sm font-bold text-primary">
                                  {activity.distanceKm} km
                                </p>
                              </div>
                              <div className="mt-2">
                                <TargetBadge distanceKm={activity.distanceKm} target={target} />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <Button
                      className="mt-4 w-full sm:w-auto"
                      disabled={!selectedId || status === "saving"}
                      onClick={() => void handleSubmit()}
                    >
                      {status === "saving" ? (
                        <LoaderCircle className="size-4 animate-spin" />
                      ) : (
                        <Check className="size-4" />
                      )}
                      {status === "saving" ? "Adding…" : "Add to leaderboard"}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="lift-card p-5 sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <Trophy className="size-5 text-primary" />
                <h3 className="font-display text-xl font-bold">Leaderboard</h3>
              </div>
              {leaderboard.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No uploaded runs yet. Be the first to add one.
                </p>
              ) : (
                <ol className="space-y-3">
                  {leaderboard.map((entry, index) => (
                    <li
                      key={entry.athleteId}
                      className="flex items-center gap-3 rounded-2xl bg-muted/65 px-3 py-3"
                    >
                      <span className="grid size-8 place-items-center rounded-full bg-ink font-display text-sm font-black text-white">
                        {index + 1}
                      </span>
                      <img
                        src={entry.athleteAvatar}
                        alt=""
                        className="size-10 rounded-full object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{entry.athleteName}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.daysMet || 0} met · {entry.daysShort || 0} short · {entry.runCount}{" "}
                          run{entry.runCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <p className="text-sm font-bold">{entry.totalDistanceKm} km</p>
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            <Card className="lift-card p-5 sm:p-6">
              <h3 className="font-display text-xl font-bold">Recent uploads</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Checked against the published office target for that challenge day.
              </p>
              {runs.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No runs uploaded yet.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {runs.map((run) => {
                    const target = targetsByDate.get(activityToChallengeDate(run.startDate));
                    return (
                      <li key={run.id} className="rounded-2xl border border-border px-4 py-3">
                        <div className="flex items-start gap-3">
                          <img
                            src={run.athleteAvatar}
                            alt=""
                            className="size-10 rounded-full object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold">{run.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {run.athleteName} · {run.type} · {formatDateLabel(run.startDate)}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                              <span className="font-bold text-primary">{run.distanceKm} km</span>
                              <span className="text-muted-foreground">
                                {formatMovingTime(run.movingTimeSec)}
                              </span>
                              <TargetBadge distanceKm={run.distanceKm} target={target} />
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </section>
  );
}
