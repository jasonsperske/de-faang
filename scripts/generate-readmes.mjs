#!/usr/bin/env node
// Regenerates the docs derived from question, rubric and resource data:
//   questions/<type>/<id>/README.md   one per question
//   rubrics/README.md                 the rubric guide
//   README.md                         the question and rubric tables between the <!-- ...:start/end --> markers
//
//   npm run readmes             rewrite the files
//   npm run readmes -- --check  exit 1 (and list the files) if any are out of date
//
// Plain Node with no npm dependencies.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const stale = [];
function write(rel, content) {
  const file = path.join(root, rel);
  const old = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (old === content) return;
  stale.push(rel);
  if (!check) fs.writeFileSync(file, content);
}
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const resources = new Map(read("resources/resources.json").map((r) => [r.id, r]));
const RUBRIC_ORDER = ["coding", "ai-coding", "debugging", "system-design"]; // any others follow alphabetically
const rubricRank = (id) => (RUBRIC_ORDER.includes(id) ? RUBRIC_ORDER.indexOf(id) : RUBRIC_ORDER.length);
const rubrics = Object.fromEntries(
  fs
    .readdirSync(path.join(root, "rubrics"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""))
    .sort((a, b) => rubricRank(a) - rubricRank(b) || a.localeCompare(b))
    .map((id) => [id, read(`rubrics/${id}.json`)]),
);
const link = (id) => {
  const r = resources.get(id);
  if (!r) throw new Error(`unknown resource ${id}`);
  return `[${r.title}](${r.url})`;
};
const pct = (w) => `${Math.round(w * 100)}%`;
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const TYPE_LABEL = { coding: "Coding", debugging: "Debugging", "system-design": "System design" };

function promptSummary(dir) {
  const text = fs.readFileSync(path.join(dir, "prompt.md"), "utf8").split("\n");
  const out = [];
  let started = false;
  for (const line of text.slice(1)) {
    if (!started && !line.trim()) continue;
    if (started && (!line.trim() || line.startsWith("#"))) break;
    started = true;
    out.push(line);
  }
  return out.join("\n");
}

function rubricSection(q, rubricId, extraDims = [], heading = "How it's graded") {
  const rubric = rubrics[rubricId];
  const dims = [...rubric.dimensions, ...extraDims];
  const total = dims.reduce((a, d) => a + d.weight, 0);
  const rows = dims.map((d) => {
    const res = (d.resources ?? []).map(link).join("<br>") || "—";
    const extra = rubric.dimensions.includes(d) ? "" : " *(question-specific)*";
    return `| ${d.name}${extra} | ${pct(d.weight / total)} | ${res} |`;
  });
  return [
    `## ${heading}`,
    "",
    `Rubric: [\`${rubricId}\`](../../../rubrics/README.md#${rubricId}) (${rubric.name}). Each dimension is scored 1–4 with quoted evidence; see the [rubric guide](../../../rubrics/README.md) for the level descriptors and how the hire signal is computed.`,
    "",
    "| Dimension | Weight | Learn more |",
    "|---|---|---|",
    ...rows,
  ].join("\n");
}

function approachBlock(interviewer, title) {
  const lines = [];
  if (interviewer.approach) lines.push(interviewer.approach, "");
  if (interviewer.pitfalls?.length) {
    lines.push("**Common pitfalls**", "", ...interviewer.pitfalls.map((p) => `- ${p}`), "");
  }
  if (interviewer.deepDives?.length) {
    lines.push("**Likely deep dives**", "", ...interviewer.deepDives.map((p) => `- ${p}`), "");
  }
  return lines.join("\n").trimEnd();
}

const index = [];
for (const type of ["coding", "debugging", "system-design"]) {
  if (!fs.existsSync(path.join(root, "questions", type))) continue;
  for (const id of fs.readdirSync(path.join(root, "questions", type)).sort()) {
    const dir = path.join(root, "questions", type, id);
    if (!fs.statSync(dir).isDirectory()) continue;
    const q = read(`questions/${type}/${id}/question.json`);
    const md = [];
    md.push(`# ${q.title}`, "");
    const meta = [
      `**Type:** ${TYPE_LABEL[type]}`,
      `**Difficulty:** ${cap(q.difficulty)}`,
      `**Time:** ${q.durationMinutes} min`,
      `**Tags:** ${q.tags.map((t) => `\`${t}\``).join(" ")}`,
    ];
    if (q.parts) meta.push(`**Parts:** ${q.parts.length}`);
    if (q.ai) meta.push("**AI-assisted:** available");
    md.push(meta.join(" · "), "");
    md.push(promptSummary(dir), "");
    md.push(`Full prompt: [prompt.md](prompt.md)${q.parts ? " (each part's prompt is in `parts/<part-id>/prompt.md`, revealed during the round)" : ""}.`, "");
    if (type === "debugging") {
      md.push(
        "## The round",
        "",
        "You get a bug report ([prompt.md](prompt.md)) and a copy of the app in [`project/`](project/), running with hot reloading (in Docker, or on your machine with the local runner). There's no architecture overview: finding your way around is part of the exercise. The prompt panel has a **Files** tab for browsing and opening the project's files, and the panel under the editor has the app's **Preview**, its **Logs**, and a **Terminal**. Your fix is graded by checks against the sample data and a hidden dataset ([`checks/`](checks/), a spoiler), and by how you investigated.",
        "",
      );
    }

    if (q.parts) {
      md.push("## Parts", "", "| # | Part | Time |", "|---|---|---|");
      q.parts.forEach((p, i) => md.push(`| ${i + 1} | ${p.title} | ${p.durationMinutes} min |`));
      md.push("");
    }

    md.push(rubricSection(q, q.rubric), "");
    if (q.ai) {
      md.push(rubricSection(q, q.ai.rubric, q.ai.dimensions, "How it's graded in AI-assisted rounds"), "");
    }

    md.push("## Approach", "");
    md.push("> **Spoiler.** This is what the interviewer is privately told to look for. Try the round first.", "");
    md.push("<details>", "<summary>Show the approach</summary>", "");
    if (q.parts) {
      if (q.interviewer?.approach) md.push(q.interviewer.approach, "");
      q.parts.forEach((p, i) => {
        md.push(`### Part ${i + 1}: ${p.title}`, "", approachBlock(p.interviewer), "");
      });
    } else {
      md.push(approachBlock(q.interviewer), "");
    }
    md.push("</details>", "");

    if (q.followUps?.length) {
      md.push("## Follow-up questions", "", "Asked in writing after you submit.", "", ...q.followUps.map((f) => `- ${f}`), "");
    }

    md.push("## Study resources", "", ...q.resources.map((r) => `- ${link(r)}`), "");
    write(path.relative(root, path.join(dir, "README.md")), md.join("\n").replace(/\n{3,}/g, "\n\n"));
    index.push({ type, id, q });
  }
}

// rubrics/README.md
const r = [];
r.push(
  "# Rubrics",
  "",
  "Every round is graded against one of these rubrics. Each rubric is a set of weighted dimensions; the evaluator scores each dimension 1–4, quotes evidence from your session for every score, and the server (not the LLM) computes the weighted average and the hire signal.",
  "",
  "## Score scale",
  "",
  "| Score | Meaning |",
  "|---|---|",
  ...Object.entries(rubrics.coding.scale).map(([k, v]) => `| ${k} | ${v} |`),
  "",
  "## Hire signal",
  "",
  "The weighted score (dimension weights normalised to sum to 1) maps to a decision in `server/evaluator.ts`:",
  "",
  "| Weighted score | Decision |",
  "|---|---|",
  "| ≥ 3.5 | Strong Hire |",
  "| ≥ 3.0 | Hire |",
  "| ≥ 2.5 | Lean Hire |",
  "| ≥ 2.0 | Lean No Hire |",
  "| < 2.0 | No Hire |",
  "",
  "AI-assisted rounds add each question's own `ai.dimensions` to the AI rubric, and the weights are normalised together. Rubric resource links can only point at ids in [`resources/resources.json`](../resources/resources.json), so the report can't invent links.",
  "",
  "## Background reading",
  "",
  "These rubrics follow the shape of the structured interview scorecards used at large tech companies: a few independent competencies, each with behavioural level descriptors, rolled up into a hire signal.",
  "",
  "- [Tech Interview Handbook — Coding interview rubrics](https://www.techinterviewhandbook.org/coding-interview-rubrics/): how FAANG interviewers score communication, problem solving, coding, and testing.",
  `- ${link("hellointerview")}: what system design interviewers expect at each level.`,
  `- ${link("sdp-primer")}: the system design topics behind the design dimensions.`,
  "",
);
for (const [id, rub] of Object.entries(rubrics)) {
  r.push(`## ${id}`, "", `**${rub.name}** · [\`${id}.json\`](${id}.json)`, "");
  r.push("| Dimension | Weight | What the evaluator looks for | Learn more |", "|---|---|---|---|");
  for (const d of rub.dimensions) {
    r.push(`| ${d.name} | ${pct(d.weight)} | ${d.signals} | ${(d.resources ?? []).map(link).join("<br>")} |`);
  }
  r.push("", "<details>", "<summary>Level descriptors</summary>", "");
  for (const d of rub.dimensions) {
    r.push(`**${d.name}**`, "", ...Object.entries(d.levels).map(([k, v]) => `- **${k}:** ${v}`), "");
  }
  r.push("</details>", "");
}
r.push("## Adding a rubric", "", "Add `rubrics/<id>.json` with `id`, `name`, `scale` and `dimensions` (each with `id`, `name`, `weight`, `signals`, `levels` 1–4, and `resources`), then reference it from a question's `rubric` or `ai.rubric`. `npm run validate` checks the ids.", "");
write("rubrics/README.md", r.join("\n"));

// Tables in the top-level README
const DIFFICULTY = { easy: 0, medium: 1, hard: 2 };
const TYPES = ["coding", "debugging", "system-design"];
const TYPE_TAGS = new Set(["multipart", "system-design"]); // already shown in other columns
const rubricLink = (id) => `[${id}](rubrics/README.md#${id})`;
const rows = index
  .slice()
  .sort((a, b) =>
    TYPES.indexOf(a.type) - TYPES.indexOf(b.type) ||
    (DIFFICULTY[a.q.difficulty] ?? 9) - (DIFFICULTY[b.q.difficulty] ?? 9) ||
    a.q.durationMinutes - b.q.durationMinutes ||
    a.q.title.localeCompare(b.q.title),
  )
  .map(({ type, id, q }) => {
    const notes = [q.parts ? `${q.parts.length}-part` : null, type === "debugging" ? "Runs the app, with a terminal" : null, q.ai ? "AI-assisted option" : null].filter(Boolean).join(", ");
    const topics = q.tags.filter((t) => !TYPE_TAGS.has(t)).map((t) => `\`${t}\``).join(" ");
    const rubric = rubricLink(q.rubric) + (q.ai ? ` + ${rubricLink(q.ai.rubric)}` : "");
    return `| [${q.title}](questions/${type}/${id}/README.md) | ${TYPE_LABEL[type]} | ${cap(q.difficulty)} | ${q.durationMinutes} min | ${topics} | ${rubric} | ${notes || "—"} |`;
  });
const questionTable = ["| Question | Type | Difficulty | Time | Topics | Rubric | Notes |", "|---|---|---|---|---|---|---|", ...rows].join("\n");

const usedFor = {};
for (const { type, q } of index) {
  (usedFor[q.rubric] ??= new Set()).add(`${TYPE_LABEL[type]} rounds`);
  if (q.ai) (usedFor[q.ai.rubric] ??= new Set()).add(type === "debugging" ? "AI-assisted debugging rounds" : "AI-assisted coding rounds");
}
const rubricTable = [
  "| Rubric | Used for | Dimensions |",
  "|---|---|---|",
  ...Object.entries(rubrics).map(([id, rub]) => {
    const dims = rub.dimensions.map((d) => `${d.name} (${pct(d.weight)})`).join(", ");
    const extra = id === "ai-coding" ? ", plus each question's own dimension" : "";
    return `| ${rubricLink(id)} | ${[...(usedFor[id] ?? ["Unused"])].join(", ")} | ${dims}${extra} |`;
  }),
].join("\n");

function replaceBlock(text, name, body) {
  const re = new RegExp(`(<!-- ${name}:start -->\\n)[\\s\\S]*?(\\n<!-- ${name}:end -->)`);
  if (!re.test(text)) throw new Error(`README.md is missing the <!-- ${name}:start/end --> markers`);
  return text.replace(re, (_, a, b) => a + body + b);
}
let readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
readme = replaceBlock(readme, "questions", questionTable);
readme = replaceBlock(readme, "rubrics", rubricTable);
write("README.md", readme);

if (check) {
  if (stale.length) {
    console.error(`Out of date (run \`npm run readmes\`):\n${stale.map((f) => `  ${f}`).join("\n")}`);
    process.exit(1);
  }
  console.log("READMEs are up to date.");
} else {
  console.log(stale.length ? `Updated:\n${stale.map((f) => `  ${f}`).join("\n")}` : "READMEs already up to date.");
}
