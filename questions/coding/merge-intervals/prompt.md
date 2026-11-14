# Merge Intervals

Given an array of `intervals` where `intervals[i] = [start_i, end_i]`, merge all overlapping intervals and return an array of the non-overlapping intervals that cover all the intervals in the input.

Return the merged intervals **sorted by start**. Intervals that touch (e.g. `[1,4]` and `[4,5]`) are considered overlapping.

### Example 1
```
intervals = [[1,3],[2,6],[8,10],[15,18]]
→ [[1,6],[8,10],[15,18]]
```

### Example 2
```
intervals = [[1,4],[4,5]]
→ [[1,5]]
```

### Constraints
- `1 <= intervals.length <= 10^4`
- `0 <= start_i <= end_i <= 10^4`
- The input is **not** guaranteed to be sorted.
