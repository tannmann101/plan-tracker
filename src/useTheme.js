import { useEffect, useState } from "react";

const STORAGE_KEY = "secretary-theme";

export function getStoredTheme() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// Three states, matching theme.js's THEME_VARS_CSS: an explicit choice
// stamps data-theme on <html> and always wins (index.html's inline script
// does this synchronously pre-mount too, so there's no flash of the wrong
// theme on load); the default "system" state stamps nothing at all and
// just tracks prefers-color-scheme live via the media-query block in CSS.
export function useTheme() {
  const [stored, setStored] = useState(() => getStoredTheme());
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    if (stored) document.documentElement.dataset.theme = stored;
    else delete document.documentElement.dataset.theme;
  }, [stored]);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const setTheme = (mode) => {
    setStored(mode);
    try {
      if (mode) localStorage.setItem(STORAGE_KEY, mode);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore -- private browsing, storage disabled, etc.
    }
  };

  const resolved = stored || (systemDark ? "dark" : "light");
  return { theme: resolved, explicit: stored, setTheme };
}
