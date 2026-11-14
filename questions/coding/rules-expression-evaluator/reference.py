from typing import List


def evaluate(expression: str, names: List[str], values: List[int]) -> int:
    variables = dict(zip(names, values))

    # Tokenize into numbers, identifiers and single-character operators.
    tokens, i = [], 0
    while i < len(expression):
        c = expression[i]
        if c.isspace():
            i += 1
        elif c.isdigit():
            j = i
            while j < len(expression) and expression[j].isdigit():
                j += 1
            tokens.append(int(expression[i:j]))
            i = j
        elif c.isalpha() or c == "_":
            j = i
            while j < len(expression) and (expression[j].isalnum() or expression[j] == "_"):
                j += 1
            tokens.append(variables[expression[i:j]])
            i = j
        else:
            tokens.append(c)
            i += 1

    pos = 0

    def peek():
        return tokens[pos] if pos < len(tokens) else None

    def take():
        nonlocal pos
        pos += 1
        return tokens[pos - 1]

    # Recursive descent: expr := term (('+'|'-') term)*, term := unary (('*'|'/') unary)*,
    # unary := '-' unary | primary, primary := number | variable | '(' expr ')'.
    def expr():
        value = term()
        while peek() in ("+", "-"):
            value = value + term() if take() == "+" else value - term()
        return value

    def term():
        value = unary()
        while peek() in ("*", "/"):
            if take() == "*":
                value *= unary()
            else:
                divisor = unary()
                quotient = abs(value) // abs(divisor)  # truncate toward zero
                value = quotient if (value < 0) == (divisor < 0) else -quotient
        return value

    def unary():
        if peek() == "-":
            take()
            return -unary()
        return primary()

    def primary():
        token = take()
        if token == "(":
            value = expr()
            take()  # ')'
            return value
        return token

    return expr()
