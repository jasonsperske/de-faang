# Teaching animations

Short narrated videos that teach how to approach a question, made with
[3Blue1Brown's manim](https://github.com/3b1b/manim) and narrated with
[ElevenLabs](https://elevenlabs.io). Each video answers the same three things,
in this order:

1. **What to look for**: the words and constraints in the prompt that give the problem away.
2. **Spot the pattern**: how those signals map to a named technique, and why that one.
3. **Think it through**: building the solution step by step on a worked example, then the pitfalls interviewers watch for.

It ends with a recap of signal → technique pairs to carry into other problems, and the likely follow-up.

| Video | Question | Length |
| --- | --- | --- |
| Multiply without the multiplication operator | [`multiply-without-multiplication`](../questions/coding/multiply-without-multiplication) | ~4.5 min |
| Monorepo build order and affected packages | [`monorepo-build-order`](../questions/coding/monorepo-build-order) | ~5 min |

## Setup

You need Python 3.10+, ffmpeg, and Pango (for text). No LaTeX: the scenes use `Text` only.

```bash
# macOS
brew install ffmpeg pango pkg-config
# Debian/Ubuntu (add xvfb on a headless machine)
sudo apt install ffmpeg libpango1.0-dev pkg-config xvfb

python3 -m venv .venv-anim && source .venv-anim/bin/activate
pip install -r animations/requirements.txt
```

For narration, add your ElevenLabs key to the repo's `.env` (see `.env.example`):

```
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=JBFqnCBsd6RMkjVDRZzb   # optional; any voice id from your account
```

## Rendering

```bash
python animations/render.py --list                                  # videos, beats, script length
python animations/render.py multiply-without-multiplication          # 1080p with narration
python animations/render.py --all --quality low                      # quick 480p drafts
python animations/render.py monorepo-build-order --script            # print the narration script
python animations/render.py monorepo-build-order --tts-only          # just render the audio
python animations/render.py monorepo-build-order --captions burn     # captions burned into the picture
```

Output goes to `animations/build/video/<id>/<id>.mp4`, with a subtitle track,
a `.srt` sidecar, and a `.timeline.json` of when each beat starts.

**Without an API key** the video renders silently with exactly the same pacing:
each beat is timed from its word count (about 156 words per minute), so you can
review drafts and edit the script before paying for audio. With a key, each beat
is rendered once and cached in `animations/build/audio/` under a hash of its
text and voice settings; changing one line re-renders only that line.

To iterate on a scene interactively, run manim directly:

```bash
manimgl animations/questions/monorepo-build-order/scene.py MonorepoBuildOrder
```

## How it fits together

```
animations/
  render.py                      CLI: ElevenLabs audio → manim render → captions
  defaang_anim/
    narration.py                 loads narration.yaml, ElevenLabs TTS, audio cache (no manim import)
    teaching.py                  TeachingScene base class, palette, section cards, helpers
  questions/<question-id>/
    narration.yaml               the script: sections of beats, each one paragraph of voiceover
    scene.py                     one TeachingScene subclass that animates each beat
```

The script and the animation are joined by beat ids. In `scene.py`:

```python
with self.voiceover("binary") as vo:
    self.play(Write(sum_line), run_time=vo.fraction(0.25))
```

Entering the block starts that beat's audio; leaving it waits out whatever
narration is left, so the picture never runs ahead of or behind the voice.
`vo.fraction(f)` sizes an animation as a share of the beat, so timings still
work when the real audio is a little longer or shorter than the estimate. The
render warns if a beat in `narration.yaml` is never played.

## Adding a video

1. Create `animations/questions/<question-id>/` using the question's id from `questions/`.
2. Write `narration.yaml`: sections *What to look for*, *Spot the pattern*, *Think it through*, *Recap*. Draw the content from the question's `question.json`: `interviewer.approach` for the solution, `hints` for the path to it, `pitfalls` and `ai.watchFor` for the mistakes. Keep beats to 1–4 sentences, and write numbers the way they should be spoken.
3. Write `scene.py` with one `TeachingScene` subclass (`question_id` set to the folder name) that calls `self.section(...)` and plays one `voiceover` block per beat. Copy an existing scene for the shape.
4. Render a low-quality silent draft, watch it, adjust, then render with narration.

## Why 3b1b manim and not Manim Community

This uses 3Blue1Brown's own manim (`manimgl`), as requested. The community fork
(ManimCE) has more documentation and the
[manim-voiceover](https://github.com/ManimCommunity/manim-voiceover) plugin with
a ready-made ElevenLabs service, which would have replaced
`defaang_anim/narration.py` and the `voiceover` helper. manimgl renders with
OpenGL (fast, and `manimgl` gives a live interactive preview) but needs a GPU
context, so headless Linux renders go through `xvfb-run`, which `render.py`
adds automatically. The PyPI release (1.7.2) is broken on current Python, so
`requirements.txt` pins a commit from GitHub.
