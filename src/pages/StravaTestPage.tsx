import {
  Activity,
  ArrowLeft,
  Check,
  Link2,
  LoaderCircle,
  LogOut,
  RefreshCw,
  Trophy,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card } from "../components/ui/primitives";
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
  setSessionToken,
  submitRun,
  type AuthAthlete,
  type LeaderboardEntry,
  type SharedRun,
  type StravaActivityOption,
} from "../lib/stravaApi";
import kurtosysLogo from "../../logo-w.svg?url";

type Status = "idle" | "loading" | "saving" | "error";

export function StravaTestPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [apiReady, setApiReady] = useState(false);
  const [stravaConfigured, setStravaConfigured] = useState(false);
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
    const params = new URLSearchParams(window.location.search);
    const session = params.get("session");
    if (session) setSessionToken(session);

    setStatus("loading");
    setMessage(queryMessage);
    try {
      const health = await fetchHealth();
      setApiReady(true);
      setStravaConfigured(health.stravaConfigured);

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
        error instanceof Error
          ? error.message
          : "API is unreachable. For local testing run npm run dev:api.",
      );
    }
  }, [queryMessage, refreshShared]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (!window.location.search) return;
    const url = new URL(window.location.href);
    url.search = "";
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
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-ink text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <img src={kurtosysLogo} alt="Kurtosys" className="h-5 w-auto" />
            <span className="h-5 w-px bg-white/25" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-signal">
                Strava test
              </p>
              <p className="text-sm font-semibold">Connect, pick a run, share it</p>
            </div>
          </div>
          <a
            href="#/"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Back to challenge
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
        <section className="rounded-[1.75rem] bg-primary px-6 py-8 text-white sm:px-8">
          <p className="eyebrow text-signal">Central board</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Test Strava sign-in and shared run uploads
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/80 sm:text-base">
            Sign in with Strava, choose an activity, and publish it to the shared store.
            Everyone hitting the same API sees the same leaderboard and run feed.
          </p>
        </section>

        {message && (
          <p
            className={`rounded-2xl border px-4 py-3 text-sm ${
              status === "error"
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-border bg-muted text-foreground"
            }`}
            aria-live="polite"
          >
            {message}
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <Card className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Authentication</p>
                <h2 className="mt-2 font-display text-2xl font-bold">Strava session</h2>
              </div>
              <Button variant="outline" size="sm" onClick={() => void refreshSession()}>
                <RefreshCw className="size-4" />
                Refresh
              </Button>
            </div>

            <div className="mt-5 space-y-3 text-sm text-muted-foreground">
              <p>
                API:{" "}
                <span className="font-semibold text-foreground">
                  {apiReady ? "reachable" : "offline"}
                </span>
              </p>
              <p>
                Strava credentials:{" "}
                <span className="font-semibold text-foreground">
                  {stravaConfigured ? "configured" : "missing in .env"}
                </span>
              </p>
            </div>

            {!athlete ? (
              <div className="mt-6 space-y-4">
                <p className="text-sm leading-6 text-muted-foreground">
                  Start the API with <code className="rounded bg-muted px-1.5 py-0.5">npm run dev:api</code>,
                  then connect a Strava account. Use localhost in your Strava app callback domain
                  for local testing.
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
              <div className="mt-6 space-y-5">
                <div className="flex items-center gap-3 rounded-2xl bg-muted/70 p-3">
                  <img
                    src={athlete.avatar}
                    alt=""
                    className="size-12 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-semibold">{athlete.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {[athlete.city, athlete.country].filter(Boolean).join(", ") || "Strava athlete"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => void handleLogout()}>
                    <LogOut className="size-4" />
                    Sign out
                  </Button>
                </div>

                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <Activity className="size-4 text-primary" />
                    <h3 className="font-display text-lg font-bold">Select an activity</h3>
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
                    {status === "saving" ? "Adding…" : "Add selected activity"}
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <div className="space-y-6">
            <Card className="p-5 sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <Trophy className="size-5 text-primary" />
                <h2 className="font-display text-2xl font-bold">Shared leaderboard</h2>
              </div>
              {leaderboard.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No uploaded runs yet. Connect and add the first activity.
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

            <Card className="p-5 sm:p-6">
              <h2 className="font-display text-2xl font-bold">All uploaded runs</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Central store shared by everyone using this API.
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
      </main>
    </div>
  );
}
