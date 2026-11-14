// Starters and test harnesses for the statically typed languages (Go, C, C++, Rust, Java).
//
// Test inputs are compiled into the program as typed literals, so the harness needs no JSON parser.
// For every case the program prints BEGIN_MARK, runs the case (the candidate's own prints land
// between the marks), then prints END_MARK followed by {"ms":..,"output":..} or {"ms":..,"error":..}
// on one line. If the process dies mid-case (segfault, stack overflow, time limit) the cases that
// finished keep their results; see parseCaseStream in index.ts.

import type { Language } from "../../shared/types.ts";
import {
  checkValue,
  floatLit,
  InputError,
  lowerFirst,
  parseType,
  quote,
  snake,
  upperFirst,
  type MethodSig,
  type Param,
  type TypedSignature,
  type TypeRef,
} from "./signature.ts";

export type TypedLanguage = "go" | "c" | "cpp" | "rust" | "java";
export const TYPED_LANGUAGES: TypedLanguage[] = ["java", "cpp", "c", "go", "rust"];
export const isTypedLanguage = (l: Language): l is TypedLanguage => (TYPED_LANGUAGES as string[]).includes(l);

export const BEGIN_MARK = "\n@@DEFAANG_BEGIN@@\n";
export const END_MARK = "\n@@DEFAANG_END@@";

/** The file the candidate's code is saved as inside the sandbox (used in compiler messages). */
export const SOLUTION_FILE: Record<TypedLanguage, string> = {
  go: "solution.go",
  c: "solution.c",
  cpp: "solution.cpp",
  rust: "solution.rs",
  java: "Solution.java",
};

export interface Case {
  args: unknown[];
  ops?: string[];
}

// ------------------------------------------------------------------------------------- naming

/** Entry point name for a typed language, derived from the JS/Python names unless overridden. */
export function defaultEntry(lang: TypedLanguage, kind: "function" | "class", entry: { python: string; javascript: string }): string {
  if (kind === "class") return entry.javascript;
  return lang === "rust" ? entry.python : entry.javascript;
}

const methodName = (lang: TypedLanguage, cls: string, op: string) =>
  lang === "go" ? upperFirst(op) : lang === "rust" ? snake(op) : lang === "c" ? lowerFirst(cls) + upperFirst(op) : op;
const paramName = (lang: TypedLanguage, name: string) => (lang === "rust" ? snake(name) : name);

// ------------------------------------------------------------------------------- type mapping

const SCALAR: Record<TypedLanguage, Record<TypeRef["base"], string>> = {
  go: { int: "int", long: "int64", double: "float64", bool: "bool", string: "string", void: "" },
  java: { int: "int", long: "long", double: "double", bool: "boolean", string: "String", void: "void" },
  cpp: { int: "int", long: "long long", double: "double", bool: "bool", string: "string", void: "void" },
  rust: { int: "i32", long: "i64", double: "f64", bool: "bool", string: "String", void: "()" },
  c: { int: "int", long: "long long", double: "double", bool: "bool", string: "char*", void: "void" },
};

function typeOf(lang: TypedLanguage, t: TypeRef): string {
  const s = SCALAR[lang][t.base];
  if (!t.dims) return s;
  const inner = typeOf(lang, { base: t.base, dims: t.dims - 1 });
  switch (lang) {
    case "go":
      return `[]${inner}`;
    case "java":
      return `${inner}[]`;
    case "cpp":
      return `vector<${inner}>`;
    case "rust":
      return `Vec<${inner}>`;
    case "c":
      return `${inner}*`;
  }
}

/** C can't express every shape with LeetCode-style (pointer, size) parameters. */
function cSupports(t: TypeRef): boolean {
  return t.dims <= (t.base === "string" ? 1 : 2);
}

const sigTypes = (sig: TypedSignature): TypeRef[] =>
  sig.kind === "function"
    ? [...sig.params!.map((p) => parseType(p.type)), parseType(sig.returns!)]
    : [...sig.init!.map((p) => parseType(p.type)), ...Object.values(sig.methods!).flatMap((m) => [...m.params.map((p) => parseType(p.type)), parseType(m.returns)])];

export function supportsLanguage(lang: TypedLanguage, sig: TypedSignature): boolean {
  return lang !== "c" || sigTypes(sig).every(cSupports);
}

// ------------------------------------------------------------------------------- literals

function intLit(n: number, t: TypeRef["base"], lang: TypedLanguage): string {
  if (t === "long") return lang === "java" ? `${n}L` : lang === "c" || lang === "cpp" ? `${n}LL` : String(n);
  if (n === -(2 ** 31) && (lang === "c" || lang === "cpp" || lang === "java")) return "(-2147483647 - 1)";
  return String(n);
}

const octal = (cp: number) => `\\${cp.toString(8).padStart(3, "0")}`;

function scalarLit(lang: TypedLanguage, v: unknown, t: TypeRef): string {
  switch (t.base) {
    case "int":
    case "long":
      return intLit(v as number, t.base, lang);
    case "double":
      return floatLit(v as number);
    case "bool":
      return String(v);
    case "string":
      if (lang === "rust") return `String::from(${quote(v as string, (cp) => `\\u{${cp.toString(16)}}`)})`;
      if (lang === "go") return quote(v as string, (cp) => `\\x${cp.toString(16).padStart(2, "0")}`);
      if (lang === "cpp") return `string(${quote(v as string, octal)})`;
      return quote(v as string, octal);
    default:
      throw new Error("void has no literal");
  }
}

/** A literal expression for languages with nested array literals (not C). */
function lit(lang: Exclude<TypedLanguage, "c">, v: unknown, t: TypeRef): string {
  if (!t.dims) return scalarLit(lang, v, t);
  const inner = { base: t.base, dims: t.dims - 1 };
  const items = (v as unknown[]).map((x) => lit(lang, x, inner)).join(", ");
  switch (lang) {
    case "go":
      return `${typeOf("go", t)}{${items}}`;
    case "java":
      return `new ${typeOf("java", t)}{${items}}`;
    case "cpp":
      return `${typeOf("cpp", t)}{${items}}`;
    case "rust":
      return `vec![${items}]`;
  }
}

// ------------------------------------------------------------------------------- validation

function checkCases(sig: TypedSignature, entry: string, cases: Case[]): void {
  cases.forEach((c, i) => {
    const where = `Test ${i + 1}`;
    if (sig.kind === "function") {
      const params = sig.params!;
      if (!Array.isArray(c.args) || c.args.length !== params.length)
        throw new InputError(`${where}: expected ${params.length} argument(s) (${params.map((p) => p.name).join(", ")}), got ${Array.isArray(c.args) ? c.args.length : "none"}`);
      params.forEach((p, j) => checkValue(c.args[j], parseType(p.type), `${where}: ${p.name}`));
      return;
    }
    const ops = c.ops ?? [];
    if (!ops.length || ops.length !== c.args.length) throw new InputError(`${where}: "ops" and "args" must be non-empty and the same length`);
    ops.forEach((op, j) => {
      const args = c.args[j];
      const params = j === 0 ? sig.init! : sig.methods![op]?.params;
      if (!params) throw new InputError(`${where}: unknown method "${op}". Methods: ${Object.keys(sig.methods!).join(", ")}`);
      if (j === 0 && op !== entry) throw new InputError(`${where}: the first op must be the constructor "${entry}"`);
      if (!Array.isArray(args) || args.length !== params.length) throw new InputError(`${where}: ${op} takes ${params.length} argument(s)`);
      params.forEach((p, k) => checkValue(args[k], parseType(p.type), `${where}: ${op}(${p.name})`));
    });
  });
}

// ------------------------------------------------------------------------------- programs

export function buildTypedProgram(lang: TypedLanguage, sig: TypedSignature, entry: string, userCode: string, cases: Case[]): Record<string, string> {
  checkCases(sig, entry, cases);
  switch (lang) {
    case "go":
      return { "solution.go": userCode, "harness.go": goHarness(sig, entry, cases) };
    case "java":
      return { "Solution.java": userCode, "Main.java": javaHarness(sig, entry, cases) };
    case "cpp":
      return { "main.cpp": `#include <bits/stdc++.h>\nusing namespace std;\n#line 1 "solution.cpp"\n${userCode}\n#line 1 "harness.cpp"\n${cppHarness(sig, entry, cases)}` };
    case "rust":
      return { "solution.rs": userCode, "main.rs": rustHarness(sig, entry, cases) };
    case "c":
      return { "main.c": `${C_PRELUDE}#line 1 "solution.c"\n${userCode}\n#line 1 "harness.c"\n${cHarness(sig, entry, cases)}` };
  }
}

const indent = (s: string, n: number) => s.split("\n").map((l) => (l ? " ".repeat(n) + l : l)).join("\n");

// ---------------------------------------------------------------------------------------- Go

function goHarness(sig: TypedSignature, entry: string, cases: Case[]): string {
  const body = cases.map((c) => {
    const lines: string[] = [];
    if (sig.kind === "function") {
      const names = sig.params!.map((p, i) => {
        lines.push(`var a${i} ${typeOf("go", parseType(p.type))} = ${lit("go", c.args[i], parseType(p.type))}`);
        return `a${i}`;
      });
      const call = `${entry}(${names.join(", ")})`;
      lines.push(parseType(sig.returns!).base === "void" ? `${call}\nreturn nil` : `return ${call}`);
    } else {
      lines.push(`__r := make([]any, 0, ${c.ops!.length})`);
      lines.push(`__o := Constructor(${sig.init!.map((p, i) => lit("go", (c.args[0] as unknown[])[i], parseType(p.type))).join(", ")})`);
      lines.push("_ = __o", "__r = append(__r, nil)");
      c.ops!.slice(1).forEach((op, j) => {
        const m = sig.methods![op];
        const args = m.params.map((p, k) => lit("go", (c.args[j + 1] as unknown[])[k], parseType(p.type))).join(", ");
        const call = `__o.${methodName("go", entry, op)}(${args})`;
        lines.push(parseType(m.returns).base === "void" ? `${call}\n__r = append(__r, nil)` : `__r = append(__r, ${call})`);
      });
      lines.push("return __r");
    }
    return `\t__defaangCase(func() any {\n${indent(lines.join("\n"), 0).replace(/^/gm, "\t\t")}\n\t})`;
  });
  return `${GO_RUNTIME}
func main() {
\tdebug.SetMaxStack(256 << 20)
${body.join("\n")}
}
`;
}

const GO_RUNTIME = String.raw`// de-faang test harness (generated)
package main

import (
	"fmt"
	"math"
	"reflect"
	"regexp"
	"runtime/debug"
	"sort"
	"strconv"
	"strings"
	"time"
)

var __defaangLine = regexp.MustCompile("solution\\.go:(\\d+)")

func __defaangEsc(s string) string {
	var b strings.Builder
	b.WriteByte('"')
	for _, r := range s {
		switch r {
		case '"':
			b.WriteString("\\\"")
		case '\\':
			b.WriteString("\\\\")
		case '\n':
			b.WriteString("\\n")
		case '\r':
			b.WriteString("\\r")
		case '\t':
			b.WriteString("\\t")
		default:
			if r < 0x20 {
				fmt.Fprintf(&b, "\\u%04x", r)
			} else {
				b.WriteRune(r)
			}
		}
	}
	b.WriteByte('"')
	return b.String()
}

func __defaangJSON(v reflect.Value) string {
	if !v.IsValid() {
		return "null"
	}
	switch v.Kind() {
	case reflect.Interface, reflect.Pointer:
		if v.IsNil() {
			return "null"
		}
		return __defaangJSON(v.Elem())
	case reflect.Bool:
		return strconv.FormatBool(v.Bool())
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return strconv.FormatInt(v.Int(), 10)
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr:
		return strconv.FormatUint(v.Uint(), 10)
	case reflect.Float32, reflect.Float64:
		f := v.Float()
		if math.IsNaN(f) || math.IsInf(f, 0) {
			return "null"
		}
		return strconv.FormatFloat(f, 'g', -1, 64)
	case reflect.String:
		return __defaangEsc(v.String())
	case reflect.Slice, reflect.Array:
		parts := make([]string, v.Len())
		for i := range parts {
			parts[i] = __defaangJSON(v.Index(i))
		}
		return "[" + strings.Join(parts, ",") + "]"
	case reflect.Map:
		parts := make([]string, 0, v.Len())
		for _, k := range v.MapKeys() {
			parts = append(parts, __defaangEsc(fmt.Sprint(k))+":"+__defaangJSON(v.MapIndex(k)))
		}
		sort.Strings(parts)
		return "{" + strings.Join(parts, ",") + "}"
	}
	return __defaangEsc(fmt.Sprint(v))
}

func __defaangCase(body func() any) {
	fmt.Print("\n@@DEFAANG_BEGIN@@\n")
	t0 := time.Now()
	var out any
	failure := ""
	func() {
		defer func() {
			if r := recover(); r != nil {
				failure = fmt.Sprint("panic: ", r)
				if m := __defaangLine.FindStringSubmatch(string(debug.Stack())); m != nil {
					failure += " (line " + m[1] + ")"
				}
			}
		}()
		out = body()
	}()
	ms := float64(time.Since(t0).Nanoseconds()) / 1e6
	if failure != "" {
		fmt.Printf("\n@@DEFAANG_END@@{\"ms\":%.3f,\"error\":%s}\n", ms, __defaangEsc(failure))
		return
	}
	fmt.Printf("\n@@DEFAANG_END@@{\"ms\":%.3f,\"output\":%s}\n", ms, __defaangJSON(reflect.ValueOf(out)))
}
`;

// -------------------------------------------------------------------------------------- Java

function javaHarness(sig: TypedSignature, entry: string, cases: Case[]): string {
  const body = cases.map((c) => {
    const lines: string[] = [];
    if (sig.kind === "function") {
      const names = sig.params!.map((p, i) => {
        const t = parseType(p.type);
        lines.push(`${typeOf("java", t)} a${i} = ${lit("java", c.args[i], t)};`);
        return `a${i}`;
      });
      const call = `new Solution().${entry}(${names.join(", ")})`;
      lines.push(parseType(sig.returns!).base === "void" ? `${call};\nreturn null;` : `return ${call};`);
    } else {
      lines.push(`java.util.List<Object> __r = new java.util.ArrayList<>();`);
      lines.push(`${entry} __o = new ${entry}(${sig.init!.map((p, i) => lit("java", (c.args[0] as unknown[])[i], parseType(p.type))).join(", ")});`);
      lines.push("__r.add(null);");
      c.ops!.slice(1).forEach((op, j) => {
        const m = sig.methods![op];
        const call = `__o.${op}(${m.params.map((p, k) => lit("java", (c.args[j + 1] as unknown[])[k], parseType(p.type))).join(", ")})`;
        lines.push(parseType(m.returns).base === "void" ? `${call}; __r.add(null);` : `__r.add(${call});`);
      });
      lines.push("return __r;");
    }
    return `        run(() -> {\n${lines.map((l) => "            " + l.replace(/\n/g, "\n            ")).join("\n")}\n        });`;
  });
  return `${JAVA_RUNTIME}
    public static void main(String[] args) {
${body.join("\n")}
    }
}
`;
}

const JAVA_RUNTIME = String.raw`// de-faang test harness (generated)
import java.util.*;

public class Main {
    interface Body { Object run() throws Throwable; }

    static String esc(String s) {
        StringBuilder b = new StringBuilder("\"");
        for (char c : s.toCharArray()) {
            switch (c) {
                case '"' -> b.append("\\\"");
                case '\\' -> b.append("\\\\");
                case '\n' -> b.append("\\n");
                case '\r' -> b.append("\\r");
                case '\t' -> b.append("\\t");
                default -> {
                    if (c < 0x20) b.append(String.format("\\u%04x", (int) c));
                    else b.append(c);
                }
            }
        }
        return b.append('"').toString();
    }

    static String json(Object o) {
        if (o == null) return "null";
        if (o instanceof Double d) return d.isNaN() || d.isInfinite() ? "null" : d.toString();
        if (o instanceof Float f) return json((double) f);
        if (o instanceof Number || o instanceof Boolean) return o.toString();
        if (o instanceof Character c) return esc(c.toString());
        if (o instanceof String s) return esc(s);
        StringJoiner j = new StringJoiner(",", "[", "]");
        if (o instanceof int[] a) { for (int x : a) j.add(Integer.toString(x)); return j.toString(); }
        if (o instanceof long[] a) { for (long x : a) j.add(Long.toString(x)); return j.toString(); }
        if (o instanceof double[] a) { for (double x : a) j.add(json(x)); return j.toString(); }
        if (o instanceof boolean[] a) { for (boolean x : a) j.add(Boolean.toString(x)); return j.toString(); }
        if (o instanceof char[] a) { for (char x : a) j.add(json(x)); return j.toString(); }
        if (o instanceof Object[] a) return json(Arrays.asList(a));
        if (o instanceof Iterable<?> it) { for (Object x : it) j.add(json(x)); return j.toString(); }
        if (o instanceof Map<?, ?> m) {
            StringJoiner mj = new StringJoiner(",", "{", "}");
            for (Map.Entry<?, ?> e : new TreeMap<>(m).entrySet()) mj.add(esc(String.valueOf(e.getKey())) + ":" + json(e.getValue()));
            return mj.toString();
        }
        return esc(o.toString());
    }

    static void run(Body body) {
        System.out.print("\n@@DEFAANG_BEGIN@@\n");
        long t0 = System.nanoTime();
        String out = null, err = null;
        try {
            out = json(body.run());
        } catch (Throwable e) {
            err = e.toString();
            for (StackTraceElement f : e.getStackTrace()) {
                if ("Solution.java".equals(f.getFileName())) {
                    err += " (line " + f.getLineNumber() + ", in " + f.getMethodName() + ")";
                    break;
                }
            }
        }
        String ms = String.format(Locale.ROOT, "%.3f", (System.nanoTime() - t0) / 1e6);
        System.out.print("\n@@DEFAANG_END@@{\"ms\":" + ms + (err == null ? ",\"output\":" + out : ",\"error\":" + esc(err)) + "}\n");
        System.out.flush();
    }
`;

// --------------------------------------------------------------------------------------- C++

function cppHarness(sig: TypedSignature, entry: string, cases: Case[]): string {
  const decl = (name: string, v: unknown, t: TypeRef) => `${typeOf("cpp", t)} ${name} = ${lit("cpp", v, t)};`;
  const body = cases.map((c) => {
    const lines: string[] = [];
    if (sig.kind === "function") {
      const names = sig.params!.map((p, i) => {
        lines.push(decl(`a${i}`, c.args[i], parseType(p.type)));
        return `a${i}`;
      });
      lines.push("Solution __s;");
      const call = `__s.${entry}(${names.join(", ")})`;
      lines.push(parseType(sig.returns!).base === "void" ? `${call};\nreturn "null";` : `return defaang::json(${call});`);
    } else {
      lines.push(`string __r = "[null";`);
      const init = sig.init!.map((p, i) => {
        lines.push(decl(`c${i}`, (c.args[0] as unknown[])[i], parseType(p.type)));
        return `c${i}`;
      });
      lines.push(`${entry}* __o = new ${entry}(${init.join(", ")});`);
      c.ops!.slice(1).forEach((op, j) => {
        const m = sig.methods![op];
        const inner: string[] = [];
        const names = m.params.map((p, k) => {
          inner.push(decl(`a${k}`, (c.args[j + 1] as unknown[])[k], parseType(p.type)));
          return `a${k}`;
        });
        const call = `__o->${op}(${names.join(", ")})`;
        inner.push(parseType(m.returns).base === "void" ? `${call}; __r += ",null";` : `__r += ","; __r += defaang::json(${call});`);
        lines.push(`{ ${inner.join(" ")} }`);
      });
      lines.push("delete __o;", `return __r + "]";`);
    }
    return `    __defaang_case([]() -> string {\n${lines.map((l) => "        " + l.replace(/\n/g, "\n        ")).join("\n")}\n    });`;
  });
  return `${CPP_RUNTIME}
int main() {
${body.join("\n")}
    return 0;
}
`;
}

const CPP_RUNTIME = String.raw`// de-faang test harness (generated)
namespace defaang {
static string esc(const string& s) {
    string o = "\"";
    for (unsigned char c : s) {
        switch (c) {
            case '"': o += "\\\""; break;
            case '\\': o += "\\\\"; break;
            case '\n': o += "\\n"; break;
            case '\r': o += "\\r"; break;
            case '\t': o += "\\t"; break;
            default:
                if (c < 0x20) { char b[8]; snprintf(b, sizeof b, "\\u%04x", c); o += b; }
                else o += (char)c;
        }
    }
    return o + "\"";
}
static string json(bool v) { return v ? "true" : "false"; }
static string json(char v) { return esc(string(1, v)); }
static string json(int v) { return to_string(v); }
static string json(long v) { return to_string(v); }
static string json(long long v) { return to_string(v); }
static string json(unsigned v) { return to_string(v); }
static string json(unsigned long v) { return to_string(v); }
static string json(unsigned long long v) { return to_string(v); }
static string json(double v) {
    if (!isfinite(v)) return "null";
    char b[32]; snprintf(b, sizeof b, "%.17g", v); return b;
}
static string json(float v) { return json((double)v); }
static string json(const string& v) { return esc(v); }
static string json(const char* v) { return v ? esc(v) : "null"; }
template <class T> static string json(const vector<T>& v) {
    string o = "[";
    bool first = true;
    for (const T& x : v) { if (!first) o += ","; first = false; o += json(x); }
    return o + "]";
}
}  // namespace defaang

static void __defaang_case(const function<string()>& body) {
    printf("\n@@DEFAANG_BEGIN@@\n");
    fflush(stdout);
    auto t0 = chrono::steady_clock::now();
    string res;
    try {
        res = "\"output\":" + body();
    } catch (const exception& e) {
        res = "\"error\":" + defaang::esc(string("exception: ") + e.what());
    } catch (...) {
        res = "\"error\":\"unknown exception\"";
    }
    double ms = chrono::duration<double, milli>(chrono::steady_clock::now() - t0).count();
    cout.flush();
    printf("\n@@DEFAANG_END@@{\"ms\":%.3f,%s}\n", ms, res.c_str());
    fflush(stdout);
}
`;

// -------------------------------------------------------------------------------------- Rust

function rustHarness(sig: TypedSignature, entry: string, cases: Case[]): string {
  const decl = (name: string, v: unknown, t: TypeRef) => `let ${name}: ${typeOf("rust", t)} = ${lit("rust", v, t)};`;
  const body = cases.map((c) => {
    const lines: string[] = [];
    if (sig.kind === "function") {
      const names = sig.params!.map((p, i) => {
        lines.push(decl(`a${i}`, c.args[i], parseType(p.type)));
        return `a${i}`;
      });
      lines.push(`Solution::${entry}(${names.join(", ")}).dj()`);
    } else {
      lines.push("let mut __r: Vec<String> = vec![String::from(\"null\")];");
      const init = sig.init!.map((p, i) => {
        lines.push(decl(`c${i}`, (c.args[0] as unknown[])[i], parseType(p.type)));
        return `c${i}`;
      });
      lines.push(`let mut __o = ${entry}::new(${init.join(", ")});`);
      c.ops!.slice(1).forEach((op, j) => {
        const m = sig.methods![op];
        const inner: string[] = [];
        const names = m.params.map((p, k) => {
          inner.push(decl(`a${k}`, (c.args[j + 1] as unknown[])[k], parseType(p.type)));
          return `a${k}`;
        });
        inner.push(`__r.push(__o.${methodName("rust", entry, op)}(${names.join(", ")}).dj());`);
        lines.push(`{ ${inner.join(" ")} }`);
      });
      lines.push(`format!("[{}]", __r.join(","))`);
    }
    return `    __defaang_case(|| {\n${lines.map((l) => "        " + l).join("\n")}\n    });`;
  });
  return `${RUST_RUNTIME}
fn __defaang_cases() {
${body.join("\n")}
}
`;
}

const RUST_RUNTIME = String.raw`// de-faang test harness (generated)
#![allow(warnings)]
struct Solution;
include!("solution.rs");

trait DefaangJson {
    fn dj(&self) -> String;
}
macro_rules! __defaang_num {
    ($($t:ty),*) => { $(impl DefaangJson for $t { fn dj(&self) -> String { self.to_string() } })* };
}
__defaang_num!(i8, i16, i32, i64, i128, isize, u8, u16, u32, u64, u128, usize);
impl DefaangJson for f64 {
    fn dj(&self) -> String { if self.is_finite() { format!("{:?}", self) } else { "null".to_string() } }
}
impl DefaangJson for f32 {
    fn dj(&self) -> String { (*self as f64).dj() }
}
impl DefaangJson for bool {
    fn dj(&self) -> String { self.to_string() }
}
impl DefaangJson for char {
    fn dj(&self) -> String { __defaang_esc(&self.to_string()) }
}
impl DefaangJson for String {
    fn dj(&self) -> String { __defaang_esc(self) }
}
impl DefaangJson for &str {
    fn dj(&self) -> String { __defaang_esc(self) }
}
impl DefaangJson for () {
    fn dj(&self) -> String { "null".to_string() }
}
impl<T: DefaangJson> DefaangJson for Vec<T> {
    fn dj(&self) -> String { format!("[{}]", self.iter().map(|x| x.dj()).collect::<Vec<_>>().join(",")) }
}
impl<T: DefaangJson> DefaangJson for Option<T> {
    fn dj(&self) -> String { match self { Some(x) => x.dj(), None => "null".to_string() } }
}

fn __defaang_esc(s: &str) -> String {
    let mut o = String::from("\"");
    for c in s.chars() {
        match c {
            '"' => o.push_str("\\\""),
            '\\' => o.push_str("\\\\"),
            '\n' => o.push_str("\\n"),
            '\r' => o.push_str("\\r"),
            '\t' => o.push_str("\\t"),
            c if (c as u32) < 0x20 => o.push_str(&format!("\\u{:04x}", c as u32)),
            c => o.push(c),
        }
    }
    o.push('"');
    o
}

static __DEFAANG_PANIC: std::sync::Mutex<Option<String>> = std::sync::Mutex::new(None);

fn __defaang_case<F: FnOnce() -> String>(f: F) {
    use std::io::Write;
    print!("\n@@DEFAANG_BEGIN@@\n");
    std::io::stdout().flush().ok();
    let t0 = std::time::Instant::now();
    let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(f));
    let ms = t0.elapsed().as_secs_f64() * 1000.0;
    let res = match r {
        Ok(s) => format!("\"output\":{}", s),
        Err(_) => {
            let m = __DEFAANG_PANIC.lock().unwrap_or_else(|e| e.into_inner()).take();
            format!("\"error\":{}", __defaang_esc(&m.unwrap_or_else(|| "panicked".to_string())))
        }
    };
    print!("\n@@DEFAANG_END@@{{\"ms\":{:.3},{}}}\n", ms, res);
    std::io::stdout().flush().ok();
}

fn main() {
    std::panic::set_hook(Box::new(|info| {
        let p = info.payload();
        let msg = if let Some(s) = p.downcast_ref::<&str>() { s.to_string() } else if let Some(s) = p.downcast_ref::<String>() { s.clone() } else { "panic".to_string() };
        let at = info.location().map(|l| format!(" (line {})", l.line())).unwrap_or_default();
        *__DEFAANG_PANIC.lock().unwrap_or_else(|e| e.into_inner()) = Some(format!("panicked: {}{}", msg, at));
    }));
    // Run on a thread with a large stack so deep recursion behaves like the other languages.
    let h = std::thread::Builder::new().stack_size(256 << 20).spawn(__defaang_cases).unwrap();
    if h.join().is_err() {
        std::process::exit(1);
    }
}
`;

// ----------------------------------------------------------------------------------------- C

const C_PRELUDE = `#define _GNU_SOURCE
#include <ctype.h>
#include <limits.h>
#include <math.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
`;

/** C parameter list fragment for one parameter (arrays get LeetCode-style size parameters). */
function cParams(p: Param): string {
  const t = parseType(p.type);
  const n = p.name;
  if (t.dims === 0) return `${typeOf("c", t)} ${n}`;
  if (t.dims === 1) return `${typeOf("c", t)} ${n}, int ${n}Size`;
  return `${typeOf("c", t)} ${n}, int ${n}Size, int* ${n}ColSize`;
}

function cReturnParams(t: TypeRef): string[] {
  if (t.dims === 0) return [];
  if (t.dims === 1) return ["int* returnSize"];
  return ["int* returnSize", "int** returnColumnSizes"];
}

let cTmp = 0;
/** Declarations for one argument value; returns the argument expressions to pass. */
function cArg(name: string, v: unknown, t: TypeRef, out: string[]): string[] {
  const scalar = (x: unknown) => scalarLit("c", x, { base: t.base, dims: 0 });
  const elem = SCALAR.c[t.base];
  if (t.dims === 0) {
    if (t.base === "string") {
      out.push(`char ${name}[] = ${scalar(v)};`);
      return [name];
    }
    out.push(`${elem} ${name} = ${scalar(v)};`);
    return [name];
  }
  const arr = v as unknown[];
  if (t.dims === 1) {
    if (t.base === "string") {
      const items = arr.map((s) => {
        const id = `${name}_${cTmp++}`;
        out.push(`char ${id}[] = ${scalar(s)};`);
        return id;
      });
      out.push(`char* ${name}[] = {${[...items, "NULL"].join(", ")}};`);
    } else {
      out.push(`${elem} ${name}[] = {${[...arr.map(scalar), "0"].join(", ")}};`);
    }
    return [name, String(arr.length)];
  }
  const rows = (arr as unknown[][]).map((row) => {
    const id = `${name}_${cTmp++}`;
    out.push(`${elem} ${id}[] = {${[...row.map(scalar), "0"].join(", ")}};`);
    return id;
  });
  out.push(`${elem}* ${name}[] = {${[...rows, "NULL"].join(", ")}};`);
  out.push(`int ${name}Cols[] = {${[...(arr as unknown[][]).map((r) => String(r.length)), "0"].join(", ")}};`);
  return [name, String(arr.length), `${name}Cols`];
}

/** Code that prints the JSON for a value held in `v` (+ `v`Size / `v`Cols for arrays). */
function cEmit(v: string, t: TypeRef): string {
  if (t.dims === 0) {
    switch (t.base) {
      case "int":
        return `printf("%d", ${v});`;
      case "long":
        return `printf("%lld", ${v});`;
      case "double":
        return `__defaang_double(${v});`;
      case "bool":
        return `fputs(${v} ? "true" : "false", stdout);`;
      case "string":
        return `__defaang_str(${v});`;
      default:
        return `fputs("null", stdout);`;
    }
  }
  const el = { base: t.base, dims: 0 } as TypeRef;
  if (t.dims === 1) return `putchar('['); for (int __i = 0; __i < ${v}Size; __i++) { if (__i) putchar(','); ${cEmit(`${v}[__i]`, el)} } putchar(']');`;
  return `putchar('['); for (int __i = 0; __i < ${v}Size; __i++) { if (__i) putchar(','); putchar('['); for (int __j = 0; __j < (${v}Cols ? ${v}Cols[__i] : 0); __j++) { if (__j) putchar(','); ${cEmit(`${v}[__i][__j]`, el)} } putchar(']'); } putchar(']');`;
}

/** Assigns a call's result (and, for arrays, its size outputs) to the variables cResultDecl declared. */
function cCall(res: string, t: TypeRef, call: (extra: string[]) => string): string {
  if (t.base === "void") return `${call([])};`;
  if (t.dims === 0) return `${res} = ${call([])};`;
  if (t.dims === 1) return `${res} = ${call([`&${res}Size`])};`;
  return `${res} = ${call([`&${res}Size`, `&${res}Cols`])};`;
}
function cResultDecl(res: string, t: TypeRef): string {
  if (t.base === "void") return "";
  const type = typeOf("c", t);
  if (t.dims === 0) return `${type} ${res} = 0;`;
  if (t.dims === 1) return `${type} ${res} = NULL; int ${res}Size = 0;`;
  return `${type} ${res} = NULL; int ${res}Size = 0; int* ${res}Cols = NULL;`;
}

function cHarness(sig: TypedSignature, entry: string, cases: Case[]): string {
  cTmp = 0;
  const prefix = lowerFirst(entry);
  const body = cases.map((c) => {
    const lines: string[] = [];
    let emit: string;
    if (sig.kind === "function") {
      const rt = parseType(sig.returns!);
      const pass = sig.params!.flatMap((p, i) => cArg(`a${i}`, c.args[i], parseType(p.type), lines));
      lines.push(cResultDecl("__res", rt));
      lines.push("__defaang_begin();", "double __t0 = __defaang_now();");
      lines.push(cCall("__res", rt, (extra) => `${entry}(${[...pass, ...extra].join(", ")})`));
      emit = rt.base === "void" ? `fputs("null", stdout);` : cEmit("__res", rt);
    } else {
      const results: string[] = [];
      const init = sig.init!.flatMap((p, i) => cArg(`c${i}`, (c.args[0] as unknown[])[i], parseType(p.type), lines));
      c.ops!.slice(1).forEach((op, j) => {
        const rt = parseType(sig.methods![op].returns);
        lines.push(cResultDecl(`__r${j}`, rt));
        results.push(rt.base === "void" ? `fputs(",null", stdout);` : `putchar(','); ${cEmit(`__r${j}`, rt)}`);
      });
      lines.push("__defaang_begin();", "double __t0 = __defaang_now();");
      lines.push(`${entry}* __o = ${prefix}Create(${init.join(", ")});`);
      c.ops!.slice(1).forEach((op, j) => {
        const m = sig.methods![op];
        const inner: string[] = [];
        const pass = m.params.flatMap((p, k) => cArg(`a${j}_${k}`, (c.args[j + 1] as unknown[])[k], parseType(p.type), inner));
        inner.push(cCall(`__r${j}`, parseType(m.returns), (extra) => `${methodName("c", entry, op)}(${["__o", ...pass, ...extra].join(", ")})`));
        lines.push(`{ ${inner.join(" ")} }`);
      });
      lines.push(`${prefix}Free(__o);`);
      emit = `fputs("[null", stdout); ${results.join(" ")} putchar(']');`;
    }
    lines.push("__defaang_end(__defaang_now() - __t0);", emit, "__defaang_close();");
    return `    {\n${lines.filter(Boolean).map((l) => "        " + l).join("\n")}\n    }`;
  });
  return `${C_RUNTIME}
int main(void) {
${body.join("\n")}
    return 0;
}
`;
}

const C_RUNTIME = String.raw`/* de-faang test harness (generated) */
static double __defaang_now(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return ts.tv_sec * 1e3 + ts.tv_nsec / 1e6;
}
static void __defaang_begin(void) { printf("\n@@DEFAANG_BEGIN@@\n"); fflush(stdout); }
static void __defaang_end(double ms) { printf("\n@@DEFAANG_END@@{\"ms\":%.3f,\"output\":", ms); }
static void __defaang_close(void) { printf("}\n"); fflush(stdout); }
static void __defaang_double(double d) {
    if (isfinite(d)) printf("%.17g", d);
    else fputs("null", stdout);
}
static void __defaang_str(const char* s) {
    if (!s) { fputs("null", stdout); return; }
    putchar('"');
    for (const unsigned char* p = (const unsigned char*)s; *p; p++) {
        switch (*p) {
            case '"': fputs("\\\"", stdout); break;
            case '\\': fputs("\\\\", stdout); break;
            case '\n': fputs("\\n", stdout); break;
            case '\r': fputs("\\r", stdout); break;
            case '\t': fputs("\\t", stdout); break;
            default:
                if (*p < 0x20) printf("\\u%04x", *p);
                else putchar(*p);
        }
    }
    putchar('"');
}
`;

// -------------------------------------------------------------------------------------- starters

export function typedStarter(lang: TypedLanguage, sig: TypedSignature, entry: string): string {
  const p = typedStarterPieces(lang, sig, entry);
  return p.header + p.body;
}

/**
 * A starter split into a file header (package line, imports, notes) and the body for this signature.
 * For Java and C++ function questions `member` is the method alone, so a multipart question can add
 * a later part's method to an existing `class Solution`.
 */
export interface StarterPieces {
  header: string;
  body: string;
  member?: string;
}

export function typedStarterPieces(lang: TypedLanguage, sig: TypedSignature, entry: string): StarterPieces {
  const t = (s: string) => typeOf(lang, parseType(s));
  const isVoid = (s: string) => parseType(s).base === "void";
  const params = (ps: Param[]) => ps.map((p) => (lang === "go" ? `${p.name} ${t(p.type)}` : lang === "rust" ? `${paramName("rust", p.name)}: ${t(p.type)}` : lang === "c" ? cParams(p) : lang === "cpp" && parseType(p.type).dims ? `${t(p.type)}& ${p.name}` : `${t(p.type)} ${p.name}`)).join(", ");
  const methods = Object.entries(sig.methods ?? {}) as [string, MethodSig][];

  switch (lang) {
    case "go": {
      const header = "package main\n\n";
      if (sig.kind === "function") return { header, body: `func ${entry}(${params(sig.params!)})${isVoid(sig.returns!) ? "" : " " + t(sig.returns!)} {\n\n}\n` };
      const ms = methods.map(([op, m]) => `func (this *${entry}) ${methodName("go", entry, op)}(${params(m.params)})${isVoid(m.returns) ? "" : " " + t(m.returns)} {\n\n}`);
      return { header, body: `type ${entry} struct {\n\n}\n\nfunc Constructor(${params(sig.init!)}) ${entry} {\n\n}\n\n${ms.join("\n\n")}\n` };
    }
    case "java": {
      const header = "import java.util.*;\n\n";
      if (sig.kind === "function") {
        const member = `    public ${t(sig.returns!)} ${entry}(${params(sig.params!)}) {\n\n    }\n`;
        return { header, body: `class Solution {\n${member}}\n`, member };
      }
      const ms = methods.map(([op, m]) => `    public ${t(m.returns)} ${op}(${params(m.params)}) {\n\n    }`);
      return { header, body: `class ${entry} {\n\n    public ${entry}(${params(sig.init!)}) {\n\n    }\n\n${ms.join("\n\n")}\n}\n` };
    }
    case "cpp": {
      const header = "// The standard library is already included and `using namespace std;` is in effect.\n\n";
      if (sig.kind === "function") {
        const member = `    ${t(sig.returns!)} ${entry}(${params(sig.params!)}) {\n\n    }\n`;
        return { header, body: `class Solution {\npublic:\n${member}};\n`, member };
      }
      const ms = methods.map(([op, m]) => `    ${t(m.returns)} ${op}(${params(m.params)}) {\n\n    }`);
      return { header, body: `class ${entry} {\npublic:\n    ${entry}(${params(sig.init!)}) {\n\n    }\n\n${ms.join("\n\n")}\n};\n` };
    }
    case "rust": {
      const ret = (s: string) => (isVoid(s) ? "" : ` -> ${t(s)}`);
      if (sig.kind === "function")
        return { header: "// `struct Solution;` is already declared.\n", body: `impl Solution {\n    pub fn ${entry}(${params(sig.params!)})${ret(sig.returns!)} {\n\n    }\n}\n` };
      const ms = methods.map(([op, m]) => `    fn ${methodName("rust", entry, op)}(&mut self${m.params.length ? ", " + params(m.params) : ""})${ret(m.returns)} {\n\n    }`);
      return { header: "", body: `struct ${entry} {\n\n}\n\nimpl ${entry} {\n    fn new(${params(sig.init!)}) -> Self {\n\n    }\n\n${ms.join("\n\n")}\n}\n` };
    }
    case "c": {
      const header = "// Standard C headers (stdio, stdlib, string, stdbool, limits, math, ...) are already included.\n\n";
      const fn = (ret: string, name: string, ps: string[]) => `${t(ret)} ${name}(${ps.filter(Boolean).join(", ")}) {\n\n}`;
      const note = (ret: string) => {
        const r = parseType(ret);
        if (r.dims === 1) return "/**\n * Note: the returned array must be malloced; set *returnSize to its length.\n */\n";
        if (r.dims === 2) return "/**\n * Note: the returned array and its rows must be malloced. Set *returnSize to the number of rows\n * and *returnColumnSizes to a malloced array of each row's length.\n */\n";
        return "";
      };
      if (sig.kind === "function") return { header, body: `${note(sig.returns!)}${fn(sig.returns!, entry, [params(sig.params!), ...cReturnParams(parseType(sig.returns!))])}\n` };
      const prefix = lowerFirst(entry);
      const ms = methods.map(([op, m]) => note(m.returns) + fn(m.returns, methodName("c", entry, op), [`${entry}* obj`, params(m.params), ...cReturnParams(parseType(m.returns))]));
      return { header, body: `typedef struct {\n\n} ${entry};\n\n${entry}* ${prefix}Create(${params(sig.init!)}) {\n\n}\n\n${ms.join("\n\n")}\n\nvoid ${prefix}Free(${entry}* obj) {\n\n}\n` };
    }
  }
}
