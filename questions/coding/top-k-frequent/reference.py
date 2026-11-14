from collections import Counter


def top_k_frequent(nums, k):
    return [x for x, _ in Counter(nums).most_common(k)]
