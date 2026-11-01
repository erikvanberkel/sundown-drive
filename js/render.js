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

  function layer(img, rotation, offsetY, alpha) {
    const iw = img.width, sx = ((Math.floor(rotation * iw) % iw) + iw) % iw;
    const first = Math.min(W, iw - sx);
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, sx, 0, first, H, 0, offsetY, first, H);
    if (first < W) ctx.drawImage(img, 0, 0, W - first, H, first, offsetY, W - first, H);
    ctx.globalAlpha = 1;
  }

  function backgroundSet(set, G, playerY, alpha) {
    ctx.globalAlpha = alpha;
    ctx.drawImage(set.sky, 0, 0);
    const clamp = v => Math.max(-22, Math.min(22, v));
    layer(set.far, G.farOffset, clamp(playerY * 0.0012), alpha);
    layer(set.near, G.nearOffset, clamp(playerY * 0.0022), alpha);
    ctx.globalAlpha = 1;
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

    // Background (cross-fade between stage themes)
    const s = pSeg.stage, into = pSeg.index - T.stageStarts[s];
    const t = s === 0 ? 1 : Math.min(1, into / Track.TRANSITION);
    if (t < 1) backgroundSet(bgs[s - 1], G, playerY, 1);
    backgroundSet(bgs[s], G, playerY, t < 1 ? t : 1);

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
    ctx.fillStyle = 'rgba(8,0,16,0.42)';
    ctx.beginPath(); ctx.ellipse(W / 2, H - 4, 68, 6, 0, 0, Math.PI * 2); ctx.fill();
    if (G.crash > 0) {
      const p = 1 - G.crash / P.crashTime;
      const hop = Math.sin(p * Math.PI) * 40;
      ctx.save();
      ctx.translate(W / 2, y + h / 2 - hop);
      ctx.rotate(G.crashSpin * p * Math.PI * 2);
      ctx.drawImage(img.canvas, -w / 2, -h / 2, w, h);
      ctx.drawImage(hair, -w / 2, -h / 2);
      ctx.restore();
      return;
    }
    ctx.drawImage(img.canvas, x, y, w, h);
    ctx.drawImage(hair, x, y);

    ctx.globalCompositeOperation = 'lighter';
    if (G.braking) {
      for (const lx of [27, 101]) glow(ox + lx, oy + 35, 30, 'rgba(255,40,70,0.55)');
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
