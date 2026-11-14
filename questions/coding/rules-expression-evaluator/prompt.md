# Rules Expression Evaluator

An insurance underwriting platform lets analysts write pricing rules as arithmetic expressions over named inputs, for example `base_rate * (100 + risk_pct) / 100 - discount`. Write the function that evaluates one rule.

Given an `expression`, a list of variable `names` and their integer `values` (`values[i]` is the value of `names[i]`), return the value of the expression.

The expression contains:

- Non-negative integer literals, such as `7` or `1200`.
- Variables: a letter or `_`, followed by letters, digits or `_`. Every variable in the expression appears in `names`; `names` may contain variables the expression doesn't use.
- The binary operators `+`, `-`, `*` and `/`, with the usual precedence (`*` and `/` before `+` and `-`) and **left associativity** (`10 - 4 - 3` is `3`).
- Unary minus, which binds tighter than any binary operator (`-2 * 3` is `-6`, `--5` is `5`).
- Parentheses, and any amount of whitespace between tokens.

Division is **integer division that truncates toward zero**: `7 / 2` is `3` and `7 / -2` is `-3`. The expression is always valid, never divides by zero, and every intermediate value fits in a signed 32-bit integer.

You may not use your language's built-in `eval` or an expression library.

**Example**

```
expression = "base_rate * (100 + risk_pct) / 100 - discount"
names      = ["base_rate", "risk_pct", "discount"]
values     = [1200, 25, 50]
output: 1450
```

`1200 * 125 = 150000`, `/ 100` is `1500`, and `- 50` gives `1450`.

**Constraints**

- `1 <= expression.length <= 10^4`
- Parentheses nest at most 200 deep.
- `0 <= names.length == values.length <= 100`
