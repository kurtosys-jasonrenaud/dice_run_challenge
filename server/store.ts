import type {
  ChallengeTarget,
  ExchangeCodeRecord,
  LeaderboardEntry,
  OAuthStateRecord,
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
  exchangeCodes: {},
});

function newId(): string {
  return crypto.randomUUID();
}

function normalizeOAuthStates(
  raw: StoreData["oauthStates"],
): Record<string, number | OAuthStateRecord> {
  return raw && typeof raw === "object" ? { ...raw } : {};
}

function normalizeExchangeCodes(
  raw: StoreData["exchangeCodes"],
): Record<string, ExchangeCodeRecord> {
  return raw && typeof raw === "object" ? { ...raw } : {};
}

function normalizeStore(raw: StoreData): StoreData {
  return {
    sessions: Array.isArray(raw.sessions) ? raw.sessions : [],
    runs: Array.isArray(raw.runs) ? raw.runs : [],
    targets: Array.isArray(raw.targets) ? raw.targets : [],
    oauthStates: normalizeOAuthStates(raw.oauthStates),
    exchangeCodes: normalizeExchangeCodes(raw.exchangeCodes),
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

function todayIsoDate(): string {
  const now = new Date();
  // Challenge office is UTC+2; keep "today" stable around midnight SA time.
  const local = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const year = local.getUTCFullYear();
  const month = String(local.getUTCMonth() + 1).padStart(2, "0");
  const day = String(local.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function requiredKmThroughToday(targets: ChallengeTarget[]): number {
  const today = todayIsoDate();
  return Number(
    targets
      .filter((target) => target.distanceKm > 0 && target.challengeDate <= today)
      .reduce((sum, target) => sum + target.distanceKm, 0)
      .toFixed(2),
  );
}

function rankLeaderboard(runs: SharedRun[], targets: ChallengeTarget[]): LeaderboardEntry[] {
  const targetByDate = new Map(targets.map((target) => [target.challengeDate, target]));
  const requiredKm = requiredKmThroughToday(targets);
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
      requiredKm,
      kmMissing: requiredKm,
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

  return [...byAthlete.values()]
    .map((entry) => ({
      ...entry,
      requiredKm,
      kmMissing: Math.max(0, Number((requiredKm - entry.totalDistanceKm).toFixed(2))),
    }))
    .sort((a, b) => {
      const metDiff = (b.daysMet || 0) - (a.daysMet || 0);
      if (metDiff !== 0) return metDiff;
      const missingDiff = (a.kmMissing || 0) - (b.kmMissing || 0);
      if (missingDiff !== 0) return missingDiff;
      if (b.totalDistanceKm !== a.totalDistanceKm) return b.totalDistanceKm - a.totalDistanceKm;
      return b.runCount - a.runCount;
    });
}

function readOAuthRecord(
  value: number | OAuthStateRecord | undefined,
): OAuthStateRecord | null {
  if (!value) return null;
  if (typeof value === "number") {
    return { expiresAt: value, codeVerifier: "" };
  }
  if (typeof value === "object" && typeof value.expiresAt === "number") {
    return {
      expiresAt: value.expiresAt,
      codeVerifier: typeof value.codeVerifier === "string" ? value.codeVerifier : "",
    };
  }
  return null;
}

export function createMemoryStore(initial?: StoreData): RunStore & { snapshot(): StoreData } {
  const data: StoreData = normalizeStore(
    initial
      ? {
          sessions: [...initial.sessions],
          runs: [...initial.runs],
          targets: [...(initial.targets || [])],
          oauthStates: { ...(initial.oauthStates || {}) },
          exchangeCodes: { ...(initial.exchangeCodes || {}) },
        }
      : emptyStore(),
  );

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
    async touchSession(sessionId) {
      const session = data.sessions.find((item) => item.id === sessionId);
      if (!session) return null;
      session.updatedAt = new Date().toISOString();
      return session;
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
    async listTargets() {
      return [...(data.targets || [])].sort((a, b) =>
        b.challengeDate.localeCompare(a.challengeDate),
      );
    },
    async upsertTarget(target) {
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
      return next;
    },
    async buildLeaderboard() {
      return rankLeaderboard(data.runs, data.targets || []);
    },
    async saveOAuthState(state, codeVerifier) {
      data.oauthStates = data.oauthStates || {};
      data.oauthStates[state] = {
        expiresAt: Date.now() + 10 * 60 * 1000,
        codeVerifier,
      };
    },
    async consumeOAuthState(state) {
      data.oauthStates = data.oauthStates || {};
      const record = readOAuthRecord(data.oauthStates[state]);
      delete data.oauthStates[state];
      if (!record || record.expiresAt < Date.now()) {
        return { ok: false, codeVerifier: null };
      }
      return { ok: true, codeVerifier: record.codeVerifier || null };
    },
    async saveExchangeCode(code, sessionId) {
      data.exchangeCodes = data.exchangeCodes || {};
      data.exchangeCodes[code] = {
        sessionId,
        expiresAt: Date.now() + 2 * 60 * 1000,
      };
    },
    async consumeExchangeCode(code) {
      data.exchangeCodes = data.exchangeCodes || {};
      const record = data.exchangeCodes[code];
      delete data.exchangeCodes[code];
      if (!record || record.expiresAt < Date.now()) return null;
      return record.sessionId;
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
    async touchSession(sessionId) {
      const data = await read();
      const session = data.sessions.find((item) => item.id === sessionId);
      if (!session) return null;
      session.updatedAt = new Date().toISOString();
      await write(data);
      return session;
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
      return [...(data.targets || [])].sort((a, b) =>
        b.challengeDate.localeCompare(a.challengeDate),
      );
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
    async saveOAuthState(state, codeVerifier) {
      const data = await read();
      data.oauthStates = data.oauthStates || {};
      data.oauthStates[state] = {
        expiresAt: Date.now() + 10 * 60 * 1000,
        codeVerifier,
      };
      await write(data);
    },
    async consumeOAuthState(state) {
      const data = await read();
      data.oauthStates = data.oauthStates || {};
      const record = readOAuthRecord(data.oauthStates[state]);
      delete data.oauthStates[state];
      await write(data);
      if (!record || record.expiresAt < Date.now()) {
        return { ok: false, codeVerifier: null };
      }
      return { ok: true, codeVerifier: record.codeVerifier || null };
    },
    async saveExchangeCode(code, sessionId) {
      const data = await read();
      data.exchangeCodes = data.exchangeCodes || {};
      data.exchangeCodes[code] = {
        sessionId,
        expiresAt: Date.now() + 2 * 60 * 1000,
      };
      await write(data);
    },
    async consumeExchangeCode(code) {
      const data = await read();
      data.exchangeCodes = data.exchangeCodes || {};
      const record = data.exchangeCodes[code];
      delete data.exchangeCodes[code];
      await write(data);
      if (!record || record.expiresAt < Date.now()) return null;
      return record.sessionId;
    },
  };
}

/** Minimal KV typing so the Worker builds without Cloudflare lib deps. */
export interface KVNamespace {
  get(key: string, type: "json"): Promise<unknown>;
  put(key: string, value: string): Promise<void>;
}
