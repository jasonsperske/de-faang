Add a wildcard query:

- `find(pattern)` returns the paths of every **file** whose full path matches `pattern`, sorted in ascending (ordinal) string order. Directories are never returned.

A pattern is written like a path, and each of its segments matches one path segment, except `**`:

- `*` matches any sequence of characters **within one segment** (possibly empty). It never matches `/`.
- `?` matches exactly one character within a segment.
- A segment that is exactly `**` matches **zero or more whole segments**.
- Any other character matches itself.

**Example**

```
files: /src/app.js  /src/lib/util.js  /src/lib/deep/helpers.js  /docs/readme.md  /docs/guide.md  /notes.txt

find("/src/*.js")         → ["/src/app.js"]
find("/**/*.js")          → ["/src/app.js", "/src/lib/deep/helpers.js", "/src/lib/util.js"]
find("/docs/?????.md")    → ["/docs/guide.md"]
find("/*")                → ["/notes.txt"]
```

`/*` matches only files directly under the root: `/src` and `/docs` are directories. `/**/*.js` matches `.js` files at any depth, including directly under `/` if there were any.

**Constraints**

- Up to `10^4` operations in total and up to `2000` files at a time. Patterns have at most `100` characters.

> Your code carries over unchanged, so add `find` to your class yourself. In compiled languages its signature is:
>
> - Java: `public String[] find(String pattern)`
> - C++: `vector<string> find(string pattern)`
> - Go: `func (this *FileSystem) Find(pattern string) []string`
> - Rust: `fn find(&mut self, pattern: String) -> Vec<String>`
> - C: `char** fileSystemFind(FileSystem* obj, char* pattern, int* returnSize)`
