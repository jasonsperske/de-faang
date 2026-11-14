Return an order in which every package can be built: each package must come **after** all the packages it depends on.

CI logs must be reproducible, so the order must be deterministic: whenever more than one package is ready to build (all its dependencies are already built), build the one whose name is **alphabetically smallest** first.

If the dependencies contain a cycle, no build order exists: return an empty list.

**Example**

```
packages = ["web-app", "ui-kit", "utils", "api-client", "design-tokens", "docs-site"]
deps     = [["web-app", "ui-kit"], ["web-app", "api-client"], ["ui-kit", "design-tokens"],
            ["ui-kit", "utils"], ["api-client", "utils"], ["docs-site", "ui-kit"]]
output: ["design-tokens", "utils", "api-client", "ui-kit", "docs-site", "web-app"]
```

At the start `design-tokens` and `utils` are ready, and `design-tokens` comes first alphabetically. Once `utils` is built, both `api-client` and `ui-kit` are ready.

**Constraints**

- `0 <= packages.length <= 10^4`
- `0 <= deps.length <= 5 * 10^4`
- Names are compared as plain strings (ordinal order).
