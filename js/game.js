// Sundown Drive: game state, physics, input, HUD and main loop.
(() => {
  const SEG = Track.SEG, ROAD_W = Track.ROAD_W, STEP = 1 / 60, W = Render.W, H = Render.H;
  const P = { fov: 100, cameraHeight: 1000, drawDistance: 300, centrifugal: 0.3, crashTime: 1.6 };
  P.cameraDepth = 1 / Math.tan((P.fov / 2) * Math.PI / 180);
  P.playerZ = P.cameraHeight * P.cameraDepth;
  P.maxSpeed = SEG / STEP;
  P.accel = P.maxSpeed / 5;
  P.braking = -P.maxSpeed;
  P.decel = -P.maxSpeed / 5;
  P.offRoadDecel = -P.maxSpeed / 2;
  P.offRoadLimit = P.maxSpeed / 4;
  P.playerW = 540 / ROAD_W;
  const KMH = 293;

  const $ = id => document.getElementById(id);
  const el = {
    hud: $('hud'), title: $('title'), radio: $('radio'), result: $('result'), pause: $('pause'),
    score: $('score'), time: $('time'), lap: $('lap'), stage: $('stage'), speed: $('speed'), tach: $('tach'),
    boost: $('boost-fill'), courseTrack: $('course-track'), courseCar: $('course-car'), courseName: $('course-name'),
    banner: $('banner'), sub: $('sub-banner'), hiscore: $('hiscore'), resultTitle: $('result-title'), resultLines: $('result-lines'),
    stations: [...document.querySelectorAll('.station')],
  };

  const G = {
    mode: 'loading', track: null, sprites: null, position: 0, playerX: 0, speed: 0, steer: 0, braking: false,
    offroad: false, skid: 0, time: 0, score: 0, lap: 0, total: 0, stage: 0, boost: 0, boosting: 0, crash: 0,
    crashSpin: 1, shake: 0, frame: 0, skyOffset: 0, farOffset: 0, nearOffset: 0, particles: [], nearMisses: 0, crashes: 0,
    leanAnim: 0, treadPhase: 0, hairPhase: 0, radio: 0, paused: false, hiscore: 0, countdown: 0, endTimer: 0, bannerTimer: 0, subTimer: 0, lastWarn: 0,
  };

  window.__sundown = { G, P }; // handy for debugging from the console

  try { G.hiscore =parseInt(localStorage.getItem('sundown-drive-hiscore') || '0', 10) || 0; } catch (e) { G.hiscore = 0; }

  // ---------------- Input ----------------
  const keys = { left: false, right: false, up: false, down: false, boost: false };
  const NONE = { left: false, right: false, up: false, down: false, boost: false };
  const MAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down', Space: 'boost', ShiftLeft: 'boost', ShiftRight: 'boost',
  };
  addEventListener('keydown', e => {
    if (MAP[e.code]) { keys[MAP[e.code]] = true; e.preventDefault(); }
    if (e.repeat) return;
    if (e.code === 'Enter' || e.code === 'NumpadEnter') action();
    else if (e.code === 'KeyM') Sound.toggleMusic();
    else if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
    else if (G.mode === 'radio' && (e.code === 'ArrowLeft' || e.code === 'KeyA')) tune(-1);
    else if (G.mode === 'radio' && (e.code === 'ArrowRight' || e.code === 'KeyD')) tune(1);
  });
  addEventListener('keyup', e => { if (MAP[e.code]) keys[MAP[e.code]] = false; });
  addEventListener('blur', () => { Object.keys(keys).forEach(k => keys[k] = false); if (inRace()) togglePause(true); });

  document.querySelectorAll('#touch button').forEach(b => {
    const k = b.dataset.key;
    const set = v => e => { e.preventDefault(); keys[k] = v; b.classList.toggle('held', v); };
    b.addEventListener('pointerdown', set(true));
    b.addEventListener('pointerup', set(false));
    b.addEventListener('pointercancel', set(false));
    b.addEventListener('pointerleave', set(false));
  });
  $('screen').addEventListener('pointerdown', e => {
    if (G.mode === 'radio') {
      const st = e.target.closest('.station');
      if (st) { const i = +st.dataset.i; if (i === G.radio) action(); else tune(i - G.radio); return; }
    }
    if (G.mode === 'title' || G.mode === 'result') action();
  });

  function inRace() { return ['countdown', 'race', 'timeup', 'goal'].includes(G.mode); }

  function action() {
    if (G.mode === 'title') {
      Sound.init(); Sound.sfx.select();
      G.mode = 'radio';
      show(el.title, false); show(el.radio, true);
      tune(0);
    } else if (G.mode === 'radio') {
      Sound.sfx.select();
      startRace();
    } else if (G.mode === 'result') {
      toTitle();
    }
  }

  function tune(d) {
    G.radio = (G.radio + d + 3) % 3;
    el.stations.forEach((s, i) => s.classList.toggle('on', i === G.radio));
    if (d) Sound.sfx.select();
    Sound.playTrack(G.radio);
  }

  function togglePause(force) {
    if (!inRace()) return;
    G.paused = force === true ? true : !G.paused;
    show(el.pause, G.paused);
    Sound.suspend(G.paused);
  }

  const show = (node, on) => node.classList.toggle('hidden', !on);

  // ---------------- Flow ----------------
  function resetPlayer() {
    G.track = Track.build(G.sprites);
    G.position = 0; G.playerX = 0; G.speed = 0; G.crash = 0; G.boosting = 0; G.particles.length = 0;
    G.skyOffset = G.farOffset = G.nearOffset = 0; G.shake = 0;
    G.track.cars.forEach(c => { c.prevRel = Infinity; });
  }

  function toTitle() {
    Sound.stopMusic();
    resetPlayer();
    G.mode = 'title';
    el.hiscore.textContent = G.hiscore.toLocaleString('en-US');
    show(el.result, false); show(el.hud, false); show(el.radio, false); show(el.title, true);
  }

  function startRace() {
    resetPlayer();
    const T = Track.THEMES;
    G.mode = 'countdown'; G.countdown = 3; G.lastWarn = 3;
    G.time = T[0].time; G.score = 0; G.lap = 0; G.total = 0; G.stage = 0; G.boost = 0.34;
    G.nearMisses = 0; G.crashes = 0; G.stageTimes = [];
    show(el.radio, false); show(el.hud, true);
    el.courseName.textContent = T[0].name;
    buildCourseMarks();
    banner('3', '', 1.2);
    Sound.sfx.countdown(false);
  }

  function finish(kind) {
    G.mode = kind; G.endTimer = 0; G.cleared = kind === 'goal';
    if (kind === 'goal') {
      const bonus = Math.floor(G.time) * 100000;
      G.bonus = bonus; G.score += bonus;
      banner('GOAL!', bonus ? `TIME BONUS ${bonus.toLocaleString('en-US')}` : '', 4);
      Sound.sfx.goal();
    } else {
      G.bonus = 0;
      banner('TIME UP', '', 4);
    }
  }

  function showResult() {
    G.mode = 'result';
    const best = G.score > G.hiscore;
    if (best) { G.hiscore = Math.floor(G.score); try { localStorage.setItem('sundown-drive-hiscore', String(G.hiscore)); } catch (e) { /* storage blocked */ } }
    el.resultTitle.textContent = G.cleared ? 'COURSE CLEAR' : 'GAME OVER';
    const row = (k, v, cls) => `<div class="${cls || ''}"><span class="k">${k}</span> ${v}</div>`;
    el.resultLines.innerHTML =
      row('SCORE', Math.floor(G.score).toLocaleString('en-US'), best ? 'new' : '') +
      (best ? row('', 'NEW RECORD!', 'new') : row('BEST', G.hiscore.toLocaleString('en-US'))) +
      row('REACHED', Track.THEMES[G.stage].name) +
      row('TIME', fmt(G.total)) +
      row('CLOSE CALLS', G.nearMisses);
    show(el.hud, false); show(el.result, true);
  }

  function banner(text, sub, dur) {
    el.banner.textContent = text; el.banner.classList.add('show'); G.bannerTimer = dur;
    if (sub !== undefined) { el.sub.textContent = sub; el.sub.classList.toggle('show', !!sub); G.subTimer = dur; }
  }

  // ---------------- Physics ----------------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function overlap(x1, w1, x2, w2, pct) {
    const half = (pct || 1) / 2;
    return !((x1 + w1 * half) < (x2 - w2 * half) || (x1 - w1 * half) > (x2 + w2 * half));
  }

  function autopilot(pSeg) {
    const segs = G.track.segments;
    const ahead = Track.segAt(G.position + P.playerZ + SEG * 10);
    let want = -ahead.curve * 0.07 - G.playerX;
    for (let i = 1; i < 25; i++) {
      const s = segs[pSeg.index + i]; if (!s) break;
      for (const c of s.cars) if (c.speed < G.speed && Math.abs(c.offset - G.playerX) < 0.45) want += (G.playerX >= c.offset ? 0.7 : -0.7) / (1 + i * 0.1);
    }
    const stop = G.mode === 'goal';
    return { up: !stop && G.speed < P.maxSpeed * 0.86, down: stop && G.endTimer > 1.2, left: want < -0.06, right: want > 0.06, boost: false };
  }

  function carSteer(car, carSeg, pSeg) {
    const cw = car.sprite.worldW / ROAD_W, segs = G.track.segments;
    if (carSeg.index - pSeg.index > P.drawDistance || carSeg.index < pSeg.index - 10) return 0;
    for (let i = 1; i < 20; i++) {
      const seg = segs[carSeg.index + i]; if (!seg) break;
      if (seg === pSeg && car.speed > G.speed && overlap(G.playerX, P.playerW, car.offset, cw, 1.2)) {
        const dir = G.playerX > 0.5 ? -1 : G.playerX < -0.5 ? 1 : (car.offset > G.playerX ? 1 : -1);
        return dir / i * (car.speed - G.speed) / P.maxSpeed;
      }
      for (const o of seg.cars) {
        if (o !== car && car.speed > o.speed && overlap(car.offset, cw, o.offset, o.sprite.worldW / ROAD_W, 1.2)) {
          const dir = o.offset > 0.5 ? -1 : o.offset < -0.5 ? 1 : (car.offset > o.offset ? 1 : -1);
          return dir / i * (car.speed - o.speed) / P.maxSpeed;
        }
      }
    }
    return 0;
  }

  const LANES = [-0.66, 0, 0.66];
  function updateCars(dt, pSeg) {
    const T = G.track;
    for (const car of T.cars) {
      const old = Track.segAt(car.z);
      car.speed = car.baseSpeed * P.maxSpeed;
      car.offset = clamp(car.offset + carSteer(car, old, pSeg), -0.85, 0.85);
      car.z += dt * car.speed;
      if (car.z > T.goal + SEG * 120) car.z = G.position - SEG * 40;
      if (car.z < G.position - SEG * 30) {
        const nz = G.position + SEG * (P.drawDistance + 10 + Math.random() * 400);
        if (nz < T.goal - SEG * 40) {
          car.z = nz; car.prevRel = Infinity;
          car.offset = LANES[Math.random() * 3 | 0];
        }
      }
      car.z = clamp(car.z, 0, T.length - SEG);
      const now = Track.segAt(car.z);
      if (now !== old) { old.cars.splice(old.cars.indexOf(car), 1); now.cars.push(car); }
    }
  }

  function scatterCars(from) {
    for (const car of G.track.cars) {
      const old = Track.segAt(car.z);
      old.cars.splice(old.cars.indexOf(car), 1);
      car.z = from + SEG * (30 + Math.random() * 1200);
      car.prevRel = Infinity;
      Track.segAt(car.z).cars.push(car);
    }
  }

  function crash() {
    G.crash = P.crashTime; G.crashSpin = Math.random() > 0.5 ? 1 : -1;
    G.speed *= 0.55; G.shake = 1; G.boosting = 0; G.crashes++;
    Sound.sfx.crash();
    for (let i = 0; i < 30; i++) puff(W / 2 + (Math.random() - 0.5) * 100, H - 30, i % 3 ? '#d8d0e0' : '#ff8a1f', 0.9, 3);
  }

  function puff(x, y, color, life, size) {
    if (G.particles.length > 220) return;
    G.particles.push({ x, y, vx: (Math.random() - 0.5) * 90, vy: -20 - Math.random() * 60, life, max: life, color, size: size || 2 });
  }

  function update(dt) {
    G.frame++;
    const T = G.track;
    const pSeg = Track.segAt(G.position + P.playerZ);
    const speedPct = G.speed / P.maxSpeed;
    const startPos = G.position;
    const auto = G.mode === 'title' || G.mode === 'radio' || G.mode === 'goal';
    const input = auto ? autopilot(pSeg) : G.mode === 'race' ? keys : NONE;

    updateCars(dt, pSeg);
    G.position = Math.min(G.position + dt * G.speed, T.length - SEG * (P.drawDistance + 5));

    const dx = dt * 2 * speedPct;
    G.steer = input.left ? -1 : input.right ? 1 : 0;
    G.braking = input.down && G.speed > 0;

    if (G.crash > 0) {
      G.crash -= dt;
      G.speed = Math.max(0, G.speed - P.maxSpeed * dt * 0.8);
      const target = clamp(G.playerX, -0.7, 0.7);
      G.playerX += clamp(target - G.playerX, -dt * 1.6, dt * 1.6);
      if (G.crash <= 0) { G.crash = 0; G.speed = 0; }
    } else {
      G.playerX += G.steer * dx;
      G.playerX -= dx * speedPct * pSeg.curve * P.centrifugal;

      // Boost: hold to burn the meter
      const wantBoost = G.mode === 'race' && input.boost && G.boost > 0.01 && G.speed > P.maxSpeed * 0.3;
      if (wantBoost) {
        if (G.boosting <= 0) Sound.sfx.boost();
        G.boosting = 0.2; G.boost = Math.max(0, G.boost - dt * 0.3);
      } else G.boosting = Math.max(0, G.boosting - dt);
      if (G.mode === 'race') G.boost = Math.min(1, G.boost + dt * 0.012);

      const limit = P.maxSpeed * (G.boosting > 0 ? 1.28 : 1);
      if (input.up) G.speed += P.accel * dt * (1.25 - 0.6 * speedPct) * (G.boosting > 0 ? 2 : 1);
      else if (input.down) G.speed += P.braking * dt;
      else G.speed += P.decel * dt;
      if (G.speed > limit) G.speed = Math.max(limit, G.speed - P.maxSpeed * 0.6 * dt);

      G.offroad = G.playerX < -1 || G.playerX > 1;
      if (G.offroad) {
        if (G.speed > P.offRoadLimit) G.speed += P.offRoadDecel * dt;
        for (const sp of pSeg.sprites) {
          const src = sp.source;
          if (!src.collide) continue;
          const sw = src.worldW / ROAD_W;
          const cx = sp.offset + (sp.offset < 0 ? -sw / 2 : sp.offset > 0 ? sw / 2 : 0);
          if (overlap(G.playerX, P.playerW, cx, sw * src.hit)) {
            if (G.speed > P.maxSpeed * 0.3) crash();
            else { G.speed = 0; G.position = Math.max(0, pSeg.p1.world.z - P.playerZ); G.shake = 0.4; Sound.sfx.bump(); }
            break;
          }
        }
      }

      if (G.crash <= 0) for (const car of pSeg.cars) {
        const cw = car.sprite.worldW / ROAD_W;
        if (G.speed > car.speed && overlap(G.playerX, P.playerW, car.offset, cw, 0.8)) {
          if ((G.speed - car.speed) / P.maxSpeed > 0.55) crash();
          else {
            G.speed = car.speed * (car.speed / G.speed);
            G.position = Math.max(0, car.z - P.playerZ - 10);
            G.shake = 0.6; Sound.sfx.bump();
          }
          break;
        }
      }
      G.playerX = clamp(G.playerX, -3, 3);
      G.speed = clamp(G.speed, 0, P.maxSpeed * 1.3);
    }

    // Car pose: ease into the yaw frames, roll the tyre tread with speed
    const targetLean = G.crash ? 0 : G.steer * (G.speed > P.maxSpeed * 0.15 ? 2 : 1);
    G.leanAnim += clamp(targetLean - G.leanAnim, -dt * 9, dt * 9);
    G.treadPhase += G.speed * dt * 0.0016;
    G.hairPhase += dt * (3 + 13 * Math.min(1.3, G.speed / P.maxSpeed));

    // Close calls fill the boost meter
    const pz = G.position + P.playerZ;
    for (const car of T.cars) {
      const rel = car.z - pz;
      if (G.mode === 'race' && car.prevRel > 0 && rel <= 0 && !G.crash && G.speed > P.maxSpeed * 0.55 &&
          Math.abs(car.offset - G.playerX) < 0.5) {
        G.nearMisses++; G.boost = Math.min(1, G.boost + 0.14); G.score += 5000;
        Sound.sfx.nearMiss();
        if (G.bannerTimer <= 0) { el.sub.textContent = 'CLOSE CALL +5000'; el.sub.classList.add('show'); G.subTimer = 0.8; }
      }
      car.prevRel = rel;
    }

    // Parallax (pixels): the sky drifts slowest, near scenery fastest as the road bends
    const turn = pSeg.curve * (G.position - startPos) / SEG;
    G.skyOffset += 0.5 * turn;
    G.farOffset += 1.15 * turn;
    G.nearOffset += 2.5 * turn;

    // Tyre smoke, dust and skid
    const sp2 = G.speed / P.maxSpeed;
    G.skid = !G.crash && sp2 > 0.72 && G.steer !== 0 && Math.abs(pSeg.curve) > 2.5 && Math.sign(G.steer) === Math.sign(pSeg.curve) ? 1 : 0;
    if (G.offroad && G.speed > 800 && G.frame % 2 === 0) {
      puff(W / 2 - 52, H - 10, pSeg.color.grass, 0.5, 3); puff(W / 2 + 52, H - 10, pSeg.color.grass, 0.5, 3);
      G.shake = Math.max(G.shake, 0.15);
    }
    if (G.skid && G.frame % 2 === 0) { puff(W / 2 - 50, H - 8, '#e8e4f0', 0.6, 3); puff(W / 2 + 50, H - 8, '#e8e4f0', 0.6, 3); }
    for (let i = G.particles.length - 1; i >= 0; i--) {
      const p = G.particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 40 * dt; p.life -= dt;
      if (p.life <= 0) G.particles.splice(i, 1);
    }
    G.shake = Math.max(0, G.shake - dt * 1.5);

    // Banners
    if (G.bannerTimer > 0 && (G.bannerTimer -= dt) <= 0) el.banner.classList.remove('show');
    if (G.subTimer > 0 && (G.subTimer -= dt) <= 0) el.sub.classList.remove('show');

    // Mode logic
    if (G.mode === 'title' || G.mode === 'radio') {
      if (G.position > T.stageStarts[1] * SEG - SEG * 400) {
        G.position = 0; G.playerX = 0; G.skyOffset = G.farOffset = G.nearOffset = 0; scatterCars(0);
      }
    } else if (G.mode === 'countdown') {
      G.countdown -= dt;
      const n = Math.ceil(G.countdown);
      if (n < G.lastWarn && n > 0) { G.lastWarn = n; banner(String(n), '', 1.2); if (n < 3) Sound.sfx.countdown(false); }
      if (G.countdown <= 0) { G.mode = 'race'; banner('GO!', '', 1); Sound.sfx.countdown(true); G.lastWarn = 11; }
    } else if (G.mode === 'race') {
      G.time -= dt; G.lap += dt; G.total += dt;
      G.score += sp2 * KMH * dt * 48;
      const n = Math.ceil(G.time);
      if (n <= 10 && n < G.lastWarn && n > 0) { G.lastWarn = n; Sound.sfx.timeWarn(); }
      if (pSeg.stage > G.stage) {
        G.stage = pSeg.stage;
        const ext = Track.THEMES[G.stage].time;
        G.time += ext; G.lap = 0; G.lastWarn = 11;
        el.courseName.textContent = Track.THEMES[G.stage].name;
        banner('CHECKPOINT', `EXTENDED TIME +${ext}`, 2.4);
        Sound.sfx.checkpoint();
      }
      if (pz >= T.goal) finish('goal');
      else if (G.time <= 0) { G.time = 0; finish('timeup'); }
    } else if (G.mode === 'timeup' || G.mode === 'goal') {
      G.endTimer += dt;
      if ((G.mode === 'timeup' && G.speed === 0 && G.endTimer > 1.5) || G.endTimer > 6) showResult();
    }
  }

  // ---------------- HUD ----------------
  const fmt = t => {
    const m = Math.floor(t / 60), s = Math.floor(t % 60), c = Math.floor((t * 100) % 100);
    return `${m}'${String(s).padStart(2, '0')}"${String(c).padStart(2, '0')}`;
  };
  const TACH = 24;
  for (let i = 0; i < TACH; i++) {
    const b = document.createElement('i');
    b.style.height = (35 + (i / TACH) * 65) + '%';
    b.style.setProperty('--c', i < 13 ? '#3ef2ff' : i < 19 ? '#ffe23b' : '#ff3b3b');
    el.tach.appendChild(b);
  }
  const tachBars = [...el.tach.children];
  const last = {};
  const put = (k, node, v) => { if (last[k] !== v) { last[k] = v; node.textContent = v; } };

  function buildCourseMarks() {
    el.courseTrack.querySelectorAll('.mark').forEach(m => m.remove());
    G.track.stageStarts.slice(1).concat([G.track.goal / SEG]).forEach(i => {
      const m = document.createElement('div'); m.className = 'mark';
      m.style.left = (i * SEG / G.track.goal * 100) + '%';
      el.courseTrack.appendChild(m);
    });
  }

  function hud() {
    if (!inRace()) return;
    const sp = G.speed / P.maxSpeed;
    put('score', el.score, Math.floor(G.score).toLocaleString('en-US'));
    put('time', el.time, String(Math.max(0, Math.ceil(G.time))));
    el.time.classList.toggle('warn', G.mode === 'race' && G.time <= 10);
    put('lap', el.lap, fmt(G.lap));
    put('stage', el.stage, String(G.stage + 1));
    put('speed', el.speed, String(Math.round(sp * KMH)));
    const lit = Math.round(Math.min(1, sp / 1.12) * TACH);
    if (last.lit !== lit) { last.lit = lit; tachBars.forEach((b, i) => b.classList.toggle('on', i < lit)); }
    el.boost.style.width = (G.boost * 100).toFixed(1) + '%';
    el.boost.classList.toggle('full', G.boost >= 0.99);
    el.boost.classList.toggle('active', G.boosting > 0);
    el.courseCar.style.left = clamp((G.position + P.playerZ) / G.track.goal * 100, 0, 100).toFixed(2) + '%';
  }

  // ---------------- Loop ----------------
  let prev = performance.now(), acc = 0;
  function loop(now) {
    const dt = Math.min(0.1, (now - prev) / 1000); prev = now;
    if (G.mode !== 'loading' && !G.paused) {
      acc += dt;
      while (acc >= STEP) { update(STEP); acc -= STEP; }
      Render.frame(G, P);
      hud();
      const active = inRace();
      const throttle = (G.mode === 'race' || G.mode === 'countdown') && keys.up ? 1 : 0;
      Sound.updateEngine(G.speed / P.maxSpeed, throttle, G.skid, G.offroad, active);
    }
    requestAnimationFrame(loop);
  }

  Art.ready().then(S => {
    G.sprites = S;
    // Ground under the far scenery matches the fully fogged grass at the horizon, so crests never show sky
    const backgrounds = Track.THEMES.map((th, i) => Art.background(th.bg, W, H, 100 + i, Track.mix(th.grass[1], th.fog, 0.9)));
    Render.init($('game'), backgrounds);
    toTitle();
    requestAnimationFrame(loop);
  });
})();
