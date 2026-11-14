# LRU Cache

Design a data structure that follows the constraints of a **Least Recently Used (LRU) cache**.

Implement the `LRUCache` class:

- `LRUCache(capacity)` initializes the cache with a **positive** size `capacity`.
- `get(key)` returns the value of `key` if it exists, otherwise `-1`.
- `put(key, value)` updates the value of `key` if it exists. Otherwise, it adds the key-value pair. If the number of keys exceeds `capacity`, **evict the least recently used key**.

Both `get` and `put` must run in **O(1)** average time. Calling `get` or `put` on a key counts as using it.

### Example
```
ops  = ["LRUCache", "put", "put", "get", "put", "get", "put", "get", "get", "get"]
args = [[2],        [1,1], [2,2], [1],   [3,3], [2],   [4,4], [1],   [3],   [4]]
→      [null,       null,  null,  1,     null,  -1,    null,  -1,    3,     4]
```

> **Test format:** each test is a sequence of operations. The first op constructs the class; each later op calls a method with the matching args. Method names are the same in every language (`get`, `put`).
