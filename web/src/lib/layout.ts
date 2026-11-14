import { useCallback, useMemo, useRef } from "react";
import type { Layout, LayoutChangedMeta } from "react-resizable-panels";

const PREFIX = "defaang-layout:";

function read(key: string): Layout | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as Layout) : undefined;
  } catch {
    return undefined;
  }
}

function write(key: string, layout: Layout) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(layout));
  } catch {
    /* storage unavailable: layout just won't persist */
  }
}

/**
 * Remembers a panel Group's layout, but only changes the person made: dragging a divider, keyboard
 * resizing, or a collapse/expand button (call `userAction` right before the imperative call).
 * Changes the library makes on its own — e.g. auto-collapsing panels when the window is momentarily
 * too narrow for their minimum sizes — are not saved.
 */
export function usePersistentLayout(key: string) {
  const defaultLayout = useMemo(() => read(key), [key]);
  const pending = useRef(false);
  const onLayoutChanged = useCallback(
    (layout: Layout, meta: LayoutChangedMeta) => {
      if (meta.isUserInteraction || pending.current) {
        pending.current = false;
        write(key, layout);
      }
    },
    [key],
  );
  const userAction = useCallback(() => {
    pending.current = true;
  }, []);
  return { defaultLayout, onLayoutChanged, userAction };
}
