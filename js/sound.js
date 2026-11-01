// Sundown Drive: procedural audio (Web Audio). Engine, SFX and three original synth tracks.
const Sound = (() => {
  let ctx = null, master, sfxBus, noiseBuf;
  let engine = null, screech = null, rumble = null;

  const SEMI = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  function hz(n) {
    const m = /^([A-G][#b]?)(-?\d)$/.exec(n);
    const midi = (parseInt(m[2], 10) + 1) * 12 + SEMI[m[1]];
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.7; sfxBus.connect(master);
    Music.attach(ctx, master);

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

  // ---- Music (see music.js) ----
  function playTrack(i) { if (ctx) Music.play(i); }
  function stopMusic() { Music.stop(); }
  function toggleMusic() { return Music.toggle(); }
  function suspend(on) { if (ctx) on ? ctx.suspend() : ctx.resume(); }

  return { init, updateEngine, sfx, playTrack, stopMusic, toggleMusic, suspend };
})();
