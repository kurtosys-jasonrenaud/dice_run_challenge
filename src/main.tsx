import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { captureSessionFromUrl } from "./lib/stravaApi";
import "./index.css";

captureSessionFromUrl();

if (window.location.hash.startsWith("#/strava")) {
  window.location.replace(`${window.location.pathname}${window.location.search}#strava`);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
