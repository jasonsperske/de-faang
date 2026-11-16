#!/usr/bin/env python3
"""Render teaching videos: narration audio (ElevenLabs) + manim animation + captions.

    python animations/render.py --list
    python animations/render.py multiply-without-multiplication          # 1080p
    python animations/render.py --all --quality low                       # quick drafts
    python animations/render.py monorepo-build-order --script             # print the script
    python animations/render.py monorepo-build-order --tts-only           # just the audio

Audio is rendered when ELEVENLABS_API_KEY is set (in the environment or the
repo's .env). Without it, videos render silently with the same pacing, timed
from the script's word count, plus captions, so drafts are still watchable.
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from defaang_anim.narration import (  # noqa: E402
    ANIM_ROOT, BUILD_DIR, QUESTIONS_DIR, ElevenLabsError, list_questions, load_dotenv, load_narration,
    synthesize,
)

QUALITY = {"low": ["-l"], "medium": ["-m"], "high": ["--hd"], "4k": ["--uhd"]}


def scene_class(question_id: str) -> str:
    source = (QUESTIONS_DIR / question_id / "scene.py").read_text()
    names = re.findall(r"^class (\w+)\(TeachingScene\)", source, re.M)
    if len(names) != 1:
        raise SystemExit(f"{question_id}/scene.py must define exactly one TeachingScene subclass")
    return names[0]


def manimgl_cmd() -> list[str]:
    exe = shutil.which("manimgl")
    if exe:
        return [exe]
    return [sys.executable, "-m", "manimlib"]


def render_video(question_id: str, quality: str, captions: str) -> Path:
    out_dir = BUILD_DIR / "video" / question_id
    out_dir.mkdir(parents=True, exist_ok=True)
    raw_name = f"{question_id}-raw"
    cmd = manimgl_cmd() + [
        str(QUESTIONS_DIR / question_id / "scene.py"), scene_class(question_id),
        "-w", *QUALITY[quality], "--video_dir", str(out_dir), "--file_name", raw_name,
    ]
    # manim needs an OpenGL context; on a headless Linux box, borrow a virtual display.
    if sys.platform.startswith("linux") and not os.environ.get("DISPLAY") and shutil.which("xvfb-run"):
        cmd = ["xvfb-run", "-a", "-s", "-screen 0 1920x1080x24"] + cmd
    env = dict(os.environ, DEFAANG_ANIM_OUT=str(out_dir),
               PYTHONPATH=os.pathsep.join(filter(None, [str(ANIM_ROOT), os.environ.get("PYTHONPATH")])))
    print(f"  manim {question_id} ({quality})")
    subprocess.run(cmd, check=True, env=env, cwd=ANIM_ROOT)

    raw = out_dir / f"{raw_name}.mp4"
    srt = out_dir / f"{question_id}.srt"
    final = out_dir / f"{question_id}.mp4"
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raw.replace(final)
        return final
    if captions == "burn":
        style = "FontName=Inter,FontSize=15,PrimaryColour=&H00F4EFEC,BackColour=&HA0000000,BorderStyle=4,MarginV=28"
        vf = f"subtitles={srt.name}:force_style='{style}'"
        subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-i", raw.name, "-vf", vf,
                        "-c:a", "copy", final.name], check=True, cwd=out_dir)
    elif captions == "track":
        subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-i", raw.name, "-i", srt.name,
                        "-map", "0", "-map", "1", "-c", "copy", "-c:s", "mov_text",
                        "-metadata:s:s:0", "language=eng", final.name], check=True, cwd=out_dir)
    else:
        raw.replace(final)
    raw.unlink(missing_ok=True)
    return final


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("questions", nargs="*", help="question ids (folders under animations/questions)")
    p.add_argument("--all", action="store_true", help="every question that has a narration.yaml")
    p.add_argument("--list", action="store_true", help="list videos and their script length")
    p.add_argument("--script", action="store_true", help="print the narration script as Markdown")
    p.add_argument("--quality", choices=QUALITY, default="high")
    p.add_argument("--tts-only", action="store_true", help="render narration audio, no video")
    p.add_argument("--no-tts", action="store_true", help="never call ElevenLabs (silent draft)")
    p.add_argument("--force-tts", action="store_true", help="re-render audio even if cached")
    p.add_argument("--captions", choices=["track", "burn", "none"], default="track",
                   help="subtitle track (default), burned-in captions, or none")
    args = p.parse_args()
    load_dotenv()

    if args.list:
        for q in list_questions():
            n = load_narration(q)
            print(f"{q:40} {len(n.beats):3} beats  {n.total_words():5} words  ~{n.total_words() / 150:.1f} min")
        return

    ids = list_questions() if args.all else args.questions
    if not ids:
        p.error("name at least one question, or pass --all / --list")
    unknown = [q for q in ids if q not in list_questions()]
    if unknown:
        p.error(f"no animation for: {', '.join(unknown)} (have: {', '.join(list_questions())})")

    for q in ids:
        narration = load_narration(q)
        if args.script:
            print(narration.to_markdown())
            continue
        have_key = bool(os.environ.get("ELEVENLABS_API_KEY"))
        if not args.no_tts and (have_key or args.tts_only):
            try:
                n = synthesize(narration, force=args.force_tts)
                print(f"  {q}: {n} beat(s) rendered with ElevenLabs, {len(narration.beats) - n} cached")
            except ElevenLabsError as e:
                raise SystemExit(f"error: {e}")
        elif not args.no_tts:
            print(f"  {q}: ELEVENLABS_API_KEY not set, rendering a silent draft (beats timed from word count)")
        if args.tts_only:
            continue
        final = render_video(q, args.quality, args.captions)
        print(f"  done: {final.relative_to(ANIM_ROOT.parent)}")


if __name__ == "__main__":
    main()
