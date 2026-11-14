Given the same kind of list, return every word that can be made by **joining two or more other words from the list**.

- Pieces can be reused: in `["a", "aa", "aaa"]`, `"aa"` is `"a" + "a"` and `"aaa"` is `"a" + "a" + "a"`.
- A word is never a piece of itself, even if the list contains it twice.
- Return each such word once, in any order.

**Example**

```
words = ["super", "superman", "man"]
output: ["superman"]
```

`"superman"` is `"super" + "man"`.

```
words = ["super", "superman", "man", "power", "manpower", "supermanpower", "cat"]
output: ["superman", "manpower", "supermanpower"]
```

`"supermanpower"` is `"super" + "man" + "power"` (or `"superman" + "power"`).

**Constraints**

- `0 <= words.length <= 10^4`
- `1 <= words[i].length <= 100`
