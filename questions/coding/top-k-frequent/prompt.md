# Top K Frequent Elements

Given an integer array `nums` and an integer `k`, return the `k` most frequent elements. You may return the answer in **any order**.

It is guaranteed that the answer is **unique** (there are no ties at the k-th position).

### Example 1
```
nums = [1,1,1,2,2,3], k = 2
→ [1, 2]
```

### Example 2
```
nums = [1], k = 1
→ [1]
```

### Constraints
- `1 <= nums.length <= 10^5`
- `k` is in the range `[1, number of distinct elements]`

**Follow-up:** can you do better than `O(n log n)`?
