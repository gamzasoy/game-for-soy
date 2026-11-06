'use strict';
/* 던전 다이버 — 턴제 로그라이크 (순수 JS, 외부 의존성 없음) */
(() => {
  // ===== 상수 =====
  const W = 44, H = 30, VIEW_W = 21, VIEW_H = 15, TILE = 32;
  const MAX_FLOOR = 10, INV_MAX = 8, SHOP_FLOORS = [3, 6, 9];
  const WALL = 0, FLOOR = 1, STAIRS = 2;
  const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Segoe UI Symbol",sans-serif';

  // ===== 난수 =====
  let rng = Math.random;
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const ri = (a, b) => a + Math.floor(rng() * (b - a + 1));
  const pick = arr => arr[Math.floor(rng() * arr.length)];
  const chance = p => rng() < p;
  const idx = (x, y) => y * W + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }
  // 한국어 조사 (받침 유무)
  function josa(word, withBatchim, without) {
    const c = word.charCodeAt(word.length - 1);
    if (c < 0xAC00 || c > 0xD7A3) return word + without;
    return word + ((c - 0xAC00) % 28 ? withBatchim : without);
  }

  // ===== 데이터 =====
  const MONS = {
    rat:    { name: '쥐', icon: '🐀', hp: 6, atk: 2, def: 0, xp: 3, min: 1, max: 4 },
    bat:    { name: '박쥐', icon: '🦇', hp: 5, atk: 2, def: 0, xp: 4, fast: true, erratic: true, min: 1, max: 6 },
    slime:  { name: '슬라임', icon: '🟢', hp: 11, atk: 3, def: 0, xp: 6, split: true, min: 2, max: 7 },
    shroom: { name: '독버섯', icon: '🍄', hp: 9, atk: 2, def: 1, xp: 6, poison: 4, slow: true, min: 2, max: 8 },
    archer: { name: '해골 궁수', icon: '💀', hp: 10, atk: 3, def: 1, xp: 9, ranged: 5, shot: '화살을 쏴서', min: 3, max: 10 },
    orc:    { name: '오크 전사', icon: '👹', hp: 22, atk: 5, def: 2, xp: 14, min: 5, max: 10 },
    ghost:  { name: '망령', icon: '👻', hp: 14, atk: 5, def: 0, xp: 13, phase: true, min: 6, max: 10 },
    mimic:  { name: '미믹', icon: '📦', hp: 16, atk: 5, def: 1, xp: 12 },
    minislime: { name: '꼬마 슬라임', icon: '🟢', hp: 4, atk: 2, def: 0, xp: 2, small: true },
    boss:   { name: '심연의 감시자', icon: '👁️', hp: 140, atk: 12, def: 3, xp: 0, ranged: 6, shot: '광선을 쏴서', boss: true },
  };

  const ITEMS = {
    potion:  { name: '회복 물약', icon: '🧪', desc: '최대 체력의 40% 회복' },
    elixir:  { name: '생명의 엘릭서', icon: '🍷', desc: '완전 회복 · 최대 체력 +5 · 해독' },
    tele:    { name: '순간이동 주문서', icon: '🌀', desc: '이 층의 무작위 위치로 이동' },
    fire:    { name: '화염 주문서', icon: '🔥', desc: '시야 안의 모든 적에게 큰 피해' },
    ice:     { name: '빙결 주문서', icon: '❄️', desc: '시야 안의 모든 적을 4턴간 얼림' },
    mapping: { name: '지도 주문서', icon: '🗺️', desc: '이 층의 지도와 함정을 밝힘' },
  };

  const WEAPONS = [['녹슨 단검', 1], ['철검', 2], ['전투 도끼', 3], ['기사의 검', 4], ['룬 블레이드', 5], ['용살자', 7]];
  const ARMORS = [['누더기 망토', 1], ['가죽 갑옷', 2], ['사슬 갑옷', 3], ['판금 갑옷', 4], ['미스릴 갑옷', 5], ['용비늘 갑옷', 6]];

  const TRAITS = [
    { id: 'vamp', name: '흡혈', icon: '🩸', desc: '준 피해의 20%만큼 체력 회복', apply() { P.lifesteal += 0.2; } },
    { id: 'thorns', name: '가시 갑옷', icon: '🌵', desc: '근접 공격을 받으면 3 피해 반사', apply() { P.thorns += 3; } },
    { id: 'tough', name: '강인함', icon: '💪', desc: '최대 체력 +12', apply() { P.maxHp += 12; P.hp += 12; } },
    { id: 'blade', name: '날카로운 칼날', icon: '⚔️', desc: '공격력 +2', apply() { P.atk += 2; } },
    { id: 'wall', name: '철벽', icon: '🧱', desc: '방어력 +1', apply() { P.def += 1; } },
    { id: 'focus', name: '집중', icon: '🎯', desc: '치명타 확률 +12% (치명타는 2배 피해)', apply() { P.crit += 0.12; } },
    { id: 'eyes', name: '올빼미 눈', icon: '🦉', desc: '시야 범위 +2', apply() { P.sight += 2; } },
    { id: 'regen', name: '재생', icon: '🌿', desc: '4턴마다 체력 1 회복 (중첩 가능)', apply() { P.regen += 1; } },
    { id: 'luck', name: '행운', icon: '🍀', desc: '골드 +50%, 아이템 드롭률 증가', apply() { P.luck += 0.5; } },
    { id: 'counter', name: '반격', icon: '🔁', desc: '근접 피격 시 30% 확률로 즉시 반격', apply() { P.counter = Math.min(0.9, P.counter + 0.3); }, ok: () => P.counter < 0.9 },
    { id: 'dodge', name: '잔상', icon: '💨', desc: '10% 확률로 공격 회피', apply() { P.dodge = Math.min(0.5, P.dodge + 0.1); }, ok: () => P.dodge < 0.5 },
  ];

  // ===== 상태 =====
  let S = null, P = null;
  let muted = false;

  // ===== 맵 생성 =====
  function genMap(floor) {
    const tiles = new Uint8Array(W * H);
    const rooms = [];
    const isBoss = floor === MAX_FLOOR;
    const maxRooms = isBoss ? 6 : ri(8, 12);
    const carveH = (x1, x2, y) => { for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) tiles[idx(x, y)] = FLOOR; };
    const carveV = (y1, y2, x) => { for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) tiles[idx(x, y)] = FLOOR; };
    const corridor = (a, b) => {
      if (chance(0.5)) { carveH(a.cx, b.cx, a.cy); carveV(a.cy, b.cy, b.cx); }
      else { carveV(a.cy, b.cy, a.cx); carveH(a.cx, b.cx, b.cy); }
    };
    for (let t = 0; t < 500 && rooms.length < maxRooms; t++) {
      const big = isBoss && rooms.length === maxRooms - 1;
      const w = big ? ri(11, 14) : ri(5, 10);
      const h = big ? ri(8, 10) : ri(4, 7);
      const x = ri(1, W - w - 1), y = ri(1, H - h - 1);
      if (rooms.some(r => x - 1 < r.x + r.w && x + w + 1 > r.x && y - 1 < r.y + r.h && y + h + 1 > r.y)) continue;
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) tiles[idx(xx, yy)] = FLOOR;
      const room = { x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) };
      if (rooms.length) corridor(rooms[rooms.length - 1], room);
      rooms.push(room);
    }
    // 순환로 몇 개 추가 (막다른 길 줄이기)
    for (let i = 0; i < 2 && rooms.length > 3; i++) {
      const a = pick(rooms), b = pick(rooms);
      if (a !== b) corridor(a, b);
    }
    const last = rooms[rooms.length - 1];
    if (!isBoss) tiles[idx(last.cx, last.cy)] = STAIRS;
    return { tiles, rooms };
  }

  // ===== 헬퍼 =====
  const walkable = (x, y) => inb(x, y) && S.tiles[idx(x, y)] !== WALL;
  const monsterAt = (x, y) => S.monsters.find(m => m.x === x && m.y === y && m.hp > 0);
  const blockingObjectAt = (x, y) => S.objects.find(o => o.x === x && o.y === y && (o.kind === 'chest' || o.kind === 'merchant'));
  const occupied = (x, y) => (P.x === x && P.y === y) || !!monsterAt(x, y) || S.objects.some(o => o.x === x && o.y === y);
  const patk = () => P.atk + P.weapon.bonus;
  const pdef = () => P.def + P.armor.bonus;

  function randomFreeTile(rooms, opts = {}) {
    for (let t = 0; t < 400; t++) {
      const r = pick(rooms);
      const x = ri(r.x, r.x + r.w - 1), y = ri(r.y, r.y + r.h - 1);
      if (S.tiles[idx(x, y)] !== FLOOR || occupied(x, y) || S.traps.has(idx(x, y))) continue;
      if (opts.notVisible && S.visible[idx(x, y)]) continue;
      return { x, y };
    }
    return null;
  }

  function freeNeighbor(x, y) {
    for (const [dx, dy] of shuffle(DIRS8.slice())) {
      const nx = x + dx, ny = y + dy;
      if (walkable(nx, ny) && !occupied(nx, ny)) return { x: nx, y: ny };
    }
    return null;
  }

  function los(x0, y0, x1, y1) {
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, x = x0, y = y0;
    while (!(x === x1 && y === y1)) {
      if (!(x === x0 && y === y0) && S.tiles[idx(x, y)] === WALL) return false;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
    return true;
  }

  function computeFOV() {
    S.visible = new Uint8Array(W * H);
    const r = P.sight;
    for (let y = P.y - r; y <= P.y + r; y++) {
      for (let x = P.x - r; x <= P.x + r; x++) {
        if (!inb(x, y)) continue;
        const dx = x - P.x, dy = y - P.y;
        if (dx * dx + dy * dy > r * r + r) continue;
        if (los(P.x, P.y, x, y)) { S.visible[idx(x, y)] = 1; S.seen[idx(x, y)] = 1; }
      }
    }
  }

  function bfsFromPlayer() {
    const dist = new Int32Array(W * H).fill(-1);
    const q = [idx(P.x, P.y)];
    dist[q[0]] = 0;
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of DIRS8) {
        const nx = x + dx, ny = y + dy;
        if (!walkable(nx, ny)) continue;
        const ni = idx(nx, ny);
        if (dist[ni] !== -1) continue;
        dist[ni] = dist[i] + 1;
        q.push(ni);
      }
    }
    return dist;
  }

  // ===== 로그 / 효과 =====
  function log(text, color = '#cfc8e6') {
    S.log.push({ text, color });
    if (S.log.length > 80) S.log.shift();
  }
  function popup(x, y, text, color) { S.fx.push({ kind: 'text', x, y, text: String(text), color, t: 0, life: 45 }); }
  function flash(color) { S.fx.push({ kind: 'flash', color, t: 0, life: 18 }); }

  // ===== 사운드 (Web Audio) =====
  let actx = null;
  function tone(freq, dur, type = 'square', vol = 0.06, delay = 0, slideTo = null) {
    if (muted) return;
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      const t0 = actx.currentTime + delay;
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(actx.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* 오디오 미지원 환경 */ }
  }
  function sfx(name) {
    switch (name) {
      case 'hit': tone(240, 0.07, 'square', 0.05, 0, 120); break;
      case 'crit': tone(520, 0.06, 'square', 0.06); tone(780, 0.1, 'square', 0.06, 0.05); break;
      case 'hurt': tone(140, 0.18, 'sawtooth', 0.07, 0, 60); break;
      case 'kill': tone(330, 0.06, 'triangle', 0.07); tone(220, 0.12, 'triangle', 0.07, 0.06, 80); break;
      case 'coin': tone(988, 0.05, 'square', 0.04); tone(1319, 0.12, 'square', 0.04, 0.05); break;
      case 'pick': tone(660, 0.06, 'sine', 0.07); tone(880, 0.08, 'sine', 0.07, 0.05); break;
      case 'equip': tone(392, 0.08, 'triangle', 0.08); tone(587, 0.14, 'triangle', 0.08, 0.07); break;
      case 'level': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.15, 'triangle', 0.08, i * 0.08)); break;
      case 'stairs': [440, 370, 311, 262].forEach((f, i) => tone(f, 0.12, 'sine', 0.08, i * 0.07)); break;
      case 'magic': tone(300, 0.35, 'sawtooth', 0.05, 0, 1200); break;
      case 'ice': tone(1800, 0.3, 'sine', 0.05, 0, 600); break;
      case 'shot': tone(900, 0.08, 'sawtooth', 0.03, 0, 300); break;
      case 'error': tone(110, 0.12, 'square', 0.05); break;
      case 'die': [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'triangle', 0.09, i * 0.18)); break;
      case 'win': [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, 'triangle', 0.09, i * 0.12)); break;
    }
  }

  // ===== 게임 시작 / 층 생성 =====
  function newGame(seed) {
    rng = seed != null ? mulberry32(seed) : Math.random;
    P = {
      x: 0, y: 0, hp: 30, maxHp: 30, atk: 4, def: 1, crit: 0.05, sight: 7,
      level: 1, xp: 0, xpNext: 10, gold: 0,
      weapon: { name: '맨주먹', bonus: 0, tier: -1 }, armor: { name: '평상복', bonus: 0, tier: -1 },
      inv: ['potion', 'potion'], poison: 0,
      lifesteal: 0, thorns: 0, regen: 0, luck: 0, counter: 0, dodge: 0, traits: [],
    };
    S = {
      floor: 1, turn: 0, kills: 0, startTime: Date.now(), endTime: 0, state: 'play',
      log: [], fx: [], shake: 0, pendingLevels: 0, lastCause: '',
      tiles: null, rooms: null, seen: null, visible: null, traps: null, monsters: [], objects: [], shop: null,
    };
    log('던전에 들어섰다. 10층 아래 「심연의 감시자」를 쓰러뜨려라!', '#ffd34d');
    newFloor(1);
  }

  function makeMonster(type, x, y) {
    const t = MONS[type], f = S.floor;
    const sc = t.boss ? 1 : 1 + 0.13 * (f - 1);
    const hp = Math.round(t.hp * sc);
    return {
      type, t, x, y, hp, maxHp: hp,
      atk: t.atk + (t.boss ? 0 : Math.floor((f - 1) * 0.6)),
      def: t.def + (t.boss ? 0 : Math.floor((f - 1) / 4)),
      awake: false, frozen: 0, cd: 0, hitFlash: 0, enraged: false,
    };
  }

  function makeEquip(kind, tier) {
    const [name, bonus] = (kind === 'weapon' ? WEAPONS : ARMORS)[tier];
    return { type: kind, name, bonus, tier };
  }

  function randomItem(bonusTier = 0) {
    const r = rng() * 100;
    if (r < 32) return { type: 'potion' };
    if (r < 42) return { type: 'fire' };
    if (r < 51) return { type: 'ice' };
    if (r < 59) return { type: 'tele' };
    if (r < 65) return { type: 'mapping' };
    if (r < 70) return { type: 'elixir' };
    const tier = clamp(Math.floor(S.floor / 2) + ri(-1, 1) + bonusTier, 0, 5);
    return makeEquip(chance(0.5) ? 'weapon' : 'armor', tier);
  }

  function newFloor(floor) {
    S.floor = floor;
    const m = genMap(floor);
    S.tiles = m.tiles; S.rooms = m.rooms;
    S.seen = new Uint8Array(W * H); S.visible = new Uint8Array(W * H);
    S.traps = new Map(); S.monsters = []; S.objects = []; S.shop = null;
    const start = m.rooms[0], others = m.rooms.slice(1);
    P.x = start.cx; P.y = start.cy;

    if (SHOP_FLOORS.includes(floor)) {
      const spot = freeNeighbor(P.x, P.y);
      if (spot) S.objects.push({ kind: 'merchant', x: spot.x, y: spot.y });
    }

    // 함정
    const nTraps = 3 + Math.floor(floor / 2);
    for (let i = 0; i < nTraps; i++) {
      const s = randomFreeTile(others);
      if (s) S.traps.set(idx(s.x, s.y), { type: chance(0.6) ? 'spike' : 'poison', revealed: false });
    }

    // 몬스터
    const pool = Object.keys(MONS).filter(k => MONS[k].min && MONS[k].min <= floor && floor <= MONS[k].max);
    const nMon = floor === MAX_FLOOR ? 6 : Math.min(5 + floor, 15);
    for (let i = 0; i < nMon; i++) {
      const s = randomFreeTile(others);
      if (s) S.monsters.push(makeMonster(pick(pool), s.x, s.y));
    }
    if (floor === MAX_FLOOR) {
      const last = m.rooms[m.rooms.length - 1];
      const boss = makeMonster('boss', last.cx, last.cy);
      S.monsters = S.monsters.filter(mm => !(mm.x === boss.x && mm.y === boss.y));
      S.monsters.push(boss);
    }

    // 아이템 / 골드 / 상자
    const nItems = ri(3, 5);
    for (let i = 0; i < nItems; i++) {
      const s = randomFreeTile(m.rooms);
      if (s) S.objects.push({ kind: 'item', x: s.x, y: s.y, item: randomItem() });
    }
    const nGold = ri(3, 6);
    for (let i = 0; i < nGold; i++) {
      const s = randomFreeTile(m.rooms);
      if (s) S.objects.push({ kind: 'item', x: s.x, y: s.y, item: { type: 'gold', amount: ri(3, 8) + floor * 2 } });
    }
    const nChest = ri(1, 2);
    for (let i = 0; i < nChest; i++) {
      const s = randomFreeTile(others);
      if (s) S.objects.push({ kind: 'chest', x: s.x, y: s.y, mimic: floor >= 2 && chance(0.2) });
    }

    computeFOV();
    if (floor === MAX_FLOOR) {
      log('🌑 최하층… 공기가 무겁다. 무언가가 지켜보고 있다.', '#ce93d8');
    } else {
      log(`${floor}층에 도착했다.`, '#ffd34d');
    }
    if (SHOP_FLOORS.includes(floor)) log('🧙 근처에 떠돌이 상인이 있다. 부딪히면 거래할 수 있다.', '#8fd3ff');
  }

  // ===== 전투 =====
  function heal(n, quiet) {
    const before = P.hp;
    P.hp = Math.min(P.maxHp, P.hp + n);
    const g = P.hp - before;
    if (g > 0) { popup(P.x, P.y, '+' + g, '#69f0ae'); if (!quiet) log(`체력을 ${g} 회복했다.`, '#69f0ae'); }
  }

  function damagePlayer(n, cause, color = '#ff5252') {
    P.hp -= n;
    S.lastCause = cause;
    popup(P.x, P.y, '-' + n, color);
    S.shake = Math.max(S.shake, 6 + n * 0.6);
    sfx('hurt');
  }

  function gainXp(n) {
    P.xp += n;
    while (P.xp >= P.xpNext) {
      P.xp -= P.xpNext;
      P.level++;
      P.xpNext = Math.floor(P.xpNext * 1.45) + 2;
      P.maxHp += 5; P.atk += 1;
      heal(Math.ceil(P.maxHp * 0.3), true);
      S.pendingLevels++;
      log(`✨ 레벨 업! Lv ${P.level}`, '#ffd34d');
      popup(P.x, P.y, 'LEVEL UP!', '#ffd34d');
      sfx('level');
    }
  }

  function playerAttack(m) {
    const crit = chance(P.crit);
    let dmg = Math.max(1, patk() + ri(-1, 1) - m.def);
    if (crit) dmg *= 2;
    m.hp -= dmg; m.awake = true; m.hitFlash = 8;
    popup(m.x, m.y, crit ? dmg + '!' : dmg, crit ? '#ffd34d' : '#ffffff');
    if (crit) S.shake = Math.max(S.shake, 5);
    sfx(crit ? 'crit' : 'hit');
    log(`${josa(m.t.name, '을', '를')} 공격! ${dmg} 피해${crit ? ' (치명타!)' : ''}`, crit ? '#ffd34d' : '#e0e0e0');
    if (P.lifesteal) heal(Math.max(1, Math.round(dmg * P.lifesteal)), true);
    if (m.hp <= 0) killMonster(m);
  }

  function dropAt(x, y, item) { S.objects.push({ kind: 'item', x, y, item }); }

  function killMonster(m) {
    m.hp = 0;
    S.monsters = S.monsters.filter(x => x !== m);
    S.kills++;
    sfx('kill');
    if (m.t.boss) {
      log('👁️ 심연의 감시자가 무너져 내린다… 승리했다!', '#ffd34d');
      flash('rgba(255,230,140,0.8)');
      S.shake = 18;
      endGame(true);
      return;
    }
    const xp = Math.round(m.t.xp * (1 + 0.15 * (S.floor - 1)));
    log(`${josa(m.t.name, '을', '를')} 처치했다! (+${xp} XP)`, '#b39ddb');
    if (m.t.split) {
      for (let i = 0; i < 2; i++) {
        const s = freeNeighbor(m.x, m.y);
        if (s) { const mini = makeMonster('minislime', s.x, s.y); mini.awake = true; S.monsters.push(mini); }
      }
      log('슬라임이 둘로 갈라졌다!', '#a5d6a7');
    }
    if (chance(0.4 + P.luck * 0.2)) dropAt(m.x, m.y, { type: 'gold', amount: ri(2, 6) + S.floor * 2 });
    else if (chance(0.09 + P.luck * 0.06)) dropAt(m.x, m.y, randomItem());
    gainXp(xp);
  }

  function monsterAttack(m, ranged) {
    if (ranged) { S.fx.push({ kind: 'shot', x1: m.x, y1: m.y, x2: P.x, y2: P.y, t: 0, life: 14, color: m.t.boss ? '#e040fb' : '#fff3b0' }); sfx('shot'); }
    if (P.dodge && chance(P.dodge)) {
      popup(P.x, P.y, '회피!', '#9be7ff');
      log(`${m.t.name}의 공격을 잔상으로 피했다!`, '#9be7ff');
      return;
    }
    const dmg = Math.max(1, m.atk + ri(-1, 1) - pdef());
    damagePlayer(dmg, m.t.name);
    log(`${josa(m.t.name, '이', '가')} ${ranged ? m.t.shot : '공격해서'} ${dmg} 피해를 입었다.`, '#ff8a80');
    if (m.t.poison && !ranged) {
      P.poison = Math.max(P.poison, m.t.poison);
      log('🤢 중독되었다!', '#7dff6a');
    }
    if (!ranged && P.hp > 0) {
      if (P.thorns) {
        m.hp -= P.thorns; m.hitFlash = 8;
        popup(m.x, m.y, P.thorns, '#c5e1a5');
        if (m.hp <= 0) { killMonster(m); return; }
      }
      if (P.counter && chance(P.counter)) { log('🔁 반격!', '#ffd34d'); playerAttack(m); }
    }
  }

  function wander(m) {
    const [dx, dy] = pick(DIRS8);
    tryMove(m, m.x + dx, m.y + dy);
  }

  function tryMove(m, nx, ny) {
    if (!inb(nx, ny) || nx <= 0 || ny <= 0 || nx >= W - 1 || ny >= H - 1) return false;
    if (!m.t.phase && !walkable(nx, ny)) return false;
    if ((P.x === nx && P.y === ny) || monsterAt(nx, ny) || blockingObjectAt(nx, ny)) return false;
    m.x = nx; m.y = ny;
    return true;
  }

  function moveToward(m, dist) {
    if (m.t.phase) {
      tryMove(m, m.x + Math.sign(P.x - m.x), m.y + Math.sign(P.y - m.y));
      return;
    }
    const cur = dist[idx(m.x, m.y)];
    if (cur === -1) { wander(m); return; }
    let best = [], bestD = cur;
    for (const [dx, dy] of DIRS8) {
      const nx = m.x + dx, ny = m.y + dy;
      if (!walkable(nx, ny) || monsterAt(nx, ny) || blockingObjectAt(nx, ny)) continue;
      const d = dist[idx(nx, ny)];
      if (d === -1) continue;
      if (d < bestD) { bestD = d; best = [[nx, ny]]; } else if (d === bestD && d < cur) best.push([nx, ny]);
    }
    if (best.length) { const [nx, ny] = pick(best); m.x = nx; m.y = ny; }
  }

  function monsterStep(m, dist) {
    const sees = S.visible[idx(m.x, m.y)] === 1;
    const d = cheb(m, P);
    if (m.t.ranged && sees && d > 1 && d <= m.t.ranged && los(m.x, m.y, P.x, P.y)) { monsterAttack(m, true); return; }
    if (d === 1) { monsterAttack(m, false); return; }
    if (m.t.erratic && chance(0.35)) { wander(m); return; }
    moveToward(m, dist);
  }

  function monstersAct() {
    const dist = bfsFromPlayer();
    for (const m of S.monsters.slice()) {
      if (m.hp <= 0 || P.hp <= 0 || S.state !== 'play') continue;
      if (m.frozen > 0) { m.frozen--; continue; }
      if (S.visible[idx(m.x, m.y)]) m.awake = true;
      if (!m.awake) { if (chance(0.3)) wander(m); continue; }
      if (m.t.slow && S.turn % 2) continue;
      const steps = m.t.fast ? 2 : 1;
      for (let s = 0; s < steps && m.hp > 0 && P.hp > 0 && S.state === 'play'; s++) monsterStep(m, dist);
      if (m.t.boss && m.hp > 0) bossSpecial(m);
    }
  }

  function bossSpecial(m) {
    m.cd++;
    if (m.cd % 7 === 0) {
      let n = 0;
      for (let i = 0; i < 2; i++) {
        const s = freeNeighbor(m.x, m.y);
        if (s) { const b = makeMonster('bat', s.x, s.y); b.awake = true; S.monsters.push(b); n++; }
      }
      if (n) { log('👁️ 심연의 감시자가 박쥐 떼를 불러낸다!', '#ce93d8'); sfx('magic'); }
    }
    if (!m.enraged && m.hp < m.maxHp / 2) {
      m.enraged = true; m.atk += 3;
      log('👁️ 심연의 감시자가 분노했다! 공격이 거세진다!', '#ff5252');
      S.shake = 14; flash('rgba(255,40,80,0.35)');
    }
  }

  // ===== 아이템 =====
  function grantItem(item) {
    if (item.type === 'gold') {
      const g = Math.round(item.amount * (1 + P.luck));
      P.gold += g;
      popup(P.x, P.y, '+' + g + 'G', '#ffd34d');
      log(`💰 골드 ${g} 획득`, '#ffd34d');
      sfx('coin');
      return true;
    }
    if (item.type === 'weapon' || item.type === 'armor') {
      const slot = item.type, cur = P[slot];
      const icon = slot === 'weapon' ? '🗡️' : '🛡️';
      if (item.bonus > cur.bonus) {
        P[slot] = { name: item.name, bonus: item.bonus, tier: item.tier };
        log(`${icon} ${josa(item.name, '을', '를')} 장착했다! (${slot === 'weapon' ? '공격' : '방어'} +${item.bonus})`, '#8fd3ff');
        sfx('equip');
      } else {
        const g = 4 + item.tier * 4;
        P.gold += g;
        log(`${icon} ${josa(item.name, '은', '는')} 지금 장비보다 약해서 ${g}골드에 팔았다.`, '#bdbdbd');
        sfx('coin');
      }
      return true;
    }
    if (P.inv.length >= INV_MAX) return false;
    P.inv.push(item.type);
    log(`${ITEMS[item.type].icon} ${ITEMS[item.type].name} 획득`, '#b9f6ca');
    sfx('pick');
    return true;
  }

  function pickupHere() {
    const here = S.objects.filter(o => o.kind === 'item' && o.x === P.x && o.y === P.y);
    for (const o of here) {
      if (grantItem(o.item)) S.objects.splice(S.objects.indexOf(o), 1);
      else log('가방이 가득 찼다! 아이템을 먼저 사용하자.', '#ff8a80');
    }
  }

  function openChest(o) {
    S.objects.splice(S.objects.indexOf(o), 1);
    if (o.mimic) {
      const m = makeMonster('mimic', o.x, o.y);
      m.awake = true;
      S.monsters.push(m);
      log('📦 상자가 이빨을 드러냈다! 미믹이다!', '#ff5252');
      S.shake = 10; sfx('hurt');
      return;
    }
    log('📦 상자를 열었다!', '#ffd34d');
    grantItem({ type: 'gold', amount: ri(5, 12) + S.floor * 3 });
    const item = randomItem(1);
    if (!grantItem(item)) { dropAt(o.x, o.y, item); log('가방이 가득 차서 바닥에 두었다.', '#ff8a80'); }
  }

  function triggerTrap() {
    const tr = S.traps.get(idx(P.x, P.y));
    if (!tr) return;
    if (tr.revealed && chance(0.75)) { log('함정을 조심스럽게 피해 지나갔다.', '#bdbdbd'); return; }
    tr.revealed = true;
    if (tr.type === 'spike') {
      damagePlayer(3 + S.floor, '가시 함정');
      log('🔺 가시 함정을 밟았다!', '#ff6b6b');
    } else {
      P.poison += 4;
      S.lastCause = '독 가스 함정';
      log('🤢 독 가스 함정! 중독되었다.', '#7dff6a');
      sfx('hurt');
    }
  }

  function useItem(i) {
    if (S.state !== 'play') return;
    const type = P.inv[i];
    if (!type) return;
    const def = ITEMS[type];
    const targets = S.monsters.filter(m => S.visible[idx(m.x, m.y)]);
    switch (type) {
      case 'potion':
        if (P.hp >= P.maxHp) { log('이미 체력이 가득하다.', '#bdbdbd'); return; }
        log(`${def.icon} ${def.name}을 마셨다.`, '#69f0ae');
        heal(Math.ceil(P.maxHp * 0.4)); sfx('pick');
        break;
      case 'elixir':
        log(`${def.icon} ${def.name}를 마셨다! 온몸에 힘이 넘친다.`, '#69f0ae');
        P.maxHp += 5; P.poison = 0; heal(P.maxHp); sfx('level');
        break;
      case 'tele': {
        const s = randomFreeTile(S.rooms, { notVisible: true }) || randomFreeTile(S.rooms);
        if (!s) { log('주문이 실패했다.', '#bdbdbd'); return; }
        log(`${def.icon} 공간이 일그러진다…`, '#b388ff');
        P.x = s.x; P.y = s.y; flash('rgba(179,136,255,0.5)'); sfx('magic');
        pickupHere();
        break;
      }
      case 'fire': {
        if (!targets.length) { log('시야 안에 적이 없다.', '#bdbdbd'); return; }
        log(`${def.icon} 화염이 휘몰아친다!`, '#ff9e40');
        flash('rgba(255,120,30,0.45)'); S.shake = 12; sfx('magic');
        const dmg = 10 + S.floor * 2;
        for (const m of targets) {
          if (m.hp <= 0) continue;
          m.hp -= dmg; m.awake = true; m.hitFlash = 10;
          popup(m.x, m.y, dmg, '#ff9e40');
          if (m.hp <= 0) killMonster(m);
        }
        break;
      }
      case 'ice':
        if (!targets.length) { log('시야 안에 적이 없다.', '#bdbdbd'); return; }
        log(`${def.icon} 냉기가 적들을 얼려버렸다!`, '#80d8ff');
        flash('rgba(128,216,255,0.45)'); sfx('ice');
        for (const m of targets) { m.frozen = 4; popup(m.x, m.y, '빙결', '#80d8ff'); }
        break;
      case 'mapping':
        log(`${def.icon} 층 전체의 구조가 머릿속에 그려진다.`, '#fff59d');
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          if (S.tiles[idx(x, y)] !== WALL) {
            S.seen[idx(x, y)] = 1;
            for (const [dx, dy] of DIRS8) if (inb(x + dx, y + dy)) S.seen[idx(x + dx, y + dy)] = 1;
          }
        }
        for (const tr of S.traps.values()) tr.revealed = true;
        sfx('magic');
        break;
    }
    P.inv.splice(i, 1);
    endTurn();
  }

  // ===== 플레이어 행동 / 턴 =====
  function playerMove(dx, dy) {
    if (S.state !== 'play') return;
    const nx = P.x + dx, ny = P.y + dy;
    if (!inb(nx, ny)) return;
    const m = monsterAt(nx, ny);
    if (m) { playerAttack(m); endTurn(); return; }
    const o = blockingObjectAt(nx, ny);
    if (o) {
      if (o.kind === 'merchant') { openShop(); return; }
      openChest(o); endTurn(); return;
    }
    if (S.tiles[idx(nx, ny)] === WALL) return;
    P.x = nx; P.y = ny;
    pickupHere();
    triggerTrap();
    if (S.tiles[idx(P.x, P.y)] === STAIRS) log('⬇ 계단이다! Enter (또는 ⏬ 버튼)로 내려간다.', '#ffd34d');
    endTurn();
  }

  function waitTurn() {
    if (S.state !== 'play') return;
    endTurn();
  }

  function descend() {
    if (S.state !== 'play') return;
    if (S.tiles[idx(P.x, P.y)] !== STAIRS) { log('여기에는 계단이 없다.', '#bdbdbd'); render(); updateUI(); return; }
    sfx('stairs');
    heal(Math.ceil(P.maxHp * 0.1), true);
    newFloor(S.floor + 1);
    updateUI();
  }

  function endTurn() {
    if (S.state === 'play') {
      S.turn++;
      if (P.poison > 0 && P.hp > 0) { P.poison--; damagePlayer(1, S.lastCause.includes('함정') ? S.lastCause : '독', '#7dff6a'); }
      if (P.regen && S.turn % 4 === 0 && P.hp > 0) heal(P.regen, true);
      if (P.hp > 0) monstersAct();
      computeFOV();
      if (P.hp <= 0 && S.state === 'play') endGame(false);
      if (S.state === 'play' && S.pendingLevels > 0) openLevelUp();
    }
    updateUI();
  }

  // ===== 레벨업 =====
  function openLevelUp() {
    S.state = 'levelup';
    const pool = TRAITS.filter(t => !t.ok || t.ok());
    S.traitChoices = shuffle(pool.slice()).slice(0, 3);
    showOverlay(`
      <div class="modal">
        <div class="big">✨</div>
        <h2>레벨 ${P.level}!</h2>
        <p>새로운 특성을 하나 고르세요. (숫자키 1~3)</p>
        <div class="choices">
          ${S.traitChoices.map((t, i) => `
            <button class="choice" data-act="trait" data-i="${i}">
              <span class="ic">${t.icon}</span>
              <span class="tx"><b>${i + 1}. ${t.name}</b><small>${t.desc}</small></span>
            </button>`).join('')}
        </div>
      </div>`);
  }

  function chooseTrait(i) {
    if (S.state !== 'levelup') return;
    const t = S.traitChoices[i];
    if (!t) return;
    t.apply();
    P.traits.push(t);
    S.pendingLevels--;
    log(`${t.icon} 특성 「${t.name}」 획득!`, '#ffd34d');
    sfx('equip');
    S.state = 'play';
    hideOverlay();
    if (S.pendingLevels > 0) openLevelUp();
    computeFOV();
    updateUI();
  }

  // ===== 상점 =====
  function genShop() {
    const f = S.floor;
    const weaker = P.weapon.bonus <= P.armor.bonus ? 'weapon' : 'armor';
    const tier = clamp(Math.max(P[weaker].tier + 1, Math.floor(f / 2)), 0, 5);
    return [
      { item: { type: 'potion' }, price: 12 + f * 2 },
      { item: { type: pick(['fire', 'ice', 'tele', 'mapping']) }, price: 20 + f * 3 },
      { item: makeEquip(weaker, tier), price: 35 + tier * 12 },
      { item: { type: 'elixir' }, price: 45 + f * 5 },
    ];
  }

  function itemLabel(item) {
    if (item.type === 'weapon') return { icon: '🗡️', name: item.name, desc: `공격력 +${item.bonus} (현재 +${P.weapon.bonus})` };
    if (item.type === 'armor') return { icon: '🛡️', name: item.name, desc: `방어력 +${item.bonus} (현재 +${P.armor.bonus})` };
    return ITEMS[item.type];
  }

  function openShop() {
    if (!S.shop) S.shop = genShop();
    S.state = 'shop';
    renderShop();
    sfx('pick');
  }

  function renderShop() {
    showOverlay(`
      <div class="modal">
        <div class="big">🧙</div>
        <h2>떠돌이 상인</h2>
        <p>"어서 오게, 모험가. 살아서 돌아가고 싶다면 뭐라도 사가게나."<br>보유 골드: <b style="color:var(--accent)">💰 ${P.gold}</b></p>
        <div class="choices">
          ${S.shop.map((o, i) => {
            const l = itemLabel(o.item);
            const dis = o.sold || P.gold < o.price;
            return `<button class="choice" data-act="buy" data-i="${i}" ${dis ? 'disabled' : ''}>
              <span class="ic">${l.icon}</span>
              <span class="tx"><b>${i + 1}. ${l.name}</b><small>${l.desc}</small></span>
              <span class="price">${o.sold ? '판매 완료' : o.price + 'G'}</span>
            </button>`;
          }).join('')}
        </div>
        <button class="secondary" data-act="closeShop">떠나기 (Esc)</button>
      </div>`);
  }

  function buy(i) {
    if (S.state !== 'shop') return;
    const o = S.shop[i];
    if (!o || o.sold || P.gold < o.price) { sfx('error'); return; }
    const consumable = o.item.type in ITEMS;
    if (consumable && P.inv.length >= INV_MAX) { log('가방이 가득 찼다!', '#ff8a80'); sfx('error'); updateUI(); return; }
    P.gold -= o.price;
    o.sold = true;
    grantItem(o.item);
    renderShop();
    updateUI();
  }

  function closeShop() {
    if (S.state !== 'shop') return;
    S.state = 'play';
    hideOverlay();
    log('🧙 "또 보세나."', '#8fd3ff');
    updateUI();
  }

  // ===== 종료 =====
  function fmtTime(ms) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}분 ${String(s % 60).padStart(2, '0')}초`;
  }

  function loadBest() {
    try { return JSON.parse(localStorage.getItem('dungeonDiverBest') || 'null'); } catch (e) { return null; }
  }
  function saveBest(won) {
    const cur = { floor: S.floor, kills: S.kills, level: P.level, won };
    const best = loadBest();
    const better = !best || (won && !best.won) || (won === !!best.won && (cur.floor > best.floor || (cur.floor === best.floor && cur.kills > best.kills)));
    if (better) { try { localStorage.setItem('dungeonDiverBest', JSON.stringify(cur)); } catch (e) { /* 저장 불가 */ } }
    return better;
  }

  function endGame(won) {
    S.state = won ? 'win' : 'dead';
    S.endTime = Date.now();
    const newRecord = saveBest(won);
    if (won) sfx('win'); else { sfx('die'); log(`💀 ${S.lastCause || '알 수 없는 힘'}에게 쓰러졌다…`, '#ff5252'); }
    const game = S;
    setTimeout(() => {
      if (S !== game) return; // 이미 새 게임이 시작됨
      showOverlay(`
        <div class="modal">
          <div class="big">${won ? '🏆' : '🪦'}</div>
          <h2>${won ? '던전 정복!' : '사망'}</h2>
          <p>${won ? '심연의 감시자를 쓰러뜨리고 전설이 되었다!' : `${S.floor}층에서 ${josa(S.lastCause || '알 수 없는 힘', '에게', '에게')} 쓰러졌다.`}
          ${newRecord ? '<br><b style="color:var(--accent)">🎉 새 최고 기록!</b>' : ''}</p>
          <div class="result">
            <div><b>${S.floor}층</b><small>도달 층</small></div>
            <div><b>Lv ${P.level}</b><small>레벨</small></div>
            <div><b>${S.kills}</b><small>처치한 적</small></div>
            <div><b>${S.turn}</b><small>진행 턴</small></div>
            <div><b>💰 ${P.gold}</b><small>골드</small></div>
            <div><b>${fmtTime(S.endTime - S.startTime)}</b><small>플레이 시간</small></div>
          </div>
          <p>특성: ${P.traits.length ? P.traits.map(t => t.icon + ' ' + t.name).join(', ') : '없음'}</p>
          <button class="primary" data-act="start">다시 도전 (Enter)</button>
        </div>`);
    }, won ? 1200 : 700);
  }

  // ===== 오버레이 =====
  const overlay = document.getElementById('overlay');
  function showOverlay(html) { overlay.innerHTML = html; overlay.classList.add('show'); }
  function hideOverlay() { overlay.classList.remove('show'); overlay.innerHTML = ''; }

  function showTitle() {
    const best = loadBest();
    showOverlay(`
      <div class="modal">
        <div class="big">🗝️</div>
        <h2>던전 다이버</h2>
        <p>무작위로 생성되는 던전을 한 칸씩 내려가세요.<br>10층에 잠든 <b>「심연의 감시자」</b>를 쓰러뜨리면 승리!<br>죽으면 처음부터 — 매 판 다른 던전과 다른 빌드.</p>
        <div class="controls">
          <kbd>방향키</kbd> <kbd>WASD</kbd> 이동 · 적에게 부딪히면 공격<br>
          <kbd>Q</kbd><kbd>E</kbd><kbd>Z</kbd><kbd>C</kbd> 대각선 이동 · <kbd>Space</kbd> 한 턴 대기<br>
          <kbd>Enter</kbd> 계단 내려가기 · <kbd>1</kbd>~<kbd>8</kbd> 아이템 사용 · <kbd>M</kbd> 소리<br>
          모바일: 화면을 탭하면 그 방향으로 한 칸 이동
        </div>
        ${best ? `<p>🏅 최고 기록: ${best.won ? '<b>정복!</b>' : best.floor + '층'} · Lv ${best.level} · ${best.kills}마리 처치</p>` : ''}
        <button class="primary" data-act="start">모험 시작 (Enter)</button>
      </div>`);
  }

  function startGame() {
    newGame();
    hideOverlay();
    updateUI();
  }

  overlay.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const act = b.dataset.act, i = Number(b.dataset.i);
    if (act === 'start') startGame();
    else if (act === 'trait') chooseTrait(i);
    else if (act === 'buy') buy(i);
    else if (act === 'closeShop') closeShop();
  });

  // ===== UI =====
  const $ = id => document.getElementById(id);
  function updateUI() {
    if (!S) return;
    const hpPct = clamp(P.hp / P.maxHp, 0, 1) * 100;
    $('hpFill').style.width = hpPct + '%';
    $('hpFill').classList.toggle('low', hpPct < 30);
    $('hpText').textContent = `❤️ ${Math.max(0, P.hp)} / ${P.maxHp}`;
    $('xpFill').style.width = clamp(P.xp / P.xpNext, 0, 1) * 100 + '%';
    $('floorLabel').textContent = S.floor === MAX_FLOOR ? '🌑 최하층' : `${S.floor}층 / ${MAX_FLOOR}`;
    $('stats').innerHTML = `
      <span>레벨 <b>${P.level}</b></span>
      <span>공격 <b>${patk()}</b></span>
      <span>방어 <b>${pdef()}</b></span>
      <span>치명 <b>${Math.round(P.crit * 100)}%</b></span>
      <span>💰 <b>${P.gold}</b></span>
      <span>처치 <b>${S.kills}</b></span>`;
    $('equip').innerHTML = `<span>🗡️ ${P.weapon.name} (+${P.weapon.bonus})</span><span>🛡️ ${P.armor.name} (+${P.armor.bonus})</span>`;
    $('status').innerHTML = (P.poison ? `<span class="poison">🤢 중독 ${P.poison}턴</span> ` : '') +
      (P.traits.length ? P.traits.map(t => `<span title="${t.name}: ${t.desc}">${t.icon}</span>`).join(' ') : '<span>특성 없음 — 레벨업 시 획득</span>');
    let inv = '';
    for (let i = 0; i < INV_MAX; i++) {
      const t = P.inv[i];
      inv += t
        ? `<button class="slot" data-i="${i}" title="${ITEMS[t].name}: ${ITEMS[t].desc}"><span class="num">${i + 1}</span>${ITEMS[t].icon}</button>`
        : `<button class="slot" disabled><span class="num">${i + 1}</span></button>`;
    }
    $('inv').innerHTML = inv;
    const logEl = $('log');
    logEl.innerHTML = S.log.slice(-40).map(l => `<div style="color:${l.color}">${l.text}</div>`).join('');
    logEl.scrollTop = logEl.scrollHeight;
  }

  $('inv').addEventListener('click', e => {
    const b = e.target.closest('.slot');
    if (b && !b.disabled) useItem(Number(b.dataset.i));
  });

  // ===== 렌더링 =====
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const CW = VIEW_W * TILE, CH = VIEW_H * TILE;
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = CW * dpr; canvas.height = CH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  function camera() {
    return { x: clamp(P.x - (VIEW_W >> 1), 0, W - VIEW_W), y: clamp(P.y - (VIEW_H >> 1), 0, H - VIEW_H) };
  }

  function drawGlyph(ch, px, py, scale, alpha = 1, color = '#fff') {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.font = `${Math.floor(TILE * scale)}px ${EMOJI_FONT}`;
    ctx.fillText(ch, px + TILE / 2, py + TILE / 2 + 2);
    ctx.globalAlpha = 1;
  }

  function drawStairs(px, py, vis) {
    ctx.fillStyle = vis ? '#ffd34d' : '#6b5a24';
    for (let s = 0; s < 4; s++) ctx.fillRect(px + 5 + s * 5, py + 7 + s * 5, TILE - 10 - s * 5, 4);
  }

  let frame = 0;
  function render() {
    frame++;
    ctx.save();
    ctx.fillStyle = '#08070c';
    ctx.fillRect(0, 0, CW, CH);
    if (!S) { ctx.restore(); return; }
    if (S.shake > 0) {
      ctx.translate((Math.random() - 0.5) * S.shake, (Math.random() - 0.5) * S.shake);
      S.shake *= 0.85; if (S.shake < 0.4) S.shake = 0;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cam = camera();

    // 타일
    for (let vy = 0; vy < VIEW_H; vy++) {
      for (let vx = 0; vx < VIEW_W; vx++) {
        const x = cam.x + vx, y = cam.y + vy, i = idx(x, y);
        if (!S.seen[i]) continue;
        const vis = S.visible[i], t = S.tiles[i], px = vx * TILE, py = vy * TILE;
        if (t === WALL) {
          ctx.fillStyle = vis ? '#3d3657' : '#1a1825';
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = vis ? '#564c7a' : '#24212f';
          ctx.fillRect(px, py, TILE, TILE - 7);
          if (vis && (x * 3 + y * 5) % 4 === 0) { ctx.fillStyle = '#4a426a'; ctx.fillRect(px + 4, py + 6, 10, 3); }
        } else {
          ctx.fillStyle = vis ? '#241f33' : '#121019';
          ctx.fillRect(px, py, TILE, TILE);
          if ((x * 7 + y * 13) % 5 === 0) { ctx.fillStyle = vis ? '#2e2842' : '#17141f'; ctx.fillRect(px + 8, py + 10, 3, 3); }
          if (t === STAIRS) drawStairs(px, py, vis);
          const tr = S.traps.get(i);
          if (tr && tr.revealed) drawGlyph(tr.type === 'spike' ? '▲' : '🤢', px, py, 0.55, vis ? 1 : 0.4, tr.type === 'spike' ? '#ff5252' : '#76ff03');
        }
      }
    }

    const onScreen = (x, y) => x >= cam.x && y >= cam.y && x < cam.x + VIEW_W && y < cam.y + VIEW_H;
    const bob = k => Math.sin(frame / 12 + k) * 1.5;

    // 오브젝트
    for (const o of S.objects) {
      if (!onScreen(o.x, o.y) || !S.seen[idx(o.x, o.y)]) continue;
      const vis = S.visible[idx(o.x, o.y)];
      const px = (o.x - cam.x) * TILE, py = (o.y - cam.y) * TILE;
      let ch = '❔';
      if (o.kind === 'merchant') ch = '🧙';
      else if (o.kind === 'chest') ch = '📦';
      else if (o.item.type === 'gold') ch = '💰';
      else if (o.item.type === 'weapon') ch = '🗡️';
      else if (o.item.type === 'armor') ch = '🛡️';
      else ch = ITEMS[o.item.type].icon;
      if (vis && o.kind === 'item') {
        ctx.fillStyle = 'rgba(255,211,77,0.12)';
        ctx.beginPath(); ctx.arc(px + TILE / 2, py + TILE / 2, 12, 0, Math.PI * 2); ctx.fill();
      }
      drawGlyph(ch, px, py + (vis && o.kind === 'item' ? bob(o.x) : 0), o.kind === 'item' ? 0.62 : 0.78, vis ? 1 : 0.35);
    }

    // 몬스터
    for (const m of S.monsters) {
      if (!onScreen(m.x, m.y) || !S.visible[idx(m.x, m.y)]) continue;
      const px = (m.x - cam.x) * TILE, py = (m.y - cam.y) * TILE;
      if (m.t.boss) {
        const g = ctx.createRadialGradient(px + TILE / 2, py + TILE / 2, 2, px + TILE / 2, py + TILE / 2, TILE * 1.2);
        g.addColorStop(0, m.enraged ? 'rgba(255,40,80,0.5)' : 'rgba(206,147,216,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(px - TILE, py - TILE, TILE * 3, TILE * 3);
      }
      const scale = m.t.boss ? 0.95 : m.t.small ? 0.5 : 0.78;
      drawGlyph(m.t.icon, px, py + (m.awake ? bob(m.x + m.y) : 0), scale, m.t.phase ? 0.75 : 1);
      if (m.hitFlash > 0) { ctx.fillStyle = `rgba(255,60,60,${m.hitFlash / 16})`; ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4); m.hitFlash--; }
      if (m.frozen > 0) { ctx.fillStyle = 'rgba(128,216,255,0.35)'; ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2); }
      if (!m.awake) drawGlyph('z', px + 10, py - 10, 0.35, 0.8, '#9a93b5');
      if (m.hp < m.maxHp) {
        ctx.fillStyle = '#000'; ctx.fillRect(px + 3, py + 1, TILE - 6, 4);
        ctx.fillStyle = m.t.boss ? '#e040fb' : '#ff5252'; ctx.fillRect(px + 3, py + 1, (TILE - 6) * Math.max(0, m.hp) / m.maxHp, 4);
      }
    }

    // 플레이어
    {
      const px = (P.x - cam.x) * TILE, py = (P.y - cam.y) * TILE;
      ctx.fillStyle = 'rgba(143,211,255,0.18)';
      ctx.beginPath(); ctx.ellipse(px + TILE / 2, py + TILE - 5, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
      drawGlyph(S.state === 'dead' ? '🪦' : '🤺', px, py, 0.82);
      if (P.poison) drawGlyph('🤢', px + 12, py - 10, 0.35, 0.9, '#76ff03');
    }

    // 조명 효과 (시야 바깥으로 갈수록 어두움)
    {
      const cx = (P.x - cam.x) * TILE + TILE / 2, cy = (P.y - cam.y) * TILE + TILE / 2;
      const g = ctx.createRadialGradient(cx, cy, TILE * 1.5, cx, cy, TILE * (P.sight + 1));
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);
    }

    // 이펙트
    for (const f of S.fx) {
      f.t++;
      const a = 1 - f.t / f.life;
      if (f.kind === 'text') {
        const px = (f.x - cam.x) * TILE + TILE / 2, py = (f.y - cam.y) * TILE + 4 - f.t * 0.6;
        ctx.globalAlpha = Math.max(0, a);
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.lineWidth = 3; ctx.strokeStyle = '#000';
        ctx.strokeText(f.text, px, py);
        ctx.fillStyle = f.color; ctx.fillText(f.text, px, py);
        ctx.globalAlpha = 1;
      } else if (f.kind === 'shot') {
        ctx.globalAlpha = Math.max(0, a);
        ctx.strokeStyle = f.color; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo((f.x1 - cam.x) * TILE + TILE / 2, (f.y1 - cam.y) * TILE + TILE / 2);
        ctx.lineTo((f.x2 - cam.x) * TILE + TILE / 2, (f.y2 - cam.y) * TILE + TILE / 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (f.kind === 'flash') {
        ctx.globalAlpha = Math.max(0, a);
        ctx.fillStyle = f.color; ctx.fillRect(-20, -20, CW + 40, CH + 40);
        ctx.globalAlpha = 1;
      }
    }
    S.fx = S.fx.filter(f => f.t < f.life);
    ctx.restore();
  }

  function loop() { render(); requestAnimationFrame(loop); }

  // ===== 입력 =====
  const KEYS = {
    ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0],
    KeyQ: [-1, -1], KeyE: [1, -1], KeyZ: [-1, 1], KeyC: [1, 1],
    KeyK: [0, -1], KeyJ: [0, 1], KeyH: [-1, 0], KeyL: [1, 0], KeyY: [-1, -1], KeyU: [1, -1], KeyB: [-1, 1], KeyN: [1, 1],
    Numpad8: [0, -1], Numpad2: [0, 1], Numpad4: [-1, 0], Numpad6: [1, 0], Numpad7: [-1, -1], Numpad9: [1, -1], Numpad1: [-1, 1], Numpad3: [1, 1],
  };
  const digit = code => { const m = /^Digit([0-9])$/.exec(code); return m ? Number(m[1]) : -1; };

  function toggleMute() {
    muted = !muted;
    $('mute').textContent = muted ? '🔇' : '🔊';
  }
  $('mute').addEventListener('click', toggleMute);

  document.addEventListener('keydown', e => {
    const code = e.code;
    if (code === 'KeyM') { toggleMute(); return; }
    if (!S || S.state === 'title') {
      if (code === 'Enter' || code === 'Space') { e.preventDefault(); startGame(); }
      return;
    }
    if (S.state === 'dead' || S.state === 'win') {
      if (code === 'Enter' && overlay.classList.contains('show')) { e.preventDefault(); startGame(); }
      return;
    }
    if (S.state === 'levelup') { const n = digit(code); if (n >= 1 && n <= 3) chooseTrait(n - 1); return; }
    if (S.state === 'shop') {
      const n = digit(code);
      if (n >= 1 && n <= 4) buy(n - 1);
      else if (code === 'Escape' || code === 'Enter') closeShop();
      return;
    }
    const d = KEYS[code];
    if (d) { e.preventDefault(); playerMove(d[0], d[1]); return; }
    if ((code === 'Period' && e.shiftKey) || code === 'Enter' || code === 'NumpadEnter') { e.preventDefault(); descend(); return; }
    if (code === 'Space' || code === 'Period' || code === 'Numpad5') { e.preventDefault(); waitTurn(); return; }
    const n = digit(code);
    if (n >= 1 && n <= INV_MAX) useItem(n - 1);
  });

  canvas.addEventListener('pointerdown', e => {
    if (!S || S.state !== 'play') return;
    const r = canvas.getBoundingClientRect();
    const cam = camera();
    const tx = Math.floor((e.clientX - r.left) / r.width * VIEW_W) + cam.x;
    const ty = Math.floor((e.clientY - r.top) / r.height * VIEW_H) + cam.y;
    const dx = Math.sign(tx - P.x), dy = Math.sign(ty - P.y);
    if (!dx && !dy) { if (S.tiles[idx(P.x, P.y)] === STAIRS) descend(); else waitTurn(); }
    else playerMove(dx, dy);
  });

  $('dpad').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || !S) return;
    if (b.dataset.dir) { const [dx, dy] = b.dataset.dir.split(',').map(Number); playerMove(dx, dy); }
    else if (b.dataset.act === 'wait') waitTurn();
    else if (b.dataset.act === 'descend') descend();
  });

  // 테스트/디버그용 핸들
  window.__DD = {
    get S() { return S; }, get P() { return P; },
    newGame, genMap: (floor, seed) => { const prev = rng; rng = mulberry32(seed); const m = genMap(floor); rng = prev; return m; },
    playerMove, descend, useItem, waitTurn, chooseTrait, buy, closeShop, startGame, W, H, WALL, STAIRS,
  };

  showTitle();
  loop();
})();
