// Sundown Drive: stage themes and course construction.
const Track = (() => {
  const SEG = 200, RUMBLE = 3, ROAD_W = 2000, LANES = 3, TRANSITION = 160;
  const STAGE_LEN = 2000;
  const CURVE = { NONE: 0, EASY: 2, MEDIUM: 4, HARD: 6 };
  const HILL = { NONE: 0, LOW: 20, MEDIUM: 40, HIGH: 60 };

  // Colors: [light, dark] for road, grass, rumble; lane is light-only.
  const THEMES = [
    {
      name: 'SUNSET BAY', time: 58,
      road: ['#7a768c', '#6a6680'], grass: ['#f2d496', '#e2be7a'], rumble: ['#fff6e8', '#e8203a'], lane: '#fff6e8', edge: '#fff6e8',
      fog: '#ff9e7a', fogDensity: 3,
      bg: {
        sky: ['#1c0538', '#5a1670', '#c2246e', '#ff5a6e', '#ffb35a'],
        sun: { x: 0.5, y: 50, r: 44, c1: '#ffe96b', c2: '#ff2f7a', stripes: true },
        clouds: 'rgba(255,170,210,0.55)',
        far: { type: 'mountains', color: '#5b2470', line: '#ff7ab0', height: 34, base: -2, sea: '#2f3fa8', glint: '#ffc9a0' },
        near: { type: 'hills', color: '#3a1452', height: 12, base: 0, rough: 0.6 },
      },
    },
    {
      name: 'DESERT RIDGE', time: 48,
      road: ['#827068', '#72605a'], grass: ['#e8aa62', '#d4924e'], rumble: ['#fff6e8', '#2a1a14'], lane: '#fff6e8', edge: '#fff6e8',
      fog: '#ffb07a', fogDensity: 4,
      bg: {
        sky: ['#2b1460', '#7a2c80', '#d4586e', '#ff9a5e', '#ffd48a'],
        sun: { x: 0.72, y: 60, r: 22, c1: '#fffbe0', c2: '#ffcf5a' },
        clouds: 'rgba(255,220,200,0.45)',
        far: { type: 'mesa', color: '#a8463a', line: '#ff9a6a', height: 46, base: 0, rough: 0.5 },
        near: { type: 'mesa', color: '#7a2e2a', height: 20, base: 2, rough: 0.7 },
      },
    },
    {
      name: 'NEON CITY', time: 47,
      road: ['#2e2c46', '#232136'], grass: ['#1c0e36', '#140828'], rumble: ['#3ef2ff', '#ff3ea5'], lane: '#ffe23b', edge: '#fff6e8',
      fog: '#3a0f5c', fogDensity: 5, night: true,
      bg: {
        sky: ['#03010c', '#100533', '#3a0b5c', '#a0157a', '#ff3ea5'],
        sun: { x: 0.25, y: 92, r: 12, c1: '#fff6e8', c2: '#c9b8ff' },
        stars: true,
        far: { type: 'city', color: '#1a0d3a', lit: '#ffd86b', lit2: '#3ef2ff', neon: '#ff3ea5', height: 70, base: 0 },
        near: { type: 'city', color: '#0e0624', lit: '#ff8a1f', lit2: '#ff3ea5', neon: '#3ef2ff', height: 40, base: 4 },
      },
    },
    {
      name: 'PINE PASS', time: 46,
      road: ['#646878', '#555968'], grass: ['#348049', '#286a3a'], rumble: ['#fff6e8', '#d81b2a'], lane: '#fff6e8', edge: '#fff6e8',
      fog: '#9fb6d8', fogDensity: 4,
      bg: {
        sky: ['#0d1b3a', '#28467a', '#6a7fb8', '#e8a0b0', '#ffd0a0'],
        sun: { x: 0.35, y: 70, r: 18, c1: '#fff8e0', c2: '#ffd2a0' },
        clouds: 'rgba(240,230,255,0.6)',
        far: { type: 'mountains', color: '#4a5a8a', cap: '#eef4ff', height: 80, base: 0, rough: 0.58 },
        near: { type: 'trees', color: '#173a2c', height: 16, base: 2 },
      },
    },
    {
      name: 'STARLINE', time: 45,
      road: ['#2a2150', '#241c46'], grass: ['#0b0420', '#0b0420'], grid: '#ff3ea5', rumble: ['#3ef2ff', '#3ef2ff'], lane: '#ff3ea5', edge: '#3ef2ff',
      fog: '#2a0650', fogDensity: 5, night: true,
      bg: {
        sky: ['#000008', '#0a0430', '#2a0a60', '#7a1a8a', '#ff4f8a'],
        sun: { x: 0.5, y: 46, r: 54, c1: '#ffe23b', c2: '#ff2f8a', stripes: true },
        stars: true,
        far: { type: 'mountains', color: '#12062e', line: '#3ef2ff', height: 50, base: 0, rough: 0.5 },
        near: { type: 'hills', color: '#0b0420', line: '#ff3ea5', height: 14, base: 2, rough: 0.6 },
      },
    },
  ];

  const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, t) => {
    const A = hex(a), B = hex(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
  };

  let segments = [], cars = [], stageStarts = [], length = 0;

  function lastY() { return segments.length ? segments[segments.length - 1].p2.world.y : 0; }

  function addSegment(curve, y) {
    const n = segments.length;
    segments.push({
      index: n,
      p1: { world: { y: lastY(), z: n * SEG }, camera: {}, screen: {} },
      p2: { world: { y, z: (n + 1) * SEG }, camera: {}, screen: {} },
      curve, sprites: [], cars: [], stage: 0,
    });
  }

  const easeIn = (a, b, p) => a + (b - a) * Math.pow(p, 2);
  const easeInOut = (a, b, p) => a + (b - a) * ((-Math.cos(p * Math.PI) / 2) + 0.5);

  function addRoad(enter, hold, leave, curve, y) {
    const startY = lastY(), endY = startY + y * SEG, total = enter + hold + leave;
    for (let n = 0; n < enter; n++) addSegment(easeIn(0, curve, n / enter), easeInOut(startY, endY, n / total));
    for (let n = 0; n < hold; n++) addSegment(curve, easeInOut(startY, endY, (enter + n) / total));
    for (let n = 0; n < leave; n++) addSegment(easeInOut(curve, 0, n / leave), easeInOut(startY, endY, (enter + hold + n) / total));
  }

  // Each theme favours different road shapes.
  const PIECES = {
    straight: (r, h) => addRoad(25, 50 + r() * 80 | 0, 25, 0, h),
    sweep: (r, h) => { const d = r() > 0.5 ? 1 : -1; addRoad(50, 60 + r() * 60 | 0, 50, d * (CURVE.EASY + r() * 2), h); },
    curve: (r, h) => { const d = r() > 0.5 ? 1 : -1; addRoad(40, 50, 40, d * CURVE.MEDIUM, h); },
    hard: (r, h) => { const d = r() > 0.5 ? 1 : -1; addRoad(30, 40, 30, d * CURVE.HARD, h); },
    scurve: (r, h) => {
      const d = r() > 0.5 ? 1 : -1;
      addRoad(40, 40, 40, d * CURVE.MEDIUM, h / 2); addRoad(40, 40, 40, -d * CURVE.MEDIUM, h / 2);
    },
    rolling: (r) => { for (let i = 0; i < 4; i++) addRoad(20, 20, 20, 0, (i % 2 ? -1 : 1) * HILL.LOW / 2); },
    hill: (r) => { addRoad(50, 50, 50, (r() - 0.5) * 3, HILL.HIGH); addRoad(50, 50, 50, 0, -HILL.HIGH); },
  };
  const MIX = [
    { sweep: 4, curve: 3, scurve: 2, straight: 2, rolling: 2, hill: 1 },
    { straight: 4, hill: 3, sweep: 2, curve: 2, rolling: 2 },
    { hard: 3, curve: 3, scurve: 3, straight: 2 },
    { curve: 4, scurve: 4, hard: 2, hill: 2, sweep: 1 },
    { rolling: 4, sweep: 3, straight: 3, hill: 2, curve: 1 },
  ];
  const HILLS = [HILL.MEDIUM, HILL.HIGH, HILL.NONE, HILL.MEDIUM, HILL.LOW];

  function pick(r, weights) {
    const keys = Object.keys(weights), total = keys.reduce((s, k) => s + weights[k], 0);
    let v = r() * total;
    for (const k of keys) { v -= weights[k]; if (v <= 0) return k; }
    return keys[0];
  }

  function buildStage(s, r) {
    const start = segments.length;
    stageStarts.push(start);
    addRoad(0, s === 0 ? 40 : 60, 20, 0, 0);
    while (segments.length - start < STAGE_LEN) {
      const h = HILLS[s] ? (r() - 0.45) * 2 * HILLS[s] : 0;
      PIECES[pick(r, MIX[s])](r, h);
    }
    addRoad(30, 60, 30, 0, -lastY() / SEG * 0.5);
    for (let i = start; i < segments.length; i++) segments[i].stage = s;
  }

  function colorize() {
    segments.forEach((seg, n) => {
      const s = seg.stage, th = THEMES[s], prev = THEMES[Math.max(0, s - 1)];
      const into = n - stageStarts[s];
      const t = s === 0 ? 1 : Math.min(1, into / TRANSITION);
      const k = Math.floor(n / RUMBLE) % 2 ? 1 : 0;
      const pick2 = (key, kk) => mix(prev[key][kk], th[key][kk], t);
      seg.color = {
        road: pick2('road', k),
        grass: pick2('grass', k),
        rumble: pick2('rumble', k),
        lane: k ? null : mix(prev.lane, th.lane, t),
        edge: mix(prev.edge, th.edge, t),
        fog: mix(prev.fog, th.fog, t),
      };
      if (th.grid && n % 4 === 0 && t >= 1) seg.color.grass = th.grid;
      seg.fogDensity = prev.fogDensity + (th.fogDensity - prev.fogDensity) * t;
    });
  }

  function add(n, sprite, offset) {
    if (n >= 0 && n < segments.length) segments[n].sprites.push({ source: sprite, offset });
  }
  const any = (r, arr) => arr[Math.floor(r() * arr.length)];

  function dress(S, r) {
    const total = segments.length;
    // Gates
    const gate = (n, banner) => { add(n, S.pillar, -1.32); add(n, S.pillar, 1.32); add(n, banner, 0); };
    gate(12, S.banners.start);
    for (let s = 1; s < THEMES.length; s++) gate(stageStarts[s], S.banners.check);
    gate(goalIndex(), S.banners.goal);

    for (let n = 20; n < total - 10; n++) {
      const seg = segments[n], s = seg.stage, into = n - stageStarts[s];
      if (into > 0 && into < 8) continue;
      const curve = seg.curve;
      // Warning chevrons on the outside of sharp bends
      if (Math.abs(curve) >= CURVE.MEDIUM && n % 12 === 0) add(n, curve > 0 ? S.chevronR : S.chevronL, curve > 0 ? -1.15 : 1.15);
      if (n % 400 === 200) add(n, any(r, S.billboards), r() > 0.5 ? 1.5 : -1.5);
      switch (s) {
        case 0:
          if (n % 6 === 0) { add(n, any(r, S.palms), -1.3 - r() * 0.4); }
          if (n % 6 === 3) { add(n, any(r, S.palms), 1.3 + r() * 0.4); }
          if (n % 17 === 0) add(n, any(r, S.umbrellas), (r() > 0.5 ? 1 : -1) * (2.2 + r()));
          if (n % 9 === 0) add(n, any(r, S.bushes), (r() > 0.5 ? 1 : -1) * (1.9 + r() * 2));
          break;
        case 1:
          if (n % 14 === 0) add(n, any(r, S.cacti), (r() > 0.5 ? 1 : -1) * (1.3 + r() * 1.5));
          if (n % 23 === 0) add(n, any(r, S.rocks), (r() > 0.5 ? 1 : -1) * (1.6 + r() * 2));
          if (n % 11 === 0) add(n, S.dryBush, (r() > 0.5 ? 1 : -1) * (1.4 + r() * 3));
          break;
        case 2:
          if (n % 10 === 0) { add(n, S.lampL, -1.18); add(n, S.lampR, 1.18); }
          if (n % 8 === 4) add(n, any(r, S.buildings), -1.8 - r() * 0.6);
          if (n % 8 === 0) add(n, any(r, S.buildings), 1.8 + r() * 0.6);
          break;
        case 3:
          if (n % 4 === 0) add(n, any(r, S.pines), -1.3 - r() * 1.2);
          if (n % 4 === 2) add(n, any(r, S.pines), 1.3 + r() * 1.2);
          if (n % 31 === 0) add(n, any(r, S.greyRocks), (r() > 0.5 ? 1 : -1) * (1.5 + r()));
          break;
        case 4:
          if (n % 8 === 0) add(n, any(r, S.neonTris), -1.5 - r());
          if (n % 8 === 4) add(n, any(r, S.neonTris), 1.5 + r());
          if (n % 12 === 6) add(n, any(r, S.darkPalms), (r() > 0.5 ? 1 : -1) * (1.4 + r() * 0.6));
          break;
      }
    }
  }

  function goalIndex() { return segments.length - 220; }

  function spawnCars(S, r, count) {
    cars = [];
    const lanes = [-0.66, 0, 0.66];
    for (let i = 0; i < count; i++) {
      const z = (60 + r() * 1400) * SEG;
      const sprite = any(r, S.cars);
      const car = { offset: any(r, lanes) + (r() - 0.5) * 0.1, z, sprite, speed: 0, lane: 0 };
      car.baseSpeed = 0.28 + r() * 0.32;
      cars.push(car);
      segAt(z).cars.push(car);
    }
  }

  function segAt(z) { return segments[Math.max(0, Math.min(segments.length - 1, Math.floor(z / SEG)))]; }

  function build(S) {
    segments = []; stageStarts = [];
    const r = Art.rng(1986);
    THEMES.forEach((_, s) => buildStage(s, r));
    addRoad(0, 400, 0, 0, 0); // run-off after the goal
    colorize();
    dress(S, Art.rng(77));
    length = segments.length * SEG;
    spawnCars(S, Art.rng(5), 46);
    return { segments, cars, stageStarts, length, goal: goalIndex() * SEG };
  }

  return { build, segAt, THEMES, SEG, RUMBLE, ROAD_W, LANES, TRANSITION, mix, get cars() { return cars; }, get segments() { return segments; } };
})();
