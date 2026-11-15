import { useMemo, useState } from "react";
import type { ProjectFile } from "../../../../shared/types";
import type { Project } from "./useProject";

interface Dir {
  name: string;
  path: string;
  dirs: Dir[];
  files: ProjectFile[];
}

function buildTree(files: ProjectFile[]): Dir {
  const root: Dir = { name: "", path: "", dirs: [], files: [] };
  for (const f of files) {
    const parts = f.path.split("/");
    let dir = root;
    for (const part of parts.slice(0, -1)) {
      let next = dir.dirs.find((d) => d.name === part);
      if (!next) {
        next = { name: part, path: dir.path ? `${dir.path}/${part}` : part, dirs: [], files: [] };
        dir.dirs.push(next);
      }
      dir = next;
    }
    dir.files.push(f);
  }
  const sort = (d: Dir) => {
    d.dirs.sort((a, b) => a.name.localeCompare(b.name));
    d.files.sort((a, b) => a.path.localeCompare(b.path));
    d.dirs.forEach(sort);
  };
  sort(root);
  return root;
}

const fmtSize = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** The project browser: a tab in the prompt panel of debugging rounds. Click a file to open it in the editor. */
export function ProjectBrowser({ project }: { project: Project }) {
  const tree = useMemo(() => buildTree(project.files), [project.files]);
  // Folders start expanded, except the ones that hold data and generated files.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(["data"]));
  const [creating, setCreating] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const dirty = new Set(project.open.filter((f) => f.dirty).map((f) => f.path));
  const openPaths = new Set(project.open.map((f) => f.path));

  const toggle = (path: string) =>
    setCollapsed((c) => {
      const n = new Set(c);
      if (n.has(path)) n.delete(path);
      else n.add(path);
      return n;
    });

  const renderDir = (d: Dir, depth: number): React.ReactNode => (
    <>
      {d.dirs.map((sub) => (
        <div key={sub.path}>
          <button className="tree-row dir" style={{ paddingLeft: 8 + depth * 14 }} onClick={() => toggle(sub.path)} title={sub.path}>
            <span className="tree-caret">{collapsed.has(sub.path) ? "▸" : "▾"}</span>
            <span>{sub.name}</span>
          </button>
          {!collapsed.has(sub.path) && renderDir(sub, depth + 1)}
        </div>
      ))}
      {d.files.map((f) => {
        const name = f.path.split("/").pop()!;
        return (
          <button
            key={f.path}
            className={`tree-row file ${project.active === f.path ? "on" : ""} ${openPaths.has(f.path) ? "open" : ""} ${f.binary ? "binary" : ""}`}
            style={{ paddingLeft: 22 + depth * 14 }}
            onClick={() => !f.binary && void project.openFile(f.path)}
            title={f.binary ? `${f.path} (${fmtSize(f.size)}): binary, inspect it from the terminal` : f.path}
          >
            <span className="tree-name">{name}</span>
            {dirty.has(f.path) && <span className="tree-dot" aria-label="unsaved" />}
            {f.binary && <span className="muted small">{fmtSize(f.size)}</span>}
          </button>
        );
      })}
    </>
  );

  return (
    <div className="project-browser">
      <div className="pb-head">
        <span className="muted small">{project.files.length} files</span>
        <div className="spacer" />
        {!project.readOnly && (
          <button className="ghost small" onClick={() => setCreating(creating === null ? "" : null)} title="Create a file">
            + File
          </button>
        )}
        <button className="ghost small" onClick={() => void project.reloadOpen()} title="Reload the file list (e.g. after a terminal command changed files)">
          ↻
        </button>
      </div>
      {creating !== null && (
        <form
          className="pb-create"
          onSubmit={(e) => {
            e.preventDefault();
            const p = creating.trim();
            if (!p) return;
            setCreating(null);
            void project.createFile(p);
          }}
        >
          <input autoFocus value={creating} placeholder="path/to/file.js" onChange={(e) => setCreating(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setCreating(null)} />
        </form>
      )}
      {project.error && <div className="banner error small">{project.error}</div>}
      <div className="tree">{renderDir(tree, 0)}</div>
      {project.active && !project.readOnly && (
        <div className="pb-foot">
          <button
            className="ghost small danger"
            onClick={() => {
              if (confirmDelete === project.active) {
                setConfirmDelete(null);
                void project.deleteFile(project.active!);
              } else setConfirmDelete(project.active!);
            }}
          >
            {confirmDelete === project.active ? `Really delete ${project.active}?` : `Delete ${project.active.split("/").pop()}`}
          </button>
        </div>
      )}
    </div>
  );
}
