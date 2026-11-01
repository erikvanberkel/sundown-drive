// Sundown Drive: procedural pixel-art sprites and parallax backgrounds.
const Art = (() => {
  const FONT = '"Press Start 2P", monospace';

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function canvas(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    return [c, g];
  }

  // Snap alpha to 0/255 so antialiased paths become crisp pixel edges.
  function crisp(c) {
    const g = c.getContext('2d');
    const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
    for (let i = 3; i < p.length; i += 4) p[i] = p[i] > 110 ? 255 : 0;
    g.putImageData(d, 0, 0);
    return c;
  }

  function sprite(w, h, worldW, draw, opts) {
    const [c, g] = canvas(w, h);
    draw(g, w, h);
    if (!opts || opts.crisp !== false) crisp(c);
    return Object.assign({ canvas: c, w, h, worldW, collide: true, hit: 0.35 }, opts || {});
  }

  const R = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  function poly(g, pts, c) {
    g.fillStyle = c; g.beginPath(); g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath(); g.fill();
  }
  function disc(g, x, y, r, c) { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }

  // ---------------- Roadside scenery ----------------
  function palm(lean, seed, pal) {
    pal = pal || { trunk: '#8a5a2b', ring: '#6b421d', hi: '#c08a4c', leaf: '#1f7a3a', leafHi: '#4fbf4a', nut: '#5a3410' };
    return sprite(64, 96, 1500, g => {
      const r = rng(seed);
      const baseX = 32, topX = 32 + lean * 12, topY = 26;
      for (let i = 0; i <= 18; i++) {
        const t = i / 18;
        const x = baseX + (topX - baseX) * t * t + Math.sin(t * 3) * lean * 2;
        const y = 96 - (96 - topY) * t;
        const w = 7 - t * 3;
        R(g, x - w / 2, y - 4, w, 5, i % 2 ? pal.trunk : pal.ring);
        R(g, x - w / 2, y - 4, 1, 5, pal.hi);
      }
      const fronds = [-2.9, -2.4, -1.9, -1.3, -0.9, -0.3, 0.2];
      fronds.forEach((a, k) => {
        const L = 22 + r() * 8, droop = 14 + r() * 8;
        const dx = Math.cos(a), dy = Math.sin(a);
        g.lineCap = 'round';
        for (const [lw, col, off] of [[5, pal.leaf, 0], [2, pal.leafHi, -1]]) {
          g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
          for (let s = 0; s <= 10; s++) {
            const t = s / 10;
            const px = topX + dx * L * t, py = topY + off + dy * L * t * 0.6 + droop * t * t;
            s ? g.lineTo(px, py) : g.moveTo(px, py);
          }
          g.stroke();
        }
        g.strokeStyle = pal.leaf; g.lineWidth = 1.5;
        for (let s = 2; s <= 9; s++) {
          const t = s / 10;
          const px = topX + dx * L * t, py = topY + dy * L * t * 0.6 + droop * t * t;
          g.beginPath(); g.moveTo(px, py); g.lineTo(px + (k % 2 ? 2 : -2), py + 5); g.stroke();
        }
      });
      disc(g, topX - 2, topY + 3, 2.5, pal.nut); disc(g, topX + 2, topY + 4, 2.5, pal.nut);
    }, { hit: 0.15 });
  }

  function bush(seed, c1, c2) {
    return sprite(48, 24, 1100, g => {
      const r = rng(seed);
      for (let i = 0; i < 9; i++) disc(g, 8 + r() * 32, 14 + r() * 4, 6 + r() * 4, c1);
      for (let i = 0; i < 7; i++) disc(g, 10 + r() * 28, 10 + r() * 4, 2 + r() * 2, c2);
    }, { collide: false });
  }

  function rock(seed, w, h, worldW, c, dark, hi) {
    return sprite(w, h, worldW, g => {
      const r = rng(seed), pts = [];
      for (let i = 0; i < 9; i++) {
        const a = Math.PI + (i / 8) * Math.PI;
        pts.push(w / 2 + Math.cos(a) * (w / 2 - 1) * (0.8 + r() * 0.2), h - 1 + Math.sin(a) * (h - 2) * (0.7 + r() * 0.3));
      }
      poly(g, pts, c);
      g.save(); g.clip();
      poly(g, [w * 0.55, 0, w, 0, w, h, w * 0.3, h], dark);
      for (let i = 0; i < 6; i++) R(g, r() * w * 0.5, r() * h * 0.6, 3 + r() * 5, 1, hi);
      g.restore();
    }, { hit: 0.7 });
  }

  function cactus(seed) {
    return sprite(32, 60, 900, g => {
      const r = rng(seed), G = '#2f8a3c', D = '#1d5e28', H = '#6fd36a';
      const col = (x, y, w, h) => { R(g, x, y, w, h, G); R(g, x + w - 2, y, 2, h, D); R(g, x + 1, y, 1, h, H); };
      col(12, 4, 8, 56); R(g, 13, 2, 6, 3, G);
      const ly = 20 + r() * 10 | 0, ry = 14 + r() * 10 | 0;
      col(4, ly, 8, 6); col(3, ly - 12, 6, 16); R(g, 4, ly - 14, 4, 3, G);
      col(20, ry, 8, 6); col(23, ry - 10, 6, 14); R(g, 24, ry - 12, 4, 3, G);
    }, { hit: 0.3 });
  }

  function pine(seed, snow) {
    return sprite(40, 80, 1300, g => {
      R(g, 17, 66, 6, 14, '#5a3a22');
      for (let i = 0; i < 4; i++) {
        const y = 6 + i * 15, hw = 8 + i * 4.5;
        poly(g, [20, y, 20 + hw, y + 22, 20 - hw, y + 22], '#163f2c');
        poly(g, [20, y, 20 - hw, y + 22, 20 - hw * 0.2, y + 22], '#2a6b45');
        if (snow) poly(g, [20, y, 20 + hw * 0.35, y + 7, 20 - hw * 0.35, y + 7], '#e8f4ff');
      }
    }, { hit: 0.2 });
  }

  function building(seed, w, h, body, neon) {
    return sprite(w, h, w * 32, g => {
      const r = rng(seed);
      R(g, 0, 8, w, h - 8, body);
      R(g, w - 6, 8, 6, h - 8, 'rgba(0,0,0,0.35)');
      R(g, 0, 6, w, 3, neon);
      R(g, w / 2 - 1, 0, 2, 7, '#888'); R(g, w / 2 - 1, 0, 2, 1, '#ff3030');
      for (let y = 14; y < h - 12; y += 7) for (let x = 4; x < w - 6; x += 6) {
        const v = r();
        R(g, x, y, 3, 4, v > 0.55 ? (v > 0.9 ? '#7ff7ff' : '#ffd86b') : '#15102a');
      }
      R(g, 0, h - 10, w, 10, '#0c0818'); R(g, 4, h - 8, w - 8, 6, neon);
    }, { crisp: false, hit: 0.9 });
  }

  function lamp(side) {
    return sprite(36, 96, 1100, g => {
      const px = side < 0 ? 4 : 30;
      R(g, px, 10, 3, 86, '#6b6f80'); R(g, px, 10, 1, 86, '#a7abc0');
      const ax = side < 0 ? px : 10;
      R(g, ax, 8, 22, 3, '#6b6f80');
      const hx = side < 0 ? 24 : 6;
      R(g, hx, 10, 8, 3, '#333'); R(g, hx + 1, 13, 6, 2, '#fff7c0');
      R(g, px - 2, 92, 7, 4, '#444');
    }, { hit: 0.12 });
  }

  function billboard(text, bg, fg, seed) {
    return sprite(88, 56, 2600, g => {
      R(g, 14, 30, 4, 26, '#5b4636'); R(g, 70, 30, 4, 26, '#5b4636');
      R(g, 2, 2, 84, 32, '#1a1a1a');
      R(g, 4, 4, 80, 28, bg);
      R(g, 4, 4, 80, 3, 'rgba(255,255,255,0.35)');
      g.font = `8px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillText(text, 45, 20);
      g.fillStyle = fg; g.fillText(text, 44, 19);
      for (let i = 0; i < 4; i++) R(g, 10 + i * 22, 34, 4, 2, '#ffe9a0');
    }, { crisp: false, hit: 0.85 });
  }

  function chevron(dir) {
    return sprite(28, 40, 700, g => {
      R(g, 12, 20, 4, 20, '#888');
      R(g, 0, 0, 28, 22, '#fff'); R(g, 1, 1, 26, 20, '#d81b2a');
      g.fillStyle = '#fff';
      for (let i = 0; i < 2; i++) {
        const x = 7 + i * 9;
        g.beginPath();
        if (dir > 0) { g.moveTo(x, 4); g.lineTo(x + 6, 11); g.lineTo(x, 18); g.lineTo(x + 3, 18); g.lineTo(x + 9, 11); g.lineTo(x + 3, 4); }
        else { g.moveTo(x + 9, 4); g.lineTo(x + 3, 11); g.lineTo(x + 9, 18); g.lineTo(x + 6, 18); g.lineTo(x, 11); g.lineTo(x + 6, 4); }
        g.fill();
      }
    }, { hit: 0.4 });
  }

  function umbrella(c1, c2) {
    return sprite(40, 40, 1100, g => {
      R(g, 19, 12, 2, 28, '#ddd');
      for (let i = 0; i < 6; i++) {
        const a0 = Math.PI + i * Math.PI / 6, a1 = a0 + Math.PI / 6;
        poly(g, [20, 14, 20 + Math.cos(a0) * 19, 14 + Math.sin(a0) * 10, 20 + Math.cos(a1) * 19, 14 + Math.sin(a1) * 10], i % 2 ? c1 : c2);
      }
      R(g, 4, 34, 32, 4, '#f4e1a1'); R(g, 6, 33, 12, 2, '#ff7aa8');
    }, { collide: false });
  }

  function neonTri(c) {
    return sprite(56, 52, 1700, g => {
      g.strokeStyle = c; g.lineWidth = 3; g.beginPath();
      g.moveTo(28, 3); g.lineTo(53, 50); g.lineTo(3, 50); g.closePath(); g.stroke();
      g.lineWidth = 1; g.strokeStyle = '#fff'; g.beginPath();
      g.moveTo(28, 3); g.lineTo(53, 50); g.lineTo(3, 50); g.closePath(); g.stroke();
    }, { hit: 0.2 });
  }

  function pillar(c) {
    return sprite(10, 100, 180, g => {
      R(g, 0, 0, 10, 100, c); R(g, 0, 0, 3, 100, 'rgba(255,255,255,0.4)'); R(g, 7, 0, 3, 100, 'rgba(0,0,0,0.3)');
    }, { hit: 1 });
  }

  function banner(text, bg, fg) {
    return sprite(240, 28, 5400, g => {
      R(g, 0, 0, 240, 28, '#111'); R(g, 2, 2, 236, 24, bg);
      for (let x = 2; x < 238; x += 12) R(g, x, 2, 6, 3, 'rgba(255,255,255,0.25)');
      g.font = `16px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#000'; g.fillText(text, 122, 17);
      g.fillStyle = fg; g.fillText(text, 120, 15);
    }, { crisp: false, collide: false, lift: 1150 });
  }

  // ---------------- Backgrounds ----------------
  // Returns { sky, far, near } canvases sized for a W x H view; far/near are 2W wide and tile.
  function background(bg, W, H, seed) {
    const r = rng(seed);
    const horizon = Math.round(H / 2);
    const [sky, sg] = canvas(W, H);
    const bands = 24, stops = bg.sky;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      sg.fillStyle = lerpStops(stops, t);
      sg.fillRect(0, Math.floor(i * (horizon + 20) / bands), W, Math.ceil((horizon + 20) / bands) + 1);
    }
    sg.fillStyle = stops[stops.length - 1]; sg.fillRect(0, horizon + 18, W, H);
    if (bg.stars) for (let i = 0; i < 90; i++) {
      sg.fillStyle = r() > 0.8 ? '#ffd6ff' : '#ffffff';
      sg.globalAlpha = 0.3 + r() * 0.7; sg.fillRect(r() * W | 0, r() * horizon * 0.8 | 0, 1, 1);
    }
    sg.globalAlpha = 1;
    if (bg.sun) {
      const s = bg.sun, sx = W * s.x, sy = horizon - s.y;
      const gr = sg.createLinearGradient(0, sy - s.r, 0, sy + s.r);
      gr.addColorStop(0, s.c1); gr.addColorStop(1, s.c2);
      sg.save(); sg.beginPath(); sg.arc(sx, sy, s.r, 0, Math.PI * 2); sg.clip();
      sg.fillStyle = gr; sg.fillRect(sx - s.r, sy - s.r, s.r * 2, s.r * 2);
      if (s.stripes) for (let k = 0; k < 7; k++) {
        const yy = Math.round(sy - s.r * 0.12 + k * (s.r * 0.16)); sg.clearRect(sx - s.r, yy, s.r * 2, Math.round(1 + k * 0.6));
      }
      sg.restore();
      if (s.stripes) { // repaint sky through the stripe gaps
        sg.globalCompositeOperation = 'destination-over';
        for (let i = 0; i < bands; i++) { sg.fillStyle = lerpStops(stops, i / (bands - 1)); sg.fillRect(0, Math.floor(i * (horizon + 20) / bands), W, Math.ceil((horizon + 20) / bands) + 1); }
        sg.globalCompositeOperation = 'source-over';
      }
    }
    if (bg.clouds) for (let i = 0; i < 7; i++) {
      const cx = r() * W, cy = 18 + r() * (horizon - 60), cw = 30 + r() * 60;
      sg.fillStyle = bg.clouds;
      sg.fillRect(cx, cy, cw, 3); sg.fillRect(cx + 6, cy - 2, cw * 0.6, 2); sg.fillRect(cx - 8, cy + 3, cw * 0.7, 2);
    }

    const far = layer(bg.far, W * 2, H, horizon, r);
    const near = layer(bg.near, W * 2, H, horizon, r);
    return { sky, far, near };
  }

  function lerpStops(stops, t) {
    const n = stops.length - 1, i = Math.min(n - 1, Math.floor(t * n)), f = t * n - i;
    const a = parseInt(stops[i].slice(1), 16), b = parseInt(stops[i + 1].slice(1), 16);
    const ch = s => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * f);
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }

  function ridge(W, r, rough, n) {
    const pts = new Array(n + 1).fill(0);
    let step = n, amp = 1;
    pts[0] = pts[n] = 0.5;
    while (step > 1) {
      const half = step / 2;
      for (let i = half; i < n; i += step) pts[i] = (pts[i - half] + pts[i + half]) / 2 + (r() - 0.5) * amp;
      step = half; amp *= rough;
    }
    return pts;
  }

  function layer(spec, W, H, horizon, r) {
    const [c, g] = canvas(W, H);
    if (!spec) return c;
    const base = horizon + (spec.base || 0);
    if (spec.sea) {
      g.fillStyle = spec.sea; g.fillRect(0, base - 2, W, H - base + 2);
      for (let i = 0; i < 120; i++) { g.fillStyle = spec.glint; g.fillRect(r() * W | 0, base + (r() * 14 | 0), 2 + r() * 6 | 0, 1); }
    }
    if (spec.type === 'mountains' || spec.type === 'mesa' || spec.type === 'hills') {
      const n = 64, pts = ridge(W, r, spec.rough || 0.55, n);
      g.fillStyle = spec.color; g.beginPath(); g.moveTo(0, H);
      for (let i = 0; i <= n; i++) {
        let v = pts[i];
        if (spec.type === 'mesa') v = Math.round(v * 3) / 3;
        g.lineTo(i * W / n, base - spec.height * (0.2 + v * 0.8));
      }
      g.lineTo(W, H); g.closePath(); g.fill();
      if (spec.cap) { // snow caps / rim light
        g.save(); g.clip();
        g.fillStyle = spec.cap;
        for (let i = 0; i <= n; i++) {
          const y = base - spec.height * (0.2 + pts[i] * 0.8);
          if (pts[i] > 0.55) g.fillRect(i * W / n - 4, y, 9, 4 + (pts[i] - 0.55) * 18);
        }
        g.restore();
      }
      if (spec.line) {
        g.strokeStyle = spec.line; g.lineWidth = 1; g.beginPath();
        for (let i = 0; i <= n; i++) {
          let v = pts[i]; if (spec.type === 'mesa') v = Math.round(v * 3) / 3;
          const y = base - spec.height * (0.2 + v * 0.8);
          i ? g.lineTo(i * W / n, y) : g.moveTo(0, y);
        }
        g.stroke();
      }
    } else if (spec.type === 'city') {
      let x = 0;
      while (x < W) {
        const bw = 14 + r() * 26 | 0, bh = spec.height * (0.3 + r() * 0.7) | 0;
        g.fillStyle = spec.color; g.fillRect(x, base - bh, bw - 2, bh + 40);
        for (let y = base - bh + 4; y < base - 2; y += 5) for (let wx = x + 2; wx < x + bw - 4; wx += 4)
          if (r() > 0.6) { g.fillStyle = r() > 0.85 ? spec.lit2 : spec.lit; g.fillRect(wx, y, 2, 2); }
        if (r() > 0.7) { g.fillStyle = spec.neon; g.fillRect(x + 2, base - bh - 3, bw - 6, 2); }
        x += bw;
      }
    } else if (spec.type === 'trees') {
      g.fillStyle = spec.color;
      for (let x = 0; x < W; x += 3) {
        const h = spec.height * (0.4 + r() * 0.6);
        g.beginPath(); g.moveTo(x - 6, base); g.lineTo(x, base - h); g.lineTo(x + 6, base); g.fill();
      }
      g.fillRect(0, base - 2, W, H);
    }
    if (spec.ground) { g.fillStyle = spec.ground; g.fillRect(0, base, W, H - base); }
    return c;
  }

  // Build the full sprite library once fonts are ready.
  function build() {
    const S = {};
    S.palms = [palm(1, 11), palm(-1, 23), palm(0.5, 37), palm(-0.6, 41)];
    S.darkPalms = [
      palm(1, 5, { trunk: '#2b0f3d', ring: '#1d0830', hi: '#ff3ea5', leaf: '#16052a', leafHi: '#ff3ea5', nut: '#16052a' }),
      palm(-1, 9, { trunk: '#2b0f3d', ring: '#1d0830', hi: '#3ef2ff', leaf: '#16052a', leafHi: '#3ef2ff', nut: '#16052a' }),
    ];
    S.bushes = [bush(3, '#2f8c3e', '#6fd36a'), bush(8, '#3a7d2c', '#9ad34a')];
    S.dryBush = bush(13, '#8a7a3a', '#c4b25a');
    S.rocks = [rock(4, 48, 30, 1500, '#b06a3a', '#7a4424', '#e0a070'), rock(9, 64, 44, 2200, '#a35a32', '#6a361c', '#d89060')];
    S.greyRocks = [rock(17, 48, 30, 1400, '#7d8794', '#4a5260', '#c4ccd8')];
    S.cacti = [cactus(2), cactus(7), cactus(12)];
    S.pines = [pine(1, false), pine(2, true)];
    S.buildings = [
      building(3, 48, 120, '#241542', '#ff3ea5'), building(5, 56, 96, '#1a2440', '#3ef2ff'),
      building(8, 40, 140, '#2e1238', '#ffe23b'), building(13, 60, 110, '#14213d', '#ff8a1f'),
    ];
    S.lampL = lamp(-1); S.lampR = lamp(1);
    S.billboards = [
      billboard('SUNDOWN', '#ff3ea5', '#fff6e8'), billboard('TURBO 88', '#1b1b6b', '#ffe23b'),
      billboard('COAST FM', '#ffe23b', '#c2185b'), billboard('NEON COLA', '#0b0b0b', '#3ef2ff'),
      billboard('DRIVE ON', '#ff8a1f', '#1a0033'),
    ];
    S.chevronL = chevron(-1); S.chevronR = chevron(1);
    S.umbrellas = [umbrella('#ff3ea5', '#fff6e8'), umbrella('#3ef2ff', '#ffe23b')];
    S.neonTris = [neonTri('#ff3ea5'), neonTri('#3ef2ff')];
    S.pillar = pillar('#e8e8f0');
    S.banners = {
      start: banner('START', '#c2185b', '#fff6e8'),
      check: banner('CHECKPOINT', '#1b1b6b', '#ffe23b'),
      goal: banner('GOAL', '#ffe23b', '#c2185b'),
    };
    S.cars = Traffic.build();
    S.player = CarArt.build();
    S.hair = CarArt.buildHair();
    return S;
  }

  async function ready() {
    try {
      await Promise.race([document.fonts.load(`8px ${FONT}`), new Promise(r => setTimeout(r, 2500))]);
    } catch (e) { /* fall back to monospace */ }
    return build();
  }

  return { ready, background, rng, lerpStops };
})();
