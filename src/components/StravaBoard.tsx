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
import { Button, Card } from "./ui/primitives";
import {
  fetchActivities,
  fetchHealth,
  fetchLeaderboard,
  fetchMe,
  fetchRuns,
  formatDateLabel,
  formatMovingTime,
  getStravaConnectUrl,
  logout,
  submitRun,
  type AuthAthlete,
  type LeaderboardEntry,
  type SharedRun,
  type StravaActivityOption,
} from "../lib/stravaApi";

type Status = "idle" | "loading" | "saving" | "error";

export function StravaBoard() {
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [apiReady, setApiReady] = useState(false);
  const [athlete, setAthlete] = useState<AuthAthlete | null>(null);
  const [activities, setActivities] = useState<StravaActivityOption[]>([]);
  const [runs, setRuns] = useState<SharedRun[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const queryMessage = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("strava") === "connected") return "Connected to Strava.";
    const error = params.get("strava_error");
    return error ? `Strava auth error: ${error}` : null;
  }, []);

  const refreshShared = useCallback(async () => {
    const [runsPayload, boardPayload] = await Promise.all([fetchRuns(), fetchLeaderboard()]);
    setRuns(runsPayload.runs);
    setLeaderboard(boardPayload.leaderboard);
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
        const activityPayload = await fetchActivities();
        setActivities(activityPayload.activities);
        if (activityPayload.activities[0]) {
          setSelectedId(activityPayload.activities[0].id);
        }
      } else {
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
    if (!window.location.search) return;
    const url = new URL(window.location.href);
    url.search = "";
    if (!url.hash || url.hash === "#/" || url.hash.startsWith("#/strava")) {
      url.hash = "strava";
    }
    window.history.replaceState({}, "", `${url.pathname}${url.hash}`);
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

  return (
    <section id="strava" aria-labelledby="strava-title">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Shared board</p>
          <h2 id="strava-title" className="section-title">
            Upload from Strava
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Connect Strava, pick the activity you completed, and add it to the Kurtosys leaderboard.
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
            The shared Strava board is temporarily unavailable. Try again in a moment.
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <Card className="lift-card p-5 sm:p-6">
            <p className="eyebrow">Your Strava</p>
            <h3 className="mt-2 font-display text-xl font-bold">Connect and upload</h3>

            {!athlete ? (
              <div className="mt-5 space-y-4">
                <p className="text-sm leading-6 text-muted-foreground">
                  Sign in once, then choose which recent activity counts for the challenge.
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
                      <p className="text-sm text-muted-foreground">
                        {[athlete.city, athlete.country].filter(Boolean).join(", ") ||
                          "Connected"}
                      </p>
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
                    <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                      {activities.map((activity) => {
                        const selected = selectedId === activity.id;
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
                            <p className="mt-2 text-xs text-muted-foreground">
                              Moving time {formatMovingTime(activity.movingTimeSec)}
                            </p>
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
                          {entry.runCount} run{entry.runCount === 1 ? "" : "s"}
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
                Runs shared by everyone in the challenge.
              </p>
              {runs.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No runs uploaded yet.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {runs.map((run) => (
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
                            <a
                              href={run.stravaUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="font-semibold text-sky hover:underline"
                            >
                              Open in Strava
                            </a>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </section>
  );
}
