import { createApp } from "./app";
import { createKvStore, type KVNamespace } from "./store";
import type { StravaEnvConfig } from "./types";

export interface WorkerEnv extends StravaEnvConfig {
  STORE: KVNamespace;
  OFFICE_PUBLISH_TOKEN?: string;
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
        OFFICE_PUBLISH_TOKEN: env.OFFICE_PUBLISH_TOKEN,
      },
      store: createKvStore(env.STORE),
    });
    return app.fetch(request);
  },
};

export default worker;
