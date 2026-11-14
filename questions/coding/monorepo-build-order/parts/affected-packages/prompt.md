A pull request changes some packages. CI should build and test only what the change can affect: the changed packages themselves and **every package that depends on them, directly or indirectly**. Packages that the changed ones merely depend on are not affected.

Given `packages`, `deps` and the list of `changed` package names, return the affected packages **in the build order from part 1** (that is, part 1's output with everything unaffected removed).

- `changed` may list a package more than once, and may contain names that are not in `packages` (a package deleted by the PR). Ignore those.
- If the dependencies contain a cycle, return an empty list.

**Example**

```
packages = ["web-app", "ui-kit", "utils", "api-client", "design-tokens", "docs-site"]
deps     = (same as part 1)
changed  = ["utils"]
output: ["utils", "api-client", "ui-kit", "docs-site", "web-app"]
```

Everything except `design-tokens` depends on `utils`, directly or through another package.

**Constraints**

- Same as part 1, and `0 <= changed.length <= 10^4`.
