Before the user accepts anything, they keep typing. Each keystroke batch changes the text, and the suggestions on screen must move with it (or disappear) without asking the server to re-check the whole document.

Given suggestion `spans` (each `[start, end]`, as in part 1) and a list of `edits` applied **in order**, return the updated spans, one per input span, in the same order.

Each edit is `[editStart, editEnd, insertedLength]`: the user replaced the range `[editStart, editEnd)` of the **current** text (after all earlier edits) with `insertedLength` new characters. `editStart == editEnd` is a pure insertion; `insertedLength == 0` is a pure deletion.

For each edit, update every suggestion that is still valid:

- If the suggestion ends at or before `editStart`, it is unchanged.
- Otherwise, if it starts at or after `editEnd`, shift it by the change in length.
- Otherwise it touches the edited text and is no longer valid: return it as `[-1, -1]`. A dropped suggestion stays dropped.

**Example**

```
spans = [[0, 5], [12, 15], [25, 32]]
edits = [[6, 11, 3]]            the user replaced "going" with "off"
output: [[0, 5], [10, 13], [23, 30]]
```

**Constraints**

- `0 <= spans.length <= 1000`, `0 <= edits.length <= 1000`
- Every edit is valid for the text at the time it is applied.
