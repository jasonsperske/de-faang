Given a list of `words`, return how many **unique pairs of words** are anagrams of each other.

Two words are anagrams when one is a rearrangement of the other's letters: they contain the same letters, the same number of times (`"listen"` and `"silent"`).

- A pair is two **different** words. A word isn't an anagram pair with itself or with another copy of itself.
- A repeated word counts once: `["ab", "ba", "ab"]` has one pair, `("ab", "ba")`.
- Order doesn't matter: `("ab", "ba")` and `("ba", "ab")` are the same pair.

**Example**

```
words = ["listen", "silent", "enlist", "google", "elgoog", "cat"]
output: 4
```

`listen`, `silent` and `enlist` form 3 pairs, and `google`/`elgoog` form 1.

**Constraints**

- `0 <= words.length <= 10^5`
- `1 <= words[i].length <= 30`
- The answer may not fit in a 32-bit integer.
