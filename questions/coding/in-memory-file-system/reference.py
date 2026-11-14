from collections import defaultdict
from functools import lru_cache
from typing import List


class FileSystem:
    def __init__(self):
        self.files = {}  # path -> data
        self.dirs = defaultdict(int)  # directory path -> number of files below it ("/" is implicit)

    @staticmethod
    def _ancestors(path):
        parts = path.split("/")[1:-1]
        return ["/" + "/".join(parts[: i + 1]) for i in range(len(parts))]

    # Part 1
    def write(self, path: str, data: str) -> bool:
        if path in self.dirs or any(a in self.files for a in self._ancestors(path)):
            return False
        if path not in self.files:
            for a in self._ancestors(path):
                self.dirs[a] += 1
        self.files[path] = data
        return True

    def read(self, path: str) -> str:
        return self.files.get(path, "")

    def remove(self, path: str) -> bool:
        if path not in self.files:
            return False
        del self.files[path]
        for a in self._ancestors(path):
            self.dirs[a] -= 1
            if self.dirs[a] == 0:
                del self.dirs[a]  # empty directories disappear
        return True

    # Part 2
    def find(self, pattern: str) -> List[str]:
        pat = pattern.split("/")[1:]

        def seg_match(p, s):
            @lru_cache(maxsize=None)
            def go(i, j):
                if i == len(p):
                    return j == len(s)
                if p[i] == "*":
                    return go(i + 1, j) or (j < len(s) and go(i, j + 1))
                return j < len(s) and (p[i] == "?" or p[i] == s[j]) and go(i + 1, j + 1)

            return go(0, 0)

        def path_match(segs):
            @lru_cache(maxsize=None)
            def go(i, j):
                if i == len(pat):
                    return j == len(segs)
                if pat[i] == "**":
                    return go(i + 1, j) or (j < len(segs) and go(i, j + 1))
                return j < len(segs) and seg_match(pat[i], segs[j]) and go(i + 1, j + 1)

            return go(0, 0)

        return sorted(f for f in self.files if path_match(tuple(f.split("/")[1:])))

    # Part 3
    def stats(self, path: str) -> List[int]:
        if path != "/" and path not in self.dirs:
            return [-1, -1, -1]
        prefix = "/" if path == "/" else path + "/"
        files = [d for f, d in self.files.items() if f.startswith(prefix)]
        subdirs = sum(1 for d in self.dirs if d.startswith(prefix))
        return [len(files), subdirs, sum(len(d) for d in files)]
