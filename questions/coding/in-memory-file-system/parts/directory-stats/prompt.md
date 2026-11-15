Now implement directory statistics:

- `stats(path)` returns `[files, directories, bytes]` for the directory at `path`, counting everything **below** it at any depth:
  - `files`: the number of files below `path`.
  - `directories`: the number of directories below `path` (not counting `path` itself).
  - `bytes`: the total size of the files below `path`.
- `stats("/")` describes the whole file system, and is `[0, 0, 0]` when it is empty.
- If `path` is not an existing directory (it doesn't exist, or it is a file), return `[-1, -1, -1]`.

**Example**

```
files: /src/app.js ("a")  /src/lib/util.js ("b")  /src/lib/deep/helpers.js ("c")
       /docs/readme.md ("d")  /docs/guide.md ("e")  /notes.txt ("f")

stats("/")               → [6, 4, 6]     directories: /src, /src/lib, /src/lib/deep, /docs
stats("/src")            → [3, 2, 3]
stats("/src/lib/deep")   → [1, 0, 1]
stats("/docs/readme.md") → [-1, -1, -1]  a file, not a directory
stats("/missing")        → [-1, -1, -1]
```

Stats must stay correct as files are written, overwritten and removed.

**Constraints**

- Up to `10^4` operations in total. Dashboards call `stats` far more often than files change, so think about what each call costs.
