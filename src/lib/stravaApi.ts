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
