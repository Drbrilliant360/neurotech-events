import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Start each page at the top and hand keyboard focus to the main landmark. */
export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
    document.getElementById("main-content")?.focus({ preventScroll: true });
  }, [pathname]);
  return null;
}
