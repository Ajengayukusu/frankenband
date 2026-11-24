# Spec: Melody Engine — Requirements

Feature: FRANKENBAND's deterministic chiptune melody engine. A user types
one sentence; the engine turns that text into a 16-step 8-bit melody
(square wave, A harmonic minor, 112 BPM) plus a simple noise-drum pattern.
The same text always produces the same melody; different texts produce
different melodies. The engine is pure logic — no DOM, no audio, no fetch
— so the web app and the tests can both use it unchanged.

## User stories

1. As a player typing a sentence, I get a melody that belongs to my
   sentence, so that every monster song feels personal.
2. As a player pressing play again, I hear the exact same melody for the
   same sentence, so that I can practise my theremin solo over it.
3. As a player typing a different sentence, I hear a clearly different
   melody, so that the band never repeats itself.
4. As the app developer, I get notes as MIDI numbers and frequencies plus
   a drum pattern, so that the Web Audio layer can play the melody and
   drums without knowing how the melody was generated.

## Acceptance criteria

### Hashing & seeding
- [ ] `fnv1aHash(text)` implements FNV-1a 32-bit over the UTF-8 bytes of
      the text (offset basis 2166136261, prime 16777619, unsigned 32-bit
      wrap on every step).
- [ ] `seedFromText(text)` returns the FNV-1a hash as the seed.
- [ ] Non-string input throws a `TypeError`; empty or whitespace-only
      text throws a `RangeError`.

### Melody generation
- [ ] `generateMelody(text, options)` returns an object with `seed`,
      `bpm` (default 112), `steps` (exactly 16 entries), and
      `drums` (exactly 16 entries).
- [ ] Each step is either a rest (`{ rest: true }`) or a note
      `{ midi, note, freq }` where `midi` is an integer in the A
      harmonic minor scale between A3 (57) and A5 (81) inclusive,
      `note` is its name (e.g. `"A4"`, `"G#4"`), and `freq` is the
      equal-tempered frequency in Hz for that MIDI number.
- [ ] At least 8 of the 16 steps are notes (the melody is never mostly
      silence) and at least 4 distinct pitches appear.
- [ ] `options.bpm`, when given, must be a number from 60 to 180
      inclusive, otherwise a `RangeError`; the default is 112.
- [ ] The same text always generates a deeply equal melody
      (determinism), and two different texts generate different seeds
      and different melodies.

### Notes & frequencies
- [ ] `noteToFrequency(midi)` returns `440 * 2^((midi - 69) / 12)`,
      rounded to 2 decimal places (A4 = 440.00).
- [ ] `midiToNoteName(midi)` returns the correct name with sharps
      (`"C"`, `"C#"`, `"D"`, `"D#"`, `"E"`, `"F"`, `"F#"`, `"G"`,
      `"G#"`, `"A"`, `"A#"`, `"B"`) plus the octave number
      (MIDI 69 = `"A4"`, MIDI 60 = `"C4"`, MIDI 57 = `"A3"`).
- [ ] `noteToFrequency` throws a `RangeError` for MIDI outside 0–127;
      `midiToNoteName` throws a `RangeError` for MIDI outside 0–127
      or for a non-integer.

### Drum pattern
- [ ] `generateDrumPattern(seed)` returns 16 entries, one per step,
      each `{ kick: boolean, hat: boolean }`, deterministic for the
      same seed.
- [ ] Step 0 always has a kick (the downbeat is never empty).
- [ ] The pattern contains at least 4 kicks and at least 4 hats
      across the 16 steps.

### Module shape
- [ ] `melody.js` is pure logic (no DOM, no `AudioContext`, no fetch),
      UMD: `window.FrankenbandMelody` in the browser and
      `require('../melody.js')` in Node.
- [ ] Zero dependencies. Tests use `node:test` only.
