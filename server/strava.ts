import type { AthleteProfile, StravaActivitySummary, StravaTokens } from "./types.js";

const STRAVA_AUTH = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN = "https://www.strava.com/oauth/token";
const STRAVA_API = "https://www.strava.com/api/v3";

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getStravaConfig() {
  return {
    clientId: requireEnv("STRAVA_CLIENT_ID"),
    clientSecret: requireEnv("STRAVA_CLIENT_SECRET"),
    redirectUri: requireEnv("STRAVA_REDIRECT_URI"),
    appOrigin: process.env.APP_ORIGIN?.trim() || "http://localhost:5173/dice_run_challenge/",
    scopes: "read,activity:read_all",
  };
}

export function buildAuthorizeUrl(state: string): string {
  const { clientId, redirectUri, scopes } = getStravaConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    scope: scopes,
    state,
  });
  return `${STRAVA_AUTH}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: {
    id: number;
    firstname: string;
    lastname: string;
    profile: string;
    city?: string | null;
    country?: string | null;
  };
}

function toTokens(payload: TokenResponse): StravaTokens {
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: payload.expires_at,
  };
}

export async function exchangeCode(code: string): Promise<{
  tokens: StravaTokens;
  athlete: AthleteProfile;
}> {
  const { clientId, clientSecret } = getStravaConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
  });

  const response = await fetch(STRAVA_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Strava token exchange failed: ${response.status} ${text}`);
  }

  const payload = (await response.json()) as TokenResponse;
  if (!payload.athlete) {
    throw new Error("Strava token response did not include athlete profile");
  }

  return {
    tokens: toTokens(payload),
    athlete: {
      id: payload.athlete.id,
      firstname: payload.athlete.firstname,
      lastname: payload.athlete.lastname,
      profile: payload.athlete.profile,
      city: payload.athlete.city,
      country: payload.athlete.country,
    },
  };
}

export async function refreshTokens(refreshToken: string): Promise<StravaTokens> {
  const { clientId, clientSecret } = getStravaConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(STRAVA_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Strava token refresh failed: ${response.status} ${text}`);
  }

  const payload = (await response.json()) as TokenResponse;
  return toTokens(payload);
}

export async function listAthleteActivities(
  accessToken: string,
  perPage = 30,
): Promise<StravaActivitySummary[]> {
  const params = new URLSearchParams({
    per_page: String(perPage),
    page: "1",
  });

  const response = await fetch(`${STRAVA_API}/athlete/activities?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Strava activities failed: ${response.status} ${text}`);
  }

  return (await response.json()) as StravaActivitySummary[];
}

export async function getAthleteActivity(
  accessToken: string,
  activityId: number,
): Promise<StravaActivitySummary> {
  const response = await fetch(`${STRAVA_API}/activities/${activityId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Strava activity lookup failed: ${response.status} ${text}`);
  }

  return (await response.json()) as StravaActivitySummary;
}

export function metersToKm(meters: number): number {
  return Number((meters / 1000).toFixed(2));
}

export function athleteDisplayName(athlete: AthleteProfile): string {
  return `${athlete.firstname} ${athlete.lastname}`.trim();
}
