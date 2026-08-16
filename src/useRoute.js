import { useState, useEffect, useCallback } from "react";

// Minimal history-API router -- no react-router-dom dependency, matching
// this app's established minimal-dependency stance (no charting library
// either, see components/charts.jsx). Paths are flat ("/today", "/week",
// "/plans", ...); BASE_URL is Vite's own base-path config (see
// vite.config.js's `base: '/plan-tracker/'`), kept in sync automatically
// rather than hardcoded here. public/404.html + index.html's inline
// restore script handle the GitHub-Pages deep-link case (a hard refresh
// or shared link to a specific tab, not just in-app navigation).
const BASE = import.meta.env.BASE_URL;

function currentPath() {
  const full = window.location.pathname;
  const rel = full.startsWith(BASE) ? full.slice(BASE.length) : full.replace(/^\//, "");
  return `/${rel}`.replace(/\/+$/, "") || "/today";
}

export function useRoute() {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const onPopState = () => setPath(currentPath());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((nextPath) => {
    const clean = nextPath.startsWith("/") ? nextPath.slice(1) : nextPath;
    window.history.pushState(null, "", `${BASE}${clean}`);
    setPath(currentPath());
  }, []);

  return { path, navigate };
}
