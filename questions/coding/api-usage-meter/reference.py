from collections import defaultdict, deque


class UsageMeter:
    def __init__(self, windowSeconds):
        self.window = windowSeconds
        self.events = defaultdict(deque)  # api key -> deque of (timestamp, units), oldest first
        self.totals = defaultdict(int)  # api key -> units inside the window

    def _expire(self, key, timestamp):
        q = self.events[key]
        while q and q[0][0] <= timestamp - self.window:
            self.totals[key] -= q.popleft()[1]

    def consume(self, apiKey, timestamp, units, quota):
        self._expire(apiKey, timestamp)
        if self.totals[apiKey] + units > quota:
            return False
        self.events[apiKey].append((timestamp, units))
        self.totals[apiKey] += units
        return True

    def usage(self, apiKey, timestamp):
        self._expire(apiKey, timestamp)
        return self.totals[apiKey]
