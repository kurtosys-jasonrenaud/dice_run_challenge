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

export interface StoreData {
  sessions: SessionRecord[];
  runs: SharedRun[];
}

export interface LeaderboardEntry {
  athleteId: number;
  athleteName: string;
  athleteAvatar: string;
  runCount: number;
  totalDistanceKm: number;
  lastRunAt: string | null;
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
