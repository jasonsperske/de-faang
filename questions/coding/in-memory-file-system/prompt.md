# In-Memory File System

Build a small in-memory file system that stores **blobs of data under file paths**. This question has **three parts**, and each part adds methods to the same `FileSystem` class.

**Paths**

- A path is absolute: it starts with `/`, and its segments are separated by single `/` characters, for example `/docs/2024/notes.txt`. There is no trailing `/`, and no `.` or `..` segments.
- Segment names use lowercase letters, digits, `.`, `_` and `-`.
- `/` on its own is the root directory. Files can't be stored at `/`.

**Directories are implicit.** Writing `/a/b/c.txt` makes `/a` and `/a/b` directories. A directory exists only while at least one file is stored somewhere below it, so it disappears when its last file is removed. A path is never both a file and a directory.

Blobs are strings. A blob's size is its length in characters.

When a part works, use **Finish part N** to hand it in and see the next one. Your code carries over: keep your class and add the new methods to it.

> **Test format:** each test is a sequence of operations. The first op constructs the class; each later op calls a method with the matching args. Method names follow each language's convention: `write`/`read` in most, `Write`/`Read` in C# and Go, `fileSystemWrite` in C (the starter shows the exact names).
