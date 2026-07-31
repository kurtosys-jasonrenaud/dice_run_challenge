import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { useHashRoute } from "./lib/routing";
import { StravaTestPage } from "./pages/StravaTestPage";
import "./index.css";

function Root() {
  const route = useHashRoute();
  if (route.startsWith("/strava-test")) {
    return <StravaTestPage />;
  }
  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
