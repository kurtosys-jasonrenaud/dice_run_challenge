import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { captureSessionFromUrl } from "./lib/stravaApi";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/plus-jakarta-sans/800.css";
import "./index.css";

async function bootstrap() {
  if (window.location.hash.startsWith("#/strava")) {
    window.location.replace(`${window.location.pathname}${window.location.search}#strava`);
  }

  await captureSessionFromUrl();

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
