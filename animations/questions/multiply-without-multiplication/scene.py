"""Teaching video: Multiply Without the Multiplication Operator.

Render with ``python animations/render.py multiply-without-multiplication``, or
preview interactively with ``manimgl animations/questions/multiply-without-multiplication/scene.py``.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from defaang_anim.teaching import *  # noqa: E402,F403

REFERENCE = """
def multiply(a, b):
    negative = (a < 0) != (b < 0)
    a, b = abs(a), abs(b)
    if a < b:
        a, b = b, a      # loop over the smaller one
    result = 0
    while b:
        if b & 1:
            result += a
        a <<= 1
        b >>= 1
    return -result if negative else result
"""

LOOP = """
while b > 0:
    if b & 1:
        result += a
    a <<= 1
    b >>= 1
"""


def bits(n: int, width: int = 0) -> str:
    return format(n, "b").rjust(width, " ")


class MultiplyWithoutMultiplication(TeachingScene):
    question_id = "multiply-without-multiplication"

    def construct(self):
        self.intro()
        self.section("look", 1)
        self.constraints()
        self.target()
        self.section("pattern", 2)
        self.binary()
        self.doubling()
        self.long_multiplication()
        self.section("think", 3)
        self.loop_and_trace()
        self.pitfalls()
        self.final_code()
        self.section("recap")
        self.recap()

    # ------------------------------------------------------------------ intro
    def intro(self):
        with self.voiceover("intro") as vo:
            card = self.title_card("Multiply without  ×", "a × b using only  +  −  and bit operations", vo)
            ops = VGroup(*(mono(s, 40, MUTED) for s in ["a = 6", "b = 7", "→  42"])).arrange(RIGHT, buff=0.8)
            ops.next_to(card, DOWN, buff=0.8)
            self.play(LaggedStartMap(FadeIn, ops, shift=0.2 * UP, lag_ratio=0.4), run_time=1.5)

    # --------------------------------------------------------- what to look for
    def constraints(self):
        with self.voiceover("constraints") as vo:
            banned_title = label("Banned", 34, BAD)
            banned = VGroup(*(mono(s, 36) for s in ["*", "/", "%", "pow", "Math.imul"]))
            banned.arrange(DOWN, buff=0.35)
            banned_col = VGroup(banned_title, banned).arrange(DOWN, buff=0.5)

            allowed_title = label("Allowed", 34, GOOD)
            allowed = VGroup(*(mono(s, 36) for s in ["+   -", "&   |   ^   ~", "<<   >>", "==  <  >"]))
            allowed.arrange(DOWN, buff=0.35)
            allowed_col = VGroup(allowed_title, allowed).arrange(DOWN, buff=0.5)

            cols = VGroup(banned_col, allowed_col).arrange(RIGHT, buff=3.0, aligned_edge=UP).shift(0.3 * DOWN)
            self.play(FadeIn(banned_title), LaggedStartMap(FadeIn, banned, lag_ratio=0.2), run_time=1.5)
            crosses = VGroup(*(Line(m.get_left() + 0.15 * LEFT, m.get_right() + 0.15 * RIGHT,
                                    stroke_color=BAD, stroke_width=4) for m in banned))
            self.play(LaggedStartMap(ShowCreation, crosses, lag_ratio=0.15), run_time=1.2)
            self.wait(vo.fraction(0.12))
            self.play(FadeIn(allowed_title), LaggedStartMap(FadeIn, allowed, lag_ratio=0.2), run_time=1.5)
            self.wait(vo.fraction(0.1))
            focus = SurroundingRectangle(VGroup(allowed[1], allowed[2]), buff=0.2, stroke_color=HILITE)
            note = callout("bit operators on purpose  →  think binary")
            note.to_edge(DOWN, buff=0.6)
            self.play(ShowCreation(focus), run_time=0.8)
            self.play(FadeIn(note, shift=0.2 * UP))

    def target(self):
        self.clear_stage()
        with self.voiceover("target") as vo:
            goal = label("Running time grows with the number of bits", 36)
            goal["number of bits"].set_color(HILITE)
            goal.to_edge(UP, buff=1.2)
            self.play(Write(goal), run_time=1.5)

            left_x = -5.5
            naive_lbl = label("add a, |b| times", 28, MUTED).move_to([left_x, 0.6, 0], aligned_edge=LEFT)
            bit_lbl = label("one step per bit", 28, MUTED).move_to([left_x, -1.4, 0], aligned_edge=LEFT)
            naive_bar = Rectangle(width=0.01, height=0.45, fill_color=BAD, fill_opacity=1, stroke_width=0)
            naive_bar.move_to([left_x, 0, 0], aligned_edge=LEFT)
            bit_bar = Rectangle(width=0.01, height=0.45, fill_color=GOOD, fill_opacity=1, stroke_width=0)
            bit_bar.move_to([left_x, -2.0, 0], aligned_edge=LEFT)
            naive_n = Integer(0, font_size=34).next_to(naive_bar, RIGHT, buff=0.3)
            bit_n = Integer(0, font_size=34).next_to(bit_bar, RIGHT, buff=0.3)
            naive_n.add_updater(lambda m: m.next_to(naive_bar, RIGHT, buff=0.3))
            bit_n.add_updater(lambda m: m.next_to(bit_bar, RIGHT, buff=0.3))
            self.play(FadeIn(VGroup(naive_lbl, bit_lbl, naive_bar, bit_bar, naive_n, bit_n)))
            self.wait(vo.fraction(0.2))
            # The naive bar runs off the screen: that's the point.
            self.play(
                naive_bar.animate.stretch_to_fit_width(10.5, about_edge=LEFT),
                ChangeDecimalToValue(naive_n, 67_108_864),
                bit_bar.animate.stretch_to_fit_width(10.5 * 26 / 2000, about_edge=LEFT),
                ChangeDecimalToValue(bit_n, 26),
                run_time=vo.fraction(0.3, 2.5),
            )
            naive_n.clear_updaters()
            bit_n.clear_updaters()
            naive_n.set_color(BAD)
            bit_n.set_color(GOOD)
            self.play(Indicate(bit_n, color=GOOD))

    # ------------------------------------------------------------ the pattern
    def binary(self):
        with self.voiceover("binary") as vo:
            prod = mono("6 × 7", 56).move_to(2.2 * UP)
            self.play(FadeIn(prod, shift=0.2 * DOWN))
            digits = VGroup(*(mono(d, 72, HILITE) for d in "111")).arrange(RIGHT, buff=0.8)
            places = VGroup(*(mono(p, 30, MUTED) for p in ["4", "2", "1"]))
            for d, p in zip(digits, places):
                p.next_to(d, DOWN, buff=0.3)
            seven = mono("7 =", 56).next_to(digits, LEFT, buff=0.7)
            group = VGroup(seven, digits, places).move_to(0.3 * UP)
            self.play(FadeIn(seven), LaggedStartMap(FadeIn, digits, lag_ratio=0.3), run_time=1.2)
            self.play(LaggedStartMap(FadeIn, places, shift=0.2 * UP, lag_ratio=0.3))
            self.wait(vo.fraction(0.15))
            sum_line = mono("6 × 7  =  6×4  +  6×2  +  6×1", 44)
            sum_line.next_to(group, DOWN, buff=0.9)
            sum_line["6×4"].set_color(ACCENT)
            sum_line["6×2"].set_color(ACCENT)
            sum_line["6×1"].set_color(ACCENT)
            self.play(Write(sum_line), run_time=vo.fraction(0.25, 1.5))
            self.binary_group = VGroup(prod, group, sum_line)

    def doubling(self):
        with self.voiceover("doubling") as vo:
            self.play(FadeOut(self.binary_group[:2]), self.binary_group[2].animate.to_edge(UP, buff=1.1))
            values = [6, 12, 24]
            rows = VGroup()
            for v in values:
                dec = mono(f"{v:>2}", 48, ACCENT)
                bin_ = mono(bits(v, 5), 48, INK)
                rows.add(VGroup(dec, bin_).arrange(RIGHT, buff=1.2))
            rows.arrange(DOWN, buff=0.7, aligned_edge=RIGHT).shift(0.6 * DOWN)
            arrows = VGroup()
            for upper, lower in zip(rows[:-1], rows[1:]):
                arr = Arrow(upper.get_left() + 0.3 * LEFT, lower.get_left() + 0.3 * LEFT,
                            path_arc=PI * 0.8, stroke_color=HILITE, buff=0.1)
                tag = mono("<< 1", 26, HILITE).next_to(arr, LEFT, buff=0.15)
                arrows.add(VGroup(arr, tag))
            self.play(FadeIn(rows[0]))
            for i in range(2):
                self.play(GrowArrow(arrows[i][0]), FadeIn(arrows[i][1]),
                          TransformFromCopy(rows[i], rows[i + 1]), run_time=vo.fraction(0.18, 1.0))
            self.wait(vo.fraction(0.1))
            zeros = VGroup(rows[1][1][-1], rows[2][1][-2:])
            self.play(Indicate(zeros, color=HILITE, scale_factor=1.3), run_time=1.2)
            self.doubling_group = VGroup(rows, arrows)

    def long_multiplication(self):
        self.clear_stage()
        with self.voiceover("long-multiplication") as vo:
            head = label("Shift and add", 44).to_edge(UP, buff=1.0)
            sub = label("(Russian peasant multiplication)", 26, MUTED).next_to(head, DOWN, buff=0.2)
            self.play(Write(head), FadeIn(sub), run_time=1.2)

            w = 7
            lines = [
                ("", bits(6, w), INK),
                ("×", bits(7, w), HILITE),
            ]
            top = VGroup(*(mono(f"{op:<2}{num}", 44, col) for op, num, col in lines))
            top.arrange(DOWN, buff=0.25, aligned_edge=RIGHT)
            rule1 = Line(LEFT, RIGHT, stroke_color=MUTED).set_width(top.get_width() + 0.4)
            partials = VGroup(*(mono(f"  {bits(6 << i, w)}", 44, ACCENT) for i in range(3)))
            notes = VGroup(*(label(f"bit {i} is 1  →  6 << {i}", 24, MUTED) for i in range(3)))
            rule2 = rule1.copy()
            total = mono(f"  {bits(42, w)}", 44, GOOD)
            stack = VGroup(top, rule1, partials, rule2, total)
            for m in stack[1:]:
                m.match_x(top)
            partials.arrange(DOWN, buff=0.25, aligned_edge=RIGHT)
            stack.arrange(DOWN, buff=0.3, aligned_edge=RIGHT).move_to(0.6 * DOWN + 1.0 * LEFT)
            for n, p in zip(notes, partials):
                n.next_to(p, RIGHT, buff=0.8)
            eq = label("= 42", 40, GOOD).next_to(total, RIGHT, buff=0.8)

            self.play(FadeIn(top), ShowCreation(rule1))
            for p, n in zip(partials, notes):
                self.play(FadeIn(p, shift=0.2 * LEFT), FadeIn(n), run_time=vo.fraction(0.08, 0.8))
            self.wait(vo.fraction(0.1))
            self.play(ShowCreation(rule2), Write(total), run_time=1.2)
            self.play(FadeIn(eq, shift=0.2 * LEFT))

    # -------------------------------------------------------- think it through
    def loop_and_trace(self):
        with self.voiceover("loop") as vo:
            loop = code_block(LOOP, 36).to_edge(LEFT, buff=0.6).shift(0.2 * DOWN)
            self.play(FadeIn(loop, shift=0.2 * RIGHT), run_time=vo.fraction(0.2, 1.0))
            code = loop[1]
            # Walk the eye down the loop body as each step is named.
            for line_text in ["b & 1", "result += a", "a <<= 1", "b >>= 1"]:
                part = code[line_text]
                self.play(FlashUnder(part, color=HILITE), run_time=vo.fraction(0.12, 0.6))

        # Trace 13 × 11 in a table to the right of the loop.
        a0, b0 = 13, 11
        headers = ["a", "b (binary)", "low bit", "result"]
        col_x = [-0.6, 1.4, 3.3, 5.0]
        header_row = VGroup(*(label(h, 26, MUTED).move_to([x, 2.2, 0]) for h, x in zip(headers, col_x)))
        rule = Line([col_x[0] - 0.7, 1.85, 0], [col_x[-1] + 0.7, 1.85, 0], stroke_color=FAINT)

        with self.voiceover("trace-start"):
            problem = mono("13 × 11", 40).move_to([1.8, 3.0, 0])
            self.play(FadeIn(problem), FadeIn(header_row), ShowCreation(rule))
            eleven = mono("11 = 1011", 34, HILITE).next_to(problem, RIGHT, buff=0.6)
            self.play(FadeIn(eleven, shift=0.2 * LEFT))

        a, b, result = a0, b0, 0
        y = 1.35
        prev_row = None
        for step in range(1, 5):
            with self.voiceover(f"trace-{step}") as vo:
                bit = b & 1
                if bit:
                    result += a
                b_str = bits(b, 4)
                b_text = mono(b_str, 32)
                b_text[-1].set_color(GOOD if bit else BAD)
                row = VGroup(
                    mono(str(a), 32, ACCENT),
                    b_text,
                    mono(str(bit), 32, GOOD if bit else BAD),
                    mono(str(result) if bit else f"{result} (skip)", 32, GOOD if bit else MUTED),
                )
                for m, x in zip(row, col_x):
                    m.move_to([x, y, 0])
                if prev_row is not None:
                    self.play(prev_row.animate.set_opacity(0.45), run_time=0.4)
                self.play(LaggedStartMap(FadeIn, row, shift=0.15 * DOWN, lag_ratio=0.25),
                          run_time=vo.fraction(0.35, 1.0))
                self.play(FlashAround(row[2], color=HILITE), run_time=0.8)
                prev_row = row
                a <<= 1
                b >>= 1
                y -= 0.8
        with_total = mono("= 143", 40, GOOD).move_to([col_x[-1], y - 0.2, 0])
        self.play(FadeIn(with_total, shift=0.2 * UP), prev_row.animate.set_opacity(1))
        self.wait(0.5)

    def pitfalls(self):
        self.clear_stage()
        with self.voiceover("signs") as vo:
            head = label("Signs first", 40).to_edge(UP, buff=1.0)
            rule = mono("negative = (a < 0) != (b < 0)", 34)
            rule["!="].set_color(HILITE)
            abs_line = mono("a, b = abs(a), abs(b)", 34)
            VGroup(rule, abs_line).arrange(DOWN, buff=0.4).next_to(head, DOWN, buff=0.7)
            self.play(Write(head), run_time=0.8)
            self.play(FadeIn(rule, shift=0.2 * UP), run_time=1.0)
            self.play(FadeIn(abs_line, shift=0.2 * UP), run_time=1.0)
            self.wait(vo.fraction(0.2))

            trap = mono("-1 >> 1  ==  -1", 44, BAD)
            trap.move_to(1.6 * DOWN)
            loop_arrow = Arc(start_angle=PI / 2, angle=-1.6 * PI, radius=0.45, stroke_color=BAD,
                             stroke_width=5).add_tip()
            loop_arrow.next_to(trap, RIGHT, buff=0.5)
            warn = label("infinite loop", 28, BAD).next_to(trap, DOWN, buff=0.4)
            self.play(Write(trap), run_time=1.2)
            self.play(ShowCreation(loop_arrow), FadeIn(warn), run_time=1.0)
            self.play(Rotate(loop_arrow, -2 * PI, about_point=loop_arrow.get_center()), run_time=1.5)

        self.clear_stage()
        with self.voiceover("smaller-and-wide") as vo:
            left = VGroup(
                label("Loop over the smaller operand", 32),
                mono("O(log min(|a|, |b|))", 30, GOOD),
            ).arrange(DOWN, buff=0.35)
            right = VGroup(
                label("64-bit accumulator", 32),
                mono("2^26 × 2^26 = 2^52  >  2^31", 30, BAD),
            ).arrange(DOWN, buff=0.35)
            VGroup(left, right).arrange(DOWN, buff=1.4).shift(0.2 * DOWN)
            self.play(FadeIn(left, shift=0.2 * UP), run_time=vo.fraction(0.15, 1.0))
            self.wait(vo.fraction(0.25))
            self.play(FadeIn(right, shift=0.2 * UP), run_time=vo.fraction(0.15, 1.0))

    def final_code(self):
        self.clear_stage()
        with self.voiceover("code") as vo:
            code = code_block(REFERENCE, 28).move_to(0.1 * UP)
            self.play(FadeIn(code, shift=0.2 * UP), run_time=1.2)
            src = code[1]
            for part in ["negative = (a < 0) != (b < 0)", "a, b = abs(a), abs(b)", "a, b = b, a",
                         "result += a"]:
                self.play(FlashAround(src[part], color=HILITE), run_time=vo.fraction(0.12, 0.8))
            badge = pill("O(log n) time · O(1) space", GOOD, 26, SANS)
            badge.next_to(code, DOWN, buff=0.35)
            self.play(FadeIn(badge, shift=0.2 * LEFT))

    # ------------------------------------------------------------------- recap
    def recap(self):
        rows = [
            ("Bans an operator, allows bitwise ones", "think binary"),
            ("Target is the number of bits", "one step per bit"),
            ("Answer is a sum of doublings", "shift and add"),
        ]
        with self.voiceover("recap") as vo:
            table = VGroup()
            for signal, move in rows:
                s = label(signal, 32)
                arr = Arrow(LEFT, RIGHT, stroke_color=HILITE).set_width(1.0)
                m = label(move, 32, GOOD)
                table.add(VGroup(s, arr, m))
            for r in table:
                r[1].next_to(r[0], RIGHT, buff=0.4)
                r[2].next_to(r[1], RIGHT, buff=0.4)
            table.arrange(DOWN, buff=0.7, aligned_edge=LEFT).move_to(0.3 * UP)
            head = VGroup(label("When you see…", 24, MUTED), label("…reach for", 24, MUTED))
            head[0].next_to(table, UP, buff=0.6).align_to(table, LEFT)
            head[1].next_to(table, UP, buff=0.6).align_to(table[0][2], LEFT)
            self.play(FadeIn(head))
            for r in table:
                self.play(FadeIn(r[0], shift=0.2 * RIGHT), GrowArrow(r[1]), FadeIn(r[2]),
                          run_time=vo.fraction(0.18, 1.0))

        with self.voiceover("follow-up") as vo:
            nxt = callout("Follow-up: divide by doubling the divisor and subtracting", CHANGE, 28)
            nxt.to_edge(DOWN, buff=0.9)
            self.play(FadeIn(nxt, shift=0.2 * UP), run_time=1.0)
            demo = mono("100 ÷ 7:   7 → 14 → 28 → 56,   100 − 56 = 44 ...", 28, MUTED)
            demo.next_to(nxt, UP, buff=0.4)
            self.play(Write(demo), run_time=vo.fraction(0.4, 1.5))
        self.play(*map(FadeOut, self.mobjects), run_time=1.0)
