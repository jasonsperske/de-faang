"""Narration scripts and ElevenLabs text-to-speech.

Every video has a ``narration.yaml`` next to its ``scene.py``. The file is the
script: an ordered list of *beats*, each a short paragraph that one block of
animation plays under. This module loads those scripts, turns beats into audio
with ElevenLabs when an API key is available, and caches the audio by a hash of
the text and voice settings so re-rendering never pays for the same line twice.

Nothing here imports manim, so scripts can be checked and audio rendered in any
Python 3.10+ environment that has PyYAML.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

import yaml

ANIM_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = ANIM_ROOT.parent
QUESTIONS_DIR = ANIM_ROOT / "questions"
BUILD_DIR = ANIM_ROOT / "build"

# George, a calm narrator voice from the ElevenLabs default library. Override
# with ELEVENLABS_VOICE_ID to use any voice in your account.
DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"
DEFAULT_MODEL_ID = "eleven_multilingual_v2"
DEFAULT_VOICE_SETTINGS = {"stability": 0.5, "similarity_boost": 0.75, "style": 0.0, "speed": 1.0}

# Without audio, beats are timed from the word count at a relaxed narration pace.
WORDS_PER_SECOND = 2.6


def load_dotenv() -> None:
    """Read KEY=VALUE pairs from the repo's .env without overriding the environment."""
    path = REPO_ROOT / ".env"
    if not path.is_file():
        return
    for line in path.read_text().splitlines():
        m = re.match(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$", line)
        if not m or line.lstrip().startswith("#"):
            continue
        key, value = m.group(1), m.group(2).strip("'\"")
        if value and key not in os.environ:
            os.environ[key] = value


@dataclass(frozen=True)
class Voice:
    voice_id: str
    model_id: str
    settings: dict = field(default_factory=dict)

    @classmethod
    def from_env(cls) -> "Voice":
        load_dotenv()
        settings = dict(DEFAULT_VOICE_SETTINGS)
        if os.environ.get("ELEVENLABS_SPEED"):
            settings["speed"] = float(os.environ["ELEVENLABS_SPEED"])
        return cls(
            voice_id=os.environ.get("ELEVENLABS_VOICE_ID") or DEFAULT_VOICE_ID,
            model_id=os.environ.get("ELEVENLABS_MODEL_ID") or DEFAULT_MODEL_ID,
            settings=settings,
        )


@dataclass
class Beat:
    id: str
    section: str
    text: str
    question_id: str

    def cache_key(self, voice: Voice) -> str:
        payload = json.dumps(
            [self.text, voice.voice_id, voice.model_id, voice.settings], sort_keys=True
        )
        return hashlib.sha256(payload.encode()).hexdigest()[:12]

    def audio_path(self, voice: Voice | None = None) -> Path:
        voice = voice or Voice.from_env()
        return BUILD_DIR / "audio" / self.question_id / f"{self.id}-{self.cache_key(voice)}.mp3"

    def audio_file(self, voice: Voice | None = None) -> Path | None:
        path = self.audio_path(voice)
        return path if path.is_file() else None

    def estimated_duration(self) -> float:
        words = len(self.text.split())
        return max(1.5, words / WORDS_PER_SECOND)

    def duration(self, voice: Voice | None = None) -> float:
        audio = self.audio_file(voice)
        return probe_duration(audio) if audio else self.estimated_duration()


@dataclass
class Narration:
    question_id: str
    title: str
    beats: list[Beat]

    def beat(self, beat_id: str) -> Beat:
        for b in self.beats:
            if b.id == beat_id:
                return b
        raise KeyError(f"{self.question_id}: no beat named {beat_id!r} in narration.yaml")

    def total_words(self) -> int:
        return sum(len(b.text.split()) for b in self.beats)

    def to_markdown(self) -> str:
        lines = [f"# {self.title}", ""]
        section = None
        for b in self.beats:
            if b.section != section:
                section = b.section
                lines += [f"## {section}", ""]
            lines += [f"**{b.id}.** {b.text}", ""]
        return "\n".join(lines)


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def load_narration(question_id: str) -> Narration:
    path = QUESTIONS_DIR / question_id / "narration.yaml"
    data = yaml.safe_load(path.read_text())
    beats: list[Beat] = []
    seen: set[str] = set()
    for section in data["sections"]:
        for raw in section["beats"]:
            if raw["id"] in seen:
                raise ValueError(f"{path}: duplicate beat id {raw['id']!r}")
            seen.add(raw["id"])
            beats.append(Beat(raw["id"], section["title"], _clean(raw["text"]), question_id))
    return Narration(question_id, data["title"], beats)


def list_questions() -> list[str]:
    return sorted(
        p.name for p in QUESTIONS_DIR.iterdir() if (p / "narration.yaml").is_file()
    )


def probe_duration(path: Path) -> float:
    ffprobe = shutil.which("ffprobe")
    if not ffprobe:
        raise RuntimeError("ffprobe (part of ffmpeg) is needed to time narration audio")
    out = subprocess.run(
        [ffprobe, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(out.stdout.strip())


class ElevenLabsError(RuntimeError):
    pass


def synthesize_beat(beat: Beat, voice: Voice, api_key: str,
                    previous_text: str | None = None, next_text: str | None = None) -> Path:
    """Render one beat to MP3 via the ElevenLabs text-to-speech API."""
    path = beat.audio_path(voice)
    body: dict = {"text": beat.text, "model_id": voice.model_id, "voice_settings": voice.settings}
    # Neighbouring lines keep intonation continuous across separately rendered beats.
    if previous_text:
        body["previous_text"] = previous_text
    if next_text:
        body["next_text"] = next_text
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice.voice_id}?output_format=mp3_44100_128",
        data=json.dumps(body).encode(),
        headers={"xi-api-key": api_key, "Content-Type": "application/json", "Accept": "audio/mpeg"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            audio = resp.read()
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:500]
        raise ElevenLabsError(f"ElevenLabs returned {e.code} for beat {beat.id!r}: {detail}") from e
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".part")
    tmp.write_bytes(audio)
    tmp.replace(path)
    return path


def synthesize(narration: Narration, voice: Voice | None = None, force: bool = False,
               log=print) -> int:
    """Render every beat that has no cached audio. Returns how many were rendered."""
    load_dotenv()
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        raise ElevenLabsError("ELEVENLABS_API_KEY is not set (environment or .env)")
    voice = voice or Voice.from_env()
    rendered = 0
    for i, beat in enumerate(narration.beats):
        if beat.audio_file(voice) and not force:
            continue
        prev_text = narration.beats[i - 1].text if i > 0 else None
        next_text = narration.beats[i + 1].text if i + 1 < len(narration.beats) else None
        log(f"  tts {narration.question_id}/{beat.id} ({len(beat.text)} chars)")
        synthesize_beat(beat, voice, api_key, prev_text, next_text)
        rendered += 1
    return rendered
