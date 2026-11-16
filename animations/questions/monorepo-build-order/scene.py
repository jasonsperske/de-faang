"""Teaching video: Monorepo Build Order & Affected Packages.

Render with ``python animations/render.py monorepo-build-order``, or preview
interactively with ``manimgl animations/questions/monorepo-build-order/scene.py``.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from defaang_anim.teaching import *  # noqa: E402,F403

# The example from the prompt, laid out left to right by build level.
POSITIONS = {
    "design-tokens": (-5.0, 1.3),
    "utils": (-5.0, -1.3),
    "ui-kit": (-1.7, 1.3),
    "api-client": (-1.7, -1.3),
    "docs-site": (1.6, 2.1),
    "web-app": (1.6, -0.1),
}
# Edges point from dependency to dependent: [a, b] in the prompt is edge b -> a.
EDGES = [
    ("design-tokens", "ui-kit"),
    ("utils", "ui-kit"),
    ("utils", "api-client"),
    ("ui-kit", "docs-site"),
    ("ui-kit", "web-app"),
    ("api-client", "web-app"),
]
BUILD_ORDER = ["design-tokens", "utils", "api-client", "ui-kit", "docs-site", "web-app"]


class PackageGraph(VGroup):
    def __init__(self, positions=POSITIONS, edges=EDGES, width=2.5):
        super().__init__()
        self.nodes: dict[str, VGroup] = {}
        self.edge_mobs: dict[tuple[str, str], Arrow] = {}
        for name, (x, y) in positions.items():
            box = RoundedRectangle(width=width, height=0.72, corner_radius=0.14, stroke_color=MUTED,
                                   stroke_width=2, fill_color="#20242C", fill_opacity=1)
            text = mono(name, 24)
            node = VGroup(box, text).move_to([x, y, 0])
            self.nodes[name] = node
        for a, b in edges:
            na, nb = self.nodes[a], self.nodes[b]
            if abs(na.get_x() - nb.get_x()) > 0.5:
                start, end = na[0].get_right(), nb[0].get_left()
            else:  # same column: go vertically
                start, end = (na[0].get_bottom(), nb[0].get_top()) if na.get_y() > nb.get_y() \
                    else (na[0].get_top(), nb[0].get_bottom())
            arrow = Arrow(start, end, buff=0.08, stroke_color=ACCENT, stroke_width=4)
            self.edge_mobs[(a, b)] = arrow
        self.edges_group = VGroup(*self.edge_mobs.values())
        self.nodes_group = VGroup(*self.nodes.values())
        self.add(self.edges_group, self.nodes_group)

    def dependents(self, name):
        return [b for (a, b) in self.edge_mobs if a == name]

    def indegree(self):
        deg = {n: 0 for n in self.nodes}
        for (_, b) in self.edge_mobs:
            deg[b] += 1
        return deg


def make_badge(n: int, node: Mobject) -> VGroup:
    circ = Circle(radius=0.22, fill_color=BG, fill_opacity=1, stroke_color=HILITE, stroke_width=2)
    num = Integer(n, font_size=24, fill_color=HILITE)
    num.move_to(circ)
    badge = VGroup(circ, num)
    badge.move_to(node[0].get_corner(UR) + 0.05 * (UP + RIGHT))
    return badge


class MonorepoBuildOrder(TeachingScene):
    question_id = "monorepo-build-order"

    def construct(self):
        self.intro()
        self.section("look", 1)
        self.words()
        self.phrases()
        self.section("pattern", 2)
        self.toposort()
        self.kahn()
        self.section("think", 3)
        self.kahn_walkthrough()
        self.why_heap()
        self.cycle()
        self.affected()
        self.section("recap")
        self.recap()

    # ------------------------------------------------------------------ intro
    def intro(self):
        with self.voiceover("intro") as vo:
            card = self.title_card("Monorepo build order", "and the packages a pull request affects", vo)
            tags = VGroup(*(pill(t, c, 24, SANS) for t, c in
                            [("graphs", ACCENT), ("topological sort", HILITE), ("heap", GOOD)]))
            tags.arrange(RIGHT, buff=0.4).next_to(card, DOWN, buff=0.8)
            self.play(LaggedStartMap(FadeIn, tags, shift=0.2 * UP, lag_ratio=0.3), run_time=1.5)

    # --------------------------------------------------------- what to look for
    def words(self):
        with self.voiceover("words") as vo:
            quote = label("package a depends on package b, so b must be built before a", 30)
            quote["depends on"].set_color(HILITE)
            quote["before"].set_color(HILITE)
            quote.to_edge(DOWN, buff=0.7)
            self.play(Write(quote), run_time=vo.fraction(0.18, 1.5))
            self.wait(vo.fraction(0.1))
            g = PackageGraph().shift(0.6 * RIGHT + 0.2 * UP)
            self.graph = g
            self.play(LaggedStartMap(FadeIn, g.nodes_group, scale=0.9, lag_ratio=0.15),
                      run_time=vo.fraction(0.2, 1.5))
            self.play(LaggedStartMap(GrowArrow, g.edges_group, lag_ratio=0.15), run_time=vo.fraction(0.2, 1.5))
            tag = label("directed graph", 28, ACCENT).next_to(g, RIGHT, buff=0.4).shift(0.8 * DOWN)
            self.play(FadeIn(tag, shift=0.2 * LEFT))
            self.quote, self.graph_tag = quote, tag

    def phrases(self):
        self.play(FadeOut(self.graph), FadeOut(self.quote), FadeOut(self.graph_tag))
        with self.voiceover("phrases") as vo:
            cards = VGroup()
            for quote, meaning, color in [
                ("“If the dependencies contain a cycle, return an empty list”",
                 "the graph may not be a DAG  →  detect cycles", BAD),
                ("“build the one whose name is alphabetically smallest first”",
                 "deterministic tie-break  →  shapes the data structure", HILITE),
            ]:
                q = label(quote, 28)
                m = label(meaning, 28, color)
                arrow = Arrow(UP, DOWN, stroke_color=color).set_height(0.6)
                cards.add(VGroup(q, arrow, m).arrange(DOWN, buff=0.25))
            cards.arrange(DOWN, buff=1.0).shift(0.2 * DOWN)
            for c in cards:
                self.play(FadeIn(c[0], shift=0.2 * UP), run_time=1.0)
                self.play(GrowArrow(c[1]), FadeIn(c[2], shift=0.2 * DOWN), run_time=vo.fraction(0.12, 1.0))
                self.wait(vo.fraction(0.18))

    # ------------------------------------------------------------ the pattern
    def toposort(self):
        g = self.graph
        with self.voiceover("toposort") as vo:
            g.to_edge(LEFT, buff=0.5).shift(0.35 * UP)
            name = label("Topological sort", 40).move_to([4.6, 1.0, 0])
            sub = label("every edge points forward", 26, MUTED).next_to(name, DOWN, buff=0.2)
            self.play(FadeIn(g), Write(name), FadeIn(sub), run_time=vo.fraction(0.2, 1.5))
            self.wait(vo.fraction(0.2))
            edge = g.edge_mobs[("utils", "api-client")]
            convention = VGroup(
                mono("edge:", 28, MUTED), mono("dependency", 28, INK),
                Arrow(LEFT, RIGHT, stroke_color=HILITE).set_width(0.9), mono("dependent", 28, INK),
            ).arrange(RIGHT, buff=0.3).to_edge(DOWN, buff=0.7)
            self.play(FadeIn(convention, shift=0.2 * UP), edge.animate.set_color(HILITE), run_time=1.0)
            self.play(FlashAround(g.nodes["utils"], color=HILITE),
                      FlashAround(g.nodes["api-client"], color=HILITE), run_time=1.2)
            self.play(edge.animate.set_color(ACCENT), run_time=0.6)
            self.topo_title = VGroup(name, sub)
            self.convention = convention

    def kahn(self):
        with self.voiceover("kahn") as vo:
            self.play(FadeOut(self.convention))
            dfs = pill("DFS post-order", MUTED, 26, SANS)
            kahn = pill("Kahn's algorithm: build whatever is ready", GOOD, 26, SANS)
            opts = VGroup(dfs, kahn).arrange(RIGHT, buff=0.6).to_edge(DOWN, buff=0.7)
            self.play(FadeIn(dfs, shift=0.2 * UP), run_time=vo.fraction(0.12, 0.8))
            self.wait(vo.fraction(0.08))
            self.play(FadeIn(kahn, shift=0.2 * UP), run_time=vo.fraction(0.12, 0.8))
            self.wait(vo.fraction(0.25))
            self.play(dfs.animate.set_opacity(0.3), kahn[0].animate.set_fill(opacity=0.3),
                      FlashAround(kahn, color=GOOD), run_time=1.2)
        self.play(FadeOut(VGroup(dfs, kahn)), FadeOut(self.topo_title))

    # -------------------------------------------------------- think it through
    def kahn_walkthrough(self):
        g = self.graph
        self.add(g)
        # Make room: graph left, heap panel right, build order along the bottom.
        self.play(g.animate.scale(0.92).to_edge(LEFT, buff=0.4), run_time=1.0)

        deg = g.indegree()
        badges = {n: make_badge(deg[n], g.nodes[n]) for n in g.nodes}
        with self.voiceover("indegree") as vo:
            title = label("in-degree = unbuilt dependencies", 26, HILITE)
            title.next_to(g, DOWN, buff=0.35).align_to(g, LEFT)
            self.play(FadeIn(title), LaggedStartMap(FadeIn, VGroup(*badges.values()), scale=0.5, lag_ratio=0.15),
                      run_time=vo.fraction(0.3, 1.5))
            ready = [n for n in g.nodes if deg[n] == 0]
            self.wait(vo.fraction(0.2))
            self.play(*(g.nodes[n][0].animate.set_stroke(GOOD, width=4) for n in ready),
                      *(Indicate(badges[n], color=GOOD) for n in ready), run_time=1.2)

        panel = RoundedRectangle(width=3.3, height=4.4, corner_radius=0.2, stroke_color=FAINT,
                                 fill_color="#111318", fill_opacity=1)
        panel.to_edge(RIGHT, buff=0.4).shift(0.5 * UP)
        panel_title = label("ready  (min-heap)", 24, MUTED).next_to(panel, UP, buff=0.15)
        order_lbl = label("build order", 24, MUTED).to_corner(DL, buff=0.5).shift(0.5 * UP)
        self.heap: list[tuple[str, VGroup]] = []
        self.order: list[VGroup] = []

        def heap_layout():
            items = sorted(self.heap, key=lambda t: t[0])
            anims = []
            for i, (_, mob) in enumerate(items):
                target = panel.get_top() + DOWN * (0.6 + 0.65 * i)
                anims.append(mob.animate.move_to(target))
            return anims

        def push(name):
            mob = pill(name, GOOD, 22)
            mob.move_to(g.nodes[name])
            self.heap.append((name, mob))
            return [TransformFromCopy(g.nodes[name][1], mob)]

        slots = VGroup(*(pill(n, ACCENT, 20) for n in BUILD_ORDER)).arrange(RIGHT, buff=0.12)
        slots.next_to(order_lbl, RIGHT, buff=0.3)

        def order_slot(i):
            return slots[i].get_center()

        def pop_and_build(run_time):
            self.heap.sort(key=lambda t: t[0])
            name, mob = self.heap.pop(0)
            node = g.nodes[name]
            self.play(FlashAround(mob, color=HILITE), run_time=0.5 * run_time)
            new_pill = pill(name, ACCENT, 20)
            new_pill.move_to(order_slot(len(self.order)))
            self.play(
                ReplacementTransform(mob, new_pill),
                node[0].animate.set_fill(GOOD, opacity=0.25).set_stroke(GOOD, width=2),
                FadeOut(badges[name]),
                *heap_layout(),
                run_time=run_time,
            )
            self.order.append(new_pill)
            freed = []
            anims = []
            for dep in g.dependents(name):
                deg[dep] -= 1
                new_num = Integer(deg[dep], font_size=24, fill_color=HILITE).move_to(badges[dep][1])
                anims += [ShowPassingFlash(g.edge_mobs[(name, dep)].copy().set_stroke(HILITE, width=8),
                                           time_width=0.6),
                          Transform(badges[dep][1], new_num)]
                if deg[dep] == 0:
                    freed.append(dep)
            if anims:
                self.play(*anims, run_time=run_time)
            if freed:
                self.play(*(g.nodes[n][0].animate.set_stroke(GOOD, width=4) for n in freed),
                          *(a for n in freed for a in push(n)), run_time=0.6 * run_time)
                self.play(*heap_layout(), run_time=0.6 * run_time)

        with self.voiceover("heap-1") as vo:
            self.play(FadeIn(panel), FadeIn(panel_title), FadeIn(order_lbl), FadeOut(title))
            self.play(*(a for n in ready for a in push(n)), run_time=1.0)
            self.play(*heap_layout(), run_time=0.8)
            self.wait(vo.fraction(0.15))
            pop_and_build(vo.fraction(0.1, 0.9))
        with self.voiceover("heap-2") as vo:
            pop_and_build(vo.fraction(0.15, 0.8))
        with self.voiceover("heap-3") as vo:
            for _ in range(4):
                pop_and_build(vo.fraction(0.05, 0.6))
            done = label("all 6 built", 26, GOOD).next_to(panel, DOWN, buff=0.3)
            self.play(FadeIn(done))

    def why_heap(self):
        self.clear_stage()
        with self.voiceover("why-heap") as vo:
            left = VGroup(
                label("List sorted once", 32, BAD),
                label("ties at the start: alphabetical", 26, MUTED),
                label("packages freed later: arrival order", 26, MUTED),
            ).arrange(DOWN, buff=0.3, aligned_edge=LEFT)
            right = VGroup(
                label("Min-heap", 32, GOOD),
                label("smallest ready name, every step", 26, MUTED),
                mono("O(log V) per push / pop", 24, MUTED),
            ).arrange(DOWN, buff=0.3, aligned_edge=LEFT)
            cols = VGroup(left, right).arrange(RIGHT, buff=1.6, aligned_edge=UP).shift(0.6 * UP)
            self.play(FadeIn(left[0]), FadeIn(left[1]), run_time=1.0)
            self.wait(vo.fraction(0.15))
            self.play(FadeIn(left[2], shift=0.2 * UP), run_time=0.8)
            self.play(left[2].animate.set_color(BAD), FlashAround(left[2], color=BAD), run_time=1.0)
            self.wait(vo.fraction(0.15))
            self.play(FadeIn(right, shift=0.2 * UP), run_time=vo.fraction(0.15, 1.0))
            example = mono("heap after utils:  [api-client, ui-kit]  ← both freed mid-run", 24, HILITE)
            example.next_to(cols, DOWN, buff=1.0)
            self.play(FadeIn(example, shift=0.2 * UP))

    def cycle(self):
        self.clear_stage()
        with self.voiceover("cycle") as vo:
            pos = {"a": (-3.6, 1.7), "b": (-1.2, -0.8), "c": (-6.0, -0.8)}
            nodes = {}
            for name, (x, y) in pos.items():
                box = RoundedRectangle(width=1.2, height=0.7, corner_radius=0.14, stroke_color=BAD,
                                       stroke_width=2, fill_color="#20242C", fill_opacity=1)
                nodes[name] = VGroup(box, mono(name, 28)).move_to([x, y, 0])
            arrows = VGroup(*(Arrow(nodes[a].get_center(), nodes[b].get_center(), buff=0.55, stroke_color=BAD)
                              for a, b in [("a", "b"), ("b", "c"), ("c", "a")]))
            badges = VGroup(*(make_badge(1, nodes[n]) for n in nodes))
            graph = VGroup(arrows, *nodes.values(), badges)
            self.play(FadeIn(graph), run_time=1.0)
            heap = RoundedRectangle(width=2.6, height=1.6, corner_radius=0.2, stroke_color=FAINT)
            heap.move_to([3.6, 1.0, 0])
            heap_lbl = label("ready: empty", 26, MUTED).move_to(heap)
            self.play(FadeIn(heap), FadeIn(heap_lbl))
            self.wait(vo.fraction(0.15))
            verdict = label("built 0 of 3  →  cycle  →  return []", 30, BAD)
            verdict.next_to(heap, DOWN, buff=0.6)
            self.play(Write(verdict), run_time=1.2)
            for _ in range(2):
                self.play(*(ShowPassingFlash(a.copy().set_stroke(HILITE, width=8), time_width=0.5)
                            for a in arrows), run_time=0.9)
            self.wait(vo.fraction(0.2))
            complexity = pill("O((V + E) log V) time · O(V + E) space", GOOD, 26, SANS)
            complexity.to_edge(DOWN, buff=0.8)
            self.play(FadeIn(complexity, shift=0.2 * UP))

    def affected(self):
        self.clear_stage()
        g = PackageGraph().scale(0.92).to_edge(LEFT, buff=0.4).shift(0.35 * UP)
        with self.voiceover("affected-direction") as vo:
            head = label("Part 2: affected packages", 32).move_to([4.7, 1.6, 0])
            self.play(FadeIn(g), Write(head), run_time=1.2)
            q = label("Which way does breakage travel?", 28, HILITE).next_to(head, DOWN, buff=0.25)
            self.play(FadeIn(q))
            self.wait(vo.fraction(0.1))
            changed = g.nodes["utils"]
            ch_lbl = label("changed", 22, CHANGE).next_to(changed, DOWN, buff=0.15)
            self.play(changed[0].animate.set_fill(CHANGE, opacity=0.35).set_stroke(CHANGE, width=4),
                      FadeIn(ch_lbl), run_time=1.0)
            for frontier in [["api-client", "ui-kit"], ["web-app", "docs-site"]]:
                anims = []
                for n in frontier:
                    for (a, b), arr in g.edge_mobs.items():
                        if b == n and a not in ("design-tokens",):
                            anims.append(arr.animate.set_color(CHANGE))
                    anims.append(g.nodes[n][0].animate.set_fill(CHANGE, opacity=0.2).set_stroke(CHANGE, width=3))
                self.play(*anims, run_time=vo.fraction(0.1, 1.0))
            safe = label("not downstream", 22, MUTED).next_to(g.nodes["design-tokens"], UP, buff=0.15)
            self.play(g.nodes["design-tokens"].animate.set_opacity(0.4), FadeIn(safe))
            self.affected_head = VGroup(head, q)

        with self.voiceover("affected-order") as vo:
            self.play(FadeOut(self.affected_head))
            call = mono("affectedPackages(changed=['utils'])", 26, MUTED)
            call.move_to([4.6, 1.0, 0])
            self.play(FadeIn(call))
            row = VGroup(*(pill(n, ACCENT, 20) for n in BUILD_ORDER)).arrange(RIGHT, buff=0.18)
            row.to_edge(DOWN, buff=0.8)
            row_lbl = label("part 1 build order", 22, MUTED).next_to(row, UP, buff=0.2).align_to(row, LEFT)
            self.play(FadeIn(row_lbl), LaggedStartMap(FadeIn, row, lag_ratio=0.1), run_time=vo.fraction(0.2, 1.2))
            self.wait(vo.fraction(0.1))
            out = row[0]
            strike = Line(out.get_left(), out.get_right(), stroke_color=BAD, stroke_width=4)
            self.play(ShowCreation(strike))
            kept = row[1:]
            self.play(FadeOut(VGroup(out, strike)), kept.animate.set_x(0), run_time=1.0)
            for p in kept:
                p[0].set_stroke(CHANGE)
            new_lbl = label("affected, in build order", 22, CHANGE).next_to(kept, UP, buff=0.2).align_to(kept, LEFT)
            self.play(FadeTransform(row_lbl, new_lbl), *(p[0].animate.set_fill(CHANGE, 0.15) for p in kept))

    # ------------------------------------------------------------------- recap
    def recap(self):
        rows = [
            ("“before”, “depends on”, “prerequisite”", "directed graph"),
            ("Need an order over that graph", "topological sort"),
            ("“ready” + a tie-break rule", "Kahn's + min-heap"),
            ("What does a change affect?", "walk edges downstream"),
        ]
        with self.voiceover("recap") as vo:
            table = VGroup()
            for signal, move in rows:
                s = label(signal, 30)
                arr = Arrow(LEFT, RIGHT, stroke_color=HILITE).set_width(1.0)
                m = label(move, 30, GOOD)
                arr.next_to(s, RIGHT, buff=0.4)
                m.next_to(arr, RIGHT, buff=0.4)
                table.add(VGroup(s, arr, m))
            table.arrange(DOWN, buff=0.6, aligned_edge=LEFT).move_to(0.4 * UP)
            head = label("When you see…  reach for", 24, MUTED).next_to(table, UP, buff=0.5).align_to(table, LEFT)
            self.play(FadeIn(head))
            for r in table:
                self.play(FadeIn(r[0], shift=0.2 * RIGHT), GrowArrow(r[1]), FadeIn(r[2]),
                          run_time=vo.fraction(0.15, 1.0))
        with self.voiceover("follow-up") as vo:
            nxt = callout("Follow-up: 8 machines, known build times. Same ready set, many pops at once.", CHANGE, 26)
            nxt.to_edge(DOWN, buff=0.8)
            self.play(FadeIn(nxt, shift=0.2 * UP), run_time=vo.fraction(0.2, 1.0))
        self.play(*map(FadeOut, self.mobjects), run_time=1.0)
