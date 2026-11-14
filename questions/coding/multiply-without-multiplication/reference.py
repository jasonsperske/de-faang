def multiply(a: int, b: int) -> int:
    # Shift-and-add ("Russian peasant") on magnitudes, then restore the sign. O(log |b|).
    negative = (a < 0) != (b < 0)
    a, b = abs(a), abs(b)
    if a < b:
        a, b = b, a  # loop over the smaller operand's bits
    result = 0
    while b:
        if b & 1:
            result += a
        a <<= 1
        b >>= 1
    return -result if negative else result
