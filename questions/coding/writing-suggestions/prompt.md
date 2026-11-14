# Writing Suggestions

A writing assistant shows suggestions on a piece of text: fix a typo, replace a word, delete a repeated word, insert a missing one. This question has **two parts** about applying those suggestions and keeping them valid while the user types.

A suggestion targets a half-open character range `[start, end)` of the text and replaces it with new text. `start == end` means an **insertion** at that index. Offsets are 0-based character indices.

When part 1 works, use **Finish part 1** to hand it in and see part 2. Your code carries over, so you can reuse anything you wrote.
