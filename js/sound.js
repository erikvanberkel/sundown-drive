// Sundown Drive: procedural audio (Web Audio). Engine, SFX and three original synth tracks.
const Sound = (() => {
  let ctx = null, master, musicBus, sfxBus, delayIn, noiseBuf;
  let engine = null, screech = null, rumble = null;
  let musicOn = true, timer = null, track = null, nextTime = 0, step = 0;

  const SEMI = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  function hz(n) {
    const m = /^([A-G][#b]?)(-?\d)$/.exec(n);
    const midi = (parseInt(m[2], 10) + 1) * 12 + SEMI[m[1]];
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // ---- Original compositions: 8 bars, 16 steps per bar ----
  const TRACKS = [
    {
      name: 'PALM SHADOW', bpm: 120, leadWave: 'square',
      chords: [['A2', ['A3', 'C4', 'E4']], ['F2', ['F3', 'A3', 'C4']], ['C2', ['G3', 'C4', 'E4']], ['G2', ['G3', 'B3', 'D4']]],
      bass: 'R.R.O.R.R.R.O.F.',
      kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.',
      lead: [
        'A4 - - C5 - - E5 - D5 - C5 - A4 - - -',
        'F4 - - A4 - - C5 - - - D5 - C5 - A4 -',
        'G4 - - C5 - - E5 - G5 - - - E5 - D5 -',
        'D5 - - - B4 - - - G4 - A4 - B4 - D5 -',
        'E5 - - - . E5 D5 E5 G5 - E5 - D5 - C5 -',
        'A5 - - - G5 - - - F5 - E5 - D5 - C5 -',
        'E5 - - - G5 - - - C6 - - - B5 - G5 -',
        'A5 - - - - - - - G5 - - - - - . .',
      ],
    },
    {
      name: 'NIGHT FREEWAY', bpm: 132, leadWave: 'sawtooth',
      chords: [['F#2', ['F#3', 'A3', 'C#4']], ['D2', ['F#3', 'A3', 'D4']], ['A2', ['E3', 'A3', 'C#4']], ['E2', ['E3', 'G#3', 'B3']]],
      bass: 'RRORRRORRRORRFRO',
      kick: 'x...x...x...x.x.', snare: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx',
      lead: [
        'F#5 - . F#5 E5 - C#5 - . . A4 - B4 - C#5 -',
        'D5 - - - - - . . A4 - D5 - E5 - F#5 -',
        'E5 - . E5 C#5 - A4 - . . E5 - F#5 - E5 -',
        'B4 - - - - - - - G#4 - B4 - E5 - G#5 -',
        'A5 - - - G#5 - F#5 - . . C#5 - F#5 - A5 -',
        'B5 - - - A5 - F#5 - . . D5 - F#5 - A5 -',
        'C#6 - - - B5 - A5 - E5 - - - A5 - B5 -',
        'G#5 - - - - - - - . . . . B4 C#5 D#5 E5',
      ],
    },
    {
      name: 'CORAL ENGINE', bpm: 112, leadWave: 'triangle',
      chords: [['D2', ['F#3', 'A3', 'C#4']], ['B1', ['D3', 'F#3', 'A3']], ['E2', ['D3', 'G3', 'B3']], ['A1', ['C#3', 'E3', 'G3']]],
      bass: 'R..R.OR..RF.O.R.',
      kick: 'x..x..x...x..x..', snare: '....x.......x..x', hat: 'x.x.x.x.x.x.x.x.',
      lead: [
        'F#5 - A5 - . F#5 - E5 - D5 - - C#5 - D5 -',
        'B4 - - - . . D5 - F#5 - E5 - D5 - B4 -',
        'G5 - - F#5 - - E5 - D5 - E5 - G5 - B5 -',
        'A5 - - - - - G5 - - - E5 - C#5 - A4 -',
        'D6 - - - C#6 - A5 - . . F#5 - A5 - C#6 -',
        'B5 - - - A5 - F#5 - D5 - - - F#5 - B5 -',
        'E6 - - - D6 - B5 - G5 - - - B5 - D6 -',
        'C#6 - - - - - - - E6 - - - . . . .',
      ],
    },
  ];
  TRACKS.forEach(t => { t.leadSteps = t.lead.map(b => b.split(/\s+/)); });

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.42; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.7; sfxBus.connect(master);

    // Echo for the lead line
    delayIn = ctx.createGain(); delayIn.gain.value = 0.32;
    const d = ctx.createDelay(1); d.delayTime.value = 0.375;
    const fb = ctx.createGain(); fb.gain.value = 0.35;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    delayIn.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(musicBus);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    buildEngine();
  }

  function noiseSource(loop) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = !!loop; return s;
  }

  function buildEngine() {
    const out = ctx.createGain(); out.gain.value = 0; out.connect(sfxBus);
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 400; filt.Q.value = 4;
    filt.connect(out);
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
    const o2 = ctx.createOscillator(); o2.type = 'square';
    const g2 = ctx.createGain(); g2.gain.value = 0.5;
    o1.connect(filt); o2.connect(g2); g2.connect(filt);
    o1.start(); o2.start();
    engine = { out, filt, o1, o2 };

    const sOut = ctx.createGain(); sOut.gain.value = 0; sOut.connect(sfxBus);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 6;
    const sn = noiseSource(true); sn.connect(bp); bp.connect(sOut); sn.start();
    screech = { out: sOut, bp };

    const rOut = ctx.createGain(); rOut.gain.value = 0; rOut.connect(sfxBus);
    const rlp = ctx.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 280;
    const rn = noiseSource(true); rn.connect(rlp); rlp.connect(rOut); rn.start();
    rumble = { out: rOut };
  }

  // speedRatio 0..1.3, throttle 0..1, skid 0..1, offroad bool, gear-ish wobble handled here
  function updateEngine(speedRatio, throttle, skid, offroad, active) {
    if (!ctx || !engine) return;
    const t = ctx.currentTime;
    // Fake 4-gear shift curve: rpm rises then dips at shift points
    const gears = [0.22, 0.45, 0.7, 1.0];
    let g = 0; while (g < gears.length - 1 && speedRatio > gears[g]) g++;
    const lo = g === 0 ? 0 : gears[g - 1];
    const rpm = (speedRatio - lo) / (gears[g] - lo || 1);
    const base = 48 + g * 12 + Math.min(rpm, 1.25) * 70;
    engine.o1.frequency.setTargetAtTime(base, t, 0.05);
    engine.o2.frequency.setTargetAtTime(base * 0.5, t, 0.05);
    engine.filt.frequency.setTargetAtTime(300 + throttle * 900 + speedRatio * 700, t, 0.08);
    engine.out.gain.setTargetAtTime(active ? 0.09 + throttle * 0.08 : 0, t, 0.1);
    screech.out.gain.setTargetAtTime(active ? skid * 0.16 : 0, t, 0.05);
    screech.bp.frequency.setTargetAtTime(2200 + skid * 900, t, 0.1);
    rumble.out.gain.setTargetAtTime(active && offroad ? 0.35 * Math.min(1, speedRatio * 2) : 0, t, 0.05);
  }

  // ---- SFX ----
  function blip(freq, dur, type, vol, when, dest) {
    if (!ctx) return;
    const t = when || ctx.currentTime;
    const o = ctx.createOscillator(); o.type = type || 'square'; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest || sfxBus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noiseHit(dur, freq, vol, type, when, dest) {
    if (!ctx) return;
    const t = when || ctx.currentTime;
    const s = noiseSource(false);
    const f = ctx.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || sfxBus);
    s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }

  const sfx = {
    countdown(final) { blip(final ? 880 : 440, final ? 0.6 : 0.25, 'square', 0.18); },
    crash() {
      if (!ctx) return;
      noiseHit(0.9, 900, 0.7, 'lowpass');
      const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.5);
      g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.65);
    },
    bump() { noiseHit(0.25, 600, 0.45, 'lowpass'); blip(90, 0.2, 'sine', 0.4); },
    checkpoint() {
      if (!ctx) return;
      const t = ctx.currentTime;
      ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'].forEach((n, i) => blip(hz(n), 0.18, 'square', 0.12, t + i * 0.07));
    },
    boost() { noiseHit(0.8, 1800, 0.35, 'bandpass'); blip(220, 0.5, 'sawtooth', 0.12); },
    nearMiss() { blip(1320, 0.08, 'square', 0.08); },
    timeWarn() { blip(1000, 0.1, 'square', 0.1); },
    select() { blip(660, 0.08, 'square', 0.12); },
    goal() {
      if (!ctx) return;
      const t = ctx.currentTime;
      ['G4', 'C5', 'E5', 'G5', 'E5', 'G5', 'C6'].forEach((n, i) => blip(hz(n), 0.3, 'square', 0.12, t + i * 0.12));
    },
  };

  // ---- Music sequencer ----
  function playKick(t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.32);
  }
  function playSnare(t) {
    noiseHit(0.18, 5000, 0.45, 'highpass', t, musicBus);
    noiseHit(0.22, 1800, 0.35, 'bandpass', t, musicBus);
    blip(190, 0.1, 'triangle', 0.3, t, musicBus);
  }
  function playHat(t) { noiseHit(0.04, 8000, 0.18, 'highpass', t, musicBus); }

  function playBass(f, t, dur) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    const f1 = ctx.createBiquadFilter(); f1.type = 'lowpass'; f1.Q.value = 8;
    f1.frequency.setValueAtTime(1600, t); f1.frequency.exponentialRampToValueAtTime(180, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.32, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(f1); f1.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 0.02);
  }

  function playLead(f, t, dur, wave) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.015);
    g.gain.setTargetAtTime(0.08, t + 0.05, 0.1);
    g.gain.setTargetAtTime(0.0001, t + dur, 0.06);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
    [-7, 7].forEach(det => {
      const o = ctx.createOscillator(); o.type = wave; o.frequency.value = f; o.detune.value = det;
      // gentle vibrato after attack
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.006, t + 0.3);
      lfo.connect(lg); lg.connect(o.frequency);
      o.connect(lp); o.start(t); o.stop(t + dur + 0.4); lfo.start(t); lfo.stop(t + dur + 0.4);
    });
    lp.connect(g); g.connect(musicBus); g.connect(delayIn);
  }

  function playPad(notes, t, dur) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.25);
    g.gain.setTargetAtTime(0.0001, t + dur - 0.1, 0.15);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    lp.connect(g); g.connect(musicBus);
    notes.forEach(n => [-10, 10].forEach(det => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(n); o.detune.value = det;
      o.connect(lp); o.start(t); o.stop(t + dur + 0.6);
    }));
  }

  function scheduleStep(t) {
    const s16 = 60 / track.bpm / 4;
    const s = step % 16, bar = Math.floor(step / 16) % track.leadSteps.length;
    const chord = track.chords[bar % track.chords.length];
    if (track.kick[s] === 'x') playKick(t);
    if (track.snare[s] === 'x') playSnare(t);
    if (track.hat[s] === 'x') playHat(t);
    const b = track.bass[s];
    if (b !== '.') {
      const root = hz(chord[0]);
      playBass(b === 'O' ? root * 2 : b === 'F' ? root * 1.5 : root, t, s16 * 1.6);
    }
    if (s === 0) playPad(chord[1], t, s16 * 16);
    const notes = track.leadSteps[bar];
    const tok = notes[s];
    if (tok && tok !== '.' && tok !== '-') {
      let len = 1;
      while (s + len < 16 && notes[s + len] === '-') len++;
      playLead(hz(tok), t, s16 * len * 0.92, track.leadWave);
    }
  }

  function tick() {
    if (!ctx || !track) return;
    const s16 = 60 / track.bpm / 4;
    while (nextTime < ctx.currentTime + 0.12) {
      scheduleStep(nextTime);
      nextTime += s16;
      step++;
    }
  }

  function playTrack(i) {
    if (!ctx) return;
    stopMusic();
    track = TRACKS[i];
    step = 0;
    nextTime = ctx.currentTime + 0.08;
    musicBus.gain.setValueAtTime(musicOn ? 0.42 : 0, ctx.currentTime);
    timer = setInterval(tick, 25);
  }
  function stopMusic() { if (timer) clearInterval(timer); timer = null; track = null; }
  function toggleMusic() {
    musicOn = !musicOn;
    if (ctx) musicBus.gain.setTargetAtTime(musicOn ? 0.42 : 0, ctx.currentTime, 0.05);
    return musicOn;
  }
  function suspend(on) { if (ctx) on ? ctx.suspend() : ctx.resume(); }

  return { init, updateEngine, sfx, playTrack, stopMusic, toggleMusic, suspend, TRACKS };
})();
