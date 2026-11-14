Implement the `FileSystem` class with:

- `FileSystem()` creates an empty file system.
- `write(path, data)` stores `data` at `path`, creating parent directories as needed, and returns `true`. If the file already exists, its data is replaced. Return `false` and change nothing if the write is impossible:
  - `path` is an existing directory, or
  - any parent of `path` is an existing file.
- `read(path)` returns the data stored at `path`, or `""` if there is no file at `path` (including when `path` is a directory).
- `remove(path)` deletes the file at `path` and returns `true`, or returns `false` if there is no file there. It never removes directories directly; a directory disappears on its own when its last file is removed.

**Example**

```
ops  = ["FileSystem", "write",                    "read",              "write",          "write",                       "read",          "remove",            "read",              "write",                "read"]
args = [[],           ["/docs/readme.md", "hello"], ["/docs/readme.md"], ["/docs", "oops"], ["/docs/readme.md/notes", "x"], ["/missing.txt"], ["/docs/readme.md"], ["/docs/readme.md"], ["/docs", "now a file"], ["/docs"]]
→      [null,         true,                       "hello",             false,            false,                         "",              true,                "",                  true,                   "now a file"]
```

`/docs` is a directory, so it can't be written; `/docs/readme.md` is a file, so nothing can go under it. Once the only file under `/docs` is removed, `/docs` no longer exists and can become a file.

**Constraints**

- Up to `10^4` operations in total. Paths have at most `100` segments and `1000` characters.
