# Spec: Melody Engine — Tasks

Build order, smallest first. Do not add any external dependency.
Only `melody.js` and `tests/melody.test.js` are in scope for this
session — `index.html`, `styles.css` and `app.js` (theremin, playback,
UI) are built separately afterwards and must not be touched here.

- [x] 1. `melody.js`: UMD skeleton + module header (hash, scale,
      tempo, pure-logic rule) + `fnv1aHash` + `seedFromText` with the
      error paths from the requirements (TypeError for non-string,
      RangeError for empty/whitespace-only text).
- [x] 2. `melody.js`: `midiToNoteName` + `noteToFrequency` (A4 =
      440.00, 2-decimal rounding, RangeError outside 0–127).
- [x] 3. `melody.js`: `generateMelody` — mulberry32 walk over the A
      harmonic minor scale (57–81), 16 steps, rests never first and
      never twice in a row, `options.bpm` default 112 (60–180,
      RangeError otherwise).
- [x] 4. `melody.js`: `generateDrumPattern` (own mulberry32 stream,
      step 0 always a kick) + `melodyToEvents` (cumulative
      16th-note start times from the melody's bpm).
- [x] 5. `tests/melody.test.js`: FNV-1a vectors (`"a"`, `"hello"`),
      determinism, different-texts-differ, error paths, melody shape
      on ≥10 sample texts, drum shape on ≥10 seeds, event timing.
      Run `node --test tests/melody.test.js` — whole file green.
- [x] 6. Tick these tasks off as they land (change `[ ]` to `[x]` in
      this file) and report: files created/changed, test count passed,
      and any requirement the implementation could not meet.
- [x] 7. Harden acceptance-criteria floors after independent verification
      over 20 000 seeds found probabilistic failures (944 seeds < 4 kicks,
      1384 seeds < 4 hats, 66 melodies < 4 distinct pitches).
      `generateDrumPattern`: after the probabilistic draw, top up kicks
      deterministically from [4,8,12,2,6,10,14] and hats from
      [1,3,5,7,9,11,13,15,0,2,4,6,8,10,12,14] until each floor (≥ 4) is
      met; step 0 remains always a kick.
      `generateMelody`: add a deterministic post-pass that replaces the
      midi of the last note-steps with unused scale notes when fewer than
      4 distinct pitches were produced, without changing rests, step count,
      or determinism.
      `tests/melody.test.js`: added two property-style `describe` blocks
      looping over 2000 seeds / texts asserting all structural invariants
      (16 steps, ≥ 8 notes, ≥ 4 distinct pitches, step 0 note/kick,
      ≥ 4 kicks, ≥ 4 hats, full determinism). All 71 tests pass.
- [x] 8. Fix post-pass distinct-pitch counting bug found by independent
      verification over 20 000 texts (seeds 482 and 19488, texts
      "sentence number 482" and "sentence number 19488", each produced
      only 3 distinct pitches).
      Root cause: `generateMelody` post-pass incremented `distinctCount`
      blindly on each replacement.  When the replaced step held the only
      occurrence of its pitch (e.g. the final midi 57), the real distinct
      count did not grow — the lost pitch and the gained pitch cancelled
      out — but the loop exited at the now-inflated counter.
      Fix in `melody.js`: replaced the boolean `usedMidi` map with a
      `pitchCounts` occurrence map.  After each replacement the old
      pitch's count is decremented (and deleted when it reaches 0), the
      new pitch's count is incremented, and `distinctCount` is recomputed
      from `Object.keys(pitchCounts).length`, so it reflects the true
      number of pitches remaining in the steps at every iteration.
      `tests/melody.test.js`: property loops raised from 2000 to 20 000
      (using texts "sentence number N" to cover the known failure seeds);
      added pinned regression `describe` block with one test per failing
      text. All 73 tests pass.
