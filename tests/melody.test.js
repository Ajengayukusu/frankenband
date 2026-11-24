'use strict';
/**
 * tests/melody.test.js — node:test only, zero external dependencies.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const M = require('../melody.js');

// ── Helpers ──────────────────────────────────────────────────────────────────

const SAMPLE_TEXTS = [
  'hello',
  'The monster woke at midnight',
  'frankenstein is alive',
  'lightning bolt',
  'stitched from many parts',
  'theremin solo',
  'chiptune goes beep boop',
  'organ pipes and darkness',
  'kiroween two thousand and twenty six',
  'the band plays on forever',
  'electric sparks in the lab',
  'igor fetch me that brain'
];

// ── Constants ─────────────────────────────────────────────────────────────────

describe('constants', () => {
  it('DEFAULT_BPM is 112', () => {
    assert.equal(M.DEFAULT_BPM, 112);
  });
  it('STEPS is 16', () => {
    assert.equal(M.STEPS, 16);
  });
  it('SCALE_NAME is A harmonic minor', () => {
    assert.equal(M.SCALE_NAME, 'A harmonic minor');
  });
});

// ── fnv1aHash ─────────────────────────────────────────────────────────────────

describe('fnv1aHash', () => {
  it('vector: "a" = 0xe40c292c', () => {
    assert.equal(M.fnv1aHash('a'), 0xe40c292c);
  });
  it('vector: "hello" = 0x4f9f2cab', () => {
    assert.equal(M.fnv1aHash('hello'), 0x4f9f2cab);
  });
  it('returns an unsigned 32-bit integer', () => {
    const h = M.fnv1aHash('test');
    assert.ok(Number.isInteger(h) && h >= 0 && h <= 0xFFFFFFFF);
  });
  it('throws TypeError for non-string input', () => {
    assert.throws(() => M.fnv1aHash(42), TypeError);
    assert.throws(() => M.fnv1aHash(null), TypeError);
    assert.throws(() => M.fnv1aHash(undefined), TypeError);
    assert.throws(() => M.fnv1aHash(['hello']), TypeError);
  });
  it('different strings produce different hashes (spread of inputs)', () => {
    const hashes = SAMPLE_TEXTS.map(t => M.fnv1aHash(t));
    const unique = new Set(hashes);
    assert.equal(unique.size, hashes.length, 'all sample texts must hash differently');
  });
});

// ── seedFromText ──────────────────────────────────────────────────────────────

describe('seedFromText', () => {
  it('returns the FNV-1a hash of the text', () => {
    for (const t of SAMPLE_TEXTS) {
      assert.equal(M.seedFromText(t), M.fnv1aHash(t));
    }
  });
  it('throws TypeError for non-string input', () => {
    assert.throws(() => M.seedFromText(123), TypeError);
    assert.throws(() => M.seedFromText(null), TypeError);
  });
  it('throws RangeError for empty string', () => {
    assert.throws(() => M.seedFromText(''), RangeError);
  });
  it('throws RangeError for whitespace-only string', () => {
    assert.throws(() => M.seedFromText('   '), RangeError);
    assert.throws(() => M.seedFromText('\t\n'), RangeError);
  });
});

// ── noteToFrequency ───────────────────────────────────────────────────────────

describe('noteToFrequency', () => {
  it('A4 (MIDI 69) = 440.00', () => {
    assert.equal(M.noteToFrequency(69), 440.00);
  });
  it('A3 (MIDI 57) ≈ 220.00', () => {
    assert.equal(M.noteToFrequency(57), 220.00);
  });
  it('A5 (MIDI 81) ≈ 880.00', () => {
    assert.equal(M.noteToFrequency(81), 880.00);
  });
  it('result is rounded to 2 decimal places', () => {
    // C4 (MIDI 60) = 440 * 2^(-9/12) ≈ 261.63
    const f = M.noteToFrequency(60);
    assert.ok(Number.isFinite(f));
    assert.equal(f, Math.round(f * 100) / 100);
  });
  it('throws RangeError for MIDI < 0', () => {
    assert.throws(() => M.noteToFrequency(-1), RangeError);
  });
  it('throws RangeError for MIDI > 127', () => {
    assert.throws(() => M.noteToFrequency(128), RangeError);
  });
  it('throws RangeError for non-number', () => {
    assert.throws(() => M.noteToFrequency('69'), RangeError);
  });
});

// ── midiToNoteName ────────────────────────────────────────────────────────────

describe('midiToNoteName', () => {
  it('MIDI 69 = "A4"', () => {
    assert.equal(M.midiToNoteName(69), 'A4');
  });
  it('MIDI 60 = "C4"', () => {
    assert.equal(M.midiToNoteName(60), 'C4');
  });
  it('MIDI 57 = "A3"', () => {
    assert.equal(M.midiToNoteName(57), 'A3');
  });
  it('MIDI 61 = "C#4"', () => {
    assert.equal(M.midiToNoteName(61), 'C#4');
  });
  it('MIDI 0 = "C-1"', () => {
    assert.equal(M.midiToNoteName(0), 'C-1');
  });
  it('MIDI 127 = "G9"', () => {
    assert.equal(M.midiToNoteName(127), 'G9');
  });
  it('throws RangeError for MIDI < 0', () => {
    assert.throws(() => M.midiToNoteName(-1), RangeError);
  });
  it('throws RangeError for MIDI > 127', () => {
    assert.throws(() => M.midiToNoteName(128), RangeError);
  });
  it('throws RangeError for non-integer (float)', () => {
    assert.throws(() => M.midiToNoteName(69.5), RangeError);
  });
  it('throws RangeError for non-number', () => {
    assert.throws(() => M.midiToNoteName('A4'), RangeError);
  });
});

// ── generateMelody ────────────────────────────────────────────────────────────

// A harmonic minor MIDI set 57–81
const A_HARMONIC_MINOR_MIDI = new Set();
const SCALE_DEGREES = [0, 2, 3, 5, 7, 8, 11];
for (let midi = 57; midi <= 81; midi++) {
  const semitone = ((midi - 57) % 12 + 12) % 12;
  if (SCALE_DEGREES.includes(semitone)) A_HARMONIC_MINOR_MIDI.add(midi);
}

describe('generateMelody — shape', () => {
  for (const text of SAMPLE_TEXTS) {
    it(`"${text}" produces valid melody`, () => {
      const mel = M.generateMelody(text);

      // top-level shape
      assert.equal(typeof mel.seed, 'number');
      assert.equal(mel.bpm, M.DEFAULT_BPM);
      assert.equal(mel.steps.length, M.STEPS);
      assert.equal(mel.drums.length, M.STEPS);

      // step 0 is never a rest
      assert.ok(!mel.steps[0].rest, 'step 0 must be a note');

      // no two rests in a row
      for (let s = 1; s < mel.steps.length; s++) {
        if (mel.steps[s].rest) {
          assert.ok(!mel.steps[s - 1].rest, `steps ${s-1} and ${s} are both rests`);
        }
      }

      const notes = mel.steps.filter(s => !s.rest);
      const rests = mel.steps.filter(s => s.rest);

      // at least 8 notes
      assert.ok(notes.length >= 8, `only ${notes.length} notes (need ≥ 8)`);

      // all notes in A harmonic minor 57–81
      for (const n of notes) {
        assert.ok(Number.isInteger(n.midi), 'midi must be integer');
        assert.ok(A_HARMONIC_MINOR_MIDI.has(n.midi),
          `midi ${n.midi} not in A harmonic minor 57–81`);
        assert.equal(n.note, M.midiToNoteName(n.midi));
        assert.equal(n.freq, M.noteToFrequency(n.midi));
      }

      // at least 4 distinct pitches
      const distinct = new Set(notes.map(n => n.midi));
      assert.ok(distinct.size >= 4, `only ${distinct.size} distinct pitches (need ≥ 4)`);
    });
  }
});

describe('generateMelody — determinism', () => {
  it('same text produces deeply equal melody twice', () => {
    for (const text of SAMPLE_TEXTS) {
      const a = M.generateMelody(text);
      const b = M.generateMelody(text);
      assert.deepEqual(a, b);
    }
  });
  it('different texts produce different seeds', () => {
    const seeds = SAMPLE_TEXTS.map(t => M.generateMelody(t).seed);
    assert.equal(new Set(seeds).size, seeds.length);
  });
  it('different texts produce different step arrays', () => {
    const melodies = SAMPLE_TEXTS.map(t => M.generateMelody(t).steps);
    for (let i = 0; i < melodies.length; i++) {
      for (let j = i + 1; j < melodies.length; j++) {
        const same = JSON.stringify(melodies[i]) === JSON.stringify(melodies[j]);
        assert.ok(!same, `texts[${i}] and texts[${j}] produced identical step arrays`);
      }
    }
  });
});

describe('generateMelody — options.bpm', () => {
  it('respects custom bpm', () => {
    const mel = M.generateMelody('hello', { bpm: 120 });
    assert.equal(mel.bpm, 120);
  });
  it('throws RangeError for bpm < 60', () => {
    assert.throws(() => M.generateMelody('hello', { bpm: 59 }), RangeError);
  });
  it('throws RangeError for bpm > 180', () => {
    assert.throws(() => M.generateMelody('hello', { bpm: 181 }), RangeError);
  });
  it('throws RangeError for non-number bpm', () => {
    assert.throws(() => M.generateMelody('hello', { bpm: '120' }), RangeError);
  });
});

describe('generateMelody — input error paths', () => {
  it('throws TypeError for non-string input', () => {
    assert.throws(() => M.generateMelody(42), TypeError);
    assert.throws(() => M.generateMelody(null), TypeError);
  });
  it('throws RangeError for empty string', () => {
    assert.throws(() => M.generateMelody(''), RangeError);
  });
  it('throws RangeError for whitespace-only string', () => {
    assert.throws(() => M.generateMelody('   '), RangeError);
  });
});

// ── generateDrumPattern ───────────────────────────────────────────────────────

const DRUM_SEEDS = [0, 1, 42, 100, 999, 0xDEADBEEF, 0x12345678,
                    M.fnv1aHash('hello'), M.fnv1aHash('kiroween'),
                    M.fnv1aHash('the monster woke at midnight')];

describe('generateDrumPattern — shape', () => {
  for (const seed of DRUM_SEEDS) {
    it(`seed ${seed} produces valid drum pattern`, () => {
      const pat = M.generateDrumPattern(seed);

      assert.equal(pat.length, M.STEPS);

      // step 0 always has a kick
      assert.equal(pat[0].kick, true, 'step 0 must have a kick');

      // each entry has kick and hat booleans
      for (const entry of pat) {
        assert.equal(typeof entry.kick, 'boolean');
        assert.equal(typeof entry.hat, 'boolean');
      }

      // at least 4 kicks
      const kicks = pat.filter(e => e.kick).length;
      assert.ok(kicks >= 4, `only ${kicks} kicks (need ≥ 4)`);

      // at least 4 hats
      const hats = pat.filter(e => e.hat).length;
      assert.ok(hats >= 4, `only ${hats} hats (need ≥ 4)`);
    });
  }
});

describe('generateDrumPattern — determinism', () => {
  it('same seed produces identical pattern', () => {
    for (const seed of DRUM_SEEDS) {
      assert.deepEqual(M.generateDrumPattern(seed), M.generateDrumPattern(seed));
    }
  });
  it('different seeds produce different patterns', () => {
    const patterns = DRUM_SEEDS.map(s => JSON.stringify(M.generateDrumPattern(s)));
    const unique = new Set(patterns);
    assert.ok(unique.size > DRUM_SEEDS.length * 0.8,
      'most seeds should produce distinct drum patterns');
  });
});

// ── melodyToEvents ────────────────────────────────────────────────────────────

describe('melodyToEvents', () => {
  it('returns 16 events', () => {
    const mel = M.generateMelody('hello');
    const events = M.melodyToEvents(mel);
    assert.equal(events.length, M.STEPS);
  });

  it('step numbers are 0..15 in order', () => {
    const mel = M.generateMelody('hello');
    const events = M.melodyToEvents(mel);
    for (let s = 0; s < M.STEPS; s++) {
      assert.equal(events[s].step, s);
    }
  });

  it('cumulative startSeconds at 112 BPM: step 0 = 0, step 15 ≈ 15 × 60/112/4', () => {
    const mel = M.generateMelody('hello');
    const events = M.melodyToEvents(mel);
    const stepSec = 60 / 112 / 4;

    assert.equal(events[0].startSeconds, 0);
    assert.ok(
      Math.abs(events[15].startSeconds - 15 * stepSec) < 1e-10,
      `step 15 startSeconds mismatch: ${events[15].startSeconds} vs ${15 * stepSec}`
    );
  });

  it('rest events have rest:true and no midi', () => {
    // Use many texts until we find one with a rest, then verify
    for (const text of SAMPLE_TEXTS) {
      const mel = M.generateMelody(text);
      const events = M.melodyToEvents(mel);
      for (let s = 0; s < M.STEPS; s++) {
        if (mel.steps[s].rest) {
          assert.equal(events[s].rest, true);
          assert.equal(events[s].midi, undefined);
        }
      }
    }
  });

  it('note events carry midi, note, freq', () => {
    for (const text of SAMPLE_TEXTS) {
      const mel = M.generateMelody(text);
      const events = M.melodyToEvents(mel);
      for (let s = 0; s < M.STEPS; s++) {
        if (!mel.steps[s].rest) {
          assert.ok(typeof events[s].midi === 'number');
          assert.ok(typeof events[s].note === 'string');
          assert.ok(typeof events[s].freq === 'number');
        }
      }
    }
  });

  it('respects custom bpm in timing', () => {
    const mel = M.generateMelody('hello', { bpm: 120 });
    const events = M.melodyToEvents(mel);
    const stepSec = 60 / 120 / 4;
    assert.ok(
      Math.abs(events[8].startSeconds - 8 * stepSec) < 1e-10,
      'step 8 startSeconds should match 120 BPM'
    );
  });
});

// ── Pinned regression cases ───────────────────────────────────────────────────
// Seeds 482 and 19488 (texts "sentence number 482" / "sentence number 19488")
// previously produced only 3 distinct pitches due to a post-pass bug where
// the replaced step's old pitch was not removed from the occurrence count,
// causing distinctCount to be incremented even when no net new pitch was added.

describe('regression: seeds 482 and 19488 — post-pass bug', () => {
  it('"sentence number 482" has ≥ 4 distinct pitches', () => {
    const mel = M.generateMelody('sentence number 482');
    const notes = mel.steps.filter(s => !s.rest);
    const distinct = new Set(notes.map(n => n.midi)).size;
    assert.ok(distinct >= 4,
      `only ${distinct} distinct pitches (need ≥ 4)`);
  });
  it('"sentence number 19488" has ≥ 4 distinct pitches', () => {
    const mel = M.generateMelody('sentence number 19488');
    const notes = mel.steps.filter(s => !s.rest);
    const distinct = new Set(notes.map(n => n.midi)).size;
    assert.ok(distinct >= 4,
      `only ${distinct} distinct pitches (need ≥ 4)`);
  });
});

// ── Property-style loops — 20000 seeds / texts ───────────────────────────────

describe('property: generateMelody over 20000 texts', () => {
  it('16 steps, ≥8 notes, ≥4 distinct pitches, step 0 is note, deterministic', () => {
    for (let i = 0; i < 20000; i++) {
      const text = 'sentence number ' + i;
      const mel  = M.generateMelody(text);
      const mel2 = M.generateMelody(text);

      assert.equal(mel.steps.length, 16, `text ${i}: step count`);

      const notes = mel.steps.filter(s => !s.rest);
      assert.ok(notes.length >= 8,
        `text ${i}: only ${notes.length} notes (need ≥ 8)`);

      const distinct = new Set(notes.map(n => n.midi)).size;
      assert.ok(distinct >= 4,
        `text ${i}: only ${distinct} distinct pitches (need ≥ 4)`);

      assert.ok(!mel.steps[0].rest,
        `text ${i}: step 0 must be a note`);

      assert.deepEqual(mel.steps, mel2.steps,
        `text ${i}: generateMelody not deterministic`);
    }
  });
});

describe('property: generateDrumPattern over 20000 seeds', () => {
  it('16 steps, step 0 kick, ≥4 kicks, ≥4 hats, deterministic', () => {
    for (let seed = 0; seed < 20000; seed++) {
      const pat  = M.generateDrumPattern(seed);
      const pat2 = M.generateDrumPattern(seed);

      assert.equal(pat.length, 16, `seed ${seed}: step count`);

      assert.equal(pat[0].kick, true,
        `seed ${seed}: step 0 must be a kick`);

      const kicks = pat.filter(e => e.kick).length;
      assert.ok(kicks >= 4,
        `seed ${seed}: only ${kicks} kicks (need ≥ 4)`);

      const hats = pat.filter(e => e.hat).length;
      assert.ok(hats >= 4,
        `seed ${seed}: only ${hats} hats (need ≥ 4)`);

      assert.deepEqual(pat, pat2,
        `seed ${seed}: generateDrumPattern not deterministic`);
    }
  });
});
