from collections import Counter
from typing import List


# Part 1
def count_anagram_pairs(words: List[str]) -> int:
    # Distinct words grouped by their sorted letters; every two words in a group form a pair.
    groups = Counter("".join(sorted(w)) for w in set(words))
    return sum(k * (k - 1) // 2 for k in groups.values())


# Part 2
def find_compound_words(words: List[str]) -> List[str]:
    dictionary = set(words)
    result = []
    for word in dict.fromkeys(words):  # each distinct word once, in input order
        n = len(word)
        # can[i]: word[:i] splits into one or more dictionary words. Pieces must be shorter
        # than the word, so a word never counts as a piece of itself.
        can = [False] * (n + 1)
        can[0] = True
        for i in range(1, n + 1):
            for j in range(i):
                if can[j] and (j > 0 or i < n) and word[j:i] in dictionary:
                    can[i] = True
                    break
        if n and can[n]:
            result.append(word)
    return result
