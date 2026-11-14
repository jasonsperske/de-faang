/**
 * Turns an Excalidraw scene into a compact text description (labelled shapes plus arrows between them),
 * so the interviewer can "see" the whiteboard on every turn without sending an image.
 */
type El = {
  id: string;
  type: string;
  isDeleted?: boolean;
  text?: string;
  originalText?: string;
  containerId?: string | null;
  boundElements?: { id: string; type: string }[] | null;
  startBinding?: { elementId: string } | null;
  endBinding?: { elementId: string } | null;
  x: number;
  y: number;
};

export function summarizeDiagram(elements: readonly El[]): string {
  const live = elements.filter((e) => !e.isDeleted);
  const byId = new Map(live.map((e) => [e.id, e]));
  const labelOf = new Map<string, string>();
  for (const t of live) {
    if (t.type === "text" && t.containerId && (t.originalText ?? t.text)) labelOf.set(t.containerId, (t.originalText ?? t.text)!.replace(/\s+/g, " ").trim());
  }
  const shapeTypes = new Set(["rectangle", "ellipse", "diamond", "frame"]);
  const shapes = live.filter((e) => shapeTypes.has(e.type));
  const name = (id?: string) => {
    if (!id) return "(unconnected)";
    const el = byId.get(id);
    if (!el) return "(unknown)";
    return labelOf.get(id) ? `[${labelOf.get(id)}]` : `[unlabelled ${el.type}]`;
  };
  const lines: string[] = [];
  if (shapes.length) lines.push("Components: " + shapes.map((s) => name(s.id)).join(", "));
  const arrows = live.filter((e) => e.type === "arrow" || e.type === "line");
  for (const a of arrows) {
    const label = labelOf.get(a.id);
    lines.push(`${name(a.startBinding?.elementId)} -> ${name(a.endBinding?.elementId)}${label ? ` (${label})` : ""}`);
  }
  const free = live.filter((e) => e.type === "text" && !e.containerId && e.text?.trim());
  if (free.length) lines.push("Free text: " + free.map((t) => `"${(t.originalText ?? t.text)!.replace(/\s+/g, " ").trim()}"`).join("; "));
  return lines.join("\n");
}
