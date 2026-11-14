The user clicks **Accept all**. Given the original `text`, a list of suggestion `spans` (each `[start, end]`, meaning the range `[start, end)`), and `replacements` (where `replacements[i]` is the new text for `spans[i]`), return the text with the suggestions applied.

Suggestions come from different checkers and can **conflict**. They are listed in priority order, highest first:

- Go through the suggestions in order. Accept a suggestion unless it conflicts with one you have already accepted; otherwise skip it.
- Two suggestions conflict when their ranges **share a character**, or when they **start at the same index**. So an insertion conflicts with a replacement that starts at the same index or contains it, but not with one that ends there.
- All offsets refer to the **original** text, and the accepted suggestions never overlap, so the result is well defined.

**Example**

```
text         = "Their going too the park tomorow."
spans        = [[0, 5], [12, 15], [25, 32], [6, 15]]
replacements = ["They're", "to", "tomorrow", "heading to"]
output: "They're going to the park tomorrow."
```

The fourth suggestion (`"going too"` → `"heading to"`) conflicts with the second, which has higher priority, so it is skipped.

**Constraints**

- `0 <= text.length <= 10^4`
- `0 <= spans.length == replacements.length <= 1000`
- `0 <= start <= end <= text.length`
