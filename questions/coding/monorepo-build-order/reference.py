import heapq
from collections import defaultdict
from typing import List


def _graph(packages: List[str], deps: List[List[str]]):
    # Edge b -> a for "a depends on b": b must be built first. Duplicate edges are ignored.
    dependents = defaultdict(set)
    for a, b in deps:
        dependents[b].add(a)
    indegree = {p: 0 for p in packages}
    for b in dependents:
        for a in dependents[b]:
            indegree[a] += 1
    return dependents, indegree


# Part 1
def build_order(packages: List[str], deps: List[List[str]]) -> List[str]:
    # Kahn's algorithm with a min-heap so ties are broken alphabetically.
    dependents, indegree = _graph(packages, deps)
    ready = [p for p in set(packages) if indegree[p] == 0]
    heapq.heapify(ready)
    order = []
    while ready:
        p = heapq.heappop(ready)
        order.append(p)
        for a in dependents[p]:
            indegree[a] -= 1
            if indegree[a] == 0:
                heapq.heappush(ready, a)
    return order if len(order) == len(indegree) else []


# Part 2
def affected_packages(packages: List[str], deps: List[List[str]], changed: List[str]) -> List[str]:
    order = build_order(packages, deps)
    if not order:
        return []
    dependents, _ = _graph(packages, deps)
    known = set(packages)
    affected = {c for c in changed if c in known}
    stack = list(affected)
    while stack:
        p = stack.pop()
        for a in dependents[p]:
            if a not in affected:
                affected.add(a)
                stack.append(a)
    return [p for p in order if p in affected]
