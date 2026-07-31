import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import type {
  AthleteProfile,
  LeaderboardEntry,
  SessionRecord,
  SharedRun,
  StoreData,
  StravaTokens,
} from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, "data", "store.json");

const emptyStore = (): StoreData => ({ sessions: [], runs: [] });

async function ensureStore(): Promise<StoreData> {
  await mkdir(dirname(DATA_PATH), { recursive: true });
  try {
    const raw = await readFile(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw) as StoreData;
    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      runs: Array.isArray(parsed.runs) ? parsed.runs : [],
    };
  } catch {
    const initial = emptyStore();
    await writeFile(DATA_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
}

async function saveStore(data: StoreData): Promise<void> {
  await mkdir(dirname(DATA_PATH), { recursive: true });
  await writeFile(DATA_PATH, JSON.stringify(data, null, 2));
}

export async function createSession(
  athlete: AthleteProfile,
  tokens: StravaTokens,
): Promise<SessionRecord> {
  const store = await ensureStore();
  store.sessions = store.sessions.filter((session) => session.athlete.id !== athlete.id);

  const now = new Date().toISOString();
  const session: SessionRecord = {
    id: randomUUID(),
    athlete,
    tokens,
    createdAt: now,
    updatedAt: now,
  };
  store.sessions.push(session);
  await saveStore(store);
  return session;
}

export async function getSession(sessionId: string | undefined): Promise<SessionRecord | null> {
  if (!sessionId) return null;
  const store = await ensureStore();
  return store.sessions.find((session) => session.id === sessionId) ?? null;
}

export async function updateSessionTokens(
  sessionId: string,
  tokens: StravaTokens,
): Promise<SessionRecord | null> {
  const store = await ensureStore();
  const session = store.sessions.find((item) => item.id === sessionId);
  if (!session) return null;
  session.tokens = tokens;
  session.updatedAt = new Date().toISOString();
  await saveStore(store);
  return session;
}

export async function deleteSession(sessionId: string | undefined): Promise<void> {
  if (!sessionId) return;
  const store = await ensureStore();
  store.sessions = store.sessions.filter((session) => session.id !== sessionId);
  await saveStore(store);
}

export async function listRuns(): Promise<SharedRun[]> {
  const store = await ensureStore();
  return [...store.runs].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
  );
}

export async function upsertRun(
  run: Omit<SharedRun, "id" | "submittedAt"> & { id?: string },
): Promise<{ run: SharedRun; created: boolean }> {
  const store = await ensureStore();
  const existing = store.runs.find(
    (item) => item.stravaActivityId === run.stravaActivityId && item.athleteId === run.athleteId,
  );

  if (existing) {
    Object.assign(existing, run, {
      id: existing.id,
      submittedAt: existing.submittedAt,
    });
    await saveStore(store);
    return { run: existing, created: false };
  }

  const created: SharedRun = {
    ...run,
    id: randomUUID(),
    submittedAt: new Date().toISOString(),
  };
  store.runs.push(created);
  await saveStore(store);
  return { run: created, created: true };
}

export async function buildLeaderboard(): Promise<LeaderboardEntry[]> {
  const runs = await listRuns();
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
