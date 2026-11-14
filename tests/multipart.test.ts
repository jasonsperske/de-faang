// Multipart questions: loading, part views, stub insertion, and both parts of the example question
// in every language (Python/JS/TS with the local runner, compiled languages through Docker).
import { execFileSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";
import { getQuestion, loadQuestions, questionView, starterThrough, summarize } from "../server/questions.ts";
import { mergeResults, runCases, type LabeledCase } from "../server/runner/index.ts";
import { addPartStub, solutionClassEnd } from "../server/runner/starters.ts";
import type { Language } from "../shared/types.ts";

const ID = "anagram-pairs-and-compound-words";

beforeAll(() => {
  loadQuestions(true);
});

const partCases = (part: number): LabeledCase[] => {
  const p = getQuestion(ID).parts[part];
  return [...p.tests.public.map((t) => ({ kind: "public" as const, test: t })), ...p.tests.hidden.map((t) => ({ kind: "hidden" as const, test: t }))];
};

const runBoth = async (lang: Language, code: string) => {
  const q = getQuestion(ID);
  return mergeResults(await Promise.all([0, 1].map((part) => runCases(q, lang, code, partCases(part), { withReference: false, part }))));
};

describe("multipart question format", () => {
  it("loads both parts with their own signature and tests", () => {
    const q = getQuestion(ID);
    expect(q.multipart).toBe(true);
    expect(q.parts.map((p) => p.id)).toEqual(["anagram-pairs", "compound-words"]);
    expect(q.parts[0].signature.entry).toMatchObject({ python: "count_anagram_pairs", rust: "count_anagram_pairs", c: "countAnagramPairs" });
    expect(q.parts[1].signature.compare).toBe("unordered");
    expect(q.languages).toHaveLength(8);
    expect(summarize(q).parts).toBe(2);
  });

  it("reveals only the parts reached so far", () => {
    const q = getQuestion(ID);
    const v0 = questionView(q, "standard", false, 0);
    expect(v0.partViews?.map((p) => p.id)).toEqual(["anagram-pairs"]);
    expect(v0.signature?.entry.python).toBe("count_anagram_pairs");
    expect(v0.publicTests).toEqual(q.parts[0].tests.public);
    expect(v0.starter?.python).not.toContain("find_compound_words");

    const v1 = questionView(q, "standard", false, 1);
    expect(v1.partViews?.map((p) => p.id)).toEqual(["anagram-pairs", "compound-words"]);
    expect(v1.signature?.entry.python).toBe("find_compound_words");
    expect(v1.publicTests).toEqual(q.parts[1].tests.public);
    expect(questionView(q, "strict", false, 1).publicTests).toBeUndefined();
  });

  it("puts later Java and C++ methods inside the existing class Solution", () => {
    const s = starterThrough(getQuestion(ID), 1);
    for (const l of ["java", "cpp"] as const) {
      expect(s[l]!.match(/class Solution/g)).toHaveLength(1);
      expect(s[l]).toMatch(/findCompoundWords\([^)]*\) \{\n\n {4}\}\n\}/);
    }
    expect(s.rust!.match(/impl Solution/g)).toHaveLength(2);
    expect(s.go).toMatch(/^package main\n/);
    expect(s.go!.match(/package main/g)).toHaveLength(1);
  });

  it("finds the end of class Solution past braces in strings and comments", () => {
    const code = `class Solution {\n    long f() {\n        String s = "}"; // }\n        char c = '}'; /* } */\n        return 0;\n    }\n}\n// trailing }\n`;
    const end = solutionClassEnd(code);
    expect(code.slice(end - 6, end + 1)).toBe("    }\n}");
    const q = getQuestion(ID);
    const out = addPartStub("java", code, q.parts[1].signature, "findCompoundWords");
    expect(out).toContain("return 0;\n    }\n\n    public String[] findCompoundWords(String[] words) {\n\n    }\n}\n// trailing }");
  });

  it("leaves code alone when the part's entry point already exists", () => {
    const q = getQuestion(ID);
    const code = "def find_compound_words(words):\n    return []\n";
    expect(addPartStub("python", code, q.parts[1].signature, "find_compound_words")).toBe(code);
    expect(addPartStub("python", "def count_anagram_pairs(words):\n    return 0\n", q.parts[1].signature, "find_compound_words")).toBe(
      "def count_anagram_pairs(words):\n    return 0\n\n\ndef find_compound_words(words: List[str]) -> List[str]:\n    pass\n",
    );
  });
});

const script: Record<"python" | "javascript" | "typescript", string> = {
  python: `from collections import Counter


def count_anagram_pairs(words):
    groups = Counter("".join(sorted(w)) for w in set(words))
    return sum(k * (k - 1) // 2 for k in groups.values())


def find_compound_words(words):
    d = set(words)
    out = []
    for w in dict.fromkeys(words):
        n = len(w)
        can = [True] + [False] * n
        for i in range(1, n + 1):
            can[i] = any(can[j] and (j or i < n) and w[j:i] in d for j in range(i))
        if can[n]:
            out.append(w)
    return out
`,
  javascript: `function countAnagramPairs(words) {
  const groups = new Map();
  for (const w of new Set(words)) {
    const k = [...w].sort().join("");
    groups.set(k, (groups.get(k) ?? 0) + 1);
  }
  let total = 0;
  for (const k of groups.values()) total += (k * (k - 1)) / 2;
  return total;
}

function findCompoundWords(words) {
  const dict = new Set(words);
  const out = [];
  for (const w of new Set(words)) {
    const n = w.length;
    const can = new Array(n + 1).fill(false);
    can[0] = true;
    for (let i = 1; i <= n; i++)
      for (let j = 0; j < i && !can[i]; j++) if (can[j] && (j > 0 || i < n) && dict.has(w.slice(j, i))) can[i] = true;
    if (can[n]) out.push(w);
  }
  return out;
}
`,
  typescript: `function countAnagramPairs(words: string[]): number {
  const groups = new Map<string, number>();
  for (const w of new Set(words)) {
    const k = [...w].sort().join("");
    groups.set(k, (groups.get(k) ?? 0) + 1);
  }
  let total = 0;
  for (const k of groups.values()) total += (k * (k - 1)) / 2;
  return total;
}

function findCompoundWords(words: string[]): string[] {
  const dict = new Set(words);
  const out: string[] = [];
  for (const w of new Set(words)) {
    const n = w.length;
    const can: boolean[] = new Array(n + 1).fill(false);
    can[0] = true;
    for (let i = 1; i <= n; i++)
      for (let j = 0; j < i && !can[i]; j++) if (can[j] && (j > 0 || i < n) && dict.has(w.slice(j, i))) can[i] = true;
    if (can[n]) out.push(w);
  }
  return out;
}
`,
};

describe("multipart runs (local runner)", () => {
  beforeAll(() => {
    process.env.DEFAANG_RUNNER = process.env.DEFAANG_TEST_RUNNER ?? "local";
  });

  for (const lang of ["python", "javascript", "typescript"] as const) {
    it(`passes both parts in ${lang}, labelling cases by part`, async () => {
      const r = await runBoth(lang, script[lang]);
      expect(r.compileError).toBeUndefined();
      expect(r.passed).toBe(r.total);
      expect(r.total).toBe(partCases(0).length + partCases(1).length);
      expect(new Set(r.cases.map((c) => c.part))).toEqual(new Set([0, 1]));
    });
  }

  it("grades a part with only that part's function written", async () => {
    const q = getQuestion(ID);
    const part1Only = script.python.slice(0, script.python.indexOf("def find_compound_words"));
    const r0 = await runCases(q, "python", part1Only, partCases(0), { withReference: false, part: 0 });
    expect(r0.passed).toBe(r0.total);
    const r1 = await runCases(q, "python", part1Only, partCases(1), { withReference: false, part: 1 });
    expect(r1.passed).toBe(0);
    expect(r1.cases[0].error).toMatch(/find_compound_words/);
  });

  it("gets expected values for part-2 custom inputs from the reference", async () => {
    const q = getQuestion(ID);
    const r = await runCases(q, "python", script.python, [{ kind: "custom", test: { args: [["x", "y", "xy", "yx", "xyz"]] } }], { withReference: true, part: 1 });
    expect(r.cases[0].expected).toEqual(["xy", "yx"]);
    expect(r.cases[0].passed).toBe(true);
  });
});

const dockerUp = (() => {
  try {
    execFileSync("docker", ["info"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

const compiled: Record<"go" | "c" | "cpp" | "rust" | "java", string> = {
  go: `package main

import "sort"

func countAnagramPairs(words []string) int64 {
	seen := map[string]bool{}
	groups := map[string]int64{}
	for _, w := range words {
		if seen[w] {
			continue
		}
		seen[w] = true
		b := []byte(w)
		sort.Slice(b, func(i, j int) bool { return b[i] < b[j] })
		groups[string(b)]++
	}
	var total int64
	for _, k := range groups {
		total += k * (k - 1) / 2
	}
	return total
}

func findCompoundWords(words []string) []string {
	dict := map[string]bool{}
	for _, w := range words {
		dict[w] = true
	}
	out := []string{}
	done := map[string]bool{}
	for _, w := range words {
		if done[w] {
			continue
		}
		done[w] = true
		n := len(w)
		can := make([]bool, n+1)
		can[0] = true
		for i := 1; i <= n; i++ {
			for j := 0; j < i; j++ {
				if can[j] && (j > 0 || i < n) && dict[w[j:i]] {
					can[i] = true
					break
				}
			}
		}
		if can[n] {
			out = append(out, w)
		}
	}
	return out
}
`,
  c: `static int cmpc(const void* a, const void* b) { return *(const char*)a - *(const char*)b; }
static int cmps(const void* a, const void* b) { return strcmp(*(char* const*)a, *(char* const*)b); }

long long countAnagramPairs(char** words, int wordsSize) {
    if (wordsSize == 0) return 0;
    char** uniq = malloc(wordsSize * sizeof(char*));
    char** keys = malloc(wordsSize * sizeof(char*));
    memcpy(uniq, words, wordsSize * sizeof(char*));
    qsort(uniq, wordsSize, sizeof(char*), cmps);
    int m = 0;
    for (int i = 0; i < wordsSize; i++) {
        if (i > 0 && strcmp(uniq[i], uniq[i - 1]) == 0) continue;
        keys[m] = strdup(uniq[i]);
        qsort(keys[m], strlen(keys[m]), 1, cmpc);
        m++;
    }
    qsort(keys, m, sizeof(char*), cmps);
    long long total = 0, run = 1;
    for (int i = 1; i <= m; i++) {
        if (i < m && strcmp(keys[i], keys[i - 1]) == 0) run++;
        else { total += run * (run - 1) / 2; run = 1; }
    }
    return total;
}

char** findCompoundWords(char** words, int wordsSize, int* returnSize) {
    char** dict = malloc((wordsSize + 1) * sizeof(char*));
    if (wordsSize) memcpy(dict, words, wordsSize * sizeof(char*));
    qsort(dict, wordsSize, sizeof(char*), cmps);
    char** out = malloc((wordsSize + 1) * sizeof(char*));
    int k = 0;
    char buf[128];
    for (int w = 0; w < wordsSize; w++) {
        char* s = words[w];
        bool dup = false;
        for (int t = 0; t < k; t++) if (strcmp(out[t], s) == 0) dup = true;
        if (dup) continue;
        int n = strlen(s);
        bool can[128] = {0};
        can[0] = true;
        for (int i = 1; i <= n; i++)
            for (int j = 0; j < i && !can[i]; j++) {
                if (!can[j] || (j == 0 && i == n)) continue;
                memcpy(buf, s + j, i - j);
                buf[i - j] = 0;
                char* key = buf;
                if (bsearch(&key, dict, wordsSize, sizeof(char*), cmps)) can[i] = true;
            }
        if (can[n]) out[k++] = s;
    }
    *returnSize = k;
    return out;
}
`,
  cpp: `class Solution {
public:
    long long countAnagramPairs(vector<string>& words) {
        unordered_set<string> uniq(words.begin(), words.end());
        unordered_map<string, long long> groups;
        for (auto w : uniq) { sort(w.begin(), w.end()); groups[w]++; }
        long long total = 0;
        for (auto& [k, c] : groups) total += c * (c - 1) / 2;
        return total;
    }

    vector<string> findCompoundWords(vector<string>& words) {
        unordered_set<string> dict(words.begin(), words.end()), seen;
        vector<string> out;
        for (auto& w : words) {
            if (!seen.insert(w).second) continue;
            int n = w.size();
            vector<bool> can(n + 1);
            can[0] = true;
            for (int i = 1; i <= n; i++)
                for (int j = 0; j < i && !can[i]; j++)
                    if (can[j] && (j > 0 || i < n) && dict.count(w.substr(j, i - j))) can[i] = true;
            if (can[n]) out.push_back(w);
        }
        return out;
    }
};
`,
  rust: `use std::collections::{HashMap, HashSet};

impl Solution {
    pub fn count_anagram_pairs(words: Vec<String>) -> i64 {
        let uniq: HashSet<String> = words.into_iter().collect();
        let mut groups: HashMap<Vec<u8>, i64> = HashMap::new();
        for w in uniq {
            let mut k = w.into_bytes();
            k.sort();
            *groups.entry(k).or_insert(0) += 1;
        }
        groups.values().map(|&k| k * (k - 1) / 2).sum()
    }
}

impl Solution {
    pub fn find_compound_words(words: Vec<String>) -> Vec<String> {
        let dict: HashSet<&str> = words.iter().map(|w| w.as_str()).collect();
        let mut seen = HashSet::new();
        let mut out = Vec::new();
        for w in &words {
            if !seen.insert(w.as_str()) {
                continue;
            }
            let n = w.len();
            let mut can = vec![false; n + 1];
            can[0] = true;
            for i in 1..=n {
                for j in 0..i {
                    if can[j] && (j > 0 || i < n) && dict.contains(&w[j..i]) {
                        can[i] = true;
                        break;
                    }
                }
            }
            if can[n] {
                out.push(w.clone());
            }
        }
        out
    }
}
`,
  java: `import java.util.*;

class Solution {
    public long countAnagramPairs(String[] words) {
        Map<String, Long> groups = new HashMap<>();
        for (String w : new HashSet<>(Arrays.asList(words))) {
            char[] c = w.toCharArray();
            Arrays.sort(c);
            groups.merge(new String(c), 1L, Long::sum);
        }
        long total = 0;
        for (long k : groups.values()) total += k * (k - 1) / 2;
        return total;
    }

    public String[] findCompoundWords(String[] words) {
        Set<String> dict = new HashSet<>(Arrays.asList(words));
        Set<String> out = new LinkedHashSet<>();
        for (String w : words) {
            int n = w.length();
            boolean[] can = new boolean[n + 1];
            can[0] = true;
            for (int i = 1; i <= n; i++)
                for (int j = 0; j < i && !can[i]; j++)
                    if (can[j] && (j > 0 || i < n) && dict.contains(w.substring(j, i))) can[i] = true;
            if (can[n]) out.add(w);
        }
        return out.toArray(new String[0]);
    }
}
`,
};

describe.skipIf(!dockerUp)("multipart runs (compiled languages)", { timeout: 180_000 }, () => {
  beforeAll(() => {
    process.env.DEFAANG_RUNNER = "docker";
  });

  for (const lang of ["go", "c", "cpp", "rust", "java"] as const) {
    it(`passes both parts in ${lang}`, async () => {
      const r = await runBoth(lang, compiled[lang]);
      expect(r.compileError).toBeUndefined();
      expect(r.cases.filter((c) => !c.passed).map((c) => `${c.part}:${c.name}:${c.error ?? JSON.stringify(c.output)}`)).toEqual([]);
      expect(r.passed).toBe(r.total);
    });

    it(`compiles the two-part ${lang} starter far enough to report a result`, async () => {
      const q = getQuestion(ID);
      const r = await runCases(q, lang, starterThrough(q, 1)[lang]!, partCases(1).slice(0, 1), { withReference: false, part: 1 });
      expect(r.compileError !== undefined || r.cases.length === 1).toBe(true);
    });
  }
});
