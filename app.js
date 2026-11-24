/* FRANKENBAND — app.js
 * All sound lives here. melody.js (pure logic) turns text into a melody;
 * this file turns that melody, the theremin, and the AI voice into audio.
 * No server, no API key, no fetch. Dynamic strings use textContent only.
 */
'use strict';

(function () {
  var M = window.FrankenbandMelody;
  if (!M) {
    document.getElementById('songMeta').textContent =
      'Melody engine failed to load. Please reload the page.';
    return;
  }

  // ── DOM ──────────────────────────────────────────────────────────────────
  var $ = function (id) { return document.getElementById(id); };
  var stage = $('stage'), songText = $('songText'), stitchBtn = $('stitchBtn');
  var playBtn = $('playBtn'), stopBtn = $('stopBtn'), songMeta = $('songMeta');
  var thereminBtn = $('thereminBtn'), announceBtn = $('announceBtn');
  var recordBtn = $('recordBtn'), replayBtn = $('replayBtn');
  var recordMeta = $('recordMeta'), nowPlaying = $('nowPlaying');
  var readout = $('thereminReadout'), stageHint = $('stageHint');
  var badgeTheremin = $('badgeTheremin'), badgeChip = $('badgeChip'),
      badgeVoice = $('badgeVoice');

  // ── State ────────────────────────────────────────────────────────────────
  var ctx = null;            // AudioContext, created on first gesture
  var master = null;         // master gain -> destination
  var recordDest = null;     // MediaStreamDestination for recording
  var melody = null;         // last stitched melody object
  var melodyText = '';       // the sentence the melody came from
  var playing = false;       // chiptune loop running
  var playTimer = null;      // loop setTimeout handle
  var activeSources = [];    // oscillators/nodes to stop on Stop
  var thereminOn = false;
  var thereminOsc = null, thereminGain = null;
  var recorder = null, recordedChunks = [], recordedBlob = null;
  var recording = false;
  var noiseBuf = null;

  // ── Audio setup ──────────────────────────────────────────────────────────
  function ensureAudio() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);
    recordDest = ctx.createMediaStreamDestination();
    master.connect(recordDest);
    // 1-second white-noise buffer, reused for hats and snare-ish ticks
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    var data = noiseBuf.getChannelData(0);
    for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  function setBadge(badge, on) {
    if (on) badge.classList.add('on'); else badge.classList.remove('on');
  }

  // ── Theremin (1920s) ─────────────────────────────────────────────────────
  // X = pitch (log scale, 110–880 Hz), Y = volume (top = loud).
  function thereminFromPointer(e) {
    var r = stage.getBoundingClientRect();
    var x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    var y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    return { freq: 110 * Math.pow(8, x), vol: 1 - y };
  }

  function thereminStart(e) {
    if (!thereminOn) return;
    ensureAudio();
    if (!thereminOsc) {
      thereminOsc = ctx.createOscillator();
      thereminOsc.type = 'sine';
      thereminGain = ctx.createGain();
      thereminGain.gain.value = 0;
      thereminOsc.connect(thereminGain);
      thereminGain.connect(master);
      thereminOsc.start();
      setBadge(badgeTheremin, true);
    }
    thereminMove(e);
  }

  function thereminMove(e) {
    if (!thereminOsc) return;
    var t = thereminFromPointer(e);
    thereminOsc.frequency.setTargetAtTime(t.freq, ctx.currentTime, 0.03);
    thereminGain.gain.setTargetAtTime(t.vol * 0.5, ctx.currentTime, 0.03);
    readout.textContent = 'Theremin: ' + Math.round(t.freq) + ' Hz';
  }

  function thereminStop() {
    if (thereminOsc) {
      try { thereminOsc.stop(); } catch (err) { /* already stopped */ }
      thereminOsc.disconnect();
      thereminGain.disconnect();
      thereminOsc = null; thereminGain = null;
    }
    setBadge(badgeTheremin, false);
    readout.textContent = thereminOn ? 'Theremin ready — move across the stage'
                                     : 'Theremin off';
  }

  thereminBtn.addEventListener('click', function () {
    thereminOn = !thereminOn;
    thereminBtn.textContent = thereminOn ? 'Theremin: on' : 'Theremin: off';
    thereminBtn.setAttribute('aria-pressed', String(thereminOn));
    if (!thereminOn) thereminStop();
    else {
      readout.textContent = 'Theremin ready — move across the stage';
      stageHint.textContent = 'Theremin live: move across the stage';
    }
  });
  stage.addEventListener('pointermove', function (e) {
    if (thereminOn) thereminStart(e);
  });
  stage.addEventListener('pointerleave', thereminStop);
  stage.addEventListener('pointerdown', function (e) {
    if (thereminOn) thereminStart(e);
  });

  // ── Chiptune playback (1980s) ─────────────────────────────────────────────
  function playNote(freq, when, dur) {
    var osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.22, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur * 0.95);
    osc.connect(g); g.connect(master);
    osc.start(when); osc.stop(when + dur);
    activeSources.push(osc);
  }

  function playKick(when) {
    var osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, when);
    osc.frequency.exponentialRampToValueAtTime(40, when + 0.12);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.5, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.14);
    osc.connect(g); g.connect(master);
    osc.start(when); osc.stop(when + 0.15);
    activeSources.push(osc);
  }

  function playHat(when) {
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    var filter = ctx.createBiquadFilter();
    filter.type = 'highpass'; filter.frequency.value = 6000;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.12, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    src.connect(filter); filter.connect(g); g.connect(master);
    src.start(when); src.stop(when + 0.06);
    activeSources.push(src);
  }

  function scheduleLoop() {
    if (!playing || !melody) return;
    var events = M.melodyToEvents(melody);
    var t0 = ctx.currentTime + 0.06;
    var stepDur = 60 / melody.bpm / 4;
    events.forEach(function (ev) {
      var when = t0 + ev.startSeconds;
      if (!ev.rest) playNote(ev.freq, when, stepDur);
    });
    melody.drums.forEach(function (d, i) {
      var when = t0 + i * stepDur;
      if (d.kick) playKick(when);
      if (d.hat) playHat(when);
    });
    var loopMs = 16 * stepDur * 1000;
    nowPlaying.textContent = 'Now playing: "' + melodyText + '" — ' +
      events.filter(function (e) { return !e.rest; }).length +
      ' notes, ' + melody.bpm + ' BPM';
    playTimer = setTimeout(scheduleLoop, loopMs);
  }

  function stopPlayback() {
    playing = false;
    if (playTimer) { clearTimeout(playTimer); playTimer = null; }
    activeSources.forEach(function (s) { try { s.stop(); } catch (e) { /* ended */ } });
    activeSources = [];
    setBadge(badgeChip, false);
    nowPlaying.textContent = '';
    playBtn.disabled = !melody;
    stopBtn.disabled = true;
  }

  // ── Stitch it together ───────────────────────────────────────────────────
  stitchBtn.addEventListener('click', function () {
    var text = songText.value;
    try {
      melody = M.generateMelody(text);
    } catch (err) {
      songMeta.textContent = 'Type a sentence first — the band needs words to sing.';
      melody = null;
      playBtn.disabled = true;
      announceBtn.disabled = true;
      return;
    }
    melodyText = text.trim();
    var notes = melody.steps.filter(function (s) { return !s.rest; });
    var names = notes.slice(0, 8).map(function (s) { return s.note; }).join(' ');
    songMeta.textContent = 'Stitched! Seed ' + melody.seed + ' — ' +
      notes.length + ' notes in A harmonic minor at ' + melody.bpm +
      ' BPM. First notes: ' + names + '.';
    playBtn.disabled = false;
    announceBtn.disabled = false;
  });

  playBtn.addEventListener('click', function () {
    if (!melody) return;
    ensureAudio();
    if (playing) return;
    playing = true;
    setBadge(badgeChip, true);
    playBtn.disabled = true;
    stopBtn.disabled = false;
    scheduleLoop();
  });

  stopBtn.addEventListener('click', stopPlayback);

  // ── AI Voice MC (2020s) ──────────────────────────────────────────────────
  announceBtn.addEventListener('click', function () {
    if (!melody || !('speechSynthesis' in window)) {
      songMeta.textContent = 'Voice announcements need a browser with speech synthesis.';
      return;
    }
    var line = 'Ladies and gentlemen, the monster band presents: ' + melodyText + '!';
    var utter = new SpeechSynthesisUtterance(line);
    utter.lang = 'en-US';
    utter.rate = 1.0;
    var voices = window.speechSynthesis.getVoices();
    var female = voices.filter(function (v) {
      return /female|samantha|zira|aria|jenny|google us english/i.test(v.name);
    })[0];
    if (female) utter.voice = female;
    utter.onstart = function () { setBadge(badgeVoice, true); };
    utter.onend = function () { setBadge(badgeVoice, false); };
    utter.onerror = function () { setBadge(badgeVoice, false); };
    window.speechSynthesis.speak(utter);
  });

  // ── Record & replay ──────────────────────────────────────────────────────
  function mediaRecorderSupported() {
    return typeof window.MediaRecorder !== 'undefined' && !!recordDest;
  }

  recordBtn.addEventListener('click', function () {
    ensureAudio();
    if (!mediaRecorderSupported()) {
      recordMeta.textContent = 'Recording is not supported here — replay still works from the seed.';
      return;
    }
    if (recording) {
      recorder.stop();
      return;
    }
    recordedChunks = [];
    recorder = new MediaRecorder(recordDest.stream);
    recorder.ondataavailable = function (e) { recordedChunks.push(e.data); };
    recorder.onstop = function () {
      recording = false;
      recordBtn.textContent = 'Record the band';
      recordedBlob = new Blob(recordedChunks, { type: recorder.mimeType });
      recordMeta.textContent = 'Take recorded (' +
        (recordedBlob.size / 1024).toFixed(1) + ' KB). Replay plays the real recording.';
      replayBtn.disabled = false;
    };
    recorder.start();
    recording = true;
    recordBtn.textContent = 'Stop recording';
    recordMeta.textContent = 'Recording… play the band or the theremin, then stop.';
  });

  replayBtn.addEventListener('click', function () {
    if (recordedBlob) {
      var url = URL.createObjectURL(recordedBlob);
      var audio = new Audio(url);
      audio.onended = function () { URL.revokeObjectURL(url); };
      audio.play();
      recordMeta.textContent = 'Replaying the recorded take.';
    } else if (melody) {
      // Fallback: the melody is deterministic, so replay is exact.
      ensureAudio();
      if (!playing) playBtn.click();
      recordMeta.textContent = 'Replaying from the seed — identical every time.';
    }
  });

  // Enable recording once audio exists (first Stitch or Play creates it).
  stitchBtn.addEventListener('click', function () {
    if (melody) recordBtn.disabled = false;
  });
})();
