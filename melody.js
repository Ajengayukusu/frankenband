'use strict';
/**
 * melody.js — FRANKENBAND Melody Engine
 *
 * Hash:   FNV-1a 32-bit (offset basis 2166136261, prime 16777619)
 * Scale:  A harmonic minor, A3–A5 (MIDI 57–81), 15 pitches
 * Tempo:  Default 112 BPM; one step = 16th note (60/bpm/4 seconds)
 * Rule:   Pure logic only — no DOM, no AudioContext, no fetch, no I/O.
 *         Feed it text, get back plain data. Everything else lives in app.js.
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.FrankenbandMelody = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  // ── Constants ──────────────────────────────────────────────────────────────

  var DEFAULT_BPM = 112;
  var STEPS = 16;
  var SCALE_NAME = 'A harmonic minor';

  // A harmonic minor scale degrees (semitone offsets from A within an octave)
  var SCALE_DEGREES = [0, 2, 3, 5, 7, 8, 11];

  // Build the full MIDI set: A3 (57) to A5 (81)
  var SCALE_MIDI = (function () {
    var notes = [];
    for (var midi = 57; midi <= 81; midi++) {
      var semitoneInOctave = ((midi - 57) % 12 + 12) % 12;
      if (SCALE_DEGREES.indexOf(semitoneInOctave) !== -1) {
        notes.push(midi);
      }
    }
    return notes; // 15 notes
  }());

  // Index of A4 (MIDI 69) in SCALE_MIDI — the tonic starting point
  var TONIC_INDEX = SCALE_MIDI.indexOf(69);

  var NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  // ── FNV-1a 32-bit hash ─────────────────────────────────────────────────────

  function fnv1aHash(text) {
    if (typeof text !== 'string') {
      throw new TypeError('fnv1aHash: text must be a string');
    }
    var bytes;
    if (typeof TextEncoder !== 'undefined') {
      bytes = new TextEncoder().encode(text);
    } else {
      // Node.js < 11 fallback; Node ≥ 18 always has TextEncoder but keep it clean
      bytes = Buffer.from(text, 'utf8');
    }
    var hash = 2166136261; // FNV offset basis
    for (var i = 0; i < bytes.length; i++) {
      hash ^= bytes[i];
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash >>> 0;
  }

  function seedFromText(text) {
    if (typeof text !== 'string') {
      throw new TypeError('seedFromText: text must be a string');
    }
    if (text.trim() === '') {
      throw new RangeError('seedFromText: text must not be empty or whitespace-only');
    }
    return fnv1aHash(text);
  }

  // ── Mulberry32 PRNG ────────────────────────────────────────────────────────

  function mulberry32(seed) {
    var state = seed >>> 0;
    return function () {
      state = (state + 0x6D2B79F5) >>> 0;
      var z = state;
      z = Math.imul(z ^ (z >>> 15), z | 1) >>> 0;
      z ^= z + Math.imul(z ^ (z >>> 7), z | 61) >>> 0;
      return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ── Note helpers ───────────────────────────────────────────────────────────

  function noteToFrequency(midi) {
    if (typeof midi !== 'number' || midi < 0 || midi > 127) {
      throw new RangeError('noteToFrequency: midi must be a number between 0 and 127');
    }
    return Math.round(440 * Math.pow(2, (midi - 69) / 12) * 100) / 100;
  }

  function midiToNoteName(midi) {
    if (typeof midi !== 'number' || !Number.isInteger(midi)) {
      throw new RangeError('midiToNoteName: midi must be an integer');
    }
    if (midi < 0 || midi > 127) {
      throw new RangeError('midiToNoteName: midi must be between 0 and 127');
    }
    var octave = Math.floor(midi / 12) - 1;
    var name = NOTE_NAMES[midi % 12];
    return name + octave;
  }

  // ── Melody generation ──────────────────────────────────────────────────────

  function generateMelody(text, options) {
    var seed = seedFromText(text); // validates text; throws TypeError/RangeError as needed

    var bpm = DEFAULT_BPM;
    if (options && options.bpm !== undefined) {
      if (typeof options.bpm !== 'number' || options.bpm < 60 || options.bpm > 180) {
        throw new RangeError('generateMelody: options.bpm must be a number between 60 and 180');
      }
      bpm = options.bpm;
    }

    var rand = mulberry32(seed);

    // Start near the tonic: pick a scale-degree offset of -2..+2 from TONIC_INDEX
    var startOffset = Math.floor(rand() * 5) - 2; // -2,-1,0,+1,+2
    var idx = Math.max(0, Math.min(SCALE_MIDI.length - 1, TONIC_INDEX + startOffset));

    // Step weights: moves of -2,-1,+1,+2 (no 0-stay) with bias toward small moves,
    // so the melody always advances and visits at least 4 distinct pitches.
    // Cumulative weights: [-2: 0.10, -1: 0.40, +1: 0.80, +2: 1.00]
    var MOVE_CDF = [0.10, 0.40, 0.80, 1.00];
    var MOVES = [-2, -1, 1, 2];

    var steps = [];
    var prevWasRest = false;

    for (var s = 0; s < STEPS; s++) {
      // Determine if this step is a rest (~1 in 5, never step 0, never two in a row)
      var isRest = false;
      if (s > 0 && !prevWasRest) {
        isRest = rand() < 0.2;
      }

      if (isRest) {
        steps.push({ rest: true });
        prevWasRest = true;
      } else {
        var midi = SCALE_MIDI[idx];
        steps.push({
          midi: midi,
          note: midiToNoteName(midi),
          freq: noteToFrequency(midi)
        });
        prevWasRest = false;

        // Advance position for the next step
        var r = rand();
        var move = 0;
        for (var m = 0; m < MOVE_CDF.length; m++) {
          if (r < MOVE_CDF[m]) {
            move = MOVES[m];
            break;
          }
        }
        idx = Math.max(0, Math.min(SCALE_MIDI.length - 1, idx + move));
      }
    }

    // ── Deterministic post-pass: guarantee at least 4 distinct pitches ────
    var PITCH_FLOOR = 4;

    // Count occurrences of each pitch in the generated steps
    var pitchCounts = {};
    for (var p = 0; p < steps.length; p++) {
      if (!steps[p].rest) {
        var pm = steps[p].midi;
        pitchCounts[pm] = (pitchCounts[pm] || 0) + 1;
      }
    }
    var distinctCount = Object.keys(pitchCounts).length;

    if (distinctCount < PITCH_FLOOR) {
      // Find scale notes not yet used
      var unused = [];
      for (var u = 0; u < SCALE_MIDI.length; u++) {
        if (!pitchCounts[SCALE_MIDI[u]]) unused.push(SCALE_MIDI[u]);
      }

      // Walk note-steps from the end, replacing midi with unused pitches.
      // After replacing a step, the old pitch loses one occurrence.  When its
      // count falls to 0 it is no longer distinct, so the net change to
      // distinctCount is 0 (lost one, gained one).  Only when the old pitch
      // still has occurrences elsewhere does the replacement add a net new
      // distinct pitch (+1).  Recompute distinctCount from pitchCounts after
      // each replacement to stay correct.
      for (var q = steps.length - 1; q >= 0 && distinctCount < PITCH_FLOOR && unused.length > 0; q--) {
        if (!steps[q].rest) {
          var oldMidi = steps[q].midi;
          var newMidi = unused.shift();

          // Update occurrence counts
          pitchCounts[oldMidi]--;
          if (pitchCounts[oldMidi] === 0) {
            delete pitchCounts[oldMidi];
          }
          pitchCounts[newMidi] = (pitchCounts[newMidi] || 0) + 1;

          // Recompute true distinct count
          distinctCount = Object.keys(pitchCounts).length;

          steps[q] = {
            midi: newMidi,
            note: midiToNoteName(newMidi),
            freq: noteToFrequency(newMidi)
          };
        }
      }
    }

    var drums = generateDrumPattern(seed);

    return {
      seed: seed,
      bpm: bpm,
      steps: steps,
      drums: drums
    };
  }

  // ── Drum pattern generation ────────────────────────────────────────────────

  // Top-up priority lists for deterministic floor enforcement
  var KICK_TOPUP_ORDER = [4, 8, 12, 2, 6, 10, 14];
  var HAT_TOPUP_ORDER  = [1, 3, 5, 7, 9, 11, 13, 15, 0, 2, 4, 6, 8, 10, 12, 14];
  var KICK_FLOOR = 4;
  var HAT_FLOOR  = 4;

  function generateDrumPattern(seed) {
    // Use a separate PRNG stream so drums don't correlate with the melody walk
    var rand = mulberry32((seed ^ 0x9E3779B9) >>> 0);

    var pattern = [];
    for (var s = 0; s < STEPS; s++) {
      var kick = false;
      var hat = false;

      if (s === 0) {
        kick = true;
      } else if (s === 4 || s === 8 || s === 12) {
        kick = rand() < 0.90;
      } else {
        kick = rand() < 0.15;
      }

      if (s % 2 === 1) {
        hat = rand() < 0.6;
      } else {
        hat = rand() < 0.15;
      }

      pattern.push({ kick: kick, hat: hat });
    }

    // ── Deterministic top-up: guarantee at least KICK_FLOOR kicks ──────────
    var kickCount = 0;
    for (var i = 0; i < STEPS; i++) { if (pattern[i].kick) kickCount++; }
    for (var ki = 0; ki < KICK_TOPUP_ORDER.length && kickCount < KICK_FLOOR; ki++) {
      var ks = KICK_TOPUP_ORDER[ki];
      if (!pattern[ks].kick) {
        pattern[ks].kick = true;
        kickCount++;
      }
    }

    // ── Deterministic top-up: guarantee at least HAT_FLOOR hats ───────────
    var hatCount = 0;
    for (var j = 0; j < STEPS; j++) { if (pattern[j].hat) hatCount++; }
    for (var hi = 0; hi < HAT_TOPUP_ORDER.length && hatCount < HAT_FLOOR; hi++) {
      var hs = HAT_TOPUP_ORDER[hi];
      if (!pattern[hs].hat) {
        pattern[hs].hat = true;
        hatCount++;
      }
    }

    return pattern;
  }

  // ── Event scheduling ───────────────────────────────────────────────────────

  function melodyToEvents(melody) {
    var stepSeconds = 60 / melody.bpm / 4; // 16th note duration
    var events = [];

    for (var s = 0; s < STEPS; s++) {
      var step = melody.steps[s];
      var startSeconds = s * stepSeconds;

      if (step.rest) {
        events.push({ step: s, startSeconds: startSeconds, rest: true });
      } else {
        events.push({
          step: s,
          startSeconds: startSeconds,
          midi: step.midi,
          note: step.note,
          freq: step.freq
        });
      }
    }

    return events;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  return {
    DEFAULT_BPM: DEFAULT_BPM,
    STEPS: STEPS,
    SCALE_NAME: SCALE_NAME,
    fnv1aHash: fnv1aHash,
    seedFromText: seedFromText,
    generateMelody: generateMelody,
    generateDrumPattern: generateDrumPattern,
    melodyToEvents: melodyToEvents,
    noteToFrequency: noteToFrequency,
    midiToNoteName: midiToNoteName
  };

}));
