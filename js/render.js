// Sundown Drive: pseudo-3D road renderer (segment projection, sprite scaling, parallax).
const Render = (() => {
  const W = 480, H = 270;
  let ctx, bgs = [];

  function init(canvas, backgrounds) {
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    bgs = backgrounds;
  }

  const lerp = (a, b, t) => a + (b - a) * t;

  function project(p, camX, camY, camZ, depth) {
    p.camera.x = (p.world.x || 0) - camX;
    p.camera.y = (p.world.y || 0) - camY;
    p.camera.z = (p.world.z || 0) - camZ;
    p.screen.scale = depth / p.camera.z;
    p.screen.x = Math.round(W / 2 + p.screen.scale * p.camera.x * W / 2);
    p.screen.y = Math.round(H / 2 - p.screen.scale * p.camera.y * H / 2);
    p.screen.w = Math.round(p.screen.scale * Track.ROAD_W * W / 2);
  }

  function quad(x1, y1, x2, y2, x3, y3, x4, y4, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4);
    ctx.closePath(); ctx.fill();
  }

  function roadStrip(x1, y1, w1, x2, y2, w2, fog, c) {
    const lanes = Track.LANES;
    const r1 = w1 / 6, r2 = w2 / 6, l1 = w1 / 22, l2 = w2 / 22;
    ctx.fillStyle = c.grass;
    ctx.fillRect(0, y2, W, y1 - y2);
    quad(x1 - w1 - r1, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - r2, y2, c.rumble);
    quad(x1 + w1 + r1, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 + r2, y2, c.rumble);
    quad(x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2, c.road);
    // Solid edge lines just inside the rumble strips
    const e1 = w1 / 22, e2 = w2 / 22, g1 = w1 / 40, g2 = w2 / 40;
    quad(x1 - w1 + g1, y1, x1 - w1 + g1 + e1, y1, x2 - w2 + g2 + e2, y2, x2 - w2 + g2, y2, c.edge);
    quad(x1 + w1 - g1 - e1, y1, x1 + w1 - g1, y1, x2 + w2 - g2, y2, x2 + w2 - g2 - e2, y2, c.edge);
    if (c.lane) {
      const lw1 = w1 * 2 / lanes, lw2 = w2 * 2 / lanes;
      let lx1 = x1 - w1 + lw1, lx2 = x2 - w2 + lw2;
      for (let l = 1; l < lanes; l++, lx1 += lw1, lx2 += lw2)
        quad(lx1 - l1 / 2, y1, lx1 + l1 / 2, y1, lx2 + l2 / 2, y2, lx2 - l2 / 2, y2, c.lane);
    }
    if (fog > 0.01) {
      ctx.globalAlpha = fog; ctx.fillStyle = c.fog;
      ctx.fillRect(0, y2, W, y1 - y2);
      ctx.globalAlpha = 1;
    }
  }

  // ---------------- Sky & backdrop ----------------
  // Wrap-around panorama strip, scrolled horizontally by `offset` pixels.
  function pano(img, offset, y, alpha) {
    if (!img || alpha <= 0.01) return;
    const iw = img.width, ih = img.height, sx = ((Math.floor(offset) % iw) + iw) % iw;
    const first = Math.min(W, iw - sx);
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, sx, 0, first, ih, 0, y, first, ih);
    if (first < W) ctx.drawImage(img, 0, 0, W - first, ih, first, y, W - first, ih);
    ctx.globalAlpha = 1;
  }

  function hexRGB(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function stopAt(stops, t) {
    const n = stops.length - 1, i = Math.min(n - 1, Math.floor(t * n)), f = t * n - i;
    const a = hexRGB(stops[i]), b = hexRGB(stops[i + 1]);
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  }

  // Sky gradient for theme A blended toward B by t, at 15-bit colour depth like the old arcade boards.
  let skyCol = null, skyKey = '';
  function skyGradient(ia, ib, t) {
    const key = ia + ':' + ib + ':' + Math.round(t * 120);
    if (key !== skyKey) {
      skyKey = key;
      if (!skyCol) { skyCol = document.createElement('canvas'); skyCol.width = 1; skyCol.height = H; }
      const g = skyCol.getContext('2d'), img = g.createImageData(1, H), d = img.data;
      const A = bgs[ia].stops, B = bgs[ib].stops, horizon = H / 2 + 2;
      for (let y = 0; y < H; y++) {
        const ty = Math.min(1, y / horizon), a = stopAt(A, ty), b = stopAt(B, ty);
        for (let c = 0; c < 3; c++) d[y * 4 + c] = Math.min(255, Math.round((a[c] + (b[c] - a[c]) * t) / 8) * 8);
        d[y * 4 + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    }
    ctx.drawImage(skyCol, 0, 0, 1, H, 0, 0, W, H);
  }

  function sun(set, offset, alpha) {
    const s = set.sun;
    if (!s || alpha <= 0.01) return;
    let x = ((s.x - offset) % set.PW + set.PW) % set.PW;
    if (x > W + s.glow.width / 2) x -= set.PW;
    if (x < -s.glow.width / 2) return;
    ctx.globalAlpha = alpha;
    ctx.drawImage(s.glow, Math.round(x - s.glow.width / 2), Math.round(s.y - s.glow.height / 2));
    ctx.drawImage(s.canvas, Math.round(x - s.canvas.width / 2), Math.round(s.y - s.canvas.height / 2));
    ctx.globalAlpha = 1;
  }

  // Sky decor, far to near: stars, sun, clouds. Each layer scrolls at its own rate through curves.
  function skyDecor(set, G, alpha) {
    pano(set.stars, G.skyOffset * 0.5, 0, alpha);
    sun(set, G.skyOffset, alpha);
    pano(set.clouds, G.skyOffset * 1.3, 0, alpha);
  }

  function hills(set, G, playerY, alpha) {
    const clamp = v => Math.max(-22, Math.min(22, v));
    pano(set.far, G.farOffset, clamp(playerY * 0.0012), alpha);
    pano(set.near, G.nearOffset, clamp(playerY * 0.0022), alpha);
  }

  function horizonHaze(color) {
    const h = H / 2, [r, g, b] = hexRGB(color);
    const gr = ctx.createLinearGradient(0, h - 16, 0, h + 10);
    gr.addColorStop(0, `rgba(${r},${g},${b},0)`);
    gr.addColorStop(0.6, `rgba(${r},${g},${b},0.38)`);
    gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = gr; ctx.fillRect(0, h - 16, W, 26);
  }

  function sprite(s, scale, x, y, clipY, offX) {
    const destW = s.worldW * scale * W / 2;
    const destH = destW * s.h / s.w;
    if (destW < 0.5 || destW > W * 4) return;
    let dx = x + destW * offX;
    let dy = y - destH - (s.lift ? s.lift * scale * W / 2 : 0);
    const clipH = clipY ? Math.max(0, dy + destH - clipY) : 0;
    if (clipH >= destH) return null;
    // Pre-shrunk copies keep distant sprites from shimmering
    let src = s.canvas;
    if (s.mips) { if (destW < s.w * 0.3) src = s.mips[1]; else if (destW < s.w * 0.6) src = s.mips[0]; }
    const sw = src.width, sh = src.height;
    ctx.drawImage(src, 0, 0, sw, sh - (sh * clipH / destH), dx | 0, dy | 0, Math.ceil(destW), Math.ceil(destH - clipH));
    return { dx, dy, destW, destH };
  }

  function frame(G, P) {
    const T = G.track, segs = T.segments, SEG = Track.SEG;
    const base = Track.segAt(G.position);
    const basePct = (G.position % SEG) / SEG;
    const pSeg = Track.segAt(G.position + P.playerZ);
    const pPct = ((G.position + P.playerZ) % SEG) / SEG;
    const playerY = lerp(pSeg.p1.world.y, pSeg.p2.world.y, pPct);
    const shakeX = G.shake ? (Math.random() - 0.5) * G.shake * 6 : 0;
    const shakeY = G.shake ? (Math.random() - 0.5) * G.shake * 4 : 0;

    ctx.save();
    ctx.translate(shakeX | 0, shakeY | 0);

    // Backdrop: the sky gradient and scenery blend from the previous stage's look over SKY_TRANSITION segments
    const s = pSeg.stage, into = pSeg.index - T.stageStarts[s];
    const t = s === 0 ? 1 : Math.min(1, into / Track.SKY_TRANSITION);
    const prev = Math.max(0, s - 1);
    skyGradient(prev, s, t);
    if (t < 1) skyDecor(bgs[prev], G, 1 - t);
    skyDecor(bgs[s], G, t);
    if (t < 1) hills(bgs[prev], G, playerY, 1 - t);
    hills(bgs[s], G, playerY, t);
    horizonHaze(pSeg.color.fog);

    // Road
    let maxy = H, x = 0, dx = -(base.curve * basePct);
    const camX = G.playerX * Track.ROAD_W, camY = playerY + P.cameraHeight;
    const visible = [];
    for (let n = 0; n < P.drawDistance && base.index + n < segs.length; n++) {
      const seg = segs[base.index + n];
      seg.clip = maxy;
      project(seg.p1, camX - x, camY, G.position, P.cameraDepth);
      project(seg.p2, camX - x - dx, camY, G.position, P.cameraDepth);
      x += dx; dx += seg.curve;
      visible.push(seg);
      if (seg.p1.camera.z <= P.cameraDepth || seg.p2.screen.y >= seg.p1.screen.y || seg.p2.screen.y >= maxy) continue;
      const d = n / P.drawDistance;
      const fog = (1 - Math.exp(-d * d * seg.fogDensity)) * 0.9;
      roadStrip(seg.p1.screen.x, seg.p1.screen.y, seg.p1.screen.w, seg.p2.screen.x, seg.p2.screen.y, seg.p2.screen.w, fog, seg.color);
      maxy = seg.p1.screen.y;
    }

    // Sprites & traffic, far to near
    for (let n = visible.length - 1; n >= 0; n--) {
      const seg = visible[n];
      for (const c of seg.cars) {
        const pct = (c.z % SEG) / SEG;
        const sc = lerp(seg.p1.screen.scale, seg.p2.screen.scale, pct);
        const sx = lerp(seg.p1.screen.x, seg.p2.screen.x, pct) + sc * c.offset * Track.ROAD_W * W / 2;
        const sy = lerp(seg.p1.screen.y, seg.p2.screen.y, pct);
        const box = sprite(c.sprite, sc, sx, sy, seg.clip, -0.5);
        if (box && Track.THEMES[seg.stage].night && c.sprite.lights) tailGlow(c.sprite, box, seg.clip);
      }
      for (const sp of seg.sprites) {
        const sc = seg.p1.screen.scale;
        const sx = seg.p1.screen.x + sc * sp.offset * Track.ROAD_W * W / 2;
        sprite(sp.source, sc, sx, seg.p1.screen.y, seg.clip, sp.offset === 0 ? -0.5 : sp.offset < 0 ? -1 : 0);
      }
      if (seg === pSeg) drawPlayer(G, P);
    }
    if (!visible.includes(pSeg)) drawPlayer(G, P);

    drawParticles(G);
    if (G.boosting > 0) speedLines(G);
    ctx.restore();
  }

  function tailGlow(s, box, clipY) {
    ctx.globalCompositeOperation = 'lighter';
    const r = Math.max(2, box.destW * 0.16);
    for (const [lx, ly] of s.lights) {
      const gx = box.dx + lx / s.w * box.destW, gy = box.dy + ly / s.h * box.destH;
      if (!clipY || gy < clipY) glow(gx, gy, r, 'rgba(255,40,70,0.6)');
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // 0 = day, 1 = night, blended across the theme transition at the start of a stage
  function nightAmount(G, P) {
    const seg = Track.segAt(G.position + P.playerZ), s = seg.stage;
    const cur = Track.THEMES[s].night ? 1 : 0;
    if (s === 0) return cur;
    const prev = Track.THEMES[s - 1].night ? 1 : 0;
    const t = Math.min(1, (seg.index - G.track.stageStarts[s]) / Track.TRANSITION);
    return prev + (cur - prev) * t;
  }

  function drawPlayer(G, P) {
    const S = G.sprites;
    const speedPct = G.speed / P.maxSpeed;
    const lean = G.crash ? 0 : Math.max(-2, Math.min(2, Math.round(G.leanAnim)));
    const tread = Math.floor(G.treadPhase) % 3;
    const img = S.player[`${lean}:${G.braking ? 1 : 0}:${tread}`];
    const w = img.w, h = img.h;
    // Wind strength from speed (boost adds a notch); flutter frame advances faster with speed
    let wind = speedPct < 0.12 ? 0 : speedPct < 0.45 ? 1 : speedPct < 0.8 ? 2 : 3;
    if (G.boosting > 0) wind = 3;
    if (G.crash > 0) wind = 1;
    const hair = S.hair[`${lean}:${wind}:${Math.floor(G.hairPhase) % CarArt.HAIR_FRAMES}`];
    let bounce = 0;
    if (G.speed > 100 && !G.crash) bounce = (G.frame % 4 < 2 ? 0 : 1) * (G.offroad ? 2 : speedPct > 0.5 ? 1 : 0);
    const x = Math.round(W / 2 - w / 2), y = H - h + 1 - bounce;
    const ox = x + img.ox - lean, oy = y + img.oy; // car-local origin, rear body shifted by yaw
    if (G.crash > 0) { drawTumble(G, P, img, hair, y + h / 2); return; }
    shadow(68, 6);
    ctx.drawImage(img.canvas, x, y, w, h);
    ctx.drawImage(hair, x, y);

    ctx.globalCompositeOperation = 'lighter';
    // Tail lights: running-light glow at night (fading in through the stage transition), brighter when braking
    const night = nightAmount(G, P), brk = G.braking ? 1 : 0;
    const lamp = Math.max(brk * 0.55, night * (0.6 + brk * 0.35));
    if (lamp > 0.01) {
      const a = v => Math.min(1, v).toFixed(3);
      if (night > 0.01) { // red wash on the road around the car
        ctx.save();
        ctx.translate(W / 2, H - 5);
        ctx.scale(1, 0.2);
        glow(0, 0, 110, `rgba(255,30,60,${a(night * (0.45 + brk * 0.3))})`);
        ctx.restore();
      }
      for (const lx of [27, 101]) {
        glow(ox + lx, oy + 35, 15, `rgba(255,70,90,${a(lamp)})`);                         // hot lens
        glow(ox + lx, oy + 35, brk ? 56 : 46, `rgba(255,30,60,${a(lamp * 0.6)})`);        // halo
      }
    }
    if (G.boosting > 0) {
      const r = Art.rng(G.frame * 13 + 1);
      for (const px of [34, 43, 85, 94]) {
        const fx = ox + px, fy = oy + 55, len = 6 + r() * 9;
        glow(fx, fy + 3, 12, 'rgba(255,120,30,0.5)');
        tri(fx - 3, fy, fx + 3, fy, fx + (r() - 0.5) * 3, fy + len, '#ff5a14');
        tri(fx - 2, fy, fx + 2, fy, fx, fy + len * 0.6, '#ffd23b');
        tri(fx - 1, fy, fx + 1, fy, fx, fy + len * 0.3, '#9ae8ff');
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function shadow(rx, ry) {
    ctx.fillStyle = 'rgba(8,0,16,0.42)';
    ctx.beginPath(); ctx.ellipse(W / 2, H - 4, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  }

  // ---------------- Crash tumble ----------------
  // The car flips nose-down end over end as a deck-high box: rear, underside, front (upside down) and top
  // as it comes back round onto its wheels. The crew and windshield rows of the rear and front views stand
  // up from the cockpit as their own planes, sized so they land exactly on the normal sprite at rest.
  // Every plane is drawn one texture row at a time, projected through the pitch with mild perspective.
  const TUMBLE_D = 420;  // camera distance to the rear face, in sprite px
  const TUMBLE_FLIP = 0.82; // share of the crash spent flipping; the rest is the landing bounce
  let tumbleRear = null, tumbleBuf = null;

  function drawTumble(G, P, img, hair, cy) {
    const T = G.sprites.tumble, cx = W / 2;
    if (!tumbleRear) {
      tumbleRear = document.createElement('canvas');
      tumbleRear.width = img.w; tumbleRear.height = img.h;
      tumbleBuf = document.createElement('canvas');
      tumbleBuf.width = W; tumbleBuf.height = H;
      tumbleBuf.getContext('2d').imageSmoothingEnabled = false;
    }
    const rg = tumbleRear.getContext('2d');
    rg.clearRect(0, 0, img.w, img.h);
    rg.drawImage(img.canvas, 0, 0); rg.drawImage(hair, 0, 0);

    const p = 1 - G.crash / P.crashTime, q = Math.min(1, p / TUMBLE_FLIP);
    const pitch = Math.PI * 2 * (1 - Math.pow(1 - q, 1.5)); // fast off the impact, easing into the landing
    const cos = Math.cos(pitch), sin = Math.sin(pitch);
    const hw = img.w / 2, hh = img.h / 2, hl = T.length / 2, deck = hh - T.deckRow;
    // car-space (height y, depth z) -> [screen y, scale, rotated depth]
    const proj = (y, z) => {
      const yr = y * cos - z * sin, zr = y * sin + z * cos;
      const s = TUMBLE_D / (TUMBLE_D + hl + zr);
      return [cy - yr * s, s, zr];
    };

    // Planes: texture rows r0..r1 spread from car-space point a to b, outward normal n (y, z), width scale k.
    // The crew planes sit deeper than the face they belong to, so k scales them up to match at rest.
    const kR = (TUMBLE_D + hl + T.seatZ) / TUMBLE_D, kF = (TUMBLE_D + hl - T.screenZ) / TUMBLE_D;
    const planes = [
      { tex: tumbleRear, r0: T.deckRow, r1: img.h, a: [deck, -hl], b: [-hh, -hl], n: [0, -1], k: 1 },
      { tex: tumbleRear, r0: 0, r1: T.deckRow, a: [hh * kR, T.seatZ], b: [deck * kR, T.seatZ], n: [0, -1], k: kR },
      { tex: T.under, r0: 0, r1: T.length, a: [-hh, -hl], b: [-hh, hl], n: [-1, 0], k: 1 },
      { tex: T.front, r0: T.deckRow, r1: img.h, a: [deck, hl], b: [-hh, hl], n: [0, 1], k: 1 },
      { tex: T.front, r0: 0, r1: T.deckRow, a: [hh * kF, T.screenZ], b: [deck * kF, T.screenZ], n: [0, 1], k: kF },
      { tex: T.top, r0: 0, r1: T.length, a: [deck, -hl], b: [deck, hl], n: [1, 0], k: 1 },
    ].filter(f => f.n[0] * sin + f.n[1] * cos < -1e-6)
      .map(f => ({ ...f, depth: proj((f.a[0] + f.b[0]) / 2, (f.a[1] + f.b[1]) / 2)[2] }))
      .sort((m, n) => n.depth - m.depth);

    // Pivot over the lowest visible edge so nothing sinks into the road, plus a hop while airborne
    let low = -Infinity;
    for (const f of planes) low = Math.max(low, proj(...f.a)[0], proj(...f.b)[0]);
    const hop = q < 1 ? Math.sin(q * Math.PI) * 34 : Math.sin((p - TUMBLE_FLIP) / (1 - TUMBLE_FLIP) * Math.PI) * 5;
    const lift = Math.max(0, low - (cy + hh)) + hop;
    const sh = Math.max(0.45, 1 - lift / 200);
    shadow(68 * sh, 6 * sh);

    // Rows go into an upright buffer first: rotating each row on its own leaves anti-aliased seams between them
    const bg = tumbleBuf.getContext('2d'), top = cy - lift;
    bg.clearRect(0, 0, W, H);
    for (const f of planes) {
      const rows = f.r1 - f.r0, pts = [];
      for (let v = 0; v <= rows; v++) {
        const t = v / rows;
        pts.push(proj(f.a[0] + (f.b[0] - f.a[0]) * t, f.a[1] + (f.b[1] - f.a[1]) * t));
      }
      for (let v = 0; v < rows; v++) {
        const y0 = Math.round(pts[v][0] - lift), y1 = Math.round(pts[v + 1][0] - lift);
        if (y0 === y1) continue;
        const w = Math.round(hw * f.k * (pts[v][1] + pts[v + 1][1]));
        bg.drawImage(f.tex, 0, f.r0 + v, f.tex.width, 1, Math.round(cx - w / 2), Math.min(y0, y1), w, Math.abs(y1 - y0));
      }
    }
    ctx.save();
    ctx.translate(cx, top);
    ctx.rotate(G.crashSpin * 0.2 * Math.sin(q * Math.PI)); // a little roll so it doesn't look on rails
    ctx.drawImage(tumbleBuf, -cx, -top);
    ctx.restore();
  }

  function glow(x, y, r, color) {
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function tri(x1, y1, x2, y2, x3, y3, c) {
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.closePath(); ctx.fill();
  }

  function drawParticles(G) {
    for (const p of G.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max) * 0.85;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x | 0, p.y | 0, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function speedLines(G) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    const r = Art.rng(G.frame * 7);
    ctx.beginPath();
    for (let i = 0; i < 14; i++) {
      const a = r() * Math.PI * 2, d0 = 70 + r() * 80, d1 = d0 + 30 + r() * 50;
      ctx.moveTo(W / 2 + Math.cos(a) * d0, H / 2 + Math.sin(a) * d0 * 0.6);
      ctx.lineTo(W / 2 + Math.cos(a) * d1, H / 2 + Math.sin(a) * d1 * 0.6);
    }
    ctx.stroke();
  }

  return { init, frame, W, H };
})();
