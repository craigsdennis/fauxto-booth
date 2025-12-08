import { useCallback, useEffect, useMemo, useState } from "react";
import type { Navigate } from "./navigation";
import { HomePage } from "./pages/HomePage";
import { BoothPage } from "./pages/BoothPage";
import { BoothPhonePage } from "./pages/BoothPhonePage";

type Route =
  | { type: "home" }
  | { type: "booth"; slug: string }
  | { type: "booth-phone"; slug: string };

function normalizePath(path: string) {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function getCurrentPath() {
  if (typeof window === "undefined") return "/";
  return window.location.pathname || "/";
}

function parseRoute(path: string): Route {
  const normalized = normalizePath(path.replace(/\/+$/, ""));
  if (normalized === "/") return { type: "home" };
  const segments = normalized.split("/").filter(Boolean);
  if (segments[0] !== "booths") return { type: "home" };
  const slug = decodeURIComponent(segments[1] ?? "");
  if (!slug) return { type: "home" };
  if (segments[2] === "phone") {
    return { type: "booth-phone", slug };
  }
  return { type: "booth", slug };
}

function useAppRouter() {
  const [path, setPath] = useState(getCurrentPath);

  useEffect(() => {
    const onPopState = () => setPath(getCurrentPath());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback<Navigate>((target, options) => {
    if (typeof window === "undefined") return;
    const nextPath = normalizePath(target);
    if (options?.replace) {
      window.history.replaceState({}, "", nextPath);
    } else {
      window.history.pushState({}, "", nextPath);
    }
    setPath(nextPath);
  }, []);

  const route = useMemo(() => parseRoute(path), [path]);

  return { route, navigate };
}

function App() {
  const { route, navigate } = useAppRouter();

  if (route.type === "booth") {
    return <BoothPage slug={route.slug} navigate={navigate} />;
  }

  if (route.type === "booth-phone") {
    return <BoothPhonePage slug={route.slug} navigate={navigate} />;
  }

  return <HomePage navigate={navigate} />;
}

export default App;
