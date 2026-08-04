import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  athleteDisplayName,
  buildAuthorizeUrl,
  exchangeCode,
  getAthleteActivity,
  getStravaConfig,
  listAthleteActivities,
  metersToKm,
  refreshTokens,
} from "./strava.js";
import type { RunStore, SessionRecord, StravaEnvConfig } from "./types.js";

export interface CreateAppOptions {
  env: StravaEnvConfig;
  store: RunStore;
}

function allowedOrigins(env: StravaEnvConfig): string[] {
  const defaults = [
    "http://localhost:5173",
    "https://kurtosys-jasonrenaud.github.io",
  ];
  const configured = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set([...defaults, ...configured])];
}

function readSessionId(c: { req: { header: (name: string) => string | undefined } }): string | undefined {
  const header = c.req.header("authorization") || c.req.header("Authorization");
  if (!header) return undefined;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

function buildAppRedirect(appOrigin: string, params: Record<string, string>): string {
  const url = new URL(appOrigin);
  // Keep OAuth result in the hash so GitHub Pages / static hosting cannot drop it.
  const hashParams = new URLSearchParams(params);
  url.hash = `strava?${hashParams.toString()}`;
  return url.toString();
}

export function createApp({ env, store }: CreateAppOptions) {
  const app = new Hono();
  const origins = allowedOrigins(env);

  app.use(
    "*",
    cors({
      origin: (origin) => {
        if (!origin) return origins[0];
        return origins.includes(origin) ? origin : "";
      },
      allowHeaders: ["Content-Type", "Authorization"],
      allowMethods: ["GET", "POST", "OPTIONS"],
    }),
  );

  app.get("/api/health", (c) =>
    c.json({
      ok: true,
      service: "roll-and-run-strava-api",
      stravaConfigured: Boolean(
        env.STRAVA_CLIENT_ID && env.STRAVA_CLIENT_SECRET && env.STRAVA_REDIRECT_URI,
      ),
    }),
  );

  async function getValidSession(sessionId: string | undefined): Promise<SessionRecord | null> {
    const session = await store.getSession(sessionId);
    if (!session) return null;

    const skewSeconds = 60;
    const now = Math.floor(Date.now() / 1000);
    if (session.tokens.expiresAt > now + skewSeconds) {
      return session;
    }

    try {
      const tokens = await refreshTokens(env, session.tokens.refreshToken);
      return (await store.updateSessionTokens(session.id, tokens)) ?? session;
    } catch {
      await store.deleteSession(session.id);
      return null;
    }
  }

  app.get("/api/auth/strava", async (c) => {
    try {
      getStravaConfig(env);
      const state = crypto.randomUUID();
      await store.saveOAuthState(state);
      return c.redirect(buildAuthorizeUrl(env, state), 302);
    } catch (error) {
      return c.json(
        {
          error: error instanceof Error ? error.message : "Strava is not configured",
        },
        500,
      );
    }
  });

  app.get("/api/auth/callback", async (c) => {
    const code = c.req.query("code");
    const state = c.req.query("state");
    const error = c.req.query("error");
    const scope = c.req.query("scope") || "";
    const { appOrigin } = getStravaConfig(env);

    if (error) {
      return c.redirect(buildAppRedirect(appOrigin, { strava_error: error }), 302);
    }

    const stateOk = state ? await store.consumeOAuthState(state) : false;
    if (!code || !state || !stateOk) {
      return c.redirect(buildAppRedirect(appOrigin, { strava_error: "invalid_state" }), 302);
    }

    if (!scope.includes("activity:read") && !scope.includes("activity:read_all")) {
      return c.redirect(
        buildAppRedirect(appOrigin, { strava_error: "missing_activity_scope" }),
        302,
      );
    }

    try {
      const { athlete, tokens } = await exchangeCode(env, code);
      const session = await store.createSession(athlete, tokens);
      return c.redirect(
        buildAppRedirect(appOrigin, {
          strava: "connected",
          session: session.id,
        }),
        302,
      );
    } catch (err) {
      return c.redirect(
        buildAppRedirect(appOrigin, {
          strava_error: err instanceof Error ? err.message : "token_exchange_failed",
        }),
        302,
      );
    }
  });

  app.get("/api/auth/me", async (c) => {
    const session = await getValidSession(readSessionId(c));
    if (!session) return c.json({ authenticated: false }, 200);
    return c.json({
      authenticated: true,
      athlete: {
        id: session.athlete.id,
        name: athleteDisplayName(session.athlete),
        avatar: session.athlete.profile,
        city: session.athlete.city,
        country: session.athlete.country,
      },
    });
  });

  app.post("/api/auth/logout", async (c) => {
    await store.deleteSession(readSessionId(c));
    return c.json({ ok: true });
  });

  app.get("/api/strava/activities", async (c) => {
    const session = await getValidSession(readSessionId(c));
    if (!session) return c.json({ error: "Not authenticated" }, 401);

    try {
      const perPage = Math.min(Number(c.req.query("per_page") || 30), 50);
      const activities = await listAthleteActivities(session.tokens.accessToken, perPage);
      return c.json({
        activities: activities.map((activity) => ({
          id: activity.id,
          name: activity.name,
          type: activity.sport_type || activity.type,
          distanceKm: metersToKm(activity.distance),
          movingTimeSec: activity.moving_time,
          startDate: activity.start_date_local || activity.start_date,
          stravaUrl: `https://www.strava.com/activities/${activity.id}`,
        })),
      });
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Failed to load activities" },
        502,
      );
    }
  });

  app.post("/api/runs", async (c) => {
    const session = await getValidSession(readSessionId(c));
    if (!session) return c.json({ error: "Not authenticated" }, 401);

    const body = await c.req.json<{ activityId?: number }>().catch(() => ({}));
    const activityId = Number(body.activityId);
    if (!Number.isFinite(activityId) || activityId <= 0) {
      return c.json({ error: "activityId is required" }, 400);
    }

    try {
      const activity = await getAthleteActivity(session.tokens.accessToken, activityId);
      const result = await store.upsertRun({
        athleteId: session.athlete.id,
        athleteName: athleteDisplayName(session.athlete),
        athleteAvatar: session.athlete.profile,
        stravaActivityId: activity.id,
        name: activity.name,
        type: activity.sport_type || activity.type,
        distanceKm: metersToKm(activity.distance),
        movingTimeSec: activity.moving_time,
        startDate: activity.start_date_local || activity.start_date,
        stravaUrl: `https://www.strava.com/activities/${activity.id}`,
      });

      return c.json({ run: result.run, created: result.created }, result.created ? 201 : 200);
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Failed to submit run" },
        502,
      );
    }
  });

  app.get("/api/runs", async (c) => c.json({ runs: await store.listRuns() }));

  app.get("/api/leaderboard", async (c) =>
    c.json({ leaderboard: await store.buildLeaderboard() }),
  );

  return app;
}
