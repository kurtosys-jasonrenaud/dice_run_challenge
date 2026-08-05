export interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface AthleteProfile {
  id: number;
  firstname: string;
  lastname: string;
  profile: string;
  city?: string | null;
  country?: string | null;
}

export interface SessionRecord {
  id: string;
  athlete: AthleteProfile;
  tokens: StravaTokens;
  createdAt: string;
  updatedAt: string;
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

export interface ChallengeTarget {
  challengeDate: string;
  distanceKm: number;
  diceValue: number | null;
  type: "weekday" | "weekend" | "rest";
  publishedAt: string;
  publishedBy?: string | null;
}

export interface OAuthStateRecord {
  expiresAt: number;
  codeVerifier: string;
}

export interface ExchangeCodeRecord {
  sessionId: string;
  expiresAt: number;
}

export interface StoreData {
  sessions: SessionRecord[];
  runs: SharedRun[];
  targets?: ChallengeTarget[];
  oauthStates?: Record<string, number | OAuthStateRecord>;
  exchangeCodes?: Record<string, ExchangeCodeRecord>;
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

export interface StravaActivitySummary {
  id: number;
  name: string;
  type: string;
  sport_type?: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  start_date: string;
  start_date_local: string;
  map?: { summary_polyline?: string | null };
}

export interface StravaEnvConfig {
  STRAVA_CLIENT_ID: string;
  STRAVA_CLIENT_SECRET: string;
  STRAVA_REDIRECT_URI: string;
  APP_ORIGIN: string;
  ALLOWED_ORIGINS?: string;
  /** Shared office write key for publishing dice targets without Strava. */
  OFFICE_PUBLISH_TOKEN?: string;
}

export interface RunStore {
  createSession(athlete: AthleteProfile, tokens: StravaTokens): Promise<SessionRecord>;
  getSession(sessionId: string | undefined): Promise<SessionRecord | null>;
  touchSession(sessionId: string): Promise<SessionRecord | null>;
  updateSessionTokens(sessionId: string, tokens: StravaTokens): Promise<SessionRecord | null>;
  deleteSession(sessionId: string | undefined): Promise<void>;
  listRuns(): Promise<SharedRun[]>;
  upsertRun(
    run: Omit<SharedRun, "id" | "submittedAt"> & { id?: string },
  ): Promise<{ run: SharedRun; created: boolean }>;
  listTargets(): Promise<ChallengeTarget[]>;
  upsertTarget(
    target: Omit<ChallengeTarget, "publishedAt"> & { publishedAt?: string },
  ): Promise<ChallengeTarget>;
  buildLeaderboard(): Promise<LeaderboardEntry[]>;
  saveOAuthState(state: string, codeVerifier: string): Promise<void>;
  consumeOAuthState(state: string): Promise<{ ok: boolean; codeVerifier: string | null }>;
  saveExchangeCode(code: string, sessionId: string): Promise<void>;
  consumeExchangeCode(code: string): Promise<string | null>;
}
