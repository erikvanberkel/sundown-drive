// Sundown Drive: the player's convertible, drawn at native game resolution (1 sprite px = 1 screen px).
// Variants: lean -2..2 (yaw while steering), brake 0/1, tread frame 0..2 (rolling tyres).
const CarArt = (() => {
  const CW = 144, CH = 74, OX = 8, OY = 8; // canvas size and car-local origin
  const PAINT = { hi: '#ffb4a4', light: '#ff6a5e', base: '#e8142c', mid: '#c00c24', dark: '#8a0618', deep: '#540312' };
  const SKIN = '#d99a72', SKIN_D = '#b8774f';

  function mk(h = CH) {
    const c = document.createElement('canvas'); c.width = CW; c.height = h;
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

  // ---------------- Crash tumble faces ----------------
  // A crash flips the car end over end as a box (Render.drawTumble). The rear face is the normal sprite;
  // these are the other three. The underside and top run rear (row 0) to nose (last row). Everything is in
  // car coordinates, so the driver's side stays on the left as it does through a real pitch flip.
  const LEN = 150; // box length in sprite px, shorter than life so the flip fits on screen
  const AXLE_R = 30, AXLE_F = 118;

  // Plan-view outline of the body, inset by `i` px
  function planPath(g, i = 0) {
    const l = 1 + i, r = 127 - i, t = 1 + i, b = LEN - 2 - i;
    g.beginPath();
    g.moveTo(l + 12, t);
    g.lineTo(r - 12, t);
    g.quadraticCurveTo(r, t, r, t + 12);
    g.lineTo(r, b - 24);
    g.quadraticCurveTo(r, b, r - 18, b);
    g.lineTo(l + 18, b);
    g.quadraticCurveTo(l, b, l, b - 24);
    g.lineTo(l, t + 12);
    g.quadraticCurveTo(l, t, l + 12, t);
    g.closePath();
  }

  function tyreUnder(g, x, zc) {
    const w = 24, h = 30, y = zc - 15;
    rr(g, x, y, w, h, 6, '#0b0b0d');
    R(g, x + 2, y + 3, w - 4, h - 6, '#1c1c21');
    for (let k = 0; k < 8; k++) R(g, x + 3, y + 4 + k * 3, w - 6, 1, '#09090b');
    R(g, x + w / 2 - 1, y + 3, 2, h - 6, '#0e0e11');
    R(g, x + 1, y + 7, 1, h - 14, '#3c3c46'); R(g, x + w - 2, y + 7, 1, h - 14, '#3c3c46');
  }

  function underside() {
    const [c, g] = mk(LEN);
    g.translate(OX, 0);
    const COAT = '#26222c', COAT_D = '#18151d', COAT_L = '#312c38';
    const MET = '#6c6a78', MET_L = '#a8a6b4', MET_D = '#45424f';
    const BOX = '#4a4652', BOX_L = '#6a6676';

    // red sill lip all round, then the undercoated floor pan with pressed ribs and a little grime
    planPath(g); g.fillStyle = PAINT.deep; g.fill();
    planPath(g, 4); g.fillStyle = COAT; g.fill();
    for (let v = 12; v < LEN - 10; v += 7) R(g, 10, v, 108, 1, COAT_L);
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 90; k++) R(g, 8 + rnd() * 112, 8 + rnd() * (LEN - 16), 1, 1, rnd() > 0.5 ? COAT_L : COAT_D);

    // bumpers at both ends
    R(g, 8, 2, 112, 2, '#5e5e68'); R(g, 8, 2, 112, 1, '#9a9caa');
    R(g, 10, LEN - 8, 108, 3, '#1c1c22');
    rr(g, 32, LEN - 18, 64, 7, 2, COAT_D);                       // radiator under-tray
    for (let x = 36; x < 92; x += 4) R(g, x, LEN - 17, 2, 5, '#2c2832');

    // wheel wells
    for (const zc of [AXLE_R, AXLE_F]) for (const wx of [3, 97]) rr(g, wx, zc - 18, 28, 36, 7, COAT_D);

    // frame rails and cross members
    for (const x of [36, 89]) { R(g, x, 8, 4, LEN - 18, '#3a3542'); R(g, x, 8, 1, LEN - 18, '#4e4858'); R(g, x + 3, 8, 1, LEN - 18, COAT_D); }
    for (const v of [50, 96]) { R(g, 36, v, 57, 4, '#3a3542'); R(g, 36, v, 57, 1, '#4e4858'); }

    // fuel tank with straps
    rr(g, 42, 56, 44, 18, 3, '#3a3442'); R(g, 44, 57, 40, 1, '#55505e');
    for (const x of [52, 75]) R(g, x, 56, 2, 18, '#5e5868');

    // engine sump, gearbox and drive shaft
    rr(g, 46, 102, 36, 24, 4, '#3e3a46');
    for (let v = 106; v < 124; v += 4) R(g, 49, v, 30, 1, '#55505e');
    disc(g, 64, 122, 2, '#9a98a8');
    rr(g, 54, 86, 20, 18, 4, BOX); R(g, 56, 87, 16, 1, BOX_L);
    R(g, 62, 38, 4, 50, MET); R(g, 62, 38, 1, 50, MET_L); R(g, 65, 38, 1, 50, MET_D);
    for (const v of [40, 84]) R(g, 61, v, 6, 3, MET_D);

    // rear differential and half shafts
    for (const [x0, x1] of [[29, 56], [72, 99]]) { R(g, x0, AXLE_R - 1, x1 - x0, 3, MET); R(g, x0, AXLE_R - 1, x1 - x0, 1, MET_L); }
    rr(g, 54, AXLE_R - 9, 20, 18, 5, BOX); R(g, 57, AXLE_R - 8, 14, 1, BOX_L);
    for (const [dx, dz] of [[-6, -5], [6, -5], [-6, 5], [6, 5]]) R(g, 64 + dx, AXLE_R + dz, 1, 1, MET_L);

    // exhaust: four tips into two silencers, then two pipes forward through the cats to the headers
    for (const px of [34, 43, 85, 94]) { R(g, px - 2, 0, 4, 7, '#8e94a2'); R(g, px - 1, 0, 2, 7, '#e2e6ee'); }
    for (const x of [30, 80]) {
      rr(g, x, 6, 19, 13, 4, '#5a5662');
      R(g, x + 2, 7, 15, 1, '#8a8694');
      R(g, x + 1, 14, 17, 2, '#6e5048'); // heat tint
    }
    for (const [x, bend] of [[50, 46], [76, 79]]) {
      R(g, Math.min(x, bend), 18, 4 + Math.abs(x - bend), 3, '#7a7684');
      R(g, x, 18, 3, 86, '#7a7684'); R(g, x, 18, 1, 86, '#b0acba'); R(g, x + 2, 18, 1, 86, MET_D);
      rr(g, x - 2, 64, 7, 16, 2, '#6a6672'); R(g, x - 1, 65, 1, 14, '#9a96a6');
    }
    for (const [x0, x1] of [[44, 52], [76, 84]]) R(g, x0, 102, x1 - x0, 2, '#6e5048');

    // suspension: wishbones and coil springs at each wheel, steering rack at the front
    for (const zc of [AXLE_R, AXLE_F]) for (const [ix, s] of [[29, 1], [99, -1]]) {
      const x0 = s > 0 ? ix : ix - 12;
      R(g, x0, zc - 8, 12, 2, MET); R(g, x0, zc + 6, 12, 2, MET);
      R(g, x0, zc - 8, 12, 1, MET_L); R(g, x0, zc + 6, 12, 1, MET_L);
      const sx = s > 0 ? ix + 2 : ix - 8;
      R(g, sx, zc - 5, 6, 11, MET_D);
      for (let k = 0; k < 6; k++) R(g, sx, zc - 5 + k * 2, 6, 1, MET_L);
    }
    R(g, 29, AXLE_F + 12, 70, 2, MET); R(g, 29, AXLE_F + 12, 70, 1, MET_L);

    for (const zc of [AXLE_R, AXLE_F]) { tyreUnder(g, 5, zc); tyreUnder(g, 99, zc); }
    finish(c);
    return c;
  }

  function topFace() {
    const [c, g] = mk(LEN);
    g.translate(OX, 0);
    planPath(g); g.save(); g.clip();

    // paint, darker toward the flanks where the body curves away
    R(g, 0, 0, 128, LEN, PAINT.base);
    R(g, 0, 0, 6, LEN, PAINT.dark); R(g, 122, 0, 6, LEN, PAINT.dark);
    R(g, 6, 0, 4, LEN, PAINT.mid); R(g, 118, 0, 4, LEN, PAINT.mid);
    R(g, 22, 0, 2, LEN, PAINT.light); R(g, 104, 0, 2, LEN, PAINT.light);

    // tail: bumper, light tops, trunk seams and the deck spoiler
    R(g, 0, 1, 128, 2, '#c4c6d2'); R(g, 0, 3, 128, 1, '#8a8c98');
    R(g, 11, 4, 33, 2, '#c80a20'); R(g, 85, 4, 32, 2, '#c80a20');
    R(g, 12, 8, 104, 1, PAINT.dark); R(g, 12, 36, 104, 1, PAINT.dark);
    R(g, 12, 8, 1, 29, PAINT.dark); R(g, 115, 8, 1, 29, PAINT.dark);
    R(g, 24, 11, 80, 4, PAINT.mid); R(g, 24, 11, 80, 1, PAINT.light); R(g, 24, 15, 80, 1, PAINT.dark);

    // cockpit tub, seats, console and dash
    rr(g, 12, 40, 104, 52, 6, '#3e1c22');
    rr(g, 14, 42, 100, 48, 5, '#1d0a0e');
    const seat = '#d9b48a', seatD = '#a9845c', seatH = '#f2d6ae';
    for (const sx of [28, 68]) {
      rr(g, sx, 46, 32, 8, 3, seatD);
      rr(g, sx, 52, 32, 22, 4, seat);
      R(g, sx + 3, 52, 26, 1, seatH);
      for (let k = 1; k < 4; k++) R(g, sx + k * 8, 55, 1, 17, seatD);
      rr(g, sx + 10, 43, 12, 5, 2, seat); R(g, sx + 12, 43, 8, 1, seatH);
    }
    R(g, 61, 48, 6, 36, '#2a1418'); disc(g, 64, 66, 2, '#c9ccd6');
    R(g, 14, 80, 100, 10, '#2a1418');
    rr(g, 34, 80, 20, 6, 3, '#121216');
    g.strokeStyle = '#121216'; g.lineWidth = 2;
    g.beginPath(); g.ellipse(44, 76, 8, 3, 0, 0, Math.PI * 2); g.stroke();

    // the crew from above: shoulders, crowns and arms; her hair streams back over the seat
    const crew = [[44, '#2e1a10', '#6a4428', SKIN, '#eef0f6', '#c4c8d6'], [84, '#ff4fa3', '#ffa0d4', '#e8a882', '#2bc8d8', '#1b92a6']];
    for (const [x, hair, hairHi, skin, shirt, shirtShade] of crew) {
      rr(g, x - 14, 52, 28, 10, 5, shirt); R(g, x + 6, 53, 6, 8, shirtShade);
      R(g, x - 12, 58, 4, 16, skin); R(g, x + 8, 58, 4, 16, skin);
      R(g, x - 3, 59, 6, 3, skin);
      disc(g, x, 55, 6, hair);
      R(g, x - 3, 51, 4, 2, hairHi);
    }
    for (let k = 0; k < 3; k++) {
      const hx = 82 + k * 3;
      strand(g, hx, 52, [[hx + 4, 48], [hx + 6 + k, 43], [hx + 11 + k, 40]], k === 1 ? 3 : 2, k % 2 ? '#c92a78' : '#ff4fa3', '#ffa8d8');
    }

    // windshield frame (glass goes in after the outline), mirrors
    R(g, 14, 90, 100, 8, '#2a1418');
    R(g, 16, 88, 96, 2, '#c9ccd6'); R(g, 16, 88, 96, 1, '#ffffff');
    R(g, 16, 88, 2, 10, '#c9ccd6'); R(g, 110, 88, 2, 10, '#c9ccd6');
    rr(g, 4, 92, 10, 5, 2, PAINT.base); R(g, 5, 92, 8, 1, PAINT.hi);
    rr(g, 114, 92, 10, 5, 2, PAINT.base); R(g, 115, 92, 8, 1, PAINT.hi);

    // hood: creases, vent slats, pop-up lamp lids, nose
    for (const x of [34, 93]) { R(g, x, 100, 1, 40, PAINT.light); R(g, x + 1, 100, 1, 40, PAINT.mid); }
    for (let k = 0; k < 5; k++) { R(g, 52, 108 + k * 3, 24, 2, PAINT.deep); R(g, 52, 110 + k * 3, 24, 1, PAINT.light); }
    for (const x of [10, 92]) {
      g.strokeStyle = PAINT.dark; g.lineWidth = 1; g.strokeRect(x + 0.5, 126.5, 25, 14);
      R(g, x + 1, 127, 24, 1, PAINT.light);
    }
    disc(g, 64, 140, 2, '#e0e2ea');
    R(g, 0, LEN - 6, 128, 2, PAINT.mid); R(g, 0, LEN - 4, 128, 3, '#1c1c22');
    g.restore();

    finish(c);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.translate(OX, 0);
    g.fillStyle = 'rgba(110,175,235,0.45)'; g.fillRect(18, 90, 92, 8);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath(); g.moveTo(30, 90); g.lineTo(36, 90); g.lineTo(32, 98); g.lineTo(26, 98); g.closePath(); g.fill();
    return c;
  }

  // Front of a crew member through the windshield: shades on, mouth open
  function faceFront(g, x, hair, hairHi, skin, shirt, shirtShade, long) {
    rr(g, x - 14, 9, 28, 12, 5, shirt);
    R(g, x - 12, 10, 6, 10, shirtShade);
    R(g, x - 3, 5, 6, 5, SKIN_D);
    if (long) rr(g, x - 9, -5, 18, 17, 5, hair);
    disc(g, x, 0, 6, skin);
    g.fillStyle = hair; g.beginPath(); g.arc(x, -1, 6.5, Math.PI, 0); g.fill();
    R(g, x - 4, -6, 5, 2, hairHi);
    R(g, x - 5, -1, 10, 2, '#101014'); R(g, x - 4, -1, 2, 1, '#6a7a9a'); R(g, x + 2, -1, 2, 1, '#6a7a9a');
    R(g, x - 1, 3, 3, 2, '#5a1018');
  }

  // Drawn as seen from in front, then mirrored into car coordinates
  function frontFace() {
    const [c, g] = mk();
    g.translate(OX, OY);

    g.strokeStyle = '#c9ccd6'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(19, 13); g.lineTo(27, 0); g.lineTo(101, 0); g.lineTo(109, 13); g.stroke();
    R(g, 27, -1, 74, 1, '#ffffff');
    faceFront(g, 84, '#2e1a10', '#6a4428', SKIN, '#eef0f6', '#c4c8d6', false);       // driver, on our right
    faceFront(g, 44, '#ff4fa3', '#ffa0d4', '#e8a882', '#2bc8d8', '#1b92a6', true);   // passenger
    R(g, 20, 12, 88, 5, '#1d0a0e'); R(g, 20, 12, 88, 1, '#3e1c22');
    rr(g, 7, 8, 10, 6, 2, PAINT.base); R(g, 8, 8, 8, 1, PAINT.hi);
    rr(g, 111, 8, 10, 6, 2, PAINT.base); R(g, 112, 8, 8, 1, PAINT.hi);

    R(g, 14, 44, 100, 16, '#0d0d10');
    tyre(g, 5, 24, 0); tyre(g, 99, 24, 0);

    bodyPath(g); g.save(); g.clip();
    for (let y = 16; y <= 52; y++) R(g, 0, y, 128, 1, rowColor(y));
    R(g, 0, 22, 5, 30, PAINT.dark); R(g, 123, 22, 5, 30, PAINT.dark);
    R(g, 5, 22, 2, 26, PAINT.mid); R(g, 121, 22, 2, 26, PAINT.mid);
    g.restore();

    // lamp clusters, grille, badge, bumper and plate
    for (const [x, white, amber] of [[10, 12, 27], [92, 102, 94]]) {
      rr(g, x, 31, 26, 7, 2, '#120204');
      R(g, white, 33, 14, 3, '#f4f6fc'); R(g, white, 33, 14, 1, '#ffffff');
      R(g, amber, 33, 7, 3, '#ffb020'); R(g, amber, 33, 7, 1, '#ffe08a');
    }
    rr(g, 40, 30, 48, 10, 2, '#120204');
    for (let k = 0; k < 4; k++) R(g, 42, 32 + k * 2, 44, 1, '#3a3a44');
    disc(g, 64, 25, 2, '#e0e2ea');
    R(g, 4, 42, 120, 2, '#f2f3f8'); R(g, 4, 44, 120, 1, '#8a8c98');
    R(g, 6, 48, 116, 2, '#1c1c22'); R(g, 30, 46, 68, 2, '#120204');
    rr(g, 52, 42, 25, 9, 1, '#5e5e68');
    R(g, 53, 43, 23, 7, '#f4eed2');
    plateText(g, 'SD 86', 56, 44, '#1a2a6a');

    finish(c);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.translate(OX, OY);
    g.globalCompositeOperation = 'destination-over';
    g.fillStyle = 'rgba(110,175,235,0.32)';
    g.beginPath(); g.moveTo(20, 12); g.lineTo(27, 1); g.lineTo(101, 1); g.lineTo(108, 12); g.closePath(); g.fill();

    const [m, mg] = mk();
    mg.translate(CW, 0); mg.scale(-1, 1);
    mg.drawImage(c, 0, 0);
    return m;
  }

  // deckRow: sprite row where the body starts; rows above it (crew, windshield) stand up from the cockpit
  // as their own plane, at seatZ for the rear view and screenZ for the front (car-space depth from centre).
  function buildTumble() {
    return { under: underside(), top: topFace(), front: frontFace(), length: LEN, deckRow: OY + 15, seatZ: -22, screenZ: 15 };
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

  return { build, buildHair, buildTumble, OX, OY, HAIR_FRAMES };
})();
