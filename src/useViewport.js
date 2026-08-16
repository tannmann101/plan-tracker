import { useEffect, useState } from "react";

// Single breakpoint the whole app branches on for the desktop-vs-mobile
// shell/layout split -- mobile stays exactly as it was below this width, so
// the only thing that should ever read this is a layout decision, never a
// data or business-logic one.
export const DESKTOP_BREAKPOINT = 1024;

export function useViewport() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= DESKTOP_BREAKPOINT
  );

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
    const onChange = () => setIsDesktop(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return { isDesktop };
}
