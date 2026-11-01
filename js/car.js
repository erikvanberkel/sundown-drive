// Sundown Drive: the player's convertible, drawn at native game resolution (1 sprite px = 1 screen px).
// Variants: lean -2..2 (yaw while steering), brake 0/1, tread frame 0..2 (rolling tyres).
const CarArt = (() => {
  const CW = 144, CH = 74, OX = 8, OY = 8; // canvas size and car-local origin
  const PAINT = { hi: '#ffb4a4', light: '#ff6a5e', base: '#e8142c', mid: '#c00c24', dark: '#8a0618', deep: '#540312' };
  const SKIN = '#d99a72', SKIN_D = '#b8774f';

  function mk() {
    const c = document.createElement('canvas'); c.width = CW; c.height = CH;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    return [c, g];
  }
  const R = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  function rr(g, x, y, w, h, r, c) { g.fillStyle = c; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); }
  function disc(g, x, y, r, c) { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }

  // Snap alpha to hard pixels, then add a 1px dark outline like hand-made sprite art.
  function finish(c) {
    const CW = c.width, CH = c.height;
    const g = c.getContext('2d');
    const img = g.getImageData(0, 0, CW, CH), p = img.data;
    for (let i = 3; i < p.length; i += 4) p[i] = p[i] > 110 ? 255 : 0;
    const solid = new Uint8Array(CW * CH);
    for (let i = 0; i < CW * CH; i++) solid[i] = p[i * 4 + 3] ? 1 : 0;
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const i = y * CW + x;
      if (solid[i]) continue;
      const n = (x > 0 && solid[i - 1]) || (x < CW - 1 && solid[i + 1]) || (y > 0 && solid[i - CW]) || (y < CH - 1 && solid[i + CW]);
      if (n) { p[i * 4] = 26; p[i * 4 + 1] = 4; p[i * 4 + 2] = 16; p[i * 4 + 3] = 255; }
    }
    g.putImageData(img, 0, 0);
  }

  const GLYPH = {
    S: ['111', '100', '111', '001', '111'], D: ['110', '101', '101', '101', '110'],
    8: ['111', '101', '111', '101', '111'], 6: ['111', '100', '111', '101', '111'],
  };
  function plateText(g, str, x, y, c) {
    for (const ch of str) {
      const gl = GLYPH[ch];
      if (gl) gl.forEach((row, j) => [...row].forEach((b, i) => { if (b === '1') R(g, x + i, y + j, 1, 1, c); }));
      x += ch === ' ' ? 2 : 4;
    }
  }

  function rowColor(y) {
    if (y <= 17) return PAINT.hi;
    if (y <= 20) return PAINT.light;
    if (y <= 26) return PAINT.base;
    if (y === 27) return PAINT.hi;      // deck crease
    if (y === 28) return PAINT.mid;
    if (y <= 37) return PAINT.base;
    if (y <= 44) return PAINT.mid;
    if (y <= 48) return PAINT.dark;
    return PAINT.deep;
  }

  function bodyPath(g) {
    g.beginPath();
    g.moveTo(18, 17);
    g.lineTo(110, 17);
    g.quadraticCurveTo(122, 18, 125, 25);
    g.lineTo(127, 44);
    g.quadraticCurveTo(127, 51, 120, 51);
    g.lineTo(8, 51);
    g.quadraticCurveTo(1, 51, 1, 44);
    g.lineTo(3, 25);
    g.quadraticCurveTo(6, 18, 18, 17);
    g.closePath();
  }

  function tyre(g, x, w, tread) {
    const y = 42, h = 22;
    rr(g, x, y, w, h, 4, '#0b0b0d');
    R(g, x + 2, y + 2, w - 4, h - 3, '#1c1c21');
    for (let k = -1; k < 8; k++) {
      const ty = y + 3 + k * 3 + tread;
      if (ty > y + 1 && ty < y + h - 2) R(g, x + 2, ty, w - 4, 1, '#09090b');
    }
    R(g, x + 1, y + 5, 1, h - 9, '#3c3c46');
    R(g, x + w - 2, y + 5, 1, h - 9, '#3c3c46');
  }

  function pipe(g, x, y) {
    disc(g, x, y, 3.5, '#8e94a2');
    disc(g, x - 0.5, y - 0.5, 2.8, '#e2e6ee');
    disc(g, x, y, 1.8, '#0b0b0d');
  }

  function person(g, x, top, hair, hairHi, skin, shirt, shirtShade) {
    rr(g, x - 14, 9, 28, 12, 5, shirt);
    R(g, x + 6, 10, 6, 10, shirtShade);
    R(g, x - 16, 11, 3, 6, skin); R(g, x + 13, 11, 3, 6, skin); // arms
    R(g, x - 3, 2, 6, 7, SKIN_D);
    disc(g, x, top, 6, hair);
    R(g, x - 7, top, 2, 3, skin); R(g, x + 5, top, 2, 3, skin);  // ears
    R(g, x - 4, top - 5, 5, 2, hairHi); R(g, x - 5, top - 3, 2, 2, hairHi);
  }

  function draw(g, L, brake, tread) {
    const bx = -L, cx = L * 1.5;
    g.translate(OX, OY);

    // ---- cockpit, far to near ----
    g.strokeStyle = '#c9ccd6'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(19 + cx, 13); g.lineTo(27 + cx, 0); g.lineTo(101 + cx, 0); g.lineTo(109 + cx, 13); g.stroke();
    R(g, 27 + cx, -1, 74, 1, '#ffffff');
    R(g, 20 + cx, 11, 88, 6, '#1d0a0e'); R(g, 20 + cx, 11, 88, 1, '#3e1c22');
    g.strokeStyle = '#121216'; g.lineWidth = 2;
    g.beginPath(); g.arc(44 + cx, 15, 8, Math.PI * 1.1, Math.PI * 1.9); g.stroke();

    person(g, 44 + cx, -1, '#2e1a10', '#6a4428', SKIN, '#eef0f6', '#c4c8d6');
    person(g, 84 + cx, -1, '#ff4fa3', '#ffa0d4', '#e8a882', '#2bc8d8', '#1b92a6');
    // (flowing hair is a separate animated overlay, see buildHair)

    // seats and headrests
    const seat = '#d9b48a', seatD = '#a9845c', seatH = '#f2d6ae';
    for (const sx of [28, 68]) {
      rr(g, sx + cx, 12, 32, 12, 4, seat);
      R(g, sx + 3 + cx, 12, 26, 1, seatH);
      for (let k = 1; k < 4; k++) R(g, sx + k * 8 + cx, 14, 1, 9, seatD);
      rr(g, sx + 10 + cx, 7, 12, 6, 3, seat);
      R(g, sx + 12 + cx, 7, 8, 1, seatH);
      R(g, sx + 10 + cx, 11, 12, 1, seatD);
    }

    // mirrors
    rr(g, 7 + cx, 8, 10, 6, 2, PAINT.base); R(g, 8 + cx, 8, 8, 1, PAINT.hi); R(g, 16 + cx, 12, 4, 2, '#2a2a30');
    rr(g, 111 + cx, 8, 10, 6, 2, PAINT.base); R(g, 112 + cx, 8, 8, 1, PAINT.hi); R(g, 108 + cx, 12, 4, 2, '#2a2a30');

    // ---- running gear ----
    R(g, 14 + bx, 44, 100, 16, '#0d0d10');
    for (let x = 30; x < 98; x += 6) R(g, x + bx, 52, 2, 7, '#25252b');
    tyre(g, 5 + L, 24 - L, tread);
    tyre(g, 99, 24 + L, tread);
    for (const px of [34, 43, 85, 94]) pipe(g, px + bx, 55);

    // side flank shows while yawing into a turn
    if (L !== 0) {
      const s = Math.sign(L), a = Math.abs(L) * 3;
      const ex = (s > 0 ? 126 : 2) + bx;
      g.fillStyle = PAINT.dark;
      g.beginPath(); g.moveTo(ex, 22); g.lineTo(ex + s * a, 20); g.lineTo(ex + s * a, 44); g.lineTo(ex, 49); g.closePath(); g.fill();
      R(g, Math.min(ex, ex + s * a), 21, a, 1, PAINT.light);
      R(g, Math.min(ex, ex + s * a), 34, a, 1, PAINT.mid);
    }

    // ---- body ----
    g.save(); g.translate(bx, 0);
    bodyPath(g); g.save(); g.clip();
    for (let y = 16; y <= 52; y++) R(g, 0, y, 128, 1, rowColor(y));
    R(g, 0, 22, 5, 30, PAINT.dark); R(g, 123, 22, 5, 30, PAINT.dark);
    R(g, 5, 22, 2, 26, PAINT.mid); R(g, 121, 22, 2, 26, PAINT.mid);
    R(g, 9, 19, 18, 1, PAINT.hi); R(g, 101, 19, 18, 1, PAINT.hi);
    g.restore();

    // deck spoiler lip
    R(g, 24, 15, 80, 3, PAINT.mid); R(g, 24, 15, 80, 1, PAINT.light); R(g, 24, 17, 80, 1, PAINT.dark);

    // tail-light bar
    rr(g, 9, 30, 110, 11, 2, '#120204');
    const cells = [[11, 44], [85, 117]];
    for (const [a, b] of cells) for (let x = a; x < b; x += 4) {
      R(g, x, 32, 3, 7, brake ? '#ff3a4c' : '#c80a20');
      R(g, x, 32, 3, 2, brake ? '#ffffff' : '#ff6a78');
      R(g, x, 38, 3, 1, brake ? '#ff1830' : '#7a0412');
    }
    for (const x of [46, 75]) { R(g, x, 32, 7, 7, '#c4c6d2'); R(g, x, 32, 7, 2, '#f4f6fc'); R(g, x, 38, 7, 1, '#8a8c98'); }
    R(g, 55, 31, 18, 9, '#1e1e24');
    R(g, 60, 34, 8, 3, '#e0e2ea'); R(g, 60, 36, 8, 1, '#8a8c98');

    // chrome bumper, rubber strip, plate
    R(g, 4, 42, 120, 2, '#f2f3f8'); R(g, 4, 44, 120, 1, '#8a8c98');
    R(g, 6, 48, 116, 2, '#1c1c22');
    rr(g, 52, 42, 25, 9, 1, '#5e5e68');
    R(g, 53, 43, 23, 7, '#f4eed2');
    plateText(g, 'SD 86', 56, 44, '#1a2a6a');
    g.restore();
  }

  // Tinted glass goes in after the outline pass so it stays see-through.
  function glass(g, L) {
    const cx = L * 1.5;
    g.save();
    g.translate(OX, OY);
    g.globalCompositeOperation = 'destination-over';
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.beginPath(); g.moveTo(40 + cx, 1); g.lineTo(48 + cx, 1); g.lineTo(38 + cx, 12); g.lineTo(30 + cx, 12); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(92 + cx, 1); g.lineTo(96 + cx, 1); g.lineTo(87 + cx, 12); g.lineTo(83 + cx, 12); g.closePath(); g.fill();
    g.fillStyle = 'rgba(110,175,235,0.32)';
    g.beginPath(); g.moveTo(20 + cx, 12); g.lineTo(27 + cx, 1); g.lineTo(101 + cx, 1); g.lineTo(108 + cx, 12); g.closePath(); g.fill();
    g.restore();
  }

  function make(L, brake, tread) {
    const [c, g] = mk();
    draw(g, L, brake, tread);
    finish(c);
    g.setTransform(1, 0, 0, 1, 0, 0);
    glass(g, L);
    return { canvas: c, w: CW, h: CH, worldW: 540, collide: true, hit: 0.9, ox: OX, oy: OY };
  }

  function build() {
    const out = {};
    for (let L = -2; L <= 2; L++) for (const b of [0, 1]) for (let t = 0; t < 3; t++) out[`${L}:${b}:${t}`] = make(L, b, t);
    return out;
  }

  // ---------------- Wind-blown hair overlay ----------------
  // Drawn over the car (same top-left), so strands can flow over the headrests toward the camera.
  // wind 0..3 (parked .. flat out / boosting), frame 0..5 flutter cycle, lean -2..2 swings the hair outward.
  const HAIR_H = 40, HAIR_FRAMES = 6;

  function strand(g, ox, oy, pts, width, col, hiCol) {
    for (const [lw, c, dy] of [[width, col, 0], [Math.max(1, width - 2), hiCol, -1]]) {
      g.strokeStyle = c; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(ox, oy + dy);
      for (const [x, y] of pts) g.lineTo(x, y + dy);
      g.stroke();
    }
  }

  // Points along a hair strand: streams sideways/back with a travelling wave that grows toward the tip.
  function flow(ox, oy, len, side, drop, amp, phase, k) {
    const pts = [];
    for (let s = 1; s <= 8; s++) {
      const t = s / 8;
      const wave = Math.sin(phase + t * 5.5 + k * 1.3) * amp * t;
      pts.push([ox + side * len * t, oy + drop * t + wave]);
    }
    return pts;
  }

  function drawHair(g, L, wind, frame) {
    const cx = L * 1.5;
    const phase = frame / HAIR_FRAMES * Math.PI * 2;
    // Turning pushes hair to the outside of the bend; base drift is to the right.
    const side = Math.max(-1.1, Math.min(1.7, 1 - L * 0.65));
    g.translate(OX, OY);

    // Passenger: long magenta hair
    const px = 84 + cx;
    const PINK = '#ff4fa3', PINK_D = '#c92a78', PINK_HI = '#ffa8d8';
    if (wind === 0) {
      for (const sx of [-6, 6]) {
        strand(g, px + sx, -1, [[px + sx * 1.15, 5], [px + sx * 1.2, 11]], 4, PINK_D, PINK);
      }
    } else {
      const len = 6 + wind * 7, amp = 0.8 + wind * 0.9;
      for (let k = 0; k < 4; k++) {
        const ox = px + 2 + k, oy = -3 + k * 2;
        const pts = flow(ox, oy, len * (0.75 + k * 0.12), side, 3 + k * 2.5 - wind * 0.5, amp, phase, k);
        strand(g, ox, oy, pts, k === 1 ? 5 : 4, k % 2 ? PINK_D : PINK, PINK_HI);
      }
      // loose wisps whipping at the tips
      if (wind >= 2) {
        const tip = flow(px + 4, 0, len * 1.15, side, 6, amp * 1.4, phase + 1.7, 5);
        strand(g, px + 4, 0, tip, 2, PINK_D, PINK);
      }
      strand(g, px - 6, -1, [[px - 7, 4], [px - 7 + Math.sin(phase) * 0.6 * wind, 8]], 3, PINK_D, PINK);
    }

    // Driver: dark 80s mullet with tufts on top
    const dx = 44 + cx;
    const BR = '#2e1a10', BR_HI = '#6a4428';
    if (wind === 0) {
      strand(g, dx - 4, -6, [[dx - 1, -7], [dx + 3, -6]], 3, BR, BR_HI);
    } else {
      const dside = side * 0.8;
      for (let k = 0; k < 3; k++) {
        const ox = dx - 3 + k * 3, oy = -6 + Math.abs(k - 1);
        strand(g, ox, oy, flow(ox, oy, 2 + wind * 1.8, dside, 1.5, 0.5 + wind * 0.35, phase + k, k), 2, BR, BR_HI);
      }
      for (let k = 0; k < 2; k++) {
        const ox = dx + 2 + k * 2, oy = 2 + k;
        strand(g, ox, oy, flow(ox, oy, 2 + wind * 1.7, dside, 3 + k, 0.5 + wind * 0.4, phase + 2 + k, k), 2, BR, BR_HI);
      }
    }
  }

  function buildHair() {
    const out = {};
    for (let L = -2; L <= 2; L++) for (let w = 0; w <= 3; w++) for (let f = 0; f < HAIR_FRAMES; f++) {
      const c = document.createElement('canvas'); c.width = CW; c.height = HAIR_H;
      const g = c.getContext('2d');
      drawHair(g, L, w, f);
      finish(c);
      out[`${L}:${w}:${f}`] = c;
    }
    return out;
  }

  return { build, buildHair, OX, OY, HAIR_FRAMES };
})();
