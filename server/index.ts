import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { cors } from "hono/cors";
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildLeaderboard,
  createSession,
  deleteSession,
  getSession,
  listRuns,
  updateSessionTokens,
  upsertRun,
} from "./store.js";
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
import type { SessionRecord } from "./types.js";

function loadEnvFile() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile();

const SESSION_COOKIE = "rr_strava_session";
const STATE_COOKIE = "rr_strava_state";
const PORT = Number(process.env.API_PORT || 8787);

const app = new Hono();

app.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    credentials: true,
  }),
);

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    service: "roll-and-run-strava-api",
    stravaConfigured: Boolean(
      process.env.STRAVA_CLIENT_ID &&
        process.env.STRAVA_CLIENT_SECRET &&
        process.env.STRAVA_REDIRECT_URI,
    ),
  }),
);

async function getValidSession(sessionId: string | undefined): Promise<SessionRecord | null> {
  const session = await getSession(sessionId);
  if (!session) return null;

  const skewSeconds = 60;
  const now = Math.floor(Date.now() / 1000);
  if (session.tokens.expiresAt > now + skewSeconds) {
    return session;
  }

  try {
    const tokens = await refreshTokens(session.tokens.refreshToken);
    return (await updateSessionTokens(session.id, tokens)) ?? session;
  } catch {
    await deleteSession(session.id);
    return null;
  }
}

app.get("/api/auth/strava", (c) => {
  try {
    const state = randomUUID();
    setCookie(c, STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      maxAge: 600,
    });
    return c.redirect(buildAuthorizeUrl(state), 302);
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
  const { appOrigin } = getStravaConfig();
  const successUrl = new URL(appOrigin);
  successUrl.hash = "/strava-test";

  if (error) {
    successUrl.searchParams.set("strava_error", error);
    return c.redirect(successUrl.toString(), 302);
  }

  const expectedState = getCookie(c, STATE_COOKIE);
  deleteCookie(c, STATE_COOKIE, { path: "/" });

  if (!code || !state || !expectedState || state !== expectedState) {
    successUrl.searchParams.set("strava_error", "invalid_state");
    return c.redirect(successUrl.toString(), 302);
  }

  if (!scope.includes("activity:read") && !scope.includes("activity:read_all")) {
    successUrl.searchParams.set("strava_error", "missing_activity_scope");
    return c.redirect(successUrl.toString(), 302);
  }

  try {
    const { athlete, tokens } = await exchangeCode(code);
    const session = await createSession(athlete, tokens);
    setCookie(c, SESSION_COOKIE, session.id, {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    successUrl.searchParams.set("strava", "connected");
    return c.redirect(successUrl.toString(), 302);
  } catch (err) {
    successUrl.searchParams.set(
      "strava_error",
      err instanceof Error ? err.message : "token_exchange_failed",
    );
    return c.redirect(successUrl.toString(), 302);
  }
});

app.get("/api/auth/me", async (c) => {
  const session = await getValidSession(getCookie(c, SESSION_COOKIE));
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
  await deleteSession(getCookie(c, SESSION_COOKIE));
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

app.get("/api/strava/activities", async (c) => {
  const session = await getValidSession(getCookie(c, SESSION_COOKIE));
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
  const session = await getValidSession(getCookie(c, SESSION_COOKIE));
  if (!session) return c.json({ error: "Not authenticated" }, 401);

  const body = await c.req.json<{ activityId?: number }>().catch(() => ({}));
  const activityId = Number(body.activityId);
  if (!Number.isFinite(activityId) || activityId <= 0) {
    return c.json({ error: "activityId is required" }, 400);
  }

  try {
    const activity = await getAthleteActivity(session.tokens.accessToken, activityId);
    const result = await upsertRun({
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

app.get("/api/runs", async (c) => {
  const runs = await listRuns();
  return c.json({ runs });
});

app.get("/api/leaderboard", async (c) => {
  const leaderboard = await buildLeaderboard();
  return c.json({ leaderboard });
});

console.log(`Strava API listening on http://localhost:${PORT}`);
serve({ fetch: app.fetch, port: PORT });
