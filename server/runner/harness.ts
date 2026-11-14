import type { Language } from "../../shared/types.ts";

export const RESULT_MARKER = "__DEFAANG_RESULT__";

/** Spec piped to the program on stdin. */
export interface HarnessSpec {
  kind: "function" | "class";
  entry: string;
  cases: { args: unknown[]; ops?: string[] }[];
}

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * The candidate's code goes first (so error line numbers match what they see in the editor),
 * followed by a harness that reads the spec from stdin, calls the entry point for every case,
 * captures per-case stdout/errors/timing, and prints a single JSON result line.
 */
export function buildProgram(lang: Language, userCode: string, entry: string): string {
  if (!IDENT.test(entry)) throw new Error(`Invalid entry point name: ${entry}`);
  switch (lang) {
    case "python":
      return `${userCode}\n\n${pythonHarness}`;
    case "javascript":
    case "typescript":
      return `${userCode}\n\n${jsHarness(entry)}`;
    default:
      throw new Error(`${lang} uses the compiled-language harness (typed.ts)`);
  }
}

const pythonHarness = String.raw`
# ---------------- de-faang harness (appended automatically) ----------------
def __defaang_main():
    import json as _j, sys as _s, io as _io, time as _t, traceback as _tb, contextlib as _cl
    _s.setrecursionlimit(100000)
    spec = _j.loads(_s.stdin.read())
    g = globals()
    entry = spec["entry"]
    target = g.get(entry)
    if target is None and spec["kind"] == "function" and isinstance(g.get("Solution"), type):
        target = getattr(g["Solution"](), entry, None)
    out = []
    for i, c in enumerate(spec["cases"]):
        buf = _io.StringIO()
        r = {"index": i}
        t0 = _t.perf_counter()
        try:
            if target is None:
                raise NameError(f"'{entry}' is not defined")
            with _cl.redirect_stdout(buf):
                if spec["kind"] == "function":
                    res = target(*c["args"])
                else:
                    obj, res = None, []
                    for j, (op, a) in enumerate(zip(c["ops"], c["args"])):
                        if j == 0:
                            obj = target(*a)
                            res.append(None)
                        else:
                            res.append(getattr(obj, op)(*a))
            r["output"] = res
        except BaseException as e:
            frames = [f for f in _tb.extract_tb(e.__traceback__) if f.name != "__defaang_main"]
            where = f" (line {frames[-1].lineno}, in {frames[-1].name})" if frames else ""
            r["error"] = f"{type(e).__name__}: {e}{where}"
        r["ms"] = round((_t.perf_counter() - t0) * 1000, 3)
        r["stdout"] = buf.getvalue()[-4000:]
        out.append(r)

    def _default(o):
        if isinstance(o, (set, frozenset)):
            return sorted(o, key=repr)
        return repr(o)

    _s.stdout.write("\n${RESULT_MARKER}" + _j.dumps(out, default=_default) + "\n")


if __name__ == "__main__":
    __defaang_main()
`;

// Plain JS that is also valid (type-strippable) TypeScript.
function jsHarness(entry: string): string {
  return String.raw`
// ---------------- de-faang harness (appended automatically) ----------------
;(function __defaangMain() {
  const fs = process.getBuiltinModule("fs");
  const util = process.getBuiltinModule("util");
  const spec = JSON.parse(fs.readFileSync(0, "utf8"));
  const target = typeof ${entry} !== "undefined" ? ${entry} : undefined;
  const methods = ["log", "info", "warn", "error", "debug"];
  const saved = methods.map((m) => console[m]);
  const out = [];
  spec.cases.forEach((c, i) => {
    const buf = [];
    const capture = (...a) => buf.push(a.map((x) => (typeof x === "string" ? x : util.inspect(x, { depth: 4 }))).join(" "));
    methods.forEach((m) => (console[m] = capture));
    const r = { index: i };
    const t0 = performance.now();
    try {
      if (target === undefined) throw new ReferenceError(spec.entry + " is not defined");
      if (spec.kind === "function") {
        r.output = target(...c.args);
      } else {
        let obj;
        r.output = c.ops.map((op, j) => {
          if (j === 0) { obj = new target(...c.args[0]); return null; }
          if (typeof obj[op] !== "function") throw new TypeError(op + " is not a method of " + spec.entry);
          return obj[op](...c.args[j]);
        });
      }
      if (r.output === undefined) r.output = null;
    } catch (e) {
      const stack = e && e.stack ? String(e.stack).split("\n") : [String(e)];
      r.error = stack.filter((l) => !l.includes("__defaangMain") && !l.includes("node:internal")).slice(0, 4).join("\n");
    } finally {
      methods.forEach((m, k) => (console[m] = saved[k]));
    }
    r.ms = Math.round((performance.now() - t0) * 1000) / 1000;
    r.stdout = buf.join("\n").slice(-4000);
    out.push(r);
  });
  const replacer = (_k, v) =>
    v === undefined ? null : v instanceof Set ? [...v] : v instanceof Map ? Object.fromEntries(v) : typeof v === "bigint" ? Number(v) : v;
  process.stdout.write("\n${RESULT_MARKER}" + JSON.stringify(out, replacer) + "\n");
})();
`;
}
