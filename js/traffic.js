// Sundown Drive: traffic vehicles (rear views), drawn in the same native-resolution style as the player car.
const Traffic = (() => {
  const FONT = '"Press Start 2P", monospace';

  function canvas(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    return [c, g];
  }
  const R = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  function rr(g, x, y, w, h, r, c) { g.fillStyle = c; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); }
  function disc(g, x, y, r, c) { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  function path(g, pts) {
    g.beginPath(); g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath();
  }
  function poly(g, pts, c) { g.fillStyle = c; path(g, pts); g.fill(); }

  // Paint palette from one base colour: stepped shades for 16-bit style banding.
  function pal(hex) {
    const n = parseInt(hex.slice(1), 16), rgb = [n >> 16, (n >> 8) & 255, n & 255];
    const f = k => '#' + rgb.map(v => Math.round(Math.max(0, Math.min(255, k > 1 ? v + (255 - v) * (k - 1) : v * k)))
      .toString(16).padStart(2, '0')).join('');
    return { hi: f(1.6), light: f(1.28), base: hex, mid: f(0.8), dark: f(0.6), deep: f(0.42) };
  }

  // rows: [[untilY, paletteKey], ...] painted top to bottom inside the current clip
  function bands(g, P, rows, x, w, y0) {
    let y = y0;
    for (const [until, key] of rows) { if (until >= y) R(g, x, y, w, until - y + 1, P[key]); y = until + 1; }
  }

  function bodyShape(g, P, x0, y0, x1, y1, r, rows) {
    g.save();
    g.beginPath(); g.roundRect(x0, y0, x1 - x0, y1 - y0, r); g.clip();
    bands(g, P, rows, x0, x1 - x0, y0);
    R(g, x0, y0 + 2, 3, y1 - y0, P.dark); R(g, x1 - 3, y0 + 2, 3, y1 - y0, P.dark);
    R(g, x0 + 3, y0 + 3, 2, y1 - y0, P.mid); R(g, x1 - 5, y0 + 3, 2, y1 - y0, P.mid);
    g.restore();
  }

  function tyre(g, x, y, w, h) {
    rr(g, x, y, w, h, 4, '#0b0b0d');
    R(g, x + 2, y + 2, w - 4, h - 3, '#1c1c21');
    for (let ty = y + 4; ty < y + h - 2; ty += 3) R(g, x + 2, ty, w - 4, 1, '#09090b');
    R(g, x + 1, y + 5, 1, h - 9, '#3c3c46'); R(g, x + w - 2, y + 5, 1, h - 9, '#3c3c46');
  }
  function under(g, x, y, w, h) { R(g, x, y, w, h, '#0d0d10'); for (let i = x + 6; i < x + w - 4; i += 7) R(g, i, y + 3, 2, h - 4, '#24242a'); }
  function pipe(g, x, y, r) {
    r = r || 3;
    disc(g, x, y, r, '#8e94a2'); disc(g, x - 0.5, y - 0.5, r * 0.8, '#e2e6ee'); disc(g, x, y, r * 0.5, '#0b0b0d');
  }

  function glass(g, pts, y0, y1, heads, opts) {
    opts = opts || {};
    g.save(); path(g, pts); g.clip();
    for (let y = y0; y <= y1; y++) R(g, 0, y, 200, 1, y < y0 + 2 ? '#4a5e80' : y > y1 - 2 ? '#141c2e' : '#1f2b44');
    for (const [hx, hy] of heads || []) {
      rr(g, hx - 9, hy + 3, 18, 12, 4, '#0f1522');
      disc(g, hx, hy, 4.5, '#0f1522');
    }
    g.fillStyle = 'rgba(150,180,220,0.55)';
    g.beginPath(); g.moveTo(pts[0] + 9, y0); g.lineTo(pts[0] + 15, y0); g.lineTo(pts[0] + 5, y1); g.lineTo(pts[0] - 1, y1); g.fill();
    if (opts.louvers) for (let y = y0 + 1; y < y1; y += 2) R(g, 0, y, 200, 1, '#08080c');
    if (opts.wiper) { g.strokeStyle = '#0a0a0e'; g.lineWidth = 1; g.beginPath(); g.moveTo(opts.wiper[0], opts.wiper[1]); g.lineTo(opts.wiper[2], opts.wiper[3]); g.stroke(); }
    g.restore();
  }

  function lamp(g, x, y, w, h, opts) {
    opts = opts || {};
    rr(g, x, y, w, h, 2, '#160204');
    const ih = opts.amber ? h - 5 : h - 2;
    R(g, x + 1, y + 1, w - 2, ih, '#d40c24');
    R(g, x + 1, y + 1, w - 2, 2, '#ff7080');
    if (opts.amber) R(g, x + 1, y + h - 4, w - 2, 3, '#ff9a1a');
    if (opts.cells) for (let cx = x + opts.cells; cx < x + w - 1; cx += opts.cells) R(g, cx, y + 1, 1, ih, '#7a0412');
  }

  const GLYPH = {
    0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'], 2: ['111', '001', '111', '100', '111'],
    3: ['111', '001', '111', '001', '111'], 4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
    6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '010', '010', '010'], 8: ['111', '101', '111', '101', '111'],
    9: ['111', '101', '111', '001', '111'], A: ['010', '101', '111', '101', '101'], D: ['110', '101', '101', '101', '110'],
    E: ['111', '100', '110', '100', '111'], K: ['101', '101', '110', '101', '101'], N: ['101', '111', '111', '101', '101'],
    R: ['110', '101', '110', '101', '101'], S: ['111', '100', '111', '001', '111'], T: ['111', '010', '010', '010', '010'],
    X: ['101', '101', '010', '101', '101'],
  };
  function plate(g, x, y, text) {
    rr(g, x, y, 24, 9, 1, '#5e5e68');
    R(g, x + 1, y + 1, 22, 7, '#f4eed2');
    let w = 0; for (const ch of text) w += ch === ' ' ? 2 : 4; w -= 1;
    let tx = x + Math.round((24 - w) / 2);
    for (const ch of text) {
      const gl = GLYPH[ch];
      if (gl) gl.forEach((row, j) => [...row].forEach((b, i) => { if (b === '1') R(g, tx + i, y + 2 + j, 1, 1, '#1a2a6a'); }));
      tx += ch === ' ' ? 2 : 4;
    }
  }

  // Crisp alpha + 1px dark outline, then pre-shrunk copies for distant draws.
  function finish(c) {
    const W = c.width, H = c.height, g = c.getContext('2d');
    const img = g.getImageData(0, 0, W, H), p = img.data;
    for (let i = 3; i < p.length; i += 4) p[i] = p[i] > 110 ? 255 : 0;
    const solid = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) solid[i] = p[i * 4 + 3] ? 1 : 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (solid[i]) continue;
      if ((x > 0 && solid[i - 1]) || (x < W - 1 && solid[i + 1]) || (y > 0 && solid[i - W]) || (y < H - 1 && solid[i + W])) {
        p[i * 4] = 20; p[i * 4 + 1] = 6; p[i * 4 + 2] = 14; p[i * 4 + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    const mips = [];
    let src = c;
    for (const k of [2, 4]) {
      const [m, mg] = canvas(Math.max(1, Math.round(W / k)), Math.max(1, Math.round(H / k)));
      mg.imageSmoothingEnabled = true; mg.imageSmoothingQuality = 'high';
      mg.drawImage(src, 0, 0, m.width, m.height);
      mips.push(m); src = m;
    }
    return mips;
  }

  function make(W, H, worldW, draw, lights) {
    const [c, g] = canvas(W, H);
    draw(g);
    const mips = finish(c);
    return { canvas: c, w: W, h: H, worldW, collide: true, hit: 0.9, lights, mips };
  }

  // ---------------- Vehicles ----------------
  function sedan(color, txt) {
    const P = pal(color);
    return make(112, 66, 520, g => {
      under(g, 18, 48, 76, 10); pipe(g, 28, 55, 2.6);
      tyre(g, 6, 47, 20, 18); tyre(g, 86, 47, 20, 18);
      poly(g, [24, 4, 88, 4, 99, 24, 13, 24], P.base);
      R(g, 24, 4, 64, 1, P.hi); R(g, 25, 5, 62, 1, P.light);
      glass(g, [28, 7, 84, 7, 93, 22, 19, 22], 7, 22, [[40, 16], [72, 16]]);
      bodyShape(g, P, 2, 23, 110, 53, 6,
        [[23, 'hi'], [25, 'light'], [29, 'base'], [30, 'hi'], [31, 'mid'], [41, 'base'], [46, 'mid'], [53, 'dark']]);
      lamp(g, 7, 32, 28, 10, { amber: true, cells: 6 }); lamp(g, 77, 32, 28, 10, { amber: true, cells: 6 });
      R(g, 51, 33, 10, 3, '#d8dae2'); R(g, 51, 35, 10, 1, '#8a8c98');
      R(g, 3, 45, 106, 3, '#eceef4'); R(g, 3, 48, 106, 1, '#80828e'); R(g, 5, 49, 102, 3, P.deep);
      plate(g, 44, 38, txt);
    }, [[21, 36], [91, 36]]);
  }

  function coupe(color, txt) {
    const P = pal(color);
    return make(120, 56, 540, g => {
      under(g, 14, 36, 92, 12);
      for (const x of [28, 35, 85, 92]) pipe(g, x, 47, 2.6);
      tyre(g, 4, 35, 24, 20); tyre(g, 92, 35, 24, 20);
      poly(g, [34, 3, 86, 3, 99, 18, 21, 18], P.base);
      R(g, 34, 3, 52, 1, P.hi);
      glass(g, [37, 5, 83, 5, 94, 17, 26, 17], 5, 17, [[48, 12], [72, 12]], { louvers: true });
      bodyShape(g, P, 1, 17, 119, 45, 6, [[17, 'hi'], [19, 'light'], [22, 'base'], [33, 'mid'], [38, 'dark'], [45, 'deep']]);
      rr(g, 6, 23, 108, 10, 1, '#0c0c10');
      for (let y = 24; y <= 31; y += 2) R(g, 8, y, 104, 1, y === 24 ? '#ff7080' : '#e0102a');
      R(g, 50, 23, 20, 10, '#0c0c10'); R(g, 55, 27, 10, 2, '#d8dae2');
      R(g, 24, 16, 3, 3, '#141418'); R(g, 93, 16, 3, 3, '#141418');
      rr(g, 6, 13, 108, 4, 1, P.mid); R(g, 6, 13, 108, 1, P.hi);
      R(g, 4, 36, 112, 6, '#1a1a20'); R(g, 4, 36, 112, 1, '#3a3a44');
      plate(g, 48, 33, txt);
    }, [[26, 28], [94, 28]]);
  }

  function compact(color, txt) {
    const P = pal(color);
    return make(100, 72, 470, g => {
      under(g, 16, 50, 68, 12); pipe(g, 24, 60, 2.4);
      tyre(g, 6, 52, 18, 19); tyre(g, 76, 52, 18, 19);
      g.save();
      g.beginPath(); g.moveTo(22, 3); g.lineTo(78, 3); g.quadraticCurveTo(88, 4, 90, 14); g.lineTo(95, 48);
      g.quadraticCurveTo(96, 57, 88, 57); g.lineTo(12, 57); g.quadraticCurveTo(4, 57, 5, 48); g.lineTo(10, 14);
      g.quadraticCurveTo(12, 4, 22, 3); g.closePath(); g.clip();
      bands(g, P, [[4, 'hi'], [6, 'light'], [30, 'base'], [31, 'hi'], [32, 'mid'], [44, 'base'], [50, 'mid'], [57, 'dark']], 0, 100, 2);
      R(g, 0, 10, 8, 50, P.dark); R(g, 92, 10, 8, 50, P.dark);
      g.restore();
      R(g, 18, 5, 64, 2, P.mid);
      glass(g, [20, 8, 80, 8, 85, 29, 15, 29], 8, 29, [[38, 20], [62, 20]], { wiper: [50, 28, 33, 18] });
      lamp(g, 5, 30, 13, 18, { amber: true }); lamp(g, 82, 30, 13, 18, { amber: true });
      R(g, 46, 33, 8, 3, '#d8dae2');
      R(g, 4, 50, 92, 6, '#1d1d24'); R(g, 4, 50, 92, 1, '#3c3c46');
      plate(g, 38, 41, txt);
    }, [[11, 36], [89, 36]]);
  }

  function pickup(color, txt) {
    const P = pal(color);
    return make(120, 80, 560, g => {
      under(g, 16, 60, 88, 12); pipe(g, 30, 70, 2.8);
      tyre(g, 6, 58, 22, 21); tyre(g, 92, 58, 22, 21);
      rr(g, 24, 2, 72, 26, 5, P.base); R(g, 28, 2, 64, 1, P.hi); R(g, 26, 3, 68, 2, P.light);
      glass(g, [32, 7, 88, 7, 90, 21, 30, 21], 7, 21, [[46, 16], [74, 16]]);
      R(g, 10, 24, 100, 10, '#26262c'); R(g, 10, 24, 100, 2, '#3a3a44');
      R(g, 4, 22, 8, 12, P.base); R(g, 108, 22, 8, 12, P.base); R(g, 4, 22, 8, 2, P.light); R(g, 108, 22, 8, 2, P.light);
      bodyShape(g, P, 3, 32, 117, 61, 2, [[32, 'hi'], [34, 'light'], [52, 'base'], [56, 'mid'], [61, 'dark']]);
      R(g, 12, 38, 96, 1, P.dark); R(g, 12, 52, 96, 1, P.hi);
      R(g, 53, 35, 14, 3, '#1a1a20'); R(g, 54, 35, 12, 1, '#d8dae2');
      lamp(g, 1, 30, 10, 22, { amber: true }); lamp(g, 109, 30, 10, 22, { amber: true });
      R(g, 2, 59, 116, 5, '#e2e4ec'); R(g, 2, 63, 116, 1, '#80828e');
      plate(g, 48, 56, txt);
    }, [[6, 38], [114, 38]]);
  }

  function van(color, label, labelBg, labelFg, txt) {
    const P = pal(color);
    return make(124, 118, 620, g => {
      tyre(g, 6, 96, 28, 21); tyre(g, 90, 96, 28, 21);
      R(g, 10, 88, 104, 12, '#141418');
      R(g, 10, 100, 20, 17, '#1a1a20'); R(g, 94, 100, 20, 17, '#1a1a20');
      R(g, 16, 104, 8, 2, '#bfc2cc'); R(g, 100, 104, 8, 2, '#bfc2cc');
      bodyShape(g, P, 2, 0, 122, 92, 2, [[1, 'hi'], [4, 'light'], [70, 'base'], [84, 'mid'], [92, 'dark']]);
      R(g, 6, 4, 112, 1, P.mid);
      if (label) {
        R(g, 4, 24, 116, 15, labelBg); R(g, 4, 24, 116, 1, 'rgba(255,255,255,0.4)');
        g.font = `8px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillText(label, 63, 33);
        g.fillStyle = labelFg; g.fillText(label, 62, 32);
      }
      R(g, 61, 4, 2, 84, P.dark);
      for (const y of [12, 44, 76]) { R(g, 3, y, 4, 6, '#3a3a44'); R(g, 117, y, 4, 6, '#3a3a44'); }
      for (const x of [46, 78]) {
        R(g, x, 6, 2, 80, '#c8cad4'); R(g, x + 1, 6, 1, 80, '#8a8c98');
        R(g, x - 3, 52, 8, 3, '#d8dae2');
      }
      for (const x of [18, 40, 82, 104]) R(g, x, 1, 4, 2, '#ffb02a');
      for (let x = 6; x < 118; x += 8) { R(g, x, 85, 4, 3, '#ff2a3a'); R(g, x + 4, 85, 4, 3, '#f4f4f4'); }
      R(g, 4, 92, 116, 4, '#d8dae2'); R(g, 4, 95, 116, 1, '#80828e');
      lamp(g, 4, 88, 14, 6); lamp(g, 106, 88, 14, 6);
      plate(g, 50, 89, txt);
    }, [[11, 91], [113, 91]]);
  }

  function suv(color, txt) {
    const P = pal(color);
    return make(112, 86, 540, g => {
      under(g, 16, 66, 80, 12); pipe(g, 26, 76, 2.8);
      tyre(g, 6, 64, 22, 21); tyre(g, 84, 64, 22, 21);
      g.save();
      g.beginPath(); g.moveTo(14, 3); g.lineTo(98, 3); g.quadraticCurveTo(104, 4, 105, 10); g.lineTo(107, 62);
      g.quadraticCurveTo(107, 69, 101, 69); g.lineTo(11, 69); g.quadraticCurveTo(5, 69, 5, 62); g.lineTo(7, 10);
      g.quadraticCurveTo(8, 4, 14, 3); g.closePath(); g.clip();
      bands(g, P, [[4, 'hi'], [6, 'light'], [32, 'base'], [33, 'hi'], [34, 'mid'], [56, 'base'], [62, 'mid'], [69, 'dark']], 0, 112, 2);
      R(g, 0, 8, 9, 62, P.dark); R(g, 103, 8, 9, 62, P.dark);
      g.restore();
      R(g, 12, 0, 88, 2, '#1a1a20'); R(g, 16, 0, 3, 4, '#1a1a20'); R(g, 93, 0, 3, 4, '#1a1a20');
      glass(g, [16, 8, 96, 8, 98, 30, 14, 30], 8, 30, [[40, 21], [72, 21]]);
      disc(g, 56, 47, 14, '#121216'); disc(g, 56, 47, 12, '#1e1e24');
      for (let a = 0; a < 12; a++) { const t = a / 12 * Math.PI * 2; R(g, 56 + Math.cos(t) * 12.5 - 0.5, 47 + Math.sin(t) * 12.5 - 0.5, 1, 1, '#09090b'); }
      disc(g, 56, 47, 7, '#b8bcc8'); disc(g, 56, 47, 5, '#8a8e9a'); disc(g, 56, 47, 2, '#2a2a30');
      R(g, 51, 42, 4, 1, '#eef0f6');
      lamp(g, 4, 34, 9, 22, { amber: true }); lamp(g, 99, 34, 9, 22, { amber: true });
      R(g, 4, 62, 104, 6, '#1d1d24'); R(g, 4, 62, 104, 1, '#3c3c46');
      plate(g, 44, 60, txt);
    }, [[8, 42], [104, 42]]);
  }

  function build() {
    return [
      sedan('#3a7bd5', 'RT 42'), sedan('#f2f2f0', 'NE 07'), sedan('#2fb36b', 'AE 55'), sedan('#8e44ad', 'XK 19'), sedan('#c9a227', 'TK 31'),
      coupe('#ffd23b', 'RA 70'), coupe('#20c4d8', 'SX 88'), coupe('#24242c', 'KR 12'), coupe('#ff7a1a', 'DN 64'),
      compact('#ff5fa0', 'TE 23'), compact('#7fd6ff', 'AN 90'), compact('#f2f2f0', 'RK 46'),
      pickup('#2e6fd8', 'NT 38'), pickup('#7a4a2a', 'DR 15'), pickup('#d82a2a', 'EX 77'),
      van('#ecebe4', 'NEON COLA', '#0b0b0b', '#3ef2ff', 'KA 03'), van('#ffe23b', 'COAST FM', '#c2185b', '#fff6e8', 'SN 61'),
      van('#3a8f6b', 'TURBO 88', '#1b1b6b', '#ffe23b', 'TR 29'),
      suv('#2a3a2e', 'XE 50'), suv('#b8b8c0', 'DA 84'),
    ];
  }

  return { build };
})();
