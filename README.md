# FRANKENBAND — The Monster Band

> Three centuries of sound, stitched into one monster band. Type a sentence,
> hear your monster's song.

FRANKENBAND is a [Kiroween 2026](https://kiroween.devpost.com/) entry in the
**Frankenstein** category, built by Ajeng Ayu Kusuma Wardani. It stitches
three sound technologies from three incompatible centuries into one band
that plays in your browser:

1. **Theremin (1920s)** — the oldest electronic instrument. Move your
   pointer across the haunted stage: X is pitch, Y is volume. Nothing to
   touch, just the air.
2. **Chiptune 8-bit (1980s)** — type a sentence and the band turns it into
   a melody: the text is hashed (FNV-1a), the hash seeds a walk over the
   A harmonic minor scale, and the result plays as a 16-step square-wave
   loop at 112 BPM with a noise drum. The same sentence always makes the
   same song.
3. **AI voice (2020s)** — the MC announces your song with text-to-speech
   (a young female voice, picked from the voices your browser provides).

## What it does today

1. Type a sentence in **"Write your monster's song"** and press
   **Stitch it together**.
2. Press **Play the band** to hear the chiptune loop, and move your pointer
   across the stage (with **Theremin: on**) to solo over it.
3. Press **Announce the song** and the MC introduces your monster's song.
4. Press **Record the band** to capture a real take (MediaRecorder), then
   **Replay last take** to hear it back. If recording is unavailable, replay
   re-plays the melody from its seed — deterministic, so identical every
   time.
5. The three organ badges (Theremin · Chip Heart · AI Voice) light up while
   each organ is alive.

Everything runs in the browser: Web Audio API + SpeechSynthesis, no server,
no API key, no account.

## The melody engine

`melody.js` is pure logic — no DOM, no audio, no fetch — built spec-first
with Kiro (see `.kiro/specs/melody-engine/`):

- `fnv1aHash(text)` — FNV-1a 32-bit over the UTF-8 bytes.
- `generateMelody(text, options)` — 16 steps in A harmonic minor
  (MIDI 57–81), 112 BPM by default, plus a 16-step drum pattern
  (kick/hat). Guarantees: ≥8 notes, ≥4 distinct pitches, first step a
  note, step 0 always a kick, ≥4 kicks and ≥4 hats — for every text.
- `melodyToEvents(melody)` — the schedule the player consumes.
- `noteToFrequency(midi)` / `midiToNoteName(midi)` — equal temperament.

Tests: `npm test` (`node --test`, zero dependencies). 73 tests pass,
including property loops over 20,000 texts/seeds.

## Built with Kiro

The melody engine was implemented in real Kiro CLI sessions
(spec-first, from `.kiro/specs/melody-engine/`): one session built
`melody.js` + tests, two follow-up sessions fixed the acceptance-criteria
floors after independent verification over 20,000 seeds caught them
(a probabilistic drum floor, then a post-pass accounting bug). No Kiro
Crew and no MCP were used for this project.

## Live demo

https://ajengayukusu.github.io/frankenband/

## Run locally

Open `index.html` in a browser, or serve the folder with any static
server (`npx serve .`, `python3 -m http.server`, …). Audio starts only
after a click, as browsers require.
