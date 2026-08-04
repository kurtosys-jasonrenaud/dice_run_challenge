import type {
  ChallengeTarget,
  LeaderboardEntry,
  RunStore,
  SessionRecord,
  SharedRun,
  StoreData,
} from "./types.js";

const emptyStore = (): StoreData => ({
  sessions: [],
  runs: [],
  targets: [],
  oauthStates: {},
});

function newId(): string {
  return crypto.randomUUID();
}

function normalizeStore(raw: StoreData): StoreData {
  return {
    sessions: Array.isArray(raw.sessions) ? raw.sessions : [],
    runs: Array.isArray(raw.runs) ? raw.runs : [],
    targets: Array.isArray(raw.targets) ? raw.targets : [],
    oauthStates: raw.oauthStates || {},
  };
}

/** Map an activity timestamp to the challenge day (Sunday counts as Saturday weekend). */
export function activityToChallengeDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);

  const local = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
  );

  // If the string looks like a local datetime without Z, Date may already be local.
  // Prefer calendar date from the ISO prefix when present.
  const prefix = iso.slice(0, 10);
  const hasTimezone = /[zZ]|[+-]\d{2}:\d{2}$/.test(iso);
  const daySource = hasTimezone ? local : new Date(`${prefix}T12:00:00`);

  if (daySource.getDay() === 0) {
    daySource.setDate(daySource.getDate() - 1);
  }

  const year = daySource.getFullYear();
  const month = String(daySource.getMonth() + 1).padStart(2, "0");
  const day = String(daySource.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function rankLeaderboard(runs: SharedRun[], targets: ChallengeTarget[]): LeaderboardEntry[] {
  const targetByDate = new Map(targets.map((target) => [target.challengeDate, target]));
  const byAthlete = new Map<number, LeaderboardEntry>();

  for (const run of runs) {
    const current = byAthlete.get(run.athleteId) ?? {
      athleteId: run.athleteId,
      athleteName: run.athleteName,
      athleteAvatar: run.athleteAvatar,
      runCount: 0,
      totalDistanceKm: 0,
      lastRunAt: null as string | null,
      daysMet: 0,
      daysShort: 0,
    };

    current.runCount += 1;
    current.totalDistanceKm = Number((current.totalDistanceKm + run.distanceKm).toFixed(2));
    if (!current.lastRunAt || new Date(run.startDate) > new Date(current.lastRunAt)) {
      current.lastRunAt = run.startDate;
    }

    const target = targetByDate.get(activityToChallengeDate(run.startDate));
    if (target && target.distanceKm > 0) {
      if (run.distanceKm + 0.05 >= target.distanceKm) current.daysMet = (current.daysMet || 0) + 1;
      else current.daysShort = (current.daysShort || 0) + 1;
    }

    byAthlete.set(run.athleteId, current);
  }

  return [...byAthlete.values()].sort((a, b) => {
    const metDiff = (b.daysMet || 0) - (a.daysMet || 0);
    if (metDiff !== 0) return metDiff;
    if (b.totalDistanceKm !== a.totalDistanceKm) return b.totalDistanceKm - a.totalDistanceKm;
    return b.runCount - a.runCount;
  });
}

function withTargetMethods(getData: () => StoreData, setData?: (data: StoreData) => void): Pick<
  RunStore,
  "listTargets" | "upsertTarget" | "buildLeaderboard"
> {
  return {
    async listTargets() {
      const data = getData();
      return [...(data.targets || [])].sort((a, b) => b.challengeDate.localeCompare(a.challengeDate));
    },
    async upsertTarget(target) {
      const data = getData();
      data.targets = data.targets || [];
      const next: ChallengeTarget = {
        challengeDate: target.challengeDate,
        distanceKm: target.distanceKm,
        diceValue: target.diceValue,
        type: target.type,
        publishedAt: target.publishedAt || new Date().toISOString(),
        publishedBy: target.publishedBy ?? null,
      };
      const index = data.targets.findIndex((item) => item.challengeDate === next.challengeDate);
      if (index >= 0) data.targets[index] = next;
      else data.targets.push(next);
      setData?.(data);
      return next;
    },
    async buildLeaderboard() {
      const data = getData();
      return rankLeaderboard(data.runs, data.targets || []);
    },
  };
}

export function createMemoryStore(initial?: StoreData): RunStore & { snapshot(): StoreData } {
  const data: StoreData = normalizeStore(
    initial
      ? {
          sessions: [...initial.sessions],
          runs: [...initial.runs],
          targets: [...(initial.targets || [])],
          oauthStates: { ...(initial.oauthStates || {}) },
        }
      : emptyStore(),
  );

  const targetMethods = withTargetMethods(() => data);

  return {
    snapshot: () => data,
    async createSession(athlete, tokens) {
      data.sessions = data.sessions.filter((session) => session.athlete.id !== athlete.id);
      const now = new Date().toISOString();
      const session: SessionRecord = {
        id: newId(),
        athlete,
        tokens,
        createdAt: now,
        updatedAt: now,
      };
      data.sessions.push(session);
      return session;
    },
    async getSession(sessionId) {
      if (!sessionId) return null;
      return data.sessions.find((session) => session.id === sessionId) ?? null;
    },
    async updateSessionTokens(sessionId, tokens) {
      const session = data.sessions.find((item) => item.id === sessionId);
      if (!session) return null;
      session.tokens = tokens;
      session.updatedAt = new Date().toISOString();
      return session;
    },
    async deleteSession(sessionId) {
      if (!sessionId) return;
      data.sessions = data.sessions.filter((session) => session.id !== sessionId);
    },
    async listRuns() {
      return [...data.runs].sort(
        (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
      );
    },
    async upsertRun(run) {
      const existing = data.runs.find(
        (item) =>
          item.stravaActivityId === run.stravaActivityId && item.athleteId === run.athleteId,
      );
      if (existing) {
        Object.assign(existing, run, {
          id: existing.id,
          submittedAt: existing.submittedAt,
        });
        return { run: existing, created: false };
      }
      const created: SharedRun = {
        ...run,
        id: newId(),
        submittedAt: new Date().toISOString(),
      };
      data.runs.push(created);
      return { run: created, created: true };
    },
    ...targetMethods,
    async saveOAuthState(state) {
      data.oauthStates = data.oauthStates || {};
      data.oauthStates[state] = Date.now() + 10 * 60 * 1000;
    },
    async consumeOAuthState(state) {
      data.oauthStates = data.oauthStates || {};
      const expiresAt = data.oauthStates[state];
      delete data.oauthStates[state];
      return Boolean(expiresAt && expiresAt >= Date.now());
    },
  };
}

export function createKvStore(kv: KVNamespace): RunStore {
  const KEY = "store";

  async function read(): Promise<StoreData> {
    const raw = await kv.get(KEY, "json");
    if (!raw || typeof raw !== "object") return emptyStore();
    return normalizeStore(raw as StoreData);
  }

  async function write(data: StoreData): Promise<void> {
    await kv.put(KEY, JSON.stringify(data));
  }

  return {
    async createSession(athlete, tokens) {
      const data = await read();
      data.sessions = data.sessions.filter((session) => session.athlete.id !== athlete.id);
      const now = new Date().toISOString();
      const session: SessionRecord = {
        id: newId(),
        athlete,
        tokens,
        createdAt: now,
        updatedAt: now,
      };
      data.sessions.push(session);
      await write(data);
      return session;
    },
    async getSession(sessionId) {
      if (!sessionId) return null;
      const data = await read();
      return data.sessions.find((session) => session.id === sessionId) ?? null;
    },
    async updateSessionTokens(sessionId, tokens) {
      const data = await read();
      const session = data.sessions.find((item) => item.id === sessionId);
      if (!session) return null;
      session.tokens = tokens;
      session.updatedAt = new Date().toISOString();
      await write(data);
      return session;
    },
    async deleteSession(sessionId) {
      if (!sessionId) return;
      const data = await read();
      data.sessions = data.sessions.filter((session) => session.id !== sessionId);
      await write(data);
    },
    async listRuns() {
      const data = await read();
      return [...data.runs].sort(
        (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
      );
    },
    async upsertRun(run) {
      const data = await read();
      const existing = data.runs.find(
        (item) =>
          item.stravaActivityId === run.stravaActivityId && item.athleteId === run.athleteId,
      );
      if (existing) {
        Object.assign(existing, run, {
          id: existing.id,
          submittedAt: existing.submittedAt,
        });
        await write(data);
        return { run: existing, created: false };
      }
      const created: SharedRun = {
        ...run,
        id: newId(),
        submittedAt: new Date().toISOString(),
      };
      data.runs.push(created);
      await write(data);
      return { run: created, created: true };
    },
    async listTargets() {
      const data = await read();
      return [...(data.targets || [])].sort((a, b) => b.challengeDate.localeCompare(a.challengeDate));
    },
    async upsertTarget(target) {
      const data = await read();
      data.targets = data.targets || [];
      const next: ChallengeTarget = {
        challengeDate: target.challengeDate,
        distanceKm: target.distanceKm,
        diceValue: target.diceValue,
        type: target.type,
        publishedAt: target.publishedAt || new Date().toISOString(),
        publishedBy: target.publishedBy ?? null,
      };
      const index = data.targets.findIndex((item) => item.challengeDate === next.challengeDate);
      if (index >= 0) data.targets[index] = next;
      else data.targets.push(next);
      await write(data);
      return next;
    },
    async buildLeaderboard() {
      const data = await read();
      return rankLeaderboard(data.runs, data.targets || []);
    },
    async saveOAuthState(state) {
      const data = await read();
      data.oauthStates = data.oauthStates || {};
      data.oauthStates[state] = Date.now() + 10 * 60 * 1000;
      await write(data);
    },
    async consumeOAuthState(state) {
      const data = await read();
      data.oauthStates = data.oauthStates || {};
      const expiresAt = data.oauthStates[state];
      delete data.oauthStates[state];
      await write(data);
      return Boolean(expiresAt && expiresAt >= Date.now());
    },
  };
}

/** Minimal KV typing so the Worker builds without Cloudflare lib deps. */
export interface KVNamespace {
  get(key: string, type: "json"): Promise<unknown>;
  put(key: string, value: string): Promise<void>;
}
