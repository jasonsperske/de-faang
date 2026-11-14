import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Group, Panel, Separator, usePanelRef } from "react-resizable-panels";
import { usePersistentLayout } from "../lib/layout";

const RAIL = 34; // px width of a collapsed side panel

interface SideControls {
  /** Collapse this side panel to its rail. */
  collapse: () => void;
}

interface Props {
  /** Layout is remembered per id (e.g. coding vs. system design rooms). */
  id: string;
  left: (c: SideControls) => ReactNode;
  center: ReactNode;
  right: (c: SideControls) => ReactNode;
  leftLabel: string;
  rightLabel: string;
  leftDefault: string;
  rightDefault: string;
  /** Increments on right-panel activity (interviewer replies); the collapsed rail shows a dot for unseen activity. */
  rightActivity?: number;
}

/**
 * Three-column room: resizable side panels that collapse to a slim rail, either with the
 * header button, by dragging them closed, or by double-clicking the divider.
 */
export function RoomLayout(p: Props) {
  const leftRef = usePanelRef();
  const rightRef = usePanelRef();
  const { defaultLayout, onLayoutChanged, userAction } = usePersistentLayout(`room-${p.id}`);
  const collapse = (ref: typeof leftRef) => {
    userAction();
    ref.current?.collapse();
  };
  const expand = (ref: typeof leftRef) => {
    userAction();
    ref.current?.expand();
  };
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // Sync collapsed state on mount (a restored layout may start collapsed).
  useEffect(() => {
    setLeftCollapsed(Boolean(leftRef.current?.isCollapsed()));
    setRightCollapsed(Boolean(rightRef.current?.isCollapsed()));
  }, [leftRef, rightRef]);

  const toggle = useCallback((ref: typeof leftRef) => {
    const panel = ref.current;
    if (!panel) return;
    userAction();
    if (panel.isCollapsed()) panel.expand();
    else panel.collapse();
  }, [userAction]);

  const activity = p.rightActivity ?? 0;
  const [seenActivity, setSeenActivity] = useState(activity);
  useEffect(() => {
    if (!rightCollapsed) setSeenActivity(activity);
  }, [rightCollapsed, activity]);

  return (
    <Group orientation="horizontal" className="room-layout" defaultLayout={defaultLayout} onLayoutChanged={onLayoutChanged}>
      <Panel
        id="left"
        panelRef={leftRef}
        defaultSize={p.leftDefault}
        minSize={220}
        collapsible
        collapsedSize={RAIL}
        className="side-panel left"
        onResize={(s) => setLeftCollapsed(s.inPixels <= RAIL + 1)}
      >
        {leftCollapsed ? (
          <Rail label={p.leftLabel} side="left" onExpand={() => expand(leftRef)} />
        ) : (
          p.left({ collapse: () => collapse(leftRef) })
        )}
      </Panel>
      <Separator className="divider" onDoubleClick={() => toggle(leftRef)} title="Drag to resize · double-click to collapse" />
      <Panel id="center" minSize="30%" className="center-panel">
        {p.center}
      </Panel>
      <Separator className="divider" onDoubleClick={() => toggle(rightRef)} title="Drag to resize · double-click to collapse" />
      <Panel
        id="right"
        panelRef={rightRef}
        defaultSize={p.rightDefault}
        minSize={260}
        collapsible
        collapsedSize={RAIL}
        className="side-panel right"
        onResize={(s) => setRightCollapsed(s.inPixels <= RAIL + 1)}
      >
        {/* Keep the chat mounted while collapsed so streaming replies aren't lost. */}
        <div style={{ display: rightCollapsed ? "none" : "contents" }}>{p.right({ collapse: () => collapse(rightRef) })}</div>
        {rightCollapsed && <Rail label={p.rightLabel} side="right" badge={activity > seenActivity} onExpand={() => expand(rightRef)} />}
      </Panel>
    </Group>
  );
}

function Rail({ label, side, badge, onExpand }: { label: string; side: "left" | "right"; badge?: boolean; onExpand: () => void }) {
  return (
    <button className={`rail ${side}`} onClick={onExpand} title={`Show ${label.toLowerCase()}`}>
      <span className="rail-icon">{side === "left" ? "»" : "«"}</span>
      <span className="rail-label">{label}</span>
      {badge && <span className="rail-badge" aria-label="new message" />}
    </button>
  );
}

/** Small header button that collapses a side panel. */
export function CollapseButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button className="collapse-btn" onClick={onClick} title="Collapse panel" aria-label="Collapse panel">
      {side === "left" ? "«" : "»"}
    </button>
  );
}
