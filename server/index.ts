import { serve } from "@hono/node-server";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createApp } from "./app.js";
import { createFileStore } from "./file-store.js";
import type { StravaEnvConfig } from "./types.js";

function loadEnvFile() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile();

const env: StravaEnvConfig = {
  STRAVA_CLIENT_ID: process.env.STRAVA_CLIENT_ID || "",
  STRAVA_CLIENT_SECRET: process.env.STRAVA_CLIENT_SECRET || "",
  STRAVA_REDIRECT_URI:
    process.env.STRAVA_REDIRECT_URI || "http://localhost:5173/api/auth/callback",
  APP_ORIGIN: process.env.APP_ORIGIN || "http://localhost:5173/dice_run_challenge/",
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || "",
  OFFICE_PUBLISH_TOKEN: process.env.OFFICE_PUBLISH_TOKEN || "",
};

const PORT = Number(process.env.API_PORT || 8787);
const store = await createFileStore();
const app = createApp({ env, store });

console.log(`Strava API listening on http://localhost:${PORT}`);
serve({ fetch: app.fetch, port: PORT });
