// Sundown Drive: music engine. Original songs, arranged in sections, played on synthesized
// 80s-style instruments (FM brass/bass, supersaw, arpeggiator, chorus pads, gated-reverb drums).
const Music = (() => {
  let ctx = null, out, glue, pumpBus, padIn, reverbIn, gatedIn, delayIn, delayL, delayR, noiseBuf;
  let arpL, arpR, pans = new Map();
  let songBus = null, song = null, bars = [], loopBar = 0, step = 0, nextTime = 0, timer = null;
  let enabled = true;

  // ---------------- Theory helpers ----------------
  const SEMI = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  const mhz = m => 440 * Math.pow(2, (m - 69) / 12);
  function hz(n) {
    const m = /^([A-G][#b]?)(-?\d)$/.exec(n);
    return mhz((parseInt(m[2], 10) + 1) * 12 + SEMI[m[1]]);
  }
  const QUAL = {
    '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], m9: [0, 3, 7, 10, 14],
    maj9: [0, 4, 7, 11, 14], 9: [0, 4, 7, 10, 14], sus4: [0, 5, 7], '7sus4': [0, 5, 7, 10], sus2: [0, 2, 7], add9: [0, 4, 7, 14],
  };
  function chord(sym) {
    const m = /^([A-G][#b]?)(.*)$/.exec(sym), pc = SEMI[m[1]], iv = QUAL[m[2]];
    let bass = 24 + pc; if (bass < 31) bass += 12;     // G1..F#2
    let root = 48 + pc; if (root < 50) root += 12;     // D3..C#4
    const pad = iv.slice(0, 4).map(i => root + i);
    const arp = iv.map(i => root + 12 + i);
    return { bass, pad, arp };
  }

  // ---------------- Songs (original compositions) ----------------
  // Lead: 16 tokens per bar: note ('E5'), glide into note ('~E5'), '-' hold, '.' rest.
  // Bass: R root, O octave, F fifth, '.' rest. Drums per 16 steps: x hit, g ghost.
  const SONGS = [
    {
      name: 'PALM SHADOW', bpm: 122, swing: 0, pump: 0.35,
      lead: { kind: 'brass' }, bass: { kind: 'fm', index: 5 }, arpIn: ['B', 'C'],
      form: ['I', 'A', 'B', 'A', 'C', 'B'],
      sections: {
        I: { chords: ['Am7', 'Fmaj7', 'C', 'G'], bass: 'R...R.R.R...R.R.', k: 'x.......x.......', s: '', h: '..x...x...x...x.', oh: '' },
        A: {
          chords: ['Am7', 'Fmaj7', 'C', 'G', 'Am7', 'Fmaj7', 'Dm7', 'E7'],
          bass: 'R.ROR.ROR.ROR.FO', k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', oh: '',
          lead: [
            'A4 - - C5 - - E5 - D5 - C5 - A4 - - -', 'F4 - - A4 - - C5 - - - D5 - C5 - A4 -',
            'G4 - - C5 - - E5 - G5 - - - E5 - D5 -', 'D5 - - - B4 - - - G4 - A4 - B4 - D5 -',
            'E5 - - - . E5 D5 E5 G5 - E5 - D5 - C5 -', 'A5 - - - G5 - - - F5 - E5 - D5 - C5 -',
            'D5 - - F5 - - A5 - C6 - - - A5 - F5 -', 'G#5 - - - - - B5 - - - D6 - - - . .',
          ],
        },
        B: {
          chords: ['Fmaj7', 'G', 'Em7', 'Am7', 'Dm7', 'G', 'Cmaj7', 'E7'],
          bass: 'R.ROR.ROR.ROF.O.', k: 'x...x...x...x.x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', oh: '..x...x...x...x.', clap: true,
          lead: [
            '. . C6 - A5 - C6 - . E6 - - D6 - C6 -', 'D6 - - - B5 - G5 - - - A5 - B5 - D6 -',
            'E6 - - - D6 - B5 - . G5 - - B5 - D6 -', 'C6 - - - - - . . A5 - B5 - C6 - E6 -',
            'F6 - - - E6 - D6 - . C6 - - A5 - C6 -', 'D6 - - - - - B5 - . G5 - A5 - B5 - -',
            'E6 - - - ~G6 - - - E6 - D6 - C6 - B5 -', 'B5 - - - - - - - G#5 - - - E5 - - -',
          ],
        },
        C: {
          chords: ['Dm9', 'Em7', 'Fmaj7', 'G', 'Dm9', 'Em7', 'Fmaj7', 'E7'],
          bass: 'R.......F...O...', k: 'x.........x.....', s: '........x.......', h: 'x...x...x...x...', oh: '',
          lead: [
            'A5 - - - . . E5 - F5 - - - . . . .', 'G5 - - - . . D5 - E5 - - - . . . .',
            'A5 - - - C6 - - - E6 - - - - - . .', 'D6 - - - - - - - . . . . . . . .',
            'F6 - - - E6 - D6 - A5 - - - . . . .', 'G6 - - - E6 - D6 - B5 - - - . . . .',
            'A6 - - - G6 - E6 - C6 - - - A5 - C6 -', 'B5 - - - - - - - - - - - . . . .',
          ],
        },
      },
    },
    {
      name: 'NIGHT FREEWAY', bpm: 132, swing: 0, pump: 0.5,
      lead: { kind: 'supersaw' }, bass: { kind: 'saw' }, arpIn: ['I', 'A', 'B', 'C'],
      form: ['I', 'A', 'B', 'A', 'C', 'B'],
      sections: {
        I: { chords: ['F#m', 'D', 'A', 'E'], bass: 'R.R.R.R.R.R.R.R.', k: 'x...x...x...x...', s: '', h: '', oh: '' },
        A: {
          chords: ['F#m', 'D', 'A', 'E', 'F#m', 'D', 'Bm7', 'C#7'],
          bass: 'R.RRR.RRR.RRR.RO', k: 'x...x...x...x...', s: '....x.......x...', h: 'x.xxx.xxx.xxx.xx', oh: '',
          lead: [
            'F#5 - . F#5 E5 - C#5 - . . A4 - B4 - C#5 -', 'D5 - - - - - . . A4 - D5 - E5 - F#5 -',
            'E5 - . E5 C#5 - A4 - . . E5 - F#5 - E5 -', 'B4 - - - - - - - G#4 - B4 - E5 - G#5 -',
            'A5 - - - G#5 - F#5 - . . C#5 - F#5 - A5 -', 'B5 - - - A5 - F#5 - . . D5 - F#5 - A5 -',
            'D6 - - - C#6 - B5 - A5 - - - F#5 - A5 -', 'G#5 - - - F5 - - - G#5 - B5 - C#6 - - -',
          ],
        },
        B: {
          chords: ['Dmaj7', 'E', 'C#m7', 'F#m', 'Bm7', 'E', 'Dmaj7', 'C#7'],
          bass: 'ROROROROROROROFO', k: 'x...x...x...x.x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', oh: '..x...x...x...x.', clap: true,
          lead: [
            'F#5 - - - A5 - - - C#6 - - - A5 - - -', 'B5 - - - G#5 - - - E5 - F#5 - G#5 - B5 -',
            'C#6 - - - B5 - G#5 - . . E5 - G#5 - B5 -', 'A5 - - - - - - - . . C#6 - B5 - A5 -',
            'F#5 - - - A5 - - - D6 - - - C#6 - B5 -', 'G#5 - - - B5 - - - E6 - - - D6 - B5 -',
            'C#6 - - - - - A5 - F#5 - - - A5 - C#6 -', 'C#6 - - - B5 - G#5 - F5 - - - . . . .',
          ],
        },
        C: {
          chords: ['Bm7', 'C#m7', 'Dmaj7', 'E', 'Bm7', 'C#m7', 'Dmaj7', 'C#7'],
          bass: 'R.......R.......', k: 'x.......x.......', s: '....x.......x...', h: '', oh: '',
          lead: [
            '', '', '', '',
            'B5 - - - - - - - A5 - - - F#5 - - -', 'G#5 - - - - - - - E5 - - - G#5 - - -',
            'A5 - - - - - - - C#6 - - - E6 - - -', 'F6 - - - - - - - - - - - . . . .',
          ],
        },
      },
    },
    {
      name: 'CORAL ENGINE', bpm: 112, swing: 0.12, pump: 0.2,
      lead: { kind: 'reed' }, bass: { kind: 'fm', index: 7 }, arpIn: ['C'],
      form: ['I', 'A', 'B', 'A', 'C', 'B'],
      sections: {
        I: { chords: ['Dmaj7', 'Bm7', 'Em7', 'A7'], bass: 'R..R.OR..RF.O.R.', k: 'x..x..x...x.....', s: '', h: 'x.x.x.x.x.x.x.x.', oh: '' },
        A: {
          chords: ['Dmaj7', 'Bm7', 'Em7', 'A7', 'Dmaj7', 'Bm7', 'Em7', 'A7'],
          bass: 'R..R.OR..RF.O.R.', k: 'x..x..x...x..x..', s: '....x..g....x..g', h: 'x.x.x.x.x.x.x.x.', oh: '',
          lead: [
            'F#5 - A5 - . F#5 - E5 - D5 - - C#5 - D5 -', 'B4 - - - . . D5 - F#5 - E5 - D5 - B4 -',
            'G5 - - F#5 - - E5 - D5 - E5 - G5 - B5 -', 'A5 - - - - - G5 - - - E5 - C#5 - A4 -',
            'D6 - - - C#6 - A5 - . . F#5 - A5 - C#6 -', 'B5 - - - A5 - F#5 - D5 - - - F#5 - B5 -',
            'E6 - - - D6 - B5 - G5 - - - B5 - D6 -', 'C#6 - - - - - - - E6 - - - . . . .',
          ],
        },
        B: {
          chords: ['Gmaj7', 'F#m7', 'Em7', 'Dmaj7', 'Gmaj7', 'F#m7', 'Bm7', 'A7'],
          bass: 'R.OR..R.F.R.O.RO', k: 'x..x..x...x..x..', s: '....x..g....x.gx', h: 'xxxxxxxxxxxxxxxx', oh: '......x.......x.',
          lead: [
            'B5 - - - D6 - - - F#6 - - - E6 - D6 -', 'C#6 - - - - - A5 - . E5 - - A5 - C#6 -',
            'B5 - - - G5 - - - D6 - - - B5 - G5 -', 'A5 - - - - - - - . . F#5 - A5 - C#6 -',
            'D6 - - - E6 - F#6 - . . E6 - D6 - B5 -', 'C#6 - - - E6 - - - A5 - - - C#6 - E6 -',
            'D6 - - - - - C#6 - B5 - - - A5 - F#5 -', 'G5 - - - - - - - E5 - - - C#5 - E5 -',
          ],
        },
        C: {
          chords: ['Em9', 'A7', 'F#m7', 'Bm7', 'Em9', 'A7', 'Dmaj7', 'A7'],
          bass: 'R..ROR..R..ROR.F', k: 'x.....x...x.....', s: '....x.......x...', h: 'x.xxx.xxx.xxx.xx', oh: '',
          lead: [
            'E5 F#5 G5 B5 D6 - B5 - . . F#5 - G5 - B5 -', 'C#6 - - - B5 A5 G5 E5 . . C#5 - E5 - G5 -',
            'A5 - - - - - C#6 - E6 - - - C#6 - A5 -', 'B5 - A5 - F#5 - D5 - . . F#5 - A5 - D6 -',
            'F#6 - - - E6 - D6 - B5 - - - G5 - - -', 'A5 B5 C#6 E6 G6 - - - E6 - - - C#6 - - -',
            'D6 - - - - - - - F#6 - - - E6 - C#6 -', 'A5 - - - - - - - . . . . G5 - E5 -',
          ],
        },
      },
    },
  ];

  function arrange(s) {
    const list = [];
    s.form.forEach((name, fi) => {
      const sec = s.sections[name];
      sec.chords.forEach((sym, i) => {
        const tokens = sec.lead && sec.lead[i] ? sec.lead[i].split(/\s+/) : null;
        list.push({
          sec, name, chord: chord(sym), lead: tokens, first: i === 0, last: i === sec.chords.length - 1,
          fill: (fi + i) % 2 ? 'toms' : 'snare', arp: s.arpIn.includes(name),
        });
      });
    });
    return { list, loop: s.sections.I.chords.length };
  }

  // ---------------- Studio: buses and effects ----------------
  function impulse(seconds, decay, gate) {
    const len = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const p = i / len;
        const shape = gate ? (p < 0.8 ? 0.9 - p * 0.3 : (1 - p) * 3) : Math.pow(1 - p, decay);
        d[i] = (Math.random() * 2 - 1) * shape;
      }
    }
    return buf;
  }

  function attach(audioCtx, dest) {
    ctx = audioCtx;
    out = ctx.createGain(); out.gain.value = enabled ? 0.45 : 0;
    const shelf = ctx.createBiquadFilter(); shelf.type = 'highshelf'; shelf.frequency.value = 6000; shelf.gain.value = 2;
    glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -16; glue.ratio.value = 3; glue.attack.value = 0.01; glue.release.value = 0.2;
    glue.connect(shelf); shelf.connect(out); out.connect(dest);

    // Reverb (hall) and gated reverb (snare)
    const rev = ctx.createConvolver(); rev.buffer = impulse(1.8, 3.4);
    reverbIn = ctx.createGain(); reverbIn.gain.value = 1;
    const revOut = ctx.createGain(); revOut.gain.value = 0.3;
    reverbIn.connect(rev); rev.connect(revOut); revOut.connect(glue);
    const gated = ctx.createConvolver(); gated.buffer = impulse(0.24, 1, true);
    gatedIn = ctx.createGain();
    const gatedOut = ctx.createGain(); gatedOut.gain.value = 0.35;
    gatedIn.connect(gated); gated.connect(gatedOut); gatedOut.connect(glue);

    // Ping-pong echo
    delayIn = ctx.createGain(); delayIn.gain.value = 1;
    delayL = ctx.createDelay(2); delayR = ctx.createDelay(2);
    const fbL = ctx.createGain(), fbR = ctx.createGain(); fbL.gain.value = fbR.gain.value = 0.38;
    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2600;
    const pL = ctx.createStereoPanner(), pR = ctx.createStereoPanner(); pL.pan.value = -0.7; pR.pan.value = 0.7;
    const dOut = ctx.createGain(); dOut.gain.value = 0.32;
    delayIn.connect(tone); tone.connect(delayL);
    delayL.connect(pL); delayL.connect(fbL); fbL.connect(delayR);
    delayR.connect(pR); delayR.connect(fbR); fbR.connect(delayL);
    pL.connect(dOut); pR.connect(dOut); dOut.connect(glue);

    // Pads/arps duck with the kick ("pump"), then go through a stereo chorus
    pumpBus = ctx.createGain(); pumpBus.connect(glue);
    padIn = ctx.createGain(); padIn.connect(pumpBus);
    [[0.012, 0.6, -0.75], [0.019, 0.83, 0.75]].forEach(([base, rate, pan]) => {
      const d = ctx.createDelay(0.1); d.delayTime.value = base;
      const lfo = ctx.createOscillator(), depth = ctx.createGain();
      lfo.frequency.value = rate; depth.gain.value = 0.003;
      lfo.connect(depth); depth.connect(d.delayTime); lfo.start();
      const p = ctx.createStereoPanner(); p.pan.value = pan;
      padIn.connect(d); d.connect(p); p.connect(pumpBus);
    });

    // Arpeggio: fixed left/right channels into the pumped pad bus, with an echo send
    [arpL, arpR] = [-0.45, 0.45].map(v => {
      const p = ctx.createStereoPanner(); p.pan.value = v; p.connect(padIn);
      const s = ctx.createGain(); s.gain.value = 0.35; p.connect(s); s.connect(delayIn);
      return p;
    });

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  }

  // ---------------- Instruments ----------------
  function env(g, t, a, d, s, r, dur, peak) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(peak * s, t + a, Math.max(0.005, d / 3));
    g.gain.setTargetAtTime(0.0001, t + Math.max(a, dur), Math.max(0.005, r / 3));
  }
  function panner(v) {
    let p = pans.get(v);
    if (!p) { p = ctx.createStereoPanner(); p.pan.value = v; p.connect(songBus); pans.set(v, p); }
    return p;
  }
  function route(node, pan, sends) {
    node.connect(pan ? panner(pan) : songBus);
    for (const [bus, amt] of sends || []) { const s = ctx.createGain(); s.gain.value = amt; node.connect(s); s.connect(bus); }
  }
  function osc(type, f, t, stop) { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.start(t); o.stop(stop); return o; }
  function noise(t, stop) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.start(t, Math.random() * 1.5); s.stop(stop); return s; }

  function vibrato(param, f, t, depth, delay) {
    const l = ctx.createOscillator(), g = ctx.createGain();
    l.frequency.value = 5.6; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(f * depth, t + delay);
    l.connect(g); g.connect(param); l.start(t); return l;
  }

  // Two-operator FM voice
  function fmVoice(t, f, dur, o) {
    const stop = t + dur + o.r * 2 + 0.05;
    const car = osc('sine', f, t, stop), mod = osc('sine', f * o.ratio, t, stop);
    if (o.glideFrom) {
      car.frequency.setValueAtTime(o.glideFrom, t); car.frequency.exponentialRampToValueAtTime(f, t + 0.07);
      mod.frequency.setValueAtTime(o.glideFrom * o.ratio, t); mod.frequency.exponentialRampToValueAtTime(f * o.ratio, t + 0.07);
    }
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(f * o.index, t);
    mg.gain.setTargetAtTime(f * o.indexEnd, t, o.indexTime);
    mod.connect(mg); mg.connect(car.frequency);
    if (o.vib) vibrato(car.frequency, f, t, o.vib, 0.28).stop(stop);
    const g = ctx.createGain(); env(g, t, o.a, o.d, o.s, o.r, dur, o.gain);
    car.connect(g);
    return g;
  }

  function lead(t, f, dur, glideFrom) {
    const kind = song.lead.kind;
    let g;
    if (kind === 'brass') {
      g = fmVoice(t, f, dur, { ratio: 1, index: 3.2, indexEnd: 1.3, indexTime: 0.1, a: 0.02, d: 0.2, s: 0.75, r: 0.12, gain: 0.12, vib: 0.006, glideFrom });
      const sq = osc('square', f * 1.003, t, t + dur + 0.4), lp = ctx.createBiquadFilter(), sg = ctx.createGain();
      lp.type = 'lowpass'; lp.frequency.value = 2200; env(sg, t, 0.02, 0.2, 0.7, 0.12, dur, 0.025);
      if (glideFrom) { sq.frequency.setValueAtTime(glideFrom, t); sq.frequency.exponentialRampToValueAtTime(f * 1.003, t + 0.07); }
      sq.connect(lp); lp.connect(sg); sg.connect(g);
    } else if (kind === 'reed') {
      g = fmVoice(t, f, dur, { ratio: 2, index: 2.2, indexEnd: 0.9, indexTime: 0.15, a: 0.03, d: 0.3, s: 0.8, r: 0.15, gain: 0.13, vib: 0.009, glideFrom });
    } else { // supersaw
      g = ctx.createGain(); env(g, t, 0.01, 0.25, 0.7, 0.18, dur, 0.075);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
      lp.frequency.setValueAtTime(5200, t); lp.frequency.setTargetAtTime(2400, t, 0.15);
      lp.connect(g);
      const stop = t + dur + 0.5;
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = 5.6; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.005, t + 0.3);
      l.connect(lg); l.start(t); l.stop(stop);
      for (const det of [-13, 0, 13]) {
        const o = osc('sawtooth', f, t, stop); o.detune.value = det;
        if (glideFrom) { o.frequency.setValueAtTime(glideFrom, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06); }
        lg.connect(o.frequency); o.connect(lp);
      }
    }
    route(g, 0.05, [[delayIn, 0.45], [reverbIn, 0.35]]);
  }

  function bass(t, f, dur) {
    if (song.bass.kind === 'fm') {
      const g = fmVoice(t, f, dur, { ratio: 1, index: song.bass.index, indexEnd: 0.5, indexTime: 0.035, a: 0.004, d: 0.18, s: 0.35, r: 0.05, gain: 0.36 });
      const sub = osc('sine', f, t, t + dur + 0.2), sg = ctx.createGain();
      env(sg, t, 0.004, 0.2, 0.6, 0.05, dur, 0.22); sub.connect(sg); sg.connect(g);
      route(g, 0);
    } else {
      const g = ctx.createGain(); env(g, t, 0.003, 0.15, 0.5, 0.05, dur, 0.3);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 7;
      lp.frequency.setValueAtTime(1800, t); lp.frequency.exponentialRampToValueAtTime(220, t + Math.max(0.08, dur));
      const stop = t + dur + 0.2;
      const o1 = osc('sawtooth', f, t, stop), o2 = osc('square', f * 0.5, t, stop), og = ctx.createGain(); og.gain.value = 0.5;
      o1.connect(lp); o2.connect(og); og.connect(lp); lp.connect(g);
      route(g, 0);
    }
  }

  function arpNote(t, f, dur, pan) {
    const g = ctx.createGain(); env(g, t, 0.003, 0.09, 0.15, 0.05, dur, 0.06);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 3;
    lp.frequency.setValueAtTime(4200, t); lp.frequency.exponentialRampToValueAtTime(900, t + 0.12);
    const o = osc('square', f, t, t + dur + 0.2);
    o.connect(lp); lp.connect(g);
    g.connect(pan < 0 ? arpL : arpR);
  }

  function pad(t, notes, dur) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.035, t + 0.35);
    g.gain.setTargetAtTime(0.0001, t + dur - 0.05, 0.25);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.5;
    lp.frequency.setValueAtTime(700, t); lp.frequency.linearRampToValueAtTime(1800, t + dur * 0.5); lp.frequency.linearRampToValueAtTime(900, t + dur);
    lp.connect(g); g.connect(padIn);
    const s = ctx.createGain(); s.gain.value = 0.6; g.connect(s); s.connect(reverbIn);
    const stop = t + dur + 0.7;
    for (const m of notes) for (const det of [-9, 9]) { const o = osc('sawtooth', mhz(m), t, stop); o.detune.value = det; o.connect(lp); }
  }

  // ---------------- Drums ----------------
  function kick(t) {
    const g = ctx.createGain(), o = osc('sine', 160, t, t + 0.4);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.11);
    g.gain.setValueAtTime(0.95, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    o.connect(g); route(g, 0);
    const c = noise(t, t + 0.02), hp = ctx.createBiquadFilter(), cg = ctx.createGain();
    hp.type = 'highpass'; hp.frequency.value = 3000; cg.gain.setValueAtTime(0.25, t); cg.gain.exponentialRampToValueAtTime(0.001, t + 0.015);
    c.connect(hp); hp.connect(cg); route(cg, 0);
    if (song.pump) {
      pumpBus.gain.cancelScheduledValues(t);
      pumpBus.gain.setValueAtTime(1 - song.pump, t);
      pumpBus.gain.setTargetAtTime(1, t + 0.02, 0.07);
    }
  }
  function snare(t, vel, clap) {
    const n = noise(t, t + 0.3), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 0.8;
    ng.gain.setValueAtTime(0.5 * vel, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    n.connect(bp); bp.connect(ng);
    const body = osc('triangle', 210, t, t + 0.15), bg = ctx.createGain();
    body.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    bg.gain.setValueAtTime(0.4 * vel, t); bg.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    body.connect(bg);
    const mix = ctx.createGain(); ng.connect(mix); bg.connect(mix);
    route(mix, 0, vel > 0.6 ? [[gatedIn, 0.8], [reverbIn, 0.15]] : [[reverbIn, 0.1]]);
    if (clap) for (let k = 0; k < 3; k++) {
      const tt = t + k * 0.011, c = noise(tt, tt + 0.12), cbp = ctx.createBiquadFilter(), cg = ctx.createGain();
      cbp.type = 'bandpass'; cbp.frequency.value = 1300; cbp.Q.value = 1.4;
      cg.gain.setValueAtTime(0.28, tt); cg.gain.exponentialRampToValueAtTime(0.001, tt + (k === 2 ? 0.14 : 0.03));
      c.connect(cbp); cbp.connect(cg); route(cg, 0.1, [[reverbIn, 0.3]]);
    }
  }
  function hat(t, open, accent) {
    const len = open ? 0.28 : 0.045;
    const n = noise(t, t + len + 0.02), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    hp.type = 'highpass'; hp.frequency.value = open ? 6500 : 8000;
    g.gain.setValueAtTime((open ? 0.13 : 0.11) * (accent ? 1 : 0.6), t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
    n.connect(hp); hp.connect(g); route(g, 0.3);
  }
  function crash(t) {
    const n = noise(t, t + 1.8), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    hp.type = 'highpass'; hp.frequency.value = 4500;
    g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.7);
    n.connect(hp); hp.connect(g); route(g, -0.35, [[reverbIn, 0.3]]);
  }
  function tom(t, f) {
    const o = osc('sine', f * 1.6, t, t + 0.4), g = ctx.createGain();
    o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g); route(g, f > 120 ? 0.3 : -0.3, [[gatedIn, 0.4]]);
  }

  // ---------------- Sequencer ----------------
  function scheduleStep(t) {
    const s16 = 60 / song.bpm / 4;
    const s = step % 16, bar = bars[Math.floor(step / 16)], sec = bar.sec;
    if (s % 2 === 1) t += song.swing * s16;

    // Drums (fill on the second half of each section's last bar)
    const fill = bar.last && bar.name !== 'I' && s >= 8;
    if (s === 0 && bar.first && bar.name !== 'I') crash(t);
    if (fill) {
      if (bar.fill === 'snare') { snare(t, 0.3 + (s - 8) * 0.09); if (s % 4 === 0) kick(t); }
      else {
        const toms = { 8: 190, 10: 190, 11: 150, 12: 150, 13: 110, 14: 110, 15: 90 };
        if (toms[s]) tom(t, toms[s]);
        if (s === 8 || s === 12) kick(t);
      }
    } else {
      if (sec.k[s] === 'x') kick(t);
      if (sec.s && sec.s[s] === 'x') snare(t, 0.95, sec.clap);
      if (sec.s && sec.s[s] === 'g') snare(t, 0.22);
      if (sec.oh && sec.oh[s] === 'x') hat(t, true, true);
      else if (sec.h && sec.h[s] === 'x') hat(t, false, s % 4 === 0);
    }

    // Bass
    const b = sec.bass[s];
    if (b && b !== '.') {
      let len = 1; while (s + len < 16 && sec.bass[s + len] === '.' && len < 2) len++;
      const root = mhz(bar.chord.bass);
      bass(t, b === 'O' ? root * 2 : b === 'F' ? root * 1.5 : root, s16 * len * 0.9);
    }

    // Pad on the bar, arpeggio on 16ths
    if (s === 0) pad(t, bar.chord.pad, s16 * 16);
    if (bar.arp) {
      const notes = bar.chord.arp, seq = notes.concat(notes.slice(1, -1).reverse());
      arpNote(t, mhz(seq[s % seq.length]), s16 * 0.9, s % 2 ? 0.45 : -0.45);
    }

    // Lead
    if (bar.lead) {
      let tok = bar.lead[s];
      if (tok && tok !== '.' && tok !== '-') {
        const glide = tok[0] === '~'; if (glide) tok = tok.slice(1);
        let len = 1; while (s + len < 16 && bar.lead[s + len] === '-') len++;
        let from = null;
        if (glide) { for (let k = s - 1; k >= 0; k--) { const p = bar.lead[k]; if (p && p !== '-' && p !== '.') { from = hz(p.replace('~', '')); break; } } }
        lead(t, hz(tok), s16 * len * 0.94, from);
      }
    }
  }

  function tick() {
    if (!song) return;
    const s16 = 60 / song.bpm / 4;
    while (nextTime < ctx.currentTime + 0.15) {
      scheduleStep(nextTime);
      nextTime += s16;
      step++;
      if (step >= bars.length * 16) step = loopBar * 16;
    }
  }

  function play(i) {
    if (!ctx) return;
    stop();
    song = SONGS[i];
    const a = arrange(song);
    bars = a.list; loopBar = a.loop; step = 0;
    const beat = 60 / song.bpm;
    delayL.delayTime.setValueAtTime(beat * 0.75, ctx.currentTime);
    delayR.delayTime.setValueAtTime(beat * 0.75, ctx.currentTime);
    songBus = ctx.createGain(); songBus.connect(glue); pans = new Map();
    nextTime = ctx.currentTime + 0.1;
    timer = setInterval(tick, 25);
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null; song = null;
    if (songBus && ctx) {
      const b = songBus, t = ctx.currentTime;
      b.gain.setValueAtTime(b.gain.value, t); b.gain.linearRampToValueAtTime(0, t + 0.12);
      setTimeout(() => b.disconnect(), 400);
    }
    songBus = null;
  }

  function toggle() {
    enabled = !enabled;
    if (ctx) out.gain.setTargetAtTime(enabled ? 0.45 : 0, ctx.currentTime, 0.05);
    return enabled;
  }

  // Dev helper: render a song offline and report levels (peak, RMS, silent seconds, NaNs).
  async function analyze(i, seconds) {
    const saved = [ctx, out, glue, pumpBus, padIn, reverbIn, gatedIn, delayIn, delayL, delayR, noiseBuf, songBus, song, bars, loopBar, step, nextTime, arpL, arpR, pans];
    const off = new OfflineAudioContext(2, 44100 * seconds, 44100);
    try {
      attach(off, off.destination);
      out.gain.value = 0.45;
      song = SONGS[i];
      const a = arrange(song); bars = a.list; loopBar = a.loop; step = 0; nextTime = 0.05;
      delayL.delayTime.value = delayR.delayTime.value = 60 / song.bpm * 0.75;
      songBus = off.createGain(); songBus.connect(glue); pans = new Map();
      const s16 = 60 / song.bpm / 4;
      while (nextTime < seconds - 0.3) { scheduleStep(nextTime); nextTime += s16; step++; if (step >= bars.length * 16) step = loopBar * 16; }
    } finally {
      [ctx, out, glue, pumpBus, padIn, reverbIn, gatedIn, delayIn, delayL, delayR, noiseBuf, songBus, song, bars, loopBar, step, nextTime, arpL, arpR, pans] = saved;
    }
    const buf = await off.startRendering();
    let peak = 0, sum = 0, nan = 0, silent = 0;
    const L = buf.getChannelData(0), R = buf.getChannelData(1), sr = buf.sampleRate;
    for (let sec = 0; sec < seconds; sec++) {
      let s2 = 0;
      for (let k = sec * sr; k < Math.min(L.length, (sec + 1) * sr); k++) {
        const v = Math.max(Math.abs(L[k]), Math.abs(R[k]));
        if (Number.isNaN(v)) { nan++; continue; }
        peak = Math.max(peak, v); s2 += L[k] * L[k]; sum += L[k] * L[k];
      }
      if (Math.sqrt(s2 / sr) < 0.005) silent++;
    }
    return { song: SONGS[i].name, peak: +peak.toFixed(3), rms: +Math.sqrt(sum / L.length).toFixed(3), silentSeconds: silent, nan };
  }

  return { attach, play, stop, toggle, analyze, SONGS };
})();
