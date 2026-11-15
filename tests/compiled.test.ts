// Compiled-language runner tests (Go, C, C++, Rust, Java, C#). These need Docker and the toolchain
// images (`npm run docker:pull`), so they are skipped when Docker isn't reachable.
import { execFileSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";
import { getQuestion, loadQuestions, starterThrough } from "../server/questions.ts";
import { runCases, type LabeledCase } from "../server/runner/index.ts";
import type { Language } from "../shared/types.ts";

const dockerUp = (() => {
  try {
    execFileSync("docker", ["info"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

beforeAll(() => {
  process.env.DEFAANG_RUNNER = "docker";
  loadQuestions(true);
});

const all = (id: string) => {
  const q = getQuestion(id);
  return [...q.tests!.public.map((t) => ({ kind: "public" as const, test: t })), ...q.tests!.hidden.map((t) => ({ kind: "hidden" as const, test: t }))];
};
const run = (id: string, lang: Language, code: string, cases: LabeledCase[] = all(id), withReference = false) =>
  runCases(getQuestion(id), lang, code, cases, { withReference });

type Typed = "go" | "c" | "cpp" | "rust" | "java" | "csharp";

const twoSum: Record<Typed, string> = {
  go: `package main

import "fmt"

func twoSum(nums []int, target int) []int {
	seen := map[int]int{}
	for i, x := range nums {
		if j, ok := seen[target-x]; ok {
			return []int{j, i}
		}
		seen[x] = i
	}
	fmt.Println("no pair")
	return nil
}
`,
  c: `int* twoSum(int* nums, int numsSize, int target, int* returnSize) {
    int* r = malloc(2 * sizeof(int));
    *returnSize = 2;
    for (int i = 0; i < numsSize; i++)
        for (int j = i + 1; j < numsSize; j++)
            if (nums[i] + nums[j] == target) { r[0] = i; r[1] = j; return r; }
    *returnSize = 0;
    return r;
}
`,
  cpp: `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> seen;
        for (int i = 0; i < (int)nums.size(); i++) {
            auto it = seen.find(target - nums[i]);
            if (it != seen.end()) return {it->second, i};
            seen[nums[i]] = i;
        }
        return {};
    }
};
`,
  rust: `use std::collections::HashMap;

impl Solution {
    pub fn two_sum(nums: Vec<i32>, target: i32) -> Vec<i32> {
        let mut seen = HashMap::new();
        for (i, &x) in nums.iter().enumerate() {
            if let Some(&j) = seen.get(&(target - x)) {
                return vec![j as i32, i as i32];
            }
            seen.insert(x, i);
        }
        vec![]
    }
}
`,
  java: `import java.util.*;

class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> seen = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            Integer j = seen.get(target - nums[i]);
            if (j != null) return new int[]{j, i};
            seen.put(nums[i], i);
        }
        return new int[0];
    }
}
`,
  csharp: `using System.Collections.Generic;

public class Solution {
    public int[] TwoSum(int[] nums, int target) {
        var seen = new Dictionary<int, int>();
        for (int i = 0; i < nums.Length; i++) {
            if (seen.TryGetValue(target - nums[i], out var j)) return new[] { j, i };
            seen[nums[i]] = i;
        }
        Console.WriteLine("no pair");
        return Array.Empty<int>();
    }
}
`,
};

const lru: Record<Typed, string> = {
  go: `package main

import "container/list"

type entry struct{ key, val int }

type LRUCache struct {
	cap   int
	order *list.List
	items map[int]*list.Element
}

func Constructor(capacity int) LRUCache {
	return LRUCache{capacity, list.New(), map[int]*list.Element{}}
}

func (this *LRUCache) Get(key int) int {
	if e, ok := this.items[key]; ok {
		this.order.MoveToFront(e)
		return e.Value.(*entry).val
	}
	return -1
}

func (this *LRUCache) Put(key int, value int) {
	if e, ok := this.items[key]; ok {
		e.Value.(*entry).val = value
		this.order.MoveToFront(e)
		return
	}
	this.items[key] = this.order.PushFront(&entry{key, value})
	if this.order.Len() > this.cap {
		last := this.order.Back()
		this.order.Remove(last)
		delete(this.items, last.Value.(*entry).key)
	}
}
`,
  c: `typedef struct {
    int cap, n, tick;
    int keys[64], vals[64], used[64];
} LRUCache;

LRUCache* lRUCacheCreate(int capacity) {
    LRUCache* c = calloc(1, sizeof(LRUCache));
    c->cap = capacity;
    return c;
}

static int find(LRUCache* c, int key) {
    for (int i = 0; i < c->n; i++) if (c->keys[i] == key) return i;
    return -1;
}

int lRUCacheGet(LRUCache* obj, int key) {
    int i = find(obj, key);
    if (i < 0) return -1;
    obj->used[i] = ++obj->tick;
    return obj->vals[i];
}

void lRUCachePut(LRUCache* obj, int key, int value) {
    int i = find(obj, key);
    if (i < 0) {
        if (obj->n < obj->cap) i = obj->n++;
        else { i = 0; for (int j = 1; j < obj->n; j++) if (obj->used[j] < obj->used[i]) i = j; }
        obj->keys[i] = key;
    }
    obj->vals[i] = value;
    obj->used[i] = ++obj->tick;
}

void lRUCacheFree(LRUCache* obj) { free(obj); }
`,
  cpp: `class LRUCache {
    int cap;
    list<pair<int, int>> order;
    unordered_map<int, list<pair<int, int>>::iterator> items;
public:
    LRUCache(int capacity) : cap(capacity) {}

    int get(int key) {
        auto it = items.find(key);
        if (it == items.end()) return -1;
        order.splice(order.begin(), order, it->second);
        return it->second->second;
    }

    void put(int key, int value) {
        auto it = items.find(key);
        if (it != items.end()) {
            it->second->second = value;
            order.splice(order.begin(), order, it->second);
            return;
        }
        order.emplace_front(key, value);
        items[key] = order.begin();
        if ((int)items.size() > cap) {
            items.erase(order.back().first);
            order.pop_back();
        }
    }
};
`,
  rust: `use std::collections::HashMap;

struct LRUCache {
    cap: usize,
    tick: u64,
    map: HashMap<i32, (i32, u64)>,
}

impl LRUCache {
    fn new(capacity: i32) -> Self {
        LRUCache { cap: capacity as usize, tick: 0, map: HashMap::new() }
    }

    fn get(&mut self, key: i32) -> i32 {
        self.tick += 1;
        let t = self.tick;
        match self.map.get_mut(&key) {
            Some(e) => { e.1 = t; e.0 }
            None => -1,
        }
    }

    fn put(&mut self, key: i32, value: i32) {
        self.tick += 1;
        if !self.map.contains_key(&key) && self.map.len() == self.cap {
            let oldest = *self.map.iter().min_by_key(|(_, v)| v.1).unwrap().0;
            self.map.remove(&oldest);
        }
        self.map.insert(key, (value, self.tick));
    }
}
`,
  java: `import java.util.*;

class LRUCache extends LinkedHashMap<Integer, Integer> {
    private final int capacity;

    public LRUCache(int capacity) {
        super(16, 0.75f, true);
        this.capacity = capacity;
    }

    public int get(int key) {
        return super.getOrDefault(key, -1);
    }

    public void put(int key, int value) {
        super.put(key, value);
    }

    @Override
    protected boolean removeEldestEntry(Map.Entry<Integer, Integer> eldest) {
        return size() > capacity;
    }
}
`,
  csharp: `public class LRUCache {
    private readonly int capacity;
    private readonly LinkedList<(int Key, int Value)> order = new();
    private readonly Dictionary<int, LinkedListNode<(int Key, int Value)>> items = new();

    public LRUCache(int capacity) {
        this.capacity = capacity;
    }

    public int Get(int key) {
        if (!items.TryGetValue(key, out var node)) return -1;
        order.Remove(node);
        order.AddFirst(node);
        return node.Value.Value;
    }

    public void Put(int key, int value) {
        if (items.TryGetValue(key, out var node)) {
            order.Remove(node);
            items.Remove(key);
        } else if (items.Count == capacity) {
            items.Remove(order.Last!.Value.Key);
            order.RemoveLast();
        }
        items[key] = order.AddFirst((key, value));
    }
}
`,
};

const merge: Record<Typed, string> = {
  go: `package main

import "sort"

func merge(intervals [][]int) [][]int {
	sort.Slice(intervals, func(a, b int) bool { return intervals[a][0] < intervals[b][0] })
	out := [][]int{}
	for _, iv := range intervals {
		if n := len(out); n > 0 && iv[0] <= out[n-1][1] {
			out[n-1][1] = max(out[n-1][1], iv[1])
		} else {
			out = append(out, []int{iv[0], iv[1]})
		}
	}
	return out
}
`,
  c: `static int cmp(const void* a, const void* b) { return (*(int**)a)[0] - (*(int**)b)[0]; }

int** merge(int** intervals, int intervalsSize, int* intervalsColSize, int* returnSize, int** returnColumnSizes) {
    qsort(intervals, intervalsSize, sizeof(int*), cmp);
    int** out = malloc(sizeof(int*) * (intervalsSize + 1));
    *returnColumnSizes = malloc(sizeof(int) * (intervalsSize + 1));
    int n = 0;
    for (int i = 0; i < intervalsSize; i++) {
        if (n && intervals[i][0] <= out[n - 1][1]) {
            if (intervals[i][1] > out[n - 1][1]) out[n - 1][1] = intervals[i][1];
        } else {
            out[n] = malloc(2 * sizeof(int));
            out[n][0] = intervals[i][0];
            out[n][1] = intervals[i][1];
            (*returnColumnSizes)[n++] = 2;
        }
    }
    *returnSize = n;
    return out;
}
`,
  cpp: `class Solution {
public:
    vector<vector<int>> merge(vector<vector<int>>& intervals) {
        sort(intervals.begin(), intervals.end());
        vector<vector<int>> out;
        for (auto& iv : intervals) {
            if (!out.empty() && iv[0] <= out.back()[1]) out.back()[1] = max(out.back()[1], iv[1]);
            else out.push_back(iv);
        }
        return out;
    }
};
`,
  rust: `impl Solution {
    pub fn merge(mut intervals: Vec<Vec<i32>>) -> Vec<Vec<i32>> {
        intervals.sort();
        let mut out: Vec<Vec<i32>> = Vec::new();
        for iv in intervals {
            match out.last_mut() {
                Some(last) if iv[0] <= last[1] => last[1] = last[1].max(iv[1]),
                _ => out.push(iv),
            }
        }
        out
    }
}
`,
  java: `import java.util.*;

class Solution {
    public int[][] merge(int[][] intervals) {
        Arrays.sort(intervals, (a, b) -> Integer.compare(a[0], b[0]));
        List<int[]> out = new ArrayList<>();
        for (int[] iv : intervals) {
            if (!out.isEmpty() && iv[0] <= out.get(out.size() - 1)[1]) {
                int[] last = out.get(out.size() - 1);
                last[1] = Math.max(last[1], iv[1]);
            } else out.add(new int[]{iv[0], iv[1]});
        }
        return out.toArray(new int[0][]);
    }
}
`,
  csharp: `public class Solution {
    public int[][] Merge(int[][] intervals) {
        var outp = new List<int[]>();
        foreach (var iv in intervals.OrderBy(x => x[0])) {
            if (outp.Count > 0 && iv[0] <= outp[^1][1]) outp[^1][1] = Math.Max(outp[^1][1], iv[1]);
            else outp.Add(new[] { iv[0], iv[1] });
        }
        return outp.ToArray();
    }
}
`,
};

const LANGS: Typed[] = ["go", "c", "cpp", "rust", "java", "csharp"];

describe.skipIf(!dockerUp)("compiled languages", { timeout: 120_000 }, () => {
  for (const lang of LANGS) {
    it(`passes two-sum in ${lang}`, async () => {
      const r = await run("two-sum", lang, twoSum[lang]);
      expect(r.compileError).toBeUndefined();
      expect(r.passed).toBe(8);
      expect(r.total).toBe(8);
    });

    it(`passes lru-cache (class) in ${lang}`, async () => {
      const r = await run("lru-cache", lang, lru[lang]);
      expect(r.compileError).toBeUndefined();
      expect(r.passed).toBe(r.total);
    });

    it(`passes merge-intervals (2-D arrays) in ${lang}`, async () => {
      const r = await run("merge-intervals", lang, merge[lang]);
      expect(r.compileError).toBeUndefined();
      expect(r.passed).toBe(r.total);
    });

    it(`compiles the generated ${lang} starter far enough to report a compile error or empty output`, async () => {
      const q = getQuestion("two-sum");
      const r = await run("two-sum", lang, q.starter[lang]!, all("two-sum").slice(0, 1));
      // Starters have empty bodies: Go/Java/C#/Rust/C++ reject a missing return; C may compile.
      expect(r.compileError !== undefined || r.cases.length === 1).toBe(true);
    });
  }

  it("reports compile errors with the candidate's line numbers", async () => {
    const r = await run("two-sum", "cpp", "class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        return nope;\n    }\n};\n");
    expect(r.ok).toBe(false);
    expect(r.compileError).toMatch(/solution\.cpp:4/);
  });

  it("captures per-case stdout and runtime errors with the line number", async () => {
    const code = `class Solution {
    public int[] twoSum(int[] nums, int target) {
        System.out.println("len=" + nums.length);
        return new int[]{nums[100]};
    }
}
`;
    const r = await run("two-sum", "java", code, all("two-sum").slice(0, 2));
    expect(r.cases[0].stdout).toContain("len=4");
    expect(r.cases[0].error).toMatch(/ArrayIndexOutOfBounds.*line 4/);
    expect(r.cases[1].stdout).toContain("len=3");
  });

  it("reports C# exceptions per case with the line number, and C# compile errors against Solution.cs", async () => {
    const thrown = await run("two-sum", "csharp", "public class Solution {\n    public int[] TwoSum(int[] nums, int target) {\n        Console.WriteLine(\"len=\" + nums.Length);\n        return new[] { nums[100] };\n    }\n}\n", all("two-sum").slice(0, 2));
    expect(thrown.cases[0].stdout).toContain("len=4");
    expect(thrown.cases[0].error).toMatch(/IndexOutOfRangeException.*line 4, in TwoSum/);
    expect(thrown.cases[1].error).toMatch(/IndexOutOfRangeException/);
    const bad = await run("two-sum", "csharp", "public class Solution {\n    public int[] TwoSum(int[] nums, int target) {\n        return nope;\n    }\n}\n");
    expect(bad.ok).toBe(false);
    expect(bad.compileError).toMatch(/Solution\.cs\(3,16\): error CS0103/);
  });

  it("compiles every coding question's C# starter with all of its test inputs", async () => {
    // Empty method bodies only fail with "not all code paths return a value" (CS0161), so any other
    // error means a generated starter, entry name or test literal is wrong.
    for (const q of [...loadQuestions().values()].filter((x) => x.meta.type === "coding")) {
      expect(q.languages, q.meta.id).toContain("csharp");
      for (const part of q.parts) {
        const cases = [...part.tests.public, ...part.tests.hidden].map((t) => ({ kind: "hidden" as const, test: t }));
        const r = await runCases(q, "csharp", starterThrough(q, part.index).csharp!, cases, { withReference: false, part: part.index });
        const errors = (r.compileError ?? "").split("\n").filter((l) => / error CS\d+/.test(l));
        expect(r.ok || errors.length > 0, `${q.meta.id} part ${part.index}: ${r.compileError}`).toBe(true);
        expect(errors.filter((l) => !l.includes("error CS0161")), `${q.meta.id} part ${part.index}`).toEqual([]);
      }
    }
  });

  it("recovers Go panics and Rust panics per case", async () => {
    const go = await run("two-sum", "go", "package main\n\nfunc twoSum(nums []int, target int) []int {\n\treturn []int{nums[10]}\n}\n", all("two-sum").slice(0, 2));
    expect(go.cases[0].error).toMatch(/index out of range.*line 4/);
    expect(go.cases[1].error).toMatch(/index out of range/);
    const rust = await run("two-sum", "rust", "impl Solution {\n    pub fn two_sum(nums: Vec<i32>, target: i32) -> Vec<i32> {\n        vec![nums[10]]\n    }\n}\n", all("two-sum").slice(0, 2));
    expect(rust.cases[0].error).toMatch(/index out of bounds.*line 3/);
    expect(rust.cases[1].error).toMatch(/index out of bounds/);
  });

  it("keeps finished cases when a C program segfaults", async () => {
    const code = "int* twoSum(int* nums, int numsSize, int target, int* returnSize) {\n    if (numsSize == 3) { int* p = NULL; *p = 1; }\n    int* r = malloc(8); r[0] = 0; r[1] = 1; *returnSize = 2; return r;\n}\n";
    const r = await run("two-sum", "c", code, all("two-sum").slice(0, 3));
    expect(r.cases[0].passed).toBe(true);
    expect(r.cases[1].error).toMatch(/Segmentation fault/);
    expect(r.cases[2].error).toMatch(/Not run/);
  });

  it("enforces the time limit inside the compiled program", async () => {
    process.env.DEFAANG_RUN_TIMEOUT = "2";
    const r = await run("two-sum", "rust", "impl Solution {\n    pub fn two_sum(nums: Vec<i32>, target: i32) -> Vec<i32> {\n        loop {}\n    }\n}\n", all("two-sum").slice(0, 2));
    delete process.env.DEFAANG_RUN_TIMEOUT;
    expect(r.cases[0].error).toMatch(/Time limit/);
  });

  it("rejects custom inputs that don't match the signature", async () => {
    const r = await run("two-sum", "go", twoSum.go, [{ kind: "custom", test: { args: [[1, 2.5], 3] } }]);
    expect(r.ok).toBe(false);
    expect(r.compileError).toMatch(/nums\[1\] should be int/);
  });

  it("gets expected values for custom inputs from the Python reference", async () => {
    const r = await run("merge-intervals", "cpp", merge.cpp, [{ kind: "custom", test: { args: [[[1, 5], [2, 3], [7, 8]]] } }], true);
    expect(r.cases[0].expected).toEqual([[1, 5], [7, 8]]);
    expect(r.cases[0].passed).toBe(true);
  });
});
