from typing import List


# Part 1
def apply_suggestions(text: str, spans: List[List[int]], replacements: List[str]) -> str:
    # Accept suggestions in priority order, skipping any that conflict with one already accepted.
    # Two suggestions conflict when their ranges share a character or they start at the same index.
    accepted = []
    for (start, end), replacement in zip(spans, replacements):
        if any(start == s or (start < e and s < end) for s, e, _ in accepted):
            continue
        accepted.append((start, end, replacement))
    accepted.sort()
    out, pos = [], 0
    for start, end, replacement in accepted:
        out.append(text[pos:start])
        out.append(replacement)
        pos = end
    out.append(text[pos:])
    return "".join(out)


# Part 2
def rebase_suggestions(spans: List[List[int]], edits: List[List[int]]) -> List[List[int]]:
    result = [list(span) for span in spans]
    for edit_start, edit_end, inserted in edits:
        delta = inserted - (edit_end - edit_start)
        for span in result:
            start, end = span
            if start < 0 or end <= edit_start:
                continue  # already dropped, or entirely before the edit
            if start >= edit_end:
                span[0], span[1] = start + delta, end + delta  # entirely after: shift
            else:
                span[0], span[1] = -1, -1  # touches the edited text: no longer valid
    return result
