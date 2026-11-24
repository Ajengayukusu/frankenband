# Spec: Melody Engine — Design

## Architecture

One new pure-logic file, mirroring REVENANT's `pypi.js` boundary:

```
index.html ──loads──> melody.js (pure logic, window.FrankenbandMelody)
app.js     ──calls──> generateMelody(text) → steps + drums
           ──plays──> Web Audio: square-wave oscillator per note,
                      noise buffer per drum hit (all audio lives here)
           ──renders──> organ indicators, note display
```

- `melody.js` never touches the DOM, never creates audio, never
  fetches. The app feeds it plain text and gets plain data back.
- `app.js` owns all Web Audio (theremin oscillator, chiptune playback,
  drum noise, SpeechSynthesis MC voice, MediaRecorder).

## Hashing design

- FNV-1a 32-bit over UTF-8 bytes: `hash = 2166136261`, then per byte
  `hash ^= byte; hash = Math.imul(hash, 16777619) >>> 0`. UTF-8 encoding
  via `TextEncoder` in the browser and `Buffer.from(text, 'utf8')` in
  Node — both must produce identical bytes; the implementation picks
  whichever is available and the test pins the hash of `"hello"` and
  of an empty-string error path.
- Known test vectors (verified against the reference FNV-1a 32-bit):
  `fnv1aHash("")` would be the offset basis, but the empty string is
  rejected by the public API, so the vector is tested through
  `fnv1aHash("a")` = 0xe40c292c and `fnv1aHash("hello")` = 0x4f9f2cab.
  (If the implementation disagrees with these vectors, the vectors win
  — they are the standard FNV-1a 32-bit values.)
- `seedFromText(text)` is the hash itself. The PRNG is mulberry32
  seeded from it: `state = seed >>> 0`, per draw
  `state = (state + 0x6D2B79F5) >>> 0`, then the standard
  `Math.imul` scramble. Mulberry32 is small, deterministic, and good
  enough for 16 steps of melody.

## Scale design

- A harmonic minor, two octaves: A3–A5 (MIDI 57–81). Scale degrees
  (semitone offsets from A): 0, 2, 3, 5, 7, 8, 11. The allowed MIDI
  set is every A-harmonic-minor note from 57 to 81 inclusive — 15
  notes: A3 B3 C4 D4 E4 F4 G#4 A4 B4 C5 D5 E5 F5 G#5 A5.
- The melody walks the scale: start on the tonic (A4, MIDI 69) or a
  nearby scale degree drawn from the PRNG; each following step moves
  by -2, -1, 0, +1, +2 scale degrees (weighted toward small moves so
  the line sings instead of jumping), clamped to the allowed range.
  About 1 in 5 steps is a rest (drawn from the PRNG), never the first
  step, and never two rests in a row.
- The walk guarantees the acceptance criteria (≥8 notes, ≥4 distinct
  pitches) structurally: with at most one rest in any two steps and a
  16-step walk, rests are at most 5–6, so notes are at least 10; the
  walk moves on most steps, so distinct pitches are at least 4 in
  practice — the tests assert both on a spread of sample texts.

## Timing design

- Tempo is BPM for quarter notes; one melody step is a 16th note, so
  `stepSeconds = 60 / bpm / 4`. At the default 112 BPM a step is
  ~0.134 s and the whole 16-step loop is ~2.14 s.
- `melodyToEvents(melody)` converts a generated melody into a
  schedule the app can play directly: an array of 16 entries
  `{ step, startSeconds, midi, note, freq }` for notes and
  `{ step, startSeconds, rest: true }` for rests, plus the drum
  pattern aligned to the same steps. `startSeconds` is cumulative
  from 0. This function is pure (no audio) and unit-tested.

## Drum design

- `generateDrumPattern(seed)` uses its own mulberry32 stream seeded
  from `seed ^ 0x9E3779B9` (a different stream from the melody walk,
  so drums and melody do not correlate).
- Step 0 is always a kick. Kicks also land on steps 4, 8, 12 with
  probability 0.75 each (drawn), plus a 0.15 chance on any other step.
  Hats land on every odd step with probability 0.6, and on even steps
  with probability 0.15. The acceptance criteria (≥4 kicks, ≥4 hats)
  hold structurally: 1 guaranteed kick + 3 likely kicks, and ~4–5
  expected hats on odd steps alone; the tests assert both on a spread
  of seeds.

## Module design

- UMD guard, same pattern as REVENANT's `pypi.js` / `score.js`:
  `typeof module !== 'undefined' && module.exports` → Node export,
  otherwise attach to `window.FrankenbandMelody`. `'use strict'` at
  the top. A module header comment documents the hash, the scale, the
  tempo, and the pure-logic rule.
- Exported API: `fnv1aHash`, `seedFromText`, `generateMelody`,
  `generateDrumPattern`, `melodyToEvents`, `noteToFrequency`,
  `midiToNoteName`, plus constants `DEFAULT_BPM = 112`,
  `STEPS = 16`, `SCALE_NAME = 'A harmonic minor'`.

## Testing design

- `tests/melody.test.js` with node:test only (zero-dependency rule).
  No network, no audio, no DOM in tests.
- FNV-1a vectors pinned (`"a"`, `"hello"`); determinism asserted by
  generating twice from the same text and deep-comparing; different
  texts asserted to give different melodies on a spread of sample
  sentences; error paths (non-string, empty, whitespace-only, bad
  bpm, out-of-range MIDI) asserted with `assert.throws`.
- Melody shape asserted on at least 10 sample texts (16 steps, note
  range, ≥8 notes, ≥4 distinct pitches, first step a note).
- Drum pattern asserted on at least 10 seeds (16 entries, step 0
  kick, ≥4 kicks, ≥4 hats, determinism).
- `melodyToEvents` asserted: 16 entries, cumulative start times at
  112 BPM (step 15 starts at 15 × 60/112/4 seconds), rest entries
  carry no `midi`.
