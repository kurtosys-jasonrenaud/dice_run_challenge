import type {
  LeaderboardEntry,
  RunStore,
  SessionRecord,
  SharedRun,
  StoreData,
} from "./types.js";

const emptyStore = (): StoreData => ({ sessions: [], runs: [], oauthStates: {} });

function newId(): string {
  return crypto.randomUUID();
}

function rankLeaderboard(runs: SharedRun[]): LeaderboardEntry[] {
  const byAthlete = new Map<number, LeaderboardEntry>();

  for (const run of runs) {
    const current = byAthlete.get(run.athleteId) ?? {
      athleteId: run.athleteId,
      athleteName: run.athleteName,
      athleteAvatar: run.athleteAvatar,
      runCount: 0,
      totalDistanceKm: 0,
      lastRunAt: null as string | null,
    };

    current.runCount += 1;
    current.totalDistanceKm = Number((current.totalDistanceKm + run.distanceKm).toFixed(2));
    if (!current.lastRunAt || new Date(run.startDate) > new Date(current.lastRunAt)) {
      current.lastRunAt = run.startDate;
    }
    byAthlete.set(run.athleteId, current);
  }

  return [...byAthlete.values()].sort((a, b) => {
    if (b.totalDistanceKm !== a.totalDistanceKm) return b.totalDistanceKm - a.totalDistanceKm;
    return b.runCount - a.runCount;
  });
}

export function createMemoryStore(initial?: StoreData): RunStore & { snapshot(): StoreData } {
  const data: StoreData = initial
    ? {
        sessions: [...initial.sessions],
        runs: [...initial.runs],
        oauthStates: { ...(initial.oauthStates || {}) },
      }
    : emptyStore();

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
    async buildLeaderboard() {
      return rankLeaderboard(await this.listRuns());
    },
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
    const parsed = raw as StoreData;
    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      runs: Array.isArray(parsed.runs) ? parsed.runs : [],
      oauthStates: parsed.oauthStates || {},
    };
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
    async buildLeaderboard() {
      return rankLeaderboard(await this.listRuns());
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
