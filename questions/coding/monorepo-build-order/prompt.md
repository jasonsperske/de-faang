# Monorepo Build Order

You maintain the build tooling for a frontend monorepo: a few apps and dozens of shared libraries, all in one repository. This question has **two parts**. Both take the same input:

- `packages`: the names of every package in the repo (distinct, non-empty strings).
- `deps`: a list of pairs `[a, b]`, meaning **package `a` depends on package `b`**, so `b` must be built before `a`. Both names are always in `packages`. The same pair may appear more than once.

When part 1 works, use **Finish part 1** to hand it in and see part 2. Your code carries over, so you can reuse anything you wrote.
