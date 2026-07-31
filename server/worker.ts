import { createApp } from "./app";
import { createKvStore, type KVNamespace } from "./store";
import type { StravaEnvConfig } from "./types";

export interface WorkerEnv extends StravaEnvConfig {
  STORE: KVNamespace;
}

const worker = {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const app = createApp({
      env: {
        STRAVA_CLIENT_ID: env.STRAVA_CLIENT_ID,
        STRAVA_CLIENT_SECRET: env.STRAVA_CLIENT_SECRET,
        STRAVA_REDIRECT_URI: env.STRAVA_REDIRECT_URI,
        APP_ORIGIN: env.APP_ORIGIN,
        ALLOWED_ORIGINS: env.ALLOWED_ORIGINS,
      },
      store: createKvStore(env.STORE),
    });
    return app.fetch(request);
  },
};

export default worker;
