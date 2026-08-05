import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createMemoryStore } from "./store.js";
import type { RunStore, StoreData } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, "data", "store.json");

async function readFileStore(): Promise<StoreData> {
  try {
    const raw = await readFile(DATA_PATH, "utf8");
    return JSON.parse(raw) as StoreData;
  } catch {
    return { sessions: [], runs: [], targets: [], oauthStates: {}, exchangeCodes: {} };
  }
}

async function writeFileStore(data: StoreData): Promise<void> {
  await mkdir(dirname(DATA_PATH), { recursive: true });
  await writeFile(DATA_PATH, JSON.stringify(data, null, 2));
}

export async function createFileStore(): Promise<RunStore> {
  const initial = await readFileStore();
  const memory = createMemoryStore(initial);

  const persist = async () => {
    await writeFileStore(memory.snapshot());
  };

  return {
    async createSession(athlete, tokens) {
      const session = await memory.createSession(athlete, tokens);
      await persist();
      return session;
    },
    getSession: (sessionId) => memory.getSession(sessionId),
    async touchSession(sessionId) {
      const session = await memory.touchSession(sessionId);
      await persist();
      return session;
    },
    async updateSessionTokens(sessionId, tokens) {
      const session = await memory.updateSessionTokens(sessionId, tokens);
      await persist();
      return session;
    },
    async deleteSession(sessionId) {
      await memory.deleteSession(sessionId);
      await persist();
    },
    listRuns: () => memory.listRuns(),
    async upsertRun(run) {
      const result = await memory.upsertRun(run);
      await persist();
      return result;
    },
    listTargets: () => memory.listTargets(),
    async upsertTarget(target) {
      const result = await memory.upsertTarget(target);
      await persist();
      return result;
    },
    buildLeaderboard: () => memory.buildLeaderboard(),
    async saveOAuthState(state, codeVerifier) {
      await memory.saveOAuthState(state, codeVerifier);
      await persist();
    },
    async consumeOAuthState(state) {
      const result = await memory.consumeOAuthState(state);
      await persist();
      return result;
    },
    async saveExchangeCode(code, sessionId) {
      await memory.saveExchangeCode(code, sessionId);
      await persist();
    },
    async consumeExchangeCode(code) {
      const sessionId = await memory.consumeExchangeCode(code);
      await persist();
      return sessionId;
    },
  };
}
