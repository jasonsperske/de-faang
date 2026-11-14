# API Usage Meter

You run a public developer API. Every API key has a quota of **units** it may use within a sliding time window (a request can cost more than one unit, for example by the size of the text it sends). Implement the meter that decides whether a request is allowed.

Implement the `UsageMeter` class:

- `UsageMeter(windowSeconds)` creates a meter with a sliding window of `windowSeconds` seconds.
- `consume(apiKey, timestamp, units, quota)` is called for each request. If the key's usage in the window **plus** `units` is at most `quota`, record the request and return `true`. Otherwise return `false` and record **nothing**.
- `usage(apiKey, timestamp)` returns the total units recorded for `apiKey` in the window ending at `timestamp`.

The window ending at `timestamp` covers the times `t` with `timestamp - windowSeconds < t <= timestamp`. So with a 60-second window, a request recorded at time 1 still counts at time 60 but not at time 61.

Timestamps are in whole seconds and **never decrease** from one call to the next (across all keys). Each call may pass a different `quota` (plans can change at any time); always use the one given.

### Example
```
ops  = ["UsageMeter", "consume",            "consume",             "consume",             "usage",       "consume",             "usage",       "usage"]
args = [[60],         ["key-a", 1, 40, 100], ["key-a", 10, 50, 100], ["key-a", 20, 30, 100], ["key-a", 30], ["key-a", 61, 30, 100], ["key-a", 61], ["key-b", 61]]
→      [null,         true,                  true,                   false,                  90,            true,                  80,            0]
```

At time 20 the key has used 90 units, so 30 more would exceed 100. At time 61 the 40 units from time 1 have left the window.

**Constraints**

- `1 <= windowSeconds <= 10^6`, `1 <= units, quota <= 10^6`, `0 <= timestamp <= 10^9`
- Up to `10^5` calls in total. Aim for amortized O(1) per call.

> **Test format:** each test is a sequence of operations. The first op constructs the class; each later op calls a method with the matching args. Method names follow each language's convention: `consume`/`usage` in most, `Consume`/`Usage` in Go (the starter shows the exact names).
