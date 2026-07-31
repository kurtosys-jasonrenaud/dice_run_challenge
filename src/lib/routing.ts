import { useEffect, useState } from "react";

export function getHashRoute(): string {
  const hash = window.location.hash.replace(/^#/, "");
  return hash.startsWith("/") ? hash : `/${hash}`;
}

export function useHashRoute(): string {
  const [route, setRoute] = useState(getHashRoute);

  useEffect(() => {
    const onChange = () => setRoute(getHashRoute());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return route;
}
