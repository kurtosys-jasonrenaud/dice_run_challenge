import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  applySecurityHeaders,
  clientKey,
  clientSafeError,
  createCodeChallenge,
  createCodeVerifier,
  MAX_JSON_BYTES,
  rateLimit,
  sessionWithinLimits,
} from "./security.js";
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

function readSessionId(c: {
  req: { header: (name: string) => string | undefined };
}): string | undefined {
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

function enforceRateLimit(
  c: { req: { raw: Request; path: string }; header: (name: string, value: string) => void },
  limit: number,
  windowMs: number,
) {
  const key = `${clientKey(c.req.raw)}:${c.req.path}`;
  const result = rateLimit(key, limit, windowMs);
  if (!result.allowed) {
    c.header("Retry-After", String(result.retryAfterSec));
    return false;
  }
  return true;
}

export function createApp({ env, store }: CreateAppOptions) {
  const app = new Hono();
  const origins = allowedOrigins(env);
  const officePublishToken = env.OFFICE_PUBLISH_TOKEN?.trim() || "";

  app.use("*", async (c, next) => {
    await next();
    applySecurityHeaders(c.res.headers);
  });

  app.use(
    "*",
    cors({
      origin: (origin) => {
        if (!origin) return "";
        return origins.includes(origin) ? origin : "";
      },
      allowHeaders: ["Content-Type", "Authorization", "X-Office-Publish-Token"],
      allowMethods: ["GET", "POST", "OPTIONS"],
      maxAge: 600,
    }),
  );

  app.use("/api/*", async (c, next) => {
    if (!enforceRateLimit(c, 180, 60_000)) {
      return c.json({ error: "Too many requests" }, 429);
    }
    return next();
  });

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

    if (!sessionWithinLimits(session.createdAt, session.updatedAt)) {
      await store.deleteSession(session.id);
      return null;
    }

    const skewSeconds = 60;
    const now = Math.floor(Date.now() / 1000);
    if (session.tokens.expiresAt > now + skewSeconds) {
      await store.touchSession(session.id);
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
    if (!enforceRateLimit(c, 12, 60_000)) {
      return c.json({ error: "Too many requests" }, 429);
    }

    try {
      getStravaConfig(env);
      const state = crypto.randomUUID();
      const codeVerifier = createCodeVerifier();
      const codeChallenge = await createCodeChallenge(codeVerifier);
      await store.saveOAuthState(state, codeVerifier);
      return c.redirect(buildAuthorizeUrl(env, state, codeChallenge), 302);
    } catch {
      return c.json({ error: "Strava is not configured" }, 500);
    }
  });

  app.get("/api/auth/callback", async (c) => {
    const code = c.req.query("code");
    const state = c.req.query("state");
    const error = c.req.query("error");
    const scope = c.req.query("scope") || "";
    const { appOrigin } = getStravaConfig(env);

    if (error) {
      return c.redirect(buildAppRedirect(appOrigin, { strava_error: "access_denied" }), 302);
    }

    const stateResult = state
      ? await store.consumeOAuthState(state)
      : { ok: false, codeVerifier: null };
    if (!code || !state || !stateResult.ok || !stateResult.codeVerifier) {
      return c.redirect(buildAppRedirect(appOrigin, { strava_error: "invalid_state" }), 302);
    }

    if (!scope.includes("activity:read") && !scope.includes("activity:read_all")) {
      return c.redirect(
        buildAppRedirect(appOrigin, { strava_error: "missing_activity_scope" }),
        302,
      );
    }

    try {
      const { athlete, tokens } = await exchangeCode(env, code, stateResult.codeVerifier);
      const session = await store.createSession(athlete, tokens);
      const exchange = crypto.randomUUID();
      await store.saveExchangeCode(exchange, session.id);
      return c.redirect(
        buildAppRedirect(appOrigin, {
          strava: "connected",
          exchange,
        }),
        302,
      );
    } catch {
      return c.redirect(
        buildAppRedirect(appOrigin, { strava_error: "token_exchange_failed" }),
        302,
      );
    }
  });

  app.post("/api/auth/session", async (c) => {
    if (!enforceRateLimit(c, 20, 60_000)) {
      return c.json({ error: "Too many requests" }, 429);
    }

    const body = await c.req.json<{ exchange?: string }>().catch(() => ({}));
    const exchange = String(body.exchange || "").trim();
    if (!exchange) return c.json({ error: "exchange is required" }, 400);

    const sessionId = await store.consumeExchangeCode(exchange);
    if (!sessionId) return c.json({ error: "Invalid or expired exchange code" }, 400);

    const session = await getValidSession(sessionId);
    if (!session) return c.json({ error: "Session unavailable" }, 401);

    return c.json({ session: session.id });
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
        { error: clientSafeError(error, "Failed to load activities") },
        502,
      );
    }
  });

  app.post("/api/runs", async (c) => {
    if (!enforceRateLimit(c, 20, 60_000)) {
      return c.json({ error: "Too many requests" }, 429);
    }

    const session = await getValidSession(readSessionId(c));
    if (!session) return c.json({ error: "Not authenticated" }, 401);

    const contentLength = Number(c.req.header("content-length") || 0);
    if (contentLength > MAX_JSON_BYTES) {
      return c.json({ error: "Request too large" }, 413);
    }

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
        { error: clientSafeError(error, "Failed to submit run") },
        502,
      );
    }
  });

  app.get("/api/runs", async (c) => c.json({ runs: await store.listRuns() }));

  app.get("/api/targets", async (c) => c.json({ targets: await store.listTargets() }));

  app.post("/api/targets", async (c) => {
    if (!enforceRateLimit(c, 10, 60_000)) {
      return c.json({ error: "Too many requests" }, 429);
    }

    const contentLength = Number(c.req.header("content-length") || 0);
    if (contentLength > MAX_JSON_BYTES) {
      return c.json({ error: "Request too large" }, 413);
    }

    const session = await getValidSession(readSessionId(c));
    const providedOfficeToken = (
      c.req.header("X-Office-Publish-Token") ||
      c.req.header("x-office-publish-token") ||
      ""
    ).trim();
    const officeAuthorized =
      Boolean(officePublishToken) &&
      Boolean(providedOfficeToken) &&
      providedOfficeToken === officePublishToken;
    const origin = c.req.header("Origin") || "";
    const originAllowed = Boolean(origin) && origins.includes(origin);

    // Prefer Strava session or office publish token. If the token is not configured yet,
    // allow only browser requests from the approved CORS origin (rate-limited above).
    if (!session && !officeAuthorized) {
      if (officePublishToken || !originAllowed) {
        return c.json({ error: "Authentication required to publish targets" }, 401);
      }
    }

    const body = await c.req
      .json<{
        challengeDate?: string;
        distanceKm?: number;
        diceValue?: number | null;
        type?: "weekday" | "weekend" | "rest";
        publishedBy?: string | null;
      }>()
      .catch(() => ({}));

    const challengeDate = String(body.challengeDate || "").trim();
    const distanceKm = Number(body.distanceKm);
    const type = body.type;
    const diceValue =
      body.diceValue === null || body.diceValue === undefined
        ? null
        : Number(body.diceValue);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(challengeDate)) {
      return c.json({ error: "challengeDate must be YYYY-MM-DD" }, 400);
    }
    if (!Number.isFinite(distanceKm) || distanceKm < 0) {
      return c.json({ error: "distanceKm must be a non-negative number" }, 400);
    }
    if (type !== "weekday" && type !== "weekend" && type !== "rest") {
      return c.json({ error: "type must be weekday, weekend, or rest" }, 400);
    }
    if (
      diceValue !== null &&
      (![1, 2, 3, 4, 5, 6].includes(diceValue) || !Number.isInteger(diceValue))
    ) {
      return c.json({ error: "diceValue must be 1-6 or null" }, 400);
    }

    const target = await store.upsertTarget({
      challengeDate,
      distanceKm,
      diceValue,
      type,
      publishedBy: session
        ? athleteDisplayName(session.athlete)
        : body.publishedBy || "Office dice",
    });

    return c.json({ target }, 201);
  });

  app.get("/api/leaderboard", async (c) =>
    c.json({ leaderboard: await store.buildLeaderboard() }),
  );

  return app;
}
