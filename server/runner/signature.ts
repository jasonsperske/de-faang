// Language-neutral type signatures for coding questions. Statically typed languages (Go, C, C++,
// Rust, Java) need parameter and return types to generate a starter and a test harness; the
// question declares them once in question.json and every language is derived from that.
//
// Types: int | long | double | bool | string, followed by any number of "[]" (e.g. "int[][]"),
// plus "void" for methods that return nothing.

export type BaseType = "int" | "long" | "double" | "bool" | "string";
export interface TypeRef {
  base: BaseType | "void";
  dims: number;
}
export interface Param {
  name: string;
  type: string;
}
export interface MethodSig {
  params: Param[];
  returns: string;
}

/** The typed part of a question signature (see questions.ts). */
export interface TypedSignature {
  kind: "function" | "class";
  /** function kind */
  params?: Param[];
  returns?: string;
  /** class kind: constructor parameters and methods keyed by the op name used in tests. */
  init?: Param[];
  methods?: Record<string, MethodSig>;
}

const TYPE_RE = /^(int|long|double|bool|string|void)((?:\[\])*)$/;

export function parseType(t: string): TypeRef {
  const m = TYPE_RE.exec(t.replace(/\s+/g, ""));
  if (!m) throw new Error(`Unknown type "${t}". Use int, long, double, bool, string (with [] for arrays) or void.`);
  const dims = m[2].length / 2;
  if (m[1] === "void" && dims) throw new Error("void[] is not a type");
  return { base: m[1] as TypeRef["base"], dims };
}

export const isTyped = (s: TypedSignature) =>
  s.kind === "function" ? Boolean(s.params && s.returns) : Boolean(s.init && s.methods && Object.keys(s.methods).length);

export const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
export const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const snake = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/([A-Z])([A-Z][a-z])/g, "$1_$2").toLowerCase();

/** Thrown when a (custom) test input doesn't fit the declared signature. */
export class InputError extends Error {}

const INT32 = 2 ** 31;

/** Checks a JSON value against a type, so bad custom inputs produce a clear message instead of a compile error. */
export function checkValue(v: unknown, t: TypeRef, where: string): void {
  const fail = (): never => {
    throw new InputError(`${where} should be ${typeName(t)}, got ${JSON.stringify(v)?.slice(0, 80)}`);
  };
  if (t.dims > 0) {
    if (!Array.isArray(v)) fail();
    (v as unknown[]).forEach((x, i) => checkValue(x, { base: t.base, dims: t.dims - 1 }, `${where}[${i}]`));
    return;
  }
  switch (t.base) {
    case "int":
      if (!Number.isInteger(v) || (v as number) < -INT32 || (v as number) >= INT32) fail();
      return;
    case "long":
      if (!Number.isSafeInteger(v)) fail();
      return;
    case "double":
      if (typeof v !== "number" || !Number.isFinite(v)) fail();
      return;
    case "bool":
      if (typeof v !== "boolean") fail();
      return;
    case "string":
      if (typeof v !== "string") fail();
      return;
    case "void":
      fail();
  }
}

export const typeName = (t: TypeRef) => t.base + "[]".repeat(t.dims);

/** Number literal that is valid as a floating point literal in C-family languages and Rust. */
export function floatLit(n: number): string {
  const s = String(n);
  return /[.eE]/.test(s) ? s : `${s}.0`;
}

/** String literal escaping shared by C, C++, Java, Go and Rust; `unicode` formats a code point escape. */
export function quote(s: string, unicode: (cp: number) => string): string {
  let out = '"';
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (ch === '"') out += '\\"';
    else if (ch === "\\") out += "\\\\";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (cp < 0x20 || cp === 0x7f) out += unicode(cp);
    else out += ch;
  }
  return out + '"';
}
