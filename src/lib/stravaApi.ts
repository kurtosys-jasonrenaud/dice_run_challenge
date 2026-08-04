export interface AuthAthlete {
  id: number;
  name: string;
  avatar: string;
  city?: string | null;
  country?: string | null;
}

export interface StravaActivityOption {
  id: number;
  name: string;
  type: string;
  distanceKm: number;
  movingTimeSec: number;
  startDate: string;
  stravaUrl: string;
}

export interface SharedRun {
  id: string;
  athleteId: number;
  athleteName: string;
  athleteAvatar: string;
  stravaActivityId: number;
  name: string;
  type: string;
  distanceKm: number;
  movingTimeSec: number;
  startDate: string;
  stravaUrl: string;
  submittedAt: string;
}

export interface LeaderboardEntry {
  athleteId: number;
  athleteName: string;
  athleteAvatar: string;
  runCount: number;
  totalDistanceKm: number;
  lastRunAt: string | null;
  daysMet?: number;
  daysShort?: number;
}

const SESSION_KEY = "roll-and-run:strava-session";

function apiBase(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return "";
}

export function getSessionToken(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function setSessionToken(token: string | null) {
  if (!token) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, token);
}

function oauthParamsFromLocation(): URLSearchParams {
  const fromSearch = new URLSearchParams(window.location.search);
  if (fromSearch.has("session") || fromSearch.has("strava") || fromSearch.has("strava_error")) {
    return fromSearch;
  }

  const hash = window.location.hash.replace(/^#/, "");
  const queryIndex = hash.indexOf("?");
  if (queryIndex >= 0) {
    return new URLSearchParams(hash.slice(queryIndex + 1));
  }

  return new URLSearchParams();
}

/** Must run before the app strips the OAuth result from the URL. */
export function captureSessionFromUrl() {
  const session = oauthParamsFromLocation().get("session");
  if (session) setSessionToken(session);
}

export function readOAuthFeedback(): { connected: boolean; error: string | null } {
  const params = oauthParamsFromLocation();
  return {
    connected: params.get("strava") === "connected",
    error: params.get("strava_error"),
  };
}

/** Drop OAuth params from search/hash while keeping #strava. */
export function cleanOAuthUrl() {
  const url = new URL(window.location.href);
  url.search = "";
  const hash = url.hash.replace(/^#/, "");
  const path = hash.split("?")[0] || "strava";
  url.hash = path.startsWith("strava") || path === "" ? "strava" : path;
  window.history.replaceState({}, "", `${url.pathname}${url.hash}`);
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers || {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = getSessionToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers,
  });

  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }
  return payload;
}

export function getStravaConnectUrl(): string {
  return `${apiBase()}/api/auth/strava`;
}

export function fetchHealth() {
  return api<{ ok: boolean; stravaConfigured: boolean }>("/api/health");
}

export function fetchMe() {
  return api<{ authenticated: boolean; athlete?: AuthAthlete }>("/api/auth/me");
}

export async function logout() {
  try {
    await api<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
  } finally {
    setSessionToken(null);
  }
}

export function fetchActivities() {
  return api<{ activities: StravaActivityOption[] }>("/api/strava/activities");
}

export function submitRun(activityId: number) {
  return api<{ run: SharedRun; created: boolean }>("/api/runs", {
    method: "POST",
    body: JSON.stringify({ activityId }),
  });
}

export function fetchRuns() {
  return api<{ runs: SharedRun[] }>("/api/runs");
}

export function fetchLeaderboard() {
  return api<{ leaderboard: LeaderboardEntry[] }>("/api/leaderboard");
}

export interface ChallengeTarget {
  challengeDate: string;
  distanceKm: number;
  diceValue: number | null;
  type: "weekday" | "weekend" | "rest";
  publishedAt: string;
  publishedBy?: string | null;
}

export type TargetStatus = "met" | "short" | "rest" | "no-target";

/** Sunday activities count toward the Saturday weekend challenge. */
export function activityToChallengeDate(iso: string): string {
  const prefix = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(prefix)) return prefix;

  const date = new Date(`${prefix}T12:00:00`);
  if (date.getDay() === 0) date.setDate(date.getDate() - 1);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function evaluateTarget(
  distanceKm: number,
  target: ChallengeTarget | undefined,
): { status: TargetStatus; label: string } {
  if (!target) return { status: "no-target", label: "No target set" };
  if (target.distanceKm <= 0 || target.type === "rest") {
    return { status: "rest", label: "Rest day" };
  }
  if (distanceKm + 0.05 >= target.distanceKm) {
    return { status: "met", label: `Met ${target.distanceKm} km` };
  }
  return {
    status: "short",
    label: `Short ${distanceKm.toFixed(2)} / ${target.distanceKm} km`,
  };
}

export function fetchTargets() {
  return api<{ targets: ChallengeTarget[] }>("/api/targets");
}

export function publishTarget(input: {
  challengeDate: string;
  distanceKm: number;
  diceValue: number | null;
  type: "weekday" | "weekend" | "rest";
  publishedBy?: string | null;
}) {
  return api<{ target: ChallengeTarget }>("/api/targets", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function formatMovingTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatDateLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
