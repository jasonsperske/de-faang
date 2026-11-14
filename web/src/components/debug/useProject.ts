import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectFile } from "../../../../shared/types";
import { api } from "../../lib/api";

export interface OpenFile {
  path: string;
  content: string;
  /** Edited since the last save reached the server. */
  dirty: boolean;
}

export type SaveState = "saved" | "saving" | "dirty" | "error";

export interface Project {
  files: ProjectFile[];
  open: OpenFile[];
  active?: string;
  activeFile?: OpenFile;
  saveState: SaveState;
  error: string | null;
  readOnly: boolean;
  /** Opens a file in the editor; `record` logs it in the investigation timeline (default true). */
  openFile(path: string, record?: boolean): Promise<void>;
  closeFile(path: string): void;
  edit(path: string, content: string): void;
  createFile(path: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  refresh(): Promise<void>;
  /** Re-reads open files that changed on disk (e.g. after a terminal command), unless they have unsaved edits. */
  reloadOpen(): Promise<void>;
  /** Saves every pending edit now (before submitting). */
  flush(): Promise<void>;
}

const SAVE_DELAY = 600;

/**
 * Debugging rounds: the project's files, the editor tabs, and autosave. Each file is saved on its
 * own shortly after an edit, so the app's dev server hot-reloads it.
 */
export function useProject(sessionId: string, initial: ProjectFile[], firstFile: string | undefined, readOnly: boolean): Project {
  const [files, setFiles] = useState<ProjectFile[]>(initial);
  const [open, setOpen] = useState<OpenFile[]>([]);
  const [active, setActive] = useState<string | undefined>();
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [error, setError] = useState<string | null>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const timers = useRef(new Map<string, number>());
  const inflight = useRef(new Set<Promise<unknown>>());

  const refresh = useCallback(async () => {
    try {
      setFiles((await api.files(sessionId)).files);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [sessionId]);

  const openFile = useCallback(
    async (path: string, record = true) => {
      setError(null);
      if (openRef.current.some((f) => f.path === path)) {
        setActive(path);
        return;
      }
      try {
        const { content } = await api.readFile(sessionId, path, record && !readOnly);
        setOpen((o) => (o.some((f) => f.path === path) ? o : [...o, { path, content, dirty: false }]));
        setActive(path);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [sessionId, readOnly],
  );

  const save = useCallback(
    (path: string) => {
      timers.current.delete(path);
      const file = openRef.current.find((f) => f.path === path);
      if (!file || !file.dirty) return;
      const content = file.content;
      setSaveState("saving");
      const p = api
        .writeFile(sessionId, path, content)
        .then(() => {
          setOpen((o) => o.map((f) => (f.path === path && f.content === content ? { ...f, dirty: false } : f)));
          setSaveState(timers.current.size ? "dirty" : "saved");
        })
        .catch((e) => {
          setSaveState("error");
          setError(`Couldn't save ${path}: ${(e as Error).message}`);
        })
        .finally(() => inflight.current.delete(p));
      inflight.current.add(p);
    },
    [sessionId],
  );

  const edit = useCallback(
    (path: string, content: string) => {
      if (readOnly) return;
      setOpen((o) => o.map((f) => (f.path === path ? { ...f, content, dirty: f.dirty || f.content !== content } : f)));
      setSaveState("dirty");
      clearTimeout(timers.current.get(path));
      timers.current.set(path, window.setTimeout(() => save(path), SAVE_DELAY));
    },
    [readOnly, save],
  );

  const flush = useCallback(async () => {
    for (const [path, t] of timers.current) {
      clearTimeout(t);
      save(path);
    }
    // Wait for the state update that `save` reads to land, then for the requests.
    await new Promise((r) => setTimeout(r, 0));
    await Promise.all([...inflight.current]);
  }, [save]);

  const closeFile = useCallback((path: string) => {
    const t = timers.current.get(path);
    if (t) {
      clearTimeout(t);
      save(path);
    }
    setOpen((o) => {
      const i = o.findIndex((f) => f.path === path);
      const next = o.filter((f) => f.path !== path);
      setActive((a) => (a === path ? (next[Math.min(i, next.length - 1)]?.path ?? undefined) : a));
      return next;
    });
  }, [save]);

  const createFile = useCallback(
    async (path: string) => {
      setError(null);
      try {
        await api.writeFile(sessionId, path, "", true);
        await refresh();
        await openFile(path);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [sessionId, refresh, openFile],
  );

  const deleteFile = useCallback(
    async (path: string) => {
      setError(null);
      try {
        await api.deleteFile(sessionId, path);
        clearTimeout(timers.current.get(path));
        timers.current.delete(path);
        setOpen((o) => o.filter((f) => f.path !== path));
        setActive((a) => (a === path ? undefined : a));
        await refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [sessionId, refresh],
  );

  const reloadOpen = useCallback(async () => {
    await refresh();
    const current = openRef.current.filter((f) => !f.dirty && !timers.current.has(f.path));
    const fresh = await Promise.all(current.map((f) => api.readFile(sessionId, f.path).then((r) => r, () => null)));
    setOpen((o) =>
      o.flatMap((f) => {
        const i = current.findIndex((c) => c.path === f.path);
        if (i === -1 || f.dirty) return [f];
        const r = fresh[i];
        if (!r) return []; // deleted
        return [r.content === f.content ? f : { ...f, content: r.content }];
      }),
    );
  }, [sessionId, refresh]);

  // Open the question's first file (or the first source file) when the round starts.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const first = firstFile && initial.some((f) => f.path === firstFile) ? firstFile : initial.find((f) => !f.binary && f.path.startsWith("src/"))?.path;
    if (first) void openFile(first, false);
  }, [firstFile, initial, openFile]);

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  return {
    files,
    open,
    active,
    activeFile: open.find((f) => f.path === active),
    saveState,
    error,
    readOnly,
    openFile,
    closeFile,
    edit,
    createFile,
    deleteFile,
    refresh,
    reloadOpen,
    flush,
  };
}
