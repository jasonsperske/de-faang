import { useCallback, useEffect, useRef, useState } from "react";
import type { AppStatus } from "../../../../shared/types";
import { api } from "../../lib/api";

/** Debugging rounds: the app's dev server. Starts it when the round opens and polls its status and logs. */
export function useAppStatus(sessionId: string, readOnly: boolean) {
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);

  const poll = useCallback(async () => {
    try {
      const s = await api.appStatus(sessionId);
      if (alive.current) setStatus(s);
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    }
  }, [sessionId]);

  const act = useCallback(
    async (action: "start" | "restart" | "stop") => {
      setBusy(true);
      setError(null);
      try {
        setStatus(await api.app(sessionId, action));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [sessionId],
  );

  useEffect(() => {
    alive.current = true;
    if (readOnly) void poll();
    else void act("start");
    return () => {
      alive.current = false;
    };
  }, [readOnly, poll, act]);

  // Poll quickly while starting, slowly otherwise (for logs and crashes).
  const state = status?.state;
  useEffect(() => {
    if (readOnly && state !== "running" && state !== "starting") return;
    const t = setInterval(() => void poll(), state === "starting" ? 1000 : 3000);
    return () => clearInterval(t);
  }, [state, readOnly, poll]);

  return { status, error, busy, start: () => act("start"), restart: () => act("restart"), stop: () => act("stop") };
}

export type AppControls = ReturnType<typeof useAppStatus>;
