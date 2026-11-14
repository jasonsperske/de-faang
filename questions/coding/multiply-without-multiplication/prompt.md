# Multiply Without the Multiplication Operator

Given two integers `a` and `b`, return their product `a × b`.

You may **not** use the multiplication operator (`*`), division (`/`), modulo (`%`), or any library function that multiplies, divides or raises to a power (such as `Math.imul`, `Math.pow`, `**`, `BigInteger.multiply`). Addition, subtraction, comparisons and **bitwise operators** (`&`, `|`, `^`, `~`, `<<`, `>>`) are allowed.

Aim for a running time that grows with the **number of bits** in the operands, not with their size.

**Example**

```
a = 6, b = 7
output: 42
```

```
a = -4, b = 25
output: -100
```

**Constraints**

- `-2^26 <= a, b <= 2^26`
- The product always fits in a signed 64-bit integer.
