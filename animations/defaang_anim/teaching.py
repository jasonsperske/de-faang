"""Base scene and visual vocabulary shared by every teaching video.

A teaching video is a :class:`TeachingScene` whose ``construct`` is written as a
sequence of narrated beats::

    with self.voiceover("intro") as vo:
        self.play(Write(title), run_time=vo.fraction(0.4))

On entering the block the beat's audio (if rendered) starts playing; on leaving,
the scene waits out whatever narration is left, so animation and voice stay in
step whether or not ElevenLabs audio exists yet. Without audio, beats are timed
from their word count, so a silent draft has the same pacing as the final cut.
"""

from __future__ import annotations

import json
import os
from contextlib import contextmanager
from pathlib import Path

from manimlib import *  # noqa: F401,F403  (scenes import everything from here)
from manimlib.logger import log

from .narration import BUILD_DIR, Narration, Voice, load_narration

# ---------------------------------------------------------------- palette ---
BG = "#16181D"
INK = "#ECEFF4"
MUTED = "#8B93A1"
FAINT = "#3B414D"
ACCENT = "#5CC8FF"      # the thing we're focused on (operand a, graph edges)
HILITE = "#FFD166"      # the clue / the signal in the prompt
GOOD = "#7BD389"        # allowed, ready, correct
BAD = "#FF6B6B"         # banned, pitfall, wrong
CHANGE = "#FF9F43"      # changed / affected

SANS = "Inter"
MONO = "DejaVu Sans Mono"

# The three questions every video answers, in this order.
SECTIONS = {
    "look": "What to look for",
    "pattern": "Spot the pattern",
    "think": "Think it through",
    "recap": "Recap",
}


def label(text: str, size: int = 30, color=INK, font: str = SANS, **kw) -> Text:
    return Text(text, font=font, font_size=size, fill_color=color, **kw)


def mono(text: str, size: int = 30, color=INK, **kw) -> Text:
    return Text(text, font=MONO, font_size=size, fill_color=color, **kw)


def code_block(source: str, size: int = 24) -> VGroup:
    """Syntax-highlighted code on a dark card."""
    code = Code(source.strip("\n"), font=MONO, font_size=size, code_style="monokai")
    card = SurroundingRectangle(code, buff=0.3, fill_color="#0E1014", fill_opacity=1,
                                stroke_color=FAINT, stroke_width=1.5)
    card.round_corners(0.15)
    return VGroup(card, code)


def pill(text: str, color=ACCENT, size: int = 26, font: str = MONO) -> VGroup:
    t = Text(text, font=font, font_size=size, fill_color=INK)
    box = RoundedRectangle(width=t.get_width() + 0.45, height=t.get_height() + 0.35,
                           corner_radius=0.15, stroke_color=color, stroke_width=2.5,
                           fill_color=color, fill_opacity=0.12)
    box.move_to(t)
    return VGroup(box, t)


def callout(text: str, color=HILITE, size: int = 28) -> VGroup:
    """A short takeaway with a coloured bar on its left edge."""
    t = label(text, size=size)
    bar = Rectangle(width=0.08, height=t.get_height() + 0.3, fill_color=color,
                    fill_opacity=1, stroke_width=0)
    bar.next_to(t, LEFT, buff=0.25)
    return VGroup(bar, t)


class VoiceBeat:
    """Handle yielded by ``TeachingScene.voiceover`` for pacing animations."""

    def __init__(self, scene: "TeachingScene", start: float, duration: float):
        self.scene, self.start, self.duration = scene, start, duration

    def elapsed(self) -> float:
        return self.scene.time - self.start

    def remaining(self) -> float:
        return max(0.0, self.duration - self.elapsed())

    def fraction(self, f: float, minimum: float = 0.4) -> float:
        """A run time equal to fraction ``f`` of this beat's narration."""
        return max(minimum, f * self.duration)


class TeachingScene(Scene):
    question_id: str = ""
    # Pause after each beat so lines don't run into each other.
    beat_gap: float = 0.35
    default_camera_config = dict(background_color=BG)

    def setup(self):
        super().setup()
        self.narration: Narration = load_narration(self.question_id)
        self.voice = Voice.from_env()
        self.used_beats: list[str] = []
        self.captions: list[tuple[float, float, str]] = []
        self.section_tag: Mobject | None = None

    # -------------------------------------------------------- narration ---
    @contextmanager
    def voiceover(self, beat_id: str):
        beat = self.narration.beat(beat_id)
        self.used_beats.append(beat_id)
        audio = beat.audio_file(self.voice)
        duration = beat.duration(self.voice)
        start = self.time
        if audio:
            self.add_sound(str(audio))
        yield VoiceBeat(self, start, duration)
        left = start + duration + self.beat_gap - self.time
        if left > 0:
            self.wait(left)
        self.captions.append((start, start + duration, beat.text))

    # ---------------------------------------------------------- framing ---
    def section(self, key: str, number: int | None = None):
        """Full-screen section card that then shrinks to a tag in the corner."""
        title = SECTIONS.get(key, key)
        heading = label(title, size=64)
        if number is not None:
            num = label(f"{number}", size=40, color=HILITE)
            num.next_to(heading, UP, buff=0.3)
            card = VGroup(num, heading)
        else:
            card = VGroup(heading)
        card.move_to(ORIGIN)
        old = [m for m in self.mobjects if m is not self.section_tag]
        anims = [FadeOut(m) for m in old]
        if self.section_tag is not None:
            anims.append(FadeOut(self.section_tag))
        if anims:
            self.play(*anims, run_time=0.6)
        self.play(FadeIn(card, shift=0.3 * UP), run_time=0.8)
        self.wait(0.5)
        tag_text = f"{number} · {title}" if number is not None else title
        tag = label(tag_text, size=24, color=MUTED).to_corner(UL, buff=0.45)
        self.play(FadeTransform(card, tag), run_time=0.8)
        self.section_tag = tag

    def clear_stage(self, run_time: float = 0.6):
        """Fade out everything except the section tag."""
        mobs = [m for m in self.mobjects if m is not self.section_tag]
        if mobs:
            self.play(*map(FadeOut, mobs), run_time=run_time)

    def title_card(self, title: str, subtitle: str, vo: VoiceBeat):
        t = label(title, size=60)
        s = label(subtitle, size=30, color=MUTED)
        s.next_to(t, DOWN, buff=0.4)
        rule = Line(LEFT, RIGHT, stroke_color=HILITE, stroke_width=3)
        rule.set_width(t.get_width() * 0.4).next_to(s, DOWN, buff=0.45)
        self.play(Write(t), run_time=vo.fraction(0.25, 1.0))
        self.play(FadeIn(s, shift=0.2 * UP), ShowCreation(rule), run_time=1.0)
        return VGroup(t, s, rule)

    # --------------------------------------------------------- teardown ---
    def tear_down(self):
        unused = [b.id for b in self.narration.beats if b.id not in self.used_beats]
        if unused and not self.skip_animations:
            log.warning("%s: narration beats never played: %s", self.question_id, ", ".join(unused))
        self._write_captions()
        super().tear_down()

    def _write_captions(self):
        out_dir = Path(os.environ.get("DEFAANG_ANIM_OUT") or BUILD_DIR / "video" / self.question_id)
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / f"{self.question_id}.srt").write_text(to_srt(self.captions))
        (out_dir / f"{self.question_id}.timeline.json").write_text(json.dumps(
            [{"start": round(s, 3), "end": round(e, 3), "text": t} for s, e, t in self.captions],
            indent=2,
        ))


def _srt_time(t: float) -> str:
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def to_srt(captions: list[tuple[float, float, str]], max_chars: int = 84) -> str:
    """Split each beat into caption-sized chunks, timed by their share of characters."""
    blocks: list[str] = []
    n = 0
    for start, end, text in captions:
        chunks: list[str] = []
        cur = ""
        for word in text.split():
            if cur and len(cur) + 1 + len(word) > max_chars:
                chunks.append(cur)
                cur = word
            else:
                cur = f"{cur} {word}".strip()
        if cur:
            chunks.append(cur)
        total = sum(len(c) for c in chunks) or 1
        t = start
        for c in chunks:
            dt = (end - start) * len(c) / total
            n += 1
            blocks.append(f"{n}\n{_srt_time(t)} --> {_srt_time(t + dt)}\n{c}\n")
            t += dt
    return "\n".join(blocks)
