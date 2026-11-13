/* =============================================================================
   RETRO CLASH: TRIVIA BOWL
   -----------------------------------------------------------------------------
   Single-file React prototype (Tailwind CSS + HTML5 Canvas + Web Audio).

   FILE MAP
     1. TRIVIA_BANK      – all prompts/answers (paste new prompts here, nothing else changes)
     2. GAME_CONFIG      – every tunable number: timers, rarity yardage, counter odds, CPU skill
     3. SOUND_ENGINE     – tiny Web Audio synth (whistle, cheer, kick, throw, buzzer, ...)
     4. CANVAS_RENDERER  – pixel sprites, sport backgrounds, keyframed play animations
     5. GAME_ENGINE      – fuzzy matching, prompt deck, CPU brain, the 3 sport rule engines
     2b. CAREER_CONFIG   – club mode economy, league, contracts + the player ABILITIES catalogue
     5b. CAREER_ENGINE   – club/league/market/contract logic over a JSON save (localStorage)
     6. APP_UI           – title, career hub (home/roster/market/league/schedule), match screen, box score

   ADDING PROMPTS: add to RANKED_PROMPTS in section 1. List every valid answer
     from most common to rarest; tiers are computed from list position via
     RARITY_CUTOFFS. Hand-tiered prompts can go in CUSTOM_PROMPTS instead.
     ids must be unique. See the section 1 header for the full format.
============================================================================= */

import React, { useState, useEffect, useRef, useCallback, useMemo, useReducer } from 'react';

/* =============================================================================
   1. TRIVIA_BANK  ->  lives in ./trivia-bank.js (paste new prompts there)
============================================================================= */
import { TRIVIA_BANK, RARITY_CUTOFFS } from './trivia-bank.js';

export { TRIVIA_BANK, RARITY_CUTOFFS };

/* =============================================================================
   2. GAME_CONFIG  (tune the feel of the game here)
============================================================================= */
export const GAME_CONFIG = {
  timerSeconds: 15,

  tiers: {
    5: { label: 'ULTRA-RARE', color: '#ffd23f' },
    4: { label: 'RARE', color: '#c77dff' },
    3: { label: 'SOLID', color: '#4cc9f0' },
    2: { label: 'COMMON', color: '#f4a261' },
    1: { label: 'TOO COMMON', color: '#ef476f' },
  },

  // Chance that an answer of this tier triggers the opponent's counter-attack
  // (pick-six / overhead smash / steal + breakaway goal).
  counterAttackChance: { 1: 0.5, 2: 0.25, 3: 0, 4: 0, 5: 0 },

  // Allowed typos (Levenshtein distance) by the shorter of guess/answer length.
  fuzzy: {
    typoAllowance: [
      { maxLen: 3, typos: 0 },
      { maxLen: 5, typos: 1 },
      { maxLen: 9, typos: 2 },
      { maxLen: Infinity, typos: 3 },
    ],
  },

  // A prompt is skipped by the deck once this share of its answers is used.
  prompts: { retireWhenUsedRatio: 0.75 },

  cpu: {
    thinkMs: [900, 1700],
    autoContinueMs: 2600, // CPU play result modals dismiss themselves
    // Weighted chance of the CPU "answering" each tier (0 = whiff / invalid).
    difficulties: {
      rookie: { label: 'ROOKIE', tierWeights: { 0: 0.16, 1: 0.26, 2: 0.24, 3: 0.2, 4: 0.1, 5: 0.04 } },
      pro: { label: 'PRO', tierWeights: { 0: 0.08, 1: 0.2, 2: 0.22, 3: 0.26, 4: 0.16, 5: 0.08 } },
      legend: { label: 'LEGEND', tierWeights: { 0: 0.04, 1: 0.12, 2: 0.18, 3: 0.3, 4: 0.22, 5: 0.14 } },
    },
    whiffs: ['Uhh... Pluto?', 'ERROR 404', 'Beep boop?', 'Toaster', '...', 'Blernsday', 'NULL', 'Potato?'],
  },

  // Real-time play (positions are in canvas pixels; the field is 320x180)
  arcade: {
    runSpeed: 58,
    carrySpeedMult: 0.92,
    tennisSpeedMult: 1.3,
    soccerSeconds: 150,
    basketballSeconds: 150,
    footballDrives: 3,
    tackleRange: 9,
    humanTackleChance: 0.55,
    humanStealChance: 0.45,
    cpuStealPerSec: 0.8,
    stunSeconds: 0.6,
    passSpeed: { 5: 200, 4: 180, 3: 140, 2: 105, 1: 95, 0: 115 },
    soccerSave: { 5: 0.05, 4: 0.28, 3: 0.52, 2: 0.74, 1: 0.86 },
    basketMake: { 5: 0.95, 4: 0.8, 3: 0.6, 2: 0.4, 1: 0.25 },
    throwCatch: { 5: 1, 4: 0.95, 3: 0.82, 2: 0.5, 1: 0.4 },
    tennisPace: { 5: 0.46, 4: 0.6, 3: 0.82, 2: 1.1, 1: 1.2 },
  },

  football: {
    startYard: 20,
    firstDownYards: 10,
    drivesPerTeam: 3,
    maxOvertimeRounds: 2,
    yardsByTier: { 4: 25, 3: 10, 2: 4, 1: 2 }, // tier 5 = automatic touchdown
    sackYards: 7, // invalid / duplicate answer
    timeoutCausesFumble: true, // timeout = fumble (turnover); otherwise treated as a sack
    touchdownPoints: 7,
    pickSixPoints: 7,
    safetyPoints: 2,
  },

  tennis: {
    pointsToWin: 7,
    winBy: 2,
    maxRallyShots: 8, // at the cap, any tier 3+ shot wins the rally
    deepRetrieveChance: 0.25, // chance a tier-4 corner shot gets chased down
    pressureMinTier: 3, // after a retrieve, the retriever needs tier 3+ or loses the point
  },

  soccer: {
    rounds: 5,
    maxSuddenDeathRounds: 10,
    counterAwardsGoal: true, // tier 1-2 counter: keeper steals it, opponent scores a breakaway goal
    // gx = horizontal placement (0 centre .. 1 post), gy = height range (0 ground .. 1 crossbar)
    shots: {
      5: { gx: 0.86, gy: [0.8, 0.95], flight: 0.3, save: 0 },
      4: { gx: 0.8, gy: [0.1, 0.7], flight: 0.36, save: 0.15 },
      3: { gx: 0.55, gy: [0.15, 0.5], flight: 0.44, save: 0.4 },
      2: { gx: 0.3, gy: [0.05, 0.35], flight: 0.55, save: 0.65 },
      1: { gx: 0.2, gy: [0, 0.25], flight: 0.62, save: 0.8 },
    },
  },
};

/* =============================================================================
   2b. CAREER_CONFIG  (club mode: economy, league, contracts, player abilities)
============================================================================= */
export const CAREER_CONFIG = {
  saveKey: 'retro-clash-career-v1',
  startingCoins: 500,
  rosterMax: 24,
  freeStartersPerSport: { football: 2, basketball: 2, soccer: 2, tennis: 1 }, // the free squad leaves the rest of each lineup empty
  coverageAgents: 10, // extra cheap free agents offered for positions you still need
  // value = transfer fee, salary = coins per week, weight = how often this rarity appears
  stars: {
    1: { value: 80, salary: 4, weight: 30 },
    2: { value: 180, salary: 10, weight: 30 },
    3: { value: 420, salary: 22, weight: 23 },
    4: { value: 950, salary: 45, weight: 12 },
    5: { value: 2200, salary: 90, weight: 5 },
  },
  rewards: { win: 300, draw: 160, loss: 100, perSeason: 30, tier5: 25, tier4: 10, playoffBerth: 250, playoffWin: 450, title: 1200 },
  sellRatio: 0.6, // selling returns 60% of a player's value
  resignFeeRatio: 0.5, // re-signing an expiring player costs 50% of value
  offers: [
    { id: 'low', label: 'LOWBALL', mult: 1.0, chance: 0.3 },
    { id: 'fair', label: 'FAIR', mult: 1.35, chance: 0.6 },
    { id: 'big', label: 'BLOCKBUSTER', mult: 1.8, chance: 0.88 },
  ],
  morale: { start: 70, win: 6, draw: 1, loss: -5, starterBonus: 2, benchedPenalty: -3, unpaid: -12, newSigning: 10, unhappyBelow: 35 },
  freeAgentsPerWeek: 10,
  rivalStarsMean: 1.8, // average star level of rival squads in season 1
  rivalStarsPerSeason: 0.35, // rivals' new signings get this much better every season
  rivalDevelopChance: 0.22, // per rival player, per off-season: chance to gain a star
  userDevelopChance: 0.2, // per happy (70+ morale) player of yours, per off-season
  forfeitScores: { football: [0, 14], basketball: [0, 20], tennis: [0, 7], soccer: [0, 3] },
  rivals: [
    { name: 'LASER SHARKS', primary: '#00b4d8', secondary: '#ffd60a' },
    { name: 'BIT CRUSHERS', primary: '#ff006e', secondary: '#111111' },
    { name: 'TURBO TITANS', primary: '#fb5607', secondary: '#ffffff' },
    { name: 'GLITCH GHOSTS', primary: '#8338ec', secondary: '#c0fdfb' },
    { name: 'ARCADE APES', primary: '#606c38', secondary: '#fefae0' },
    { name: 'VECTOR VIPERS', primary: '#2dc653', secondary: '#081c15' },
    { name: 'CHROME COMETS', primary: '#adb5bd', secondary: '#d00000' },
  ],
};

const pct = (m) => `${Math.round(m * 100)}%`;

// Every player rolls one ability. `mags` = strength at 1..5 stars (rolled with a little variance).
export const ABILITIES = {
  clock: { name: 'CLOCK MANAGER', kind: 'TRIVIA', mags: [1, 2, 3, 4, 5], desc: (m) => `+${m}s on the answer clock` },
  scout: { name: 'FILM STUDY', kind: 'TRIVIA', mags: [0.15, 0.25, 0.4, 0.55, 0.75], desc: (m) => `${pct(m)} chance per play to reveal a rare-answer hint` },
  retry: { name: 'SECOND WIND', kind: 'TRIVIA', mags: [1, 1, 1, 2, 3], desc: (m) => `${m} free retr${m > 1 ? 'ies' : 'y'} per match after a wrong answer` },
  shield: { name: 'IRON DEFENSE', kind: 'RISK', mags: [0.1, 0.18, 0.28, 0.38, 0.5], desc: (m) => `Rival counter-attacks ${pct(m)} less likely` },
  ballhawk: { name: 'BALLHAWK', kind: 'RISK', mags: [0.05, 0.08, 0.12, 0.16, 0.22], desc: (m) => `+${pct(m)} chance to counter the rival's obvious answers` },
  clutch: { name: 'CLUTCH GENE', kind: 'RISK', mags: [0.2, 0.35, 0.5, 0.7, 0.9], desc: (m) => `${pct(m)} chance a T2 answer plays as T3` },
  composure: { name: 'COMPOSURE', kind: 'RISK', mags: [0.12, 0.2, 0.3, 0.42, 0.55], desc: (m) => `${pct(m)} chance a wrong answer is forgiven (plays as a safe T2)` },
  power: { name: 'BULLDOZER', kind: 'STAT', sport: 'football', mags: [0.12, 0.2, 0.28, 0.36, 0.48], desc: (m) => `${pct(m)} chance to break the first tackle each play` },
  shooter: { name: 'SHARPSHOOTER', kind: 'STAT', sport: 'basketball', mags: [0.04, 0.07, 0.1, 0.14, 0.2], desc: (m) => `+${pct(m)} shot make chance` },
  wheels: { name: 'WHEELS', kind: 'STAT', mags: [0.05, 0.09, 0.13, 0.18, 0.25], desc: (m) => `Runs ${pct(m)} faster on the field` },
  bigserve: { name: 'BIG SERVE', kind: 'STAT', sport: 'tennis', mags: [0.1, 0.18, 0.27, 0.36, 0.5], desc: (m) => `${pct(m)} chance a SOLID shot is a clean winner` },
  finisher: { name: 'FINISHER', kind: 'STAT', sport: 'soccer', mags: [0.06, 0.1, 0.15, 0.2, 0.28], desc: (m) => `Keeper save chance -${pct(m)}` },
  specialist: { name: 'BRAIN', kind: 'SPECIALIST', mags: [0.2, 0.35, 0.5, 0.7, 0.9], desc: (m, cat) => `${pct(m)} chance ${cat} answers jump +1 tier` },
};

/* =============================================================================
   3. SOUND_ENGINE  (pure Web Audio synthesis, no assets)
============================================================================= */
export const SOUND_ENGINE = (() => {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let muted = false;

  function ensure() {
    if (typeof window === 'undefined') return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function noiseSource() {
    if (!noiseBuf) {
      const len = ctx.sampleRate * 2;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    return src;
  }

  function tone({ type = 'square', f0, f1, dur, vol = 0.25, at = 0, vibrato }) {
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (vibrato) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = vibrato.rate;
      lg.gain.value = vibrato.depth;
      lfo.connect(lg);
      lg.connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function noise({ dur, vol = 0.3, at = 0, type = 'bandpass', f0 = 1000, f1, q = 1, attack = 0.01 }) {
    const t = ctx.currentTime + at;
    const src = noiseSource();
    const filt = ctx.createBiquadFilter();
    const g = ctx.createGain();
    filt.type = type;
    filt.Q.value = q;
    filt.frequency.setValueAtTime(f0, t);
    if (f1) filt.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  const SFX = {
    whistle() {
      tone({ type: 'square', f0: 2200, dur: 0.16, vol: 0.12, vibrato: { rate: 40, depth: 140 } });
      tone({ type: 'square', f0: 2200, dur: 0.5, vol: 0.12, at: 0.22, vibrato: { rate: 40, depth: 140 } });
    },
    cheer() {
      noise({ dur: 1.8, vol: 0.45, f0: 900, f1: 1300, q: 0.5, attack: 0.25 });
      noise({ dur: 1.4, vol: 0.2, at: 0.15, f0: 2600, f1: 1900, q: 1.2, attack: 0.2 });
      for (let i = 0; i < 4; i++) {
        const f = 500 + Math.random() * 400;
        tone({ type: 'triangle', f0: f, f1: f * 1.6, dur: 0.35, vol: 0.05, at: 0.2 + i * 0.22 });
      }
    },
    kick() {
      tone({ type: 'sine', f0: 170, f1: 40, dur: 0.2, vol: 0.6 });
      noise({ dur: 0.06, vol: 0.35, type: 'highpass', f0: 1800 });
    },
    throw() {
      noise({ dur: 0.4, vol: 0.25, f0: 400, f1: 2400, q: 2, attack: 0.08 });
    },
    hit() {
      tone({ type: 'triangle', f0: 950, f1: 420, dur: 0.08, vol: 0.35 });
      noise({ dur: 0.04, vol: 0.2, type: 'highpass', f0: 3000 });
    },
    smash() {
      tone({ type: 'square', f0: 700, f1: 160, dur: 0.18, vol: 0.3 });
      noise({ dur: 0.3, vol: 0.4, f0: 2500, f1: 300, q: 1 });
    },
    tackle() {
      noise({ dur: 0.18, vol: 0.5, type: 'lowpass', f0: 600, f1: 120 });
      tone({ type: 'sine', f0: 120, f1: 50, dur: 0.15, vol: 0.4 });
    },
    buzzer() {
      tone({ type: 'sawtooth', f0: 138, dur: 0.7, vol: 0.22 });
      tone({ type: 'square', f0: 146, dur: 0.7, vol: 0.12 });
    },
    tick() {
      tone({ type: 'square', f0: 1250, dur: 0.04, vol: 0.07 });
    },
    correct() {
      [523, 659, 784, 1046].forEach((f, i) => tone({ type: 'square', f0: f, dur: 0.09, vol: 0.1, at: i * 0.06 }));
    },
    wrong() {
      tone({ type: 'square', f0: 320, f1: 140, dur: 0.3, vol: 0.14 });
    },
    select() {
      tone({ type: 'square', f0: 880, dur: 0.05, vol: 0.08 });
    },
  };

  return {
    unlock: () => ensure(),
    play(name) {
      if (muted) return;
      const c = ensure();
      if (!c || !SFX[name]) return;
      try {
        SFX[name]();
      } catch (e) {
        /* audio failures must never break gameplay */
      }
    },
    setMuted(m) {
      muted = m;
    },
    isMuted: () => muted,
  };
})();

/* =============================================================================
   4. CANVAS_RENDERER
   -----------------------------------------------------------------------------
   The renderer is data driven. Sport engines emit a small "anim spec"; the
   builders below turn it into a TIMELINE:
     { sport, scene, teams, duration, idle,
       actors: [{ id, team, head, swap, racket, face, kf: [{ t, x, y, pose?, face? }] }],
       ball:   { kind, kf: [{ t, x, y, h, arc? } | { t, carry: actorId, h }] },
       events: [{ t, sound? , shake?, cheer?, confetti?, banner? }] }
   renderFrame(ctx, timeline, t) draws any timeline at any time t, so every
   animation is just keyframes + events. Internal resolution 320x180, scaled up.
============================================================================= */
const CW = 320;
const CH = 180;
const PIXEL_FONT = '"Press Start 2P", ui-monospace, monospace';
const FIXED_COLORS = { K: '#f2c18d', W: '#f4f4f4', B: '#1a1a1a', G: '#a8a8a8', H: '#3b2414' };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, u) => a + (b - a) * u;
const hash2 = (x, y) => {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

// --- Pixel sprite parts (P = primary jersey, S = secondary, K = skin, G = facemask, H = hair, B = boots)
const SPRITE_PARTS = {
  head: {
    helmet: ['..PPPP..', '.PPPSPP.', '.PPKKGG.', '..KKKG..'],
    hair: ['..HHHH..', '.HHHHHH.', '.HHKKKK.', '..KKKK..'],
  },
  body: {
    normal: ['.PPSSPP.', 'KPPSSPPK', 'K.PPPP.K', '..PPPP..'],
    armsUp: ['.PPSSPP.', '.PPSSPP.', '..PPPP..', '..PPPP..'],
  },
  legs: {
    stand: ['..SSSS..', '..S..S..', '..K..K..', '.BB..BB.'],
    run1: ['..SSSS..', '.SS..SS.', '.K....K.', 'BB....BB'],
    run2: ['..SSSS..', '...SSS..', '...KK...', '...BBB..'],
  },
};

function composeSprite(head, body, legs, armsUp) {
  const rows = [...SPRITE_PARTS.head[head], ...SPRITE_PARTS.body[body], ...SPRITE_PARTS.legs[legs]].map((r) => r.split(''));
  if (armsUp) {
    for (let y = 1; y <= 4; y++) {
      rows[y][0] = 'K';
      rows[y][7] = 'K';
    }
  }
  return rows.map((r) => r.join(''));
}

// Rotate a char map 90deg clockwise: the head ends up on the right (= facing direction).
function rotateCW(rows) {
  const h = rows.length;
  const w = rows[0].length;
  const out = [];
  for (let y = 0; y < w; y++) {
    let line = '';
    for (let x = 0; x < h; x++) line += rows[h - 1 - x][y];
    out.push(line);
  }
  return out;
}

const POSE_MAPS = {};
['helmet', 'hair'].forEach((head) => {
  POSE_MAPS[head] = {
    stand: composeSprite(head, 'normal', 'stand'),
    run1: composeSprite(head, 'normal', 'run1'),
    run2: composeSprite(head, 'normal', 'run2'),
    armsUp: composeSprite(head, 'armsUp', 'stand', true),
    dive: rotateCW(composeSprite(head, 'armsUp', 'run1', true)),
    down: rotateCW(composeSprite(head, 'normal', 'stand')),
  };
});

const spriteCache = new Map();
export function getSprite(pose, head, primary, secondary, flip, skin, hair) {
  const key = `${pose}|${head}|${primary}|${secondary}|${flip ? 1 : 0}|${skin || ''}|${hair || ''}`;
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const map = (POSE_MAPS[head] || POSE_MAPS.hair)[pose] || POSE_MAPS[head].stand;
  const h = map.length;
  const w = map[0].length;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = map[y][x];
      const col = ch === 'P' ? primary : ch === 'S' ? secondary : ch === 'K' && skin ? skin : ch === 'H' && hair ? hair : FIXED_COLORS[ch];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(flip ? w - 1 - x : x, y, 1, 1);
    }
  }
  spriteCache.set(key, c);
  return c;
}

// --- Text helpers ------------------------------------------------------------
function drawPixelText(ctx, text, x, y, size, color, align = 'center', outline = 2) {
  ctx.font = `${size}px ${PIXEL_FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (outline) {
    ctx.fillStyle = '#000';
    for (const [dx, dy] of [[-outline, 0], [outline, 0], [0, -outline], [0, outline], [-outline, -outline], [outline, outline], [-outline, outline], [outline, -outline], [0, outline + 1]]) {
      ctx.fillText(text, x + dx, y + dy);
    }
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function fitFont(ctx, text, size, maxW) {
  let s = size;
  ctx.font = `${s}px ${PIXEL_FONT}`;
  while (s > 6 && ctx.measureText(text).width > maxW) {
    s -= 1;
    ctx.font = `${s}px ${PIXEL_FONT}`;
  }
  return s;
}

const shortName = (name) => {
  const words = String(name || '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').split(' ').filter(Boolean);
  if (!words.length) return 'TEAM';
  return (words[0].length >= 3 ? words[0] : words.join('')).slice(0, 4);
};

// --- Shared background pieces -----------------------------------------------
function drawCrowd(ctx, teams, y0, y1, clock, cheer) {
  ctx.fillStyle = '#1c1830';
  ctx.fillRect(0, y0, CW, y1 - y0);
  const cols = [teams[0].primary, teams[1].primary, teams[0].secondary, teams[1].secondary, '#e8e8e8', '#6c6c8a'];
  let row = 0;
  for (let y = y0 + 3; y < y1 - 3; y += 5, row++) {
    for (let x = (row % 2) * 3 + 1; x < CW; x += 6) {
      const h = hash2(x, row);
      let bob = 0;
      if (cheer > 0.05) bob = Math.sin(clock * 18 + h * 6.28) > 0 ? -Math.round(cheer * 2) : 0;
      else if (Math.sin(clock * 2 + h * 40) > 0.97) bob = -1;
      ctx.fillStyle = FIXED_COLORS.K;
      ctx.fillRect(x, y + bob, 2, 2);
      ctx.fillStyle = cols[Math.floor(h * cols.length)];
      ctx.fillRect(x - 1, y + 2 + bob, 4, 2);
    }
  }
}

// Football field: offense always attacks to the right.
const FY = (yard) => 20 + yard * 2.8;
const FIELD_TOP = 48;
const FIELD_BOT = 172;

function bgFootball(ctx, scene, teams, clock, cheer) {
  const off = teams[scene.offense];
  const def = teams[1 - scene.offense];
  drawCrowd(ctx, teams, 0, 40, clock, cheer);
  ctx.fillStyle = '#24572a';
  ctx.fillRect(0, 40, CW, 8);
  ctx.fillRect(0, FIELD_BOT, CW, CH - FIELD_BOT);
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = i % 2 ? '#3d9140' : '#368238';
    ctx.fillRect(Math.round(FY(i * 10)), FIELD_TOP, 28, FIELD_BOT - FIELD_TOP);
  }
  ctx.fillStyle = off.primary;
  ctx.fillRect(0, FIELD_TOP, 20, FIELD_BOT - FIELD_TOP);
  ctx.fillStyle = def.primary;
  ctx.fillRect(300, FIELD_TOP, 20, FIELD_BOT - FIELD_TOP);
  const vText = (txt, x, color) => {
    txt.split('').forEach((ch, i) => drawPixelText(ctx, ch, x, 110 - (txt.length - 1) * 5 + i * 10, 8, color, 'center', 1));
  };
  vText(shortName(off.name), 10, off.secondary);
  vText(shortName(def.name), 310, def.secondary);
  for (let yard = 0; yard <= 100; yard += 5) {
    ctx.fillStyle = yard % 10 === 0 ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.45)';
    ctx.fillRect(Math.round(FY(yard)), FIELD_TOP, 1, FIELD_BOT - FIELD_TOP);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  for (let yard = 1; yard < 100; yard++) {
    const x = Math.round(FY(yard));
    ctx.fillRect(x, 94, 1, 2);
    ctx.fillRect(x, 124, 1, 2);
  }
  for (let yard = 10; yard <= 90; yard += 10) {
    const n = String(yard <= 50 ? yard : 100 - yard);
    drawPixelText(ctx, n, FY(yard), 58, 6, 'rgba(255,255,255,0.8)', 'center', 0);
    drawPixelText(ctx, n, FY(yard), 164, 6, 'rgba(255,255,255,0.8)', 'center', 0);
  }
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, FIELD_TOP, CW, 1);
  ctx.fillRect(0, FIELD_BOT - 1, CW, 1);
  if (scene.yard != null) {
    ctx.fillStyle = '#3a86ff';
    ctx.fillRect(Math.round(FY(scene.yard)), FIELD_TOP, 2, FIELD_BOT - FIELD_TOP);
    if (scene.toGo && scene.yard + scene.toGo < 100) {
      ctx.fillStyle = '#ffd60a';
      ctx.fillRect(Math.round(FY(scene.yard + scene.toGo)), FIELD_TOP, 2, FIELD_BOT - FIELD_TOP);
    }
  }
}

// Tennis court: team 0 always on the left.
const COURT = { x0: 40, x1: 280, y0: 64, y1: 156, net: 160 };
function bgTennis(ctx, scene, teams, clock, cheer) {
  drawCrowd(ctx, teams, 0, 36, clock, cheer);
  ctx.fillStyle = '#2f6b4f';
  ctx.fillRect(0, 36, CW, CH - 36);
  ctx.fillStyle = '#3f72b8';
  ctx.fillRect(COURT.x0, COURT.y0, COURT.x1 - COURT.x0, COURT.y1 - COURT.y0);
  ctx.fillStyle = '#fff';
  const line = (x, y, w, h) => ctx.fillRect(x, y, w, h);
  line(COURT.x0, COURT.y0, COURT.x1 - COURT.x0, 1);
  line(COURT.x0, COURT.y1, COURT.x1 - COURT.x0 + 1, 1);
  line(COURT.x0, COURT.y0, 1, COURT.y1 - COURT.y0);
  line(COURT.x1, COURT.y0, 1, COURT.y1 - COURT.y0);
  line(COURT.x0, COURT.y0 + 11, COURT.x1 - COURT.x0, 1);
  line(COURT.x0, COURT.y1 - 11, COURT.x1 - COURT.x0, 1);
  line(100, COURT.y0 + 11, 1, COURT.y1 - COURT.y0 - 22);
  line(220, COURT.y0 + 11, 1, COURT.y1 - COURT.y0 - 22);
  line(100, 110, 120, 1);
  line(COURT.x0, 110, 4, 1);
  line(COURT.x1 - 3, 110, 4, 1);
  // net
  ctx.fillStyle = 'rgba(20,20,20,0.55)';
  ctx.fillRect(COURT.net - 1, COURT.y0 - 6, 3, COURT.y1 - COURT.y0 + 12);
  ctx.fillStyle = '#ddd';
  for (let y = COURT.y0 - 6; y < COURT.y1 + 6; y += 2) ctx.fillRect(COURT.net, y, 1, 1);
  ctx.fillStyle = '#fff';
  ctx.fillRect(COURT.net - 1, COURT.y0 - 6, 3, 1);
  ctx.fillStyle = '#333';
  ctx.fillRect(COURT.net - 1, COURT.y0 - 9, 3, 4);
  ctx.fillRect(COURT.net - 1, COURT.y1 + 5, 3, 4);
  drawPixelText(ctx, shortName(teams[0].name), 20, 48, 6, teams[0].primary, 'center', 1);
  drawPixelText(ctx, shortName(teams[1].name), 300, 48, 6, teams[1].primary, 'center', 1);
}

// Soccer: behind-the-penalty-spot view.
const GOAL = { left: 104, right: 216, line: 74, bar: 30 };
function bgSoccer(ctx, scene, teams, clock, cheer) {
  drawCrowd(ctx, teams, 0, 26, clock, cheer);
  for (let i = 0; i < 8; i++) {
    const tm = teams[i % 2];
    ctx.fillStyle = tm.primary;
    ctx.fillRect(i * 40, 26, 40, 8);
    drawPixelText(ctx, i % 2 ? 'CLASH' : 'RETRO', i * 40 + 20, 30, 5, tm.secondary, 'center', 0);
  }
  for (let y = 34, i = 0; y < CH; y += 12, i++) {
    ctx.fillStyle = i % 2 ? '#3a8c3f' : '#348238';
    ctx.fillRect(0, y, CW, 12);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(0, GOAL.line, CW, 1);
  const rect = (x0, y0, x1, y1) => {
    ctx.fillRect(x0, y0, x1 - x0, 1);
    ctx.fillRect(x0, y1, x1 - x0 + 1, 1);
    ctx.fillRect(x0, y0, 1, y1 - y0);
    ctx.fillRect(x1, y0, 1, y1 - y0);
  };
  rect(84, GOAL.line, 236, 96);
  rect(40, GOAL.line, 280, 134);
  for (let a = 0.25; a <= Math.PI - 0.25; a += 0.06) ctx.fillRect(Math.round(160 + Math.cos(a) * 30), Math.round(134 + Math.sin(a) * 10), 1, 1);
  ctx.fillRect(159, 150, 3, 2);
  // net (behind posts)
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(GOAL.left + 4, GOAL.bar - 6, GOAL.right - GOAL.left - 8, GOAL.line - GOAL.bar + 6);
  ctx.fillStyle = 'rgba(230,230,230,0.5)';
  for (let x = GOAL.left + 4; x <= GOAL.right - 4; x += 4) ctx.fillRect(x, GOAL.bar - 6, 1, GOAL.line - GOAL.bar + 6);
  for (let y = GOAL.bar - 6; y <= GOAL.line; y += 4) ctx.fillRect(GOAL.left + 4, y, GOAL.right - GOAL.left - 8, 1);
  // frame
  ctx.fillStyle = '#fff';
  ctx.fillRect(GOAL.left - 2, GOAL.bar - 2, 3, GOAL.line - GOAL.bar + 3);
  ctx.fillRect(GOAL.right, GOAL.bar - 2, 3, GOAL.line - GOAL.bar + 3);
  ctx.fillRect(GOAL.left - 2, GOAL.bar - 2, GOAL.right - GOAL.left + 5, 3);
}

const BACKGROUNDS = { football: bgFootball, tennis: bgTennis, soccer: bgSoccer };

// --- Timeline evaluation ------------------------------------------------------
function actorState(a, t) {
  const k = a.kf;
  let i = 0;
  while (i < k.length - 1 && k[i + 1].t <= t) i++;
  const k0 = k[i];
  const k1 = k[i + 1];
  let x = k0.x;
  let y = k0.y;
  let moving = false;
  if (k1 && t > k0.t) {
    const u = clamp((t - k0.t) / (k1.t - k0.t), 0, 1);
    x = lerp(k0.x, k1.x, u);
    y = lerp(k0.y, k1.y, u);
    moving = Math.hypot(k1.x - k0.x, k1.y - k0.y) > 0.5;
  }
  let face = null;
  if (k0.face) face = k0.face;
  else if (k1 && t > k0.t && Math.abs(k1.x - k0.x) > 0.3) face = Math.sign(k1.x - k0.x);
  else {
    for (let j = i; j > 0 && face === null; j--) {
      if (k[j].face) face = k[j].face;
      else if (Math.abs(k[j].x - k[j - 1].x) > 0.3) face = Math.sign(k[j].x - k[j - 1].x);
    }
  }
  if (face === null) face = a.face || 1;
  const pose = k0.pose || (moving ? (Math.floor(t * 10) % 2 ? 'run1' : 'run2') : 'stand');
  return { x, y, pose, face };
}

function ballState(ball, t, actorsById) {
  const k = ball.kf;
  let i = 0;
  while (i < k.length - 1 && k[i + 1].t <= t) i++;
  const k0 = k[i];
  const k1 = k[i + 1];
  if (k0.carry) {
    const a = actorsById[k0.carry];
    if (!a) return null;
    const s = actorState(a, t);
    return { x: s.x + s.face * 3, y: s.y + 0.5, h: k0.h != null ? k0.h : 6 };
  }
  if (!k1 || t <= k0.t || k1.carry && k1.x == null) return { x: k0.x, y: k0.y, h: k0.h || 0 };
  const u = clamp((t - k0.t) / (k1.t - k0.t), 0, 1);
  return {
    x: lerp(k0.x, k1.x, u),
    y: lerp(k0.y, k1.y, u),
    h: lerp(k0.h || 0, k1.h || 0, u) + (k1.arc || 0) * 4 * u * (1 - u),
  };
}

function drawBall(ctx, kind, b, t) {
  const x = Math.round(b.x);
  const y = Math.round(b.y - b.h);
  if (kind === 'football') {
    const spin = Math.floor(t * 12) % 2;
    ctx.fillStyle = '#7a4a1e';
    ctx.fillRect(x - 2, y - 1, 5, 3);
    ctx.fillRect(x - 1, y - 2, 3, 1);
    ctx.fillRect(x - 1, y + 2, 3, 1);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 1 + spin, y, 2 - spin, 1);
  } else if (kind === 'basketball') {
    ctx.fillStyle = '#e8711c';
    ctx.fillRect(x - 1, y - 2, 3, 5);
    ctx.fillRect(x - 2, y - 1, 5, 3);
    ctx.fillStyle = '#5a2a00';
    ctx.fillRect(x - 2, y, 5, 1);
    ctx.fillRect(x, y - 2, 1, 5);
  } else if (kind === 'tennis') {
    ctx.fillStyle = '#d7ff3a';
    ctx.fillRect(x - 1, y - 1, 2, 2);
    ctx.fillStyle = '#9fbf20';
    ctx.fillRect(x, y, 1, 1);
  } else {
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 1, y - 2, 3, 5);
    ctx.fillRect(x - 2, y - 1, 5, 3);
    ctx.fillStyle = '#111';
    ctx.fillRect(x, y, 1, 1);
    ctx.fillRect(x - 2 + (Math.floor(t * 10) % 2) * 3, y - 1, 1, 1);
  }
}

function drawRacket(ctx, s) {
  const up = s.pose === 'armsUp';
  const hx = Math.round(s.x + s.face * (up ? 3 : 5));
  const hy = Math.round(s.y - (up ? 15 : 8));
  ctx.fillStyle = '#e04848';
  ctx.fillRect(hx, hy + 3, 1, 3);
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(hx - 1, hy - 1, 3, 1);
  ctx.fillRect(hx - 1, hy + 2, 3, 1);
  ctx.fillRect(hx - 2, hy, 1, 2);
  ctx.fillRect(hx + 2, hy, 1, 2);
}

function drawConfetti(ctx, ev, dt) {
  if (dt < 0 || dt > 2.8) return;
  const cols = ev.confetti.colors;
  for (let i = 0; i < 56; i++) {
    const r1 = hash2(i, 1);
    const r2 = hash2(i, 2);
    const vx = (r1 - 0.5) * 150;
    const vy = -50 - r2 * 100;
    const x = ev.confetti.x + vx * dt;
    const y = ev.confetti.y + vy * dt + 85 * dt * dt;
    if (y > CH) continue;
    ctx.fillStyle = cols[i % cols.length];
    ctx.fillRect(Math.round(x), Math.round(y), 2, Math.floor(dt * 10 + i) % 2 ? 2 : 1);
  }
}

export function renderFrame(ctx, tl, t, clock) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, CW, CH);

  // screen shake + crowd energy from events
  let sx = 0;
  let sy = 0;
  let cheer = 0;
  for (const ev of tl.events) {
    const dt = t - ev.t;
    if (dt < 0) continue;
    if (ev.shake && dt < (ev.dur || 0.35)) {
      const m = ev.shake * (1 - dt / (ev.dur || 0.35));
      sx += Math.round((hash2(Math.floor(clock * 60), 3) - 0.5) * 2 * m);
      sy += Math.round((hash2(Math.floor(clock * 60), 4) - 0.5) * 2 * m);
    }
    if (ev.cheer && dt < 3) cheer = Math.max(cheer, 1 - dt / 3);
  }
  ctx.translate(sx, sy);

  BACKGROUNDS[tl.sport](ctx, tl.scene, tl.teams, clock, cheer);

  const byId = {};
  tl.actors.forEach((a) => (byId[a.id] = a));
  const states = tl.actors.map((a) => {
    const s = actorState(a, t);
    if (tl.idle && s.pose === 'stand' && Math.sin(clock * 4 + (a.seed || 0)) > 0.55) s.y -= 1;
    return { a, s };
  });

  // ground shadows first
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  states.forEach(({ s }) => {
    const wide = s.pose === 'dive' || s.pose === 'down';
    ctx.fillRect(Math.round(s.x - (wide ? 6 : 4)), Math.round(s.y) - 1, wide ? 12 : 8, 2);
  });
  const b = tl.ball ? ballState(tl.ball, t, byId) : null;
  if (b) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(Math.round(b.x - 1), Math.round(b.y), 3, 1);
  }

  // y-sorted sprites + ball
  const items = states.map(({ a, s }) => ({ y: s.y, draw: () => drawActor(ctx, a, s, tl) }));
  if (b) items.push({ y: b.y + 0.1, draw: () => drawBall(ctx, tl.ball.kind, b, t) });
  items.sort((p, q) => p.y - q.y).forEach((it) => it.draw());

  // particles + banners
  for (const ev of tl.events) {
    if (ev.confetti) drawConfetti(ctx, ev, t - ev.t);
  }
  for (const ev of tl.events) {
    if (!ev.banner) continue;
    const dt = t - ev.t;
    const dur = ev.dur || 99;
    if (dt < 0 || dt > dur) continue;
    const pop = Math.min(1, dt / 0.12);
    const size = fitFont(ctx, ev.banner, ev.size || 16, 300);
    const y = ev.y || 104;
    ctx.save();
    ctx.translate(CW / 2, y);
    ctx.scale(0.4 + 0.6 * pop + (pop < 1 ? 0.2 : 0), 0.4 + 0.6 * pop + (pop < 1 ? 0.2 : 0));
    drawPixelText(ctx, ev.banner, 0, 0, size, ev.color || '#ffd23f');
    ctx.restore();
  }
}

function drawActor(ctx, a, s, tl) {
  const team = tl.teams[a.team];
  const p = a.swap ? team.secondary : team.primary;
  const q = a.swap ? team.primary : team.secondary;
  const spr = getSprite(s.pose, a.head, p, q, s.face < 0);
  ctx.drawImage(spr, Math.round(s.x - spr.width / 2), Math.round(s.y - spr.height));
  if (a.racket) drawRacket(ctx, s);
}

// --- Timeline builders ----------------------------------------------------------
function newTimeline(sport, scene, teams) {
  return { sport, scene, teams, actors: [], ball: null, events: [], duration: 2, idle: false };
}

function addActor(tl, id, team, x, y, opts = {}) {
  const a = { id, team, head: opts.head || 'hair', swap: !!opts.swap, racket: !!opts.racket, face: opts.face || 1, seed: tl.actors.length * 1.7, kf: [{ t: 0, x, y }] };
  tl.actors.push(a);
  return a;
}

const move = (a, t, x, y, pose, face) => {
  a.kf.push({ t, x, y, pose, face });
  return a;
};
const lastKf = (a) => a.kf[a.kf.length - 1];

function footballFormation(yard) {
  const x = FY(yard);
  return {
    off: { qb: [x - 12, 110], c: [x - 3, 110], lg: [x - 3, 100], rg: [x - 3, 120], wr: [x - 3, 66], wr2: [x - 3, 152], rb: [x - 22, 113] },
    def: { dl1: [x + 4, 100], dl2: [x + 4, 120], dl3: [x + 4, 110], lb: [x + 16, 113], cb: [x + 10, 68], cb2: [x + 10, 150], s: [x + 38, 104] },
  };
}

function buildFootballActors(tl, yard, offense) {
  const F = footballFormation(yard);
  const A = {};
  Object.entries(F.off).forEach(([id, [x, y]]) => (A[id] = addActor(tl, id, offense, x, y, { head: 'helmet', face: 1 })));
  Object.entries(F.def).forEach(([id, [x, y]]) => (A[id] = addActor(tl, id, 1 - offense, x, y, { head: 'helmet', face: -1 })));
  return { A, F };
}

function buildFootball(spec, teams) {
  const tl = newTimeline('football', { offense: spec.offense, yard: spec.from, toGo: spec.toGo }, teams);
  const off = spec.offense;
  const def = 1 - off;
  const offC = [teams[off].primary, teams[off].secondary, '#fff'];
  const defC = [teams[def].primary, teams[def].secondary, '#fff'];
  const { A } = buildFootballActors(tl, spec.from, off);
  const x0 = FY(spec.from);
  const SNAP = 0.45;
  const ev = tl.events;
  ev.push({ t: 0.05, sound: 'whistle' });
  ['c', 'lg', 'rg'].forEach((id) => {
    const k = lastKf(A[id]);
    move(A[id], SNAP, k.x, k.y);
    move(A[id], SNAP + 0.2, k.x + 3, k.y);
  });
  ['dl1', 'dl3'].forEach((id) => {
    const k = lastKf(A[id]);
    move(A[id], SNAP, k.x, k.y);
    move(A[id], SNAP + 0.2, k.x - 1, k.y);
  });
  const ballKf = [{ t: 0, carry: 'c', h: 3 }, { t: SNAP, carry: 'qb', h: 7 }];
  tl.ball = { kind: 'football', kf: ballKf };
  let end = 2;
  const bannerColor = spec.tone === 'bad' ? '#ef476f' : '#ffd23f';

  if (spec.type === 'pass') {
    const qbX = x0 - 26;
    move(A.qb, SNAP, x0 - 12, 110);
    move(A.qb, SNAP + 0.5, qbX, 110);
    const tThrow = SNAP + 0.75;
    move(A.qb, tThrow, qbX, 110, 'armsUp');
    move(A.qb, tThrow + 0.3, qbX, 110, 'stand');
    const td = !!spec.td;
    const catchYard = td ? Math.min(94, Math.max(spec.from + 12, 92)) : spec.dive ? spec.to : spec.to - 4;
    const cx = FY(catchYard);
    const cy = 74;
    const wr0 = lastKf(A.wr);
    const tCatch = Math.max(tThrow + 0.55, SNAP + (cx - wr0.x) / 115);
    move(A.wr, SNAP, wr0.x, wr0.y);
    if (spec.dive) {
      move(A.wr, tCatch - 0.2, cx - 12, cy);
      move(A.wr, tCatch - 0.2, cx - 12, cy, 'dive');
      move(A.wr, tCatch, cx, cy, 'dive');
      move(A.wr, tCatch + 0.25, cx + 5, cy + 1, 'dive');
    } else move(A.wr, tCatch, cx, cy);
    ballKf.push({ t: tThrow, x: qbX + 3, y: 110, h: 9 });
    ballKf.push({ t: tCatch, x: cx + (spec.dive ? 3 : 3), y: cy + 0.5, h: spec.dive ? 3 : 6, arc: 12 + (cx - qbX) * 0.12 });
    ballKf.push({ t: tCatch, carry: 'wr', h: spec.dive ? 2 : 6 });
    ev.push({ t: tThrow, sound: 'throw' });
    let endX = cx + 5;
    let tEnd = tCatch + 0.25;
    if (!spec.dive) {
      endX = td ? FY(104) : FY(spec.to);
      tEnd = tCatch + Math.max(0.15, (endX - cx) / 100);
      move(A.wr, tEnd, endX, cy + 4);
    }
    // defenders chase
    const cb0 = lastKf(A.cb);
    move(A.cb, SNAP, cb0.x, cb0.y);
    move(A.cb, tCatch, cx - 10, cy + 6);
    const s0 = lastKf(A.s);
    move(A.s, SNAP + 0.3, s0.x, s0.y);
    move(A.s, tCatch, cx + 16, cy + 18);
    if (td) {
      move(A.cb, tEnd, endX - 18, cy + 6);
      move(A.s, tEnd, endX - 12, cy + 14);
      move(A.wr, tEnd + 0.15, endX, cy + 4, 'armsUp');
      ev.push({ t: tEnd, sound: 'cheer', cheer: true, banner: spec.banner || 'TOUCHDOWN!', color: '#ffd23f' });
      ev.push({ t: tEnd, confetti: { x: endX, y: cy, colors: offC }, shake: 3 });
      end = tEnd + 2.4;
    } else {
      move(A.cb, tEnd, endX - 5, cy + 4, 'dive');
      move(A.s, tEnd, endX + 6, cy + 3, 'dive');
      if (!spec.dive) move(A.wr, tEnd + 0.12, endX + 2, cy + 5, 'down');
      ev.push({ t: tEnd, sound: 'tackle', shake: 1.5, banner: spec.banner, color: bannerColor });
      end = tEnd + 1.5;
    }
    const lb0 = lastKf(A.lb);
    move(A.lb, SNAP, lb0.x, lb0.y);
    move(A.lb, tThrow, x0 + 6, 98);
    const dl0 = lastKf(A.dl2);
    move(A.dl2, SNAP + 0.2, dl0.x, dl0.y);
    move(A.dl2, tThrow + 0.2, qbX + 10, 115, 'armsUp');
    const w2 = lastKf(A.wr2);
    move(A.wr2, SNAP, w2.x, w2.y);
    move(A.wr2, SNAP + 1.3, x0 + 34, 140);
    const c2 = lastKf(A.cb2);
    move(A.cb2, SNAP, c2.x, c2.y);
    move(A.cb2, SNAP + 1.3, x0 + 38, 136);
    const rb0 = lastKf(A.rb);
    move(A.rb, SNAP, rb0.x, rb0.y);
    move(A.rb, SNAP + 0.4, x0 - 16, 119);
  } else if (spec.type === 'run') {
    const tHand = SNAP + 0.35;
    move(A.qb, SNAP, x0 - 12, 110);
    move(A.qb, tHand, x0 - 16, 111);
    const rb0 = lastKf(A.rb);
    move(A.rb, SNAP, rb0.x, rb0.y);
    move(A.rb, tHand, x0 - 15, 112);
    const endX = FY(spec.to);
    const tEnd = tHand + Math.max(0.5, (endX - (x0 - 15)) / 70);
    move(A.rb, tEnd, endX, 107);
    move(A.rb, tEnd + 0.12, endX + 2, 108, 'down');
    ballKf.push({ t: tHand, carry: 'rb', h: 6 });
    const lb0 = lastKf(A.lb);
    move(A.lb, SNAP, lb0.x, lb0.y);
    move(A.lb, tEnd, endX + 5, 107, 'dive');
    move(A.dl1, tEnd, endX + 3, 100);
    const d2 = lastKf(A.dl2);
    move(A.dl2, SNAP, d2.x, d2.y);
    move(A.dl2, tEnd, endX + 2, 115);
    ev.push({ t: tEnd, sound: 'tackle', shake: 1.5, banner: spec.banner, color: bannerColor });
    end = tEnd + 1.5;
  } else if (spec.type === 'sack') {
    const qbTo = FY(spec.to);
    const tHit = SNAP + 0.95;
    move(A.qb, SNAP, x0 - 12, 110);
    move(A.qb, SNAP + 0.6, qbTo, 110);
    move(A.qb, tHit, qbTo, 110);
    move(A.qb, tHit + 0.1, qbTo - 3, 112, 'down');
    const d2 = lastKf(A.dl2);
    move(A.dl2, SNAP + 0.25, d2.x - 8, 117);
    move(A.dl2, tHit, qbTo + 5, 112, 'dive');
    move(A.dl2, tHit + 0.5, qbTo + 6, 113, 'armsUp');
    const lb0 = lastKf(A.lb);
    move(A.lb, SNAP, lb0.x, lb0.y);
    move(A.lb, tHit + 0.2, qbTo + 12, 104);
    ev.push({ t: tHit, sound: 'tackle', shake: 3 });
    ev.push({ t: tHit + 0.15, sound: 'buzzer', banner: spec.banner || 'SACKED!', color: '#ef476f' });
    end = tHit + 1.7;
  } else if (spec.type === 'fumble') {
    const qbX = x0 - 20;
    const tF = SNAP + 0.9;
    move(A.qb, SNAP, x0 - 12, 110);
    move(A.qb, SNAP + 0.5, qbX, 110);
    move(A.qb, tF, qbX, 110, 'armsUp');
    move(A.qb, tF + 0.6, qbX + 4, 114);
    ballKf.push({ t: tF, x: qbX + 3, y: 110.5, h: 7 });
    ballKf.push({ t: tF + 0.3, x: qbX + 10, y: 117, h: 0, arc: 8 });
    ballKf.push({ t: tF + 0.5, x: qbX + 14, y: 120, h: 0, arc: 4 });
    ballKf.push({ t: tF + 0.7, x: qbX + 15, y: 121, h: 0, arc: 1 });
    move(A.dl1, SNAP + 0.3, lastKf(A.dl1).x - 6, 108);
    move(A.dl1, tF + 0.45, qbX + 8, 121);
    move(A.dl1, tF + 0.45, qbX + 8, 121, 'dive');
    move(A.dl1, tF + 0.7, qbX + 15, 122, 'dive');
    ballKf.push({ t: tF + 0.72, carry: 'dl1', h: 1 });
    ev.push({ t: tF, sound: 'wrong' });
    ev.push({ t: tF + 0.72, sound: 'buzzer', shake: 2, banner: 'FUMBLE!', color: '#ef476f' });
    end = tF + 2.1;
  } else if (spec.type === 'pick6') {
    const qbX = x0 - 26;
    const tThrow = SNAP + 0.75;
    move(A.qb, SNAP, x0 - 12, 110);
    move(A.qb, SNAP + 0.5, qbX, 110);
    move(A.qb, tThrow, qbX, 110, 'armsUp');
    move(A.qb, tThrow + 0.3, qbX, 110);
    const ix = x0 + 20;
    const iy = 80;
    const tInt = tThrow + 0.45;
    const cb0 = lastKf(A.cb);
    move(A.cb, SNAP, cb0.x, cb0.y);
    move(A.cb, tInt, ix, iy, 'armsUp');
    move(A.cb, tInt + 0.2, ix, iy);
    const goalX = FY(-6);
    const tRet = tInt + 0.2 + (ix - goalX) / 115;
    move(A.cb, tRet, goalX, 98);
    move(A.cb, tRet + 0.15, goalX, 98, 'armsUp');
    const wr0 = lastKf(A.wr);
    move(A.wr, SNAP, wr0.x, wr0.y);
    move(A.wr, tInt, ix + 16, 72);
    move(A.wr, tRet, goalX + 26, 92);
    move(A.qb, tRet - 0.35, qbX - 4, 106);
    move(A.qb, tRet - 0.2, Math.max(goalX + 12, qbX - 10), 102, 'dive');
    ballKf.push({ t: tThrow, x: qbX + 3, y: 110, h: 9 });
    ballKf.push({ t: tInt, x: ix - 3, y: iy + 0.5, h: 8, arc: 10 });
    ballKf.push({ t: tInt, carry: 'cb', h: 6 });
    ev.push({ t: tThrow, sound: 'throw' });
    ev.push({ t: tInt, sound: 'buzzer', shake: 2, banner: 'INTERCEPTED!', dur: 0.9, color: '#ef476f' });
    ev.push({ t: tRet, sound: 'cheer', cheer: true, banner: 'PICK SIX!', color: '#ef476f' });
    ev.push({ t: tRet, confetti: { x: goalX, y: 90, colors: defC } });
    end = tRet + 2.2;
  }
  if (spec.sub) ev.push({ t: end - 1.0, banner: spec.sub, size: 10, y: 128, color: spec.sub.includes('TURNOVER') ? '#ef476f' : '#06d6a0', sound: spec.sub.includes('TURNOVER') ? 'buzzer' : 'correct' });
  tl.duration = end;
  return tl;
}

function buildTennis(spec, teams) {
  const tl = newTimeline('tennis', {}, teams);
  const L = spec.hitter === 0;
  const mx = (x) => (L ? x : CW - x);
  const H = addActor(tl, 'H', spec.hitter, mx(30), spec.fromY, { racket: true, face: L ? 1 : -1 });
  const R = addActor(tl, 'R', 1 - spec.hitter, mx(290), spec.recvY, { racket: true, face: L ? -1 : 1 });
  const ev = tl.events;
  const hitT = 0.3;
  const fy = spec.fromY;
  if (spec.stretched) {
    move(H, 0.1, mx(30), fy + 6, 'dive');
  } else {
    move(H, 0.12, mx(30), fy, 'armsUp');
    move(H, hitT + 0.15, mx(30), fy, 'stand');
  }
  const kf = spec.serve
    ? [{ t: 0, x: mx(33), y: fy, h: 8 }, { t: hitT, x: mx(33), y: fy, h: 18, arc: 6 }]
    : [{ t: 0, x: mx(33), y: fy, h: 7 }, { t: hitT, x: mx(33), y: fy, h: 9 }];
  tl.ball = { kind: 'tennis', kf };
  if (!spec.stretched) ev.push({ t: hitT, sound: 'hit' });
  let end = 1.5;
  const r = spec.result;
  if (r === 'continue' || r === 'retrieved') {
    const deep = r === 'retrieved';
    const by = clamp(spec.toY + (Math.random() - 0.5) * 24, COURT.y0 + 6, COURT.y1 - 6);
    kf.push({ t: hitT + 0.45, x: mx(deep ? 268 : 232), y: by, h: 0, arc: 16 });
    kf.push({ t: hitT + 0.8, x: mx(286), y: spec.toY, h: 8, arc: 7 });
    move(R, hitT + 0.1, mx(290), spec.recvY);
    if (deep) {
      move(R, hitT + 0.55, mx(290), lerp(spec.recvY, spec.toY, 0.6));
      move(R, hitT + 0.55, mx(290), lerp(spec.recvY, spec.toY, 0.6), 'dive');
      move(R, hitT + 0.78, mx(290), spec.toY, 'dive');
      move(R, hitT + 1.1, mx(290), spec.toY, 'stand');
      ev.push({ t: hitT + 0.8, sound: 'hit', banner: spec.banner || 'WHAT A GET!', size: 12, dur: 0.9, color: '#4cc9f0' });
      end = hitT + 1.3;
    } else {
      move(R, hitT + 0.75, mx(290), spec.toY);
      end = hitT + 0.95;
    }
  } else if (r === 'winner' || r === 'ace') {
    const cornerY = Math.random() < 0.5 ? COURT.y0 + 4 : COURT.y1 - 4;
    const dir = cornerY < 110 ? -1 : 1;
    kf.push({ t: hitT + 0.38, x: mx(262), y: cornerY, h: 0, arc: r === 'ace' ? 9 : 12 });
    kf.push({ t: hitT + 0.75, x: mx(345), y: cornerY + dir * 8, h: 5, arc: 6 });
    move(R, hitT + 0.15, mx(290), spec.recvY);
    move(R, hitT + 0.4, mx(291), lerp(spec.recvY, cornerY, 0.5));
    move(R, hitT + 0.4, mx(291), lerp(spec.recvY, cornerY, 0.5), 'dive');
    move(R, hitT + 0.6, mx(292), lerp(spec.recvY, cornerY, 0.75), 'dive');
    move(H, hitT + 0.9, mx(30), fy, 'armsUp');
    ev.push({ t: hitT + 0.45, sound: 'cheer', cheer: true, banner: spec.banner, color: '#ffd23f' });
    ev.push({ t: hitT + 0.45, confetti: { x: mx(150), y: 70, colors: [teams[spec.hitter].primary, teams[spec.hitter].secondary, '#fff'] } });
    end = hitT + 2.1;
  } else if (r === 'error') {
    if (spec.errorType === 'net') {
      kf.push({ t: hitT + 0.32, x: mx(158), y: fy + 6, h: 4, arc: 6 });
      kf.push({ t: hitT + 0.55, x: mx(150), y: fy + 8, h: 0, arc: 3 });
      kf.push({ t: hitT + 0.75, x: mx(146), y: fy + 9, h: 0, arc: 1 });
    } else {
      const wy = Math.random() < 0.5 ? COURT.y0 - 10 : COURT.y1 + 10;
      kf.push({ t: hitT + 0.5, x: mx(300), y: wy, h: 0, arc: 18 });
      kf.push({ t: hitT + 0.8, x: mx(318), y: wy, h: 3, arc: 4 });
    }
    ev.push({ t: hitT + 0.55, sound: 'buzzer', banner: spec.banner, color: '#ef476f' });
    end = hitT + 1.9;
  } else if (r === 'smash') {
    const sy = clamp(spec.recvY + (Math.random() - 0.5) * 20, COURT.y0 + 10, COURT.y1 - 10);
    kf.push({ t: hitT + 0.7, x: mx(205), y: sy, h: 15, arc: 36 });
    move(R, hitT + 0.1, mx(290), spec.recvY);
    move(R, hitT + 0.6, mx(208), sy);
    move(R, hitT + 0.6, mx(208), sy, 'armsUp', L ? -1 : 1);
    move(R, hitT + 1.0, mx(208), sy, 'stand', L ? -1 : 1);
    kf.push({ t: hitT + 0.85, x: mx(95), y: fy + 16, h: 0 });
    kf.push({ t: hitT + 1.1, x: mx(-20), y: fy + 26, h: 6, arc: 5 });
    move(H, hitT + 0.75, mx(30), fy);
    move(H, hitT + 0.75, mx(30), fy, 'dive', L ? -1 : 1);
    move(H, hitT + 0.95, mx(30), fy + 10, 'dive', L ? -1 : 1);
    ev.push({ t: hitT + 0.7, sound: 'smash', shake: 4 });
    ev.push({ t: hitT + 0.95, sound: 'buzzer', banner: spec.banner || 'SMASH!', color: '#ef476f' });
    end = hitT + 2.2;
  }
  tl.duration = end;
  return tl;
}

function buildSoccer(spec, teams) {
  const tl = newTimeline('soccer', {}, teams);
  const K = addActor(tl, 'K', spec.kicker, 150, 172, { face: 1 });
  const GK = addActor(tl, 'GK', 1 - spec.kicker, 160, 82, { swap: true, face: 1 });
  const ev = tl.events;
  const kickT = 0.7;
  move(K, 0.15, 150, 172);
  move(K, kickT, 157, 153);
  move(K, kickT + 0.25, 158, 151, 'stand');
  ev.push({ t: 0.05, sound: 'whistle' });
  ev.push({ t: kickT, sound: 'kick' });
  const tx = 160 + spec.gx * 54;
  const th = Math.max(0, spec.gy) * 40;
  const arrive = kickT + spec.flight;
  const kf = [{ t: 0, x: 160, y: 150, h: 0 }, { t: kickT, x: 160, y: 150, h: 0 }];
  tl.ball = { kind: 'soccer', kf };
  const dir = spec.diveDir;
  const diveX = 160 + dir * 40;
  const diveY = 82 - (spec.diveHigh ? 10 : 0);
  move(GK, kickT, 160, 82);
  move(GK, kickT + 0.12, 160 + dir * 8, 82, dir ? 'dive' : 'armsUp', dir || 1);
  move(GK, arrive + 0.05, dir ? diveX : 160, diveY, dir ? 'dive' : 'armsUp', dir || 1);
  const kickColors = [teams[spec.kicker].primary, teams[spec.kicker].secondary, '#fff'];
  const r = spec.result;
  if (r === 'goal') {
    kf.push({ t: arrive, x: tx, y: 76, h: th, arc: spec.gy > 0.6 ? 10 : 4 });
    kf.push({ t: arrive + 0.12, x: tx + (tx - 160) * 0.05, y: 70, h: th * 0.85 });
    kf.push({ t: arrive + 0.45, x: tx, y: 72, h: 0, arc: 2 });
    move(GK, arrive + 0.45, dir ? diveX : 160, 84, dir ? 'dive' : 'stand', dir || 1);
    move(K, arrive + 0.3, 158, 151, 'armsUp');
    ev.push({ t: arrive, sound: 'cheer', cheer: true, shake: 2, banner: spec.banner || 'GOAL!', color: '#ffd23f' });
    ev.push({ t: arrive, confetti: { x: tx, y: 60, colors: kickColors } });
    end(arrive + 2.3);
  } else if (r === 'save' || r === 'breakaway') {
    kf.push({ t: arrive, x: diveX + dir * 2, y: diveY + 0.5, h: Math.min(th, 10), arc: 4 });
    move(GK, arrive + 0.45, diveX, 84, 'dive', dir || 1);
    if (r === 'save') {
      kf.push({ t: arrive + 0.4, x: diveX + dir * 40, y: 100, h: 0, arc: 10 });
      kf.push({ t: arrive + 0.7, x: diveX + dir * 52, y: 104, h: 0, arc: 3 });
      ev.push({ t: arrive, sound: 'tackle', shake: 2, banner: spec.banner || 'SAVED!', color: '#ef476f' });
      ev.push({ t: arrive + 0.3, sound: 'buzzer' });
      end(arrive + 2.0);
    } else {
      kf.push({ t: arrive, carry: 'GK', h: 4 });
      move(GK, arrive + 0.7, diveX, 86, 'stand', -dir || 1);
      move(GK, arrive + 1.1, diveX, 88, 'armsUp');
      move(GK, arrive + 1.4, diveX, 88, 'stand');
      kf.push({ t: arrive + 1.1, x: diveX, y: 88.5, h: 6 });
      kf.push({ t: arrive + 1.9, x: 160 + dir * 20, y: 230, h: 0, arc: 70 });
      move(K, arrive + 1.2, 158, 151);
      move(K, arrive + 2.0, 160, 200);
      ev.push({ t: arrive, sound: 'tackle', shake: 2, banner: 'STOLEN!', dur: 1.0, color: '#ef476f' });
      ev.push({ t: arrive + 1.1, sound: 'kick' });
      ev.push({ t: arrive + 1.9, sound: 'buzzer', shake: 3, banner: spec.banner || 'BREAKAWAY GOAL!', color: '#ef476f' });
      ev.push({ t: arrive + 1.9, confetti: { x: 160, y: 170, colors: [teams[1 - spec.kicker].primary, teams[1 - spec.kicker].secondary, '#fff'] } });
      end(arrive + 3.3);
    }
  } else {
    // miss: wide or over the bar
    kf.push({ t: arrive, x: tx, y: 76, h: th, arc: 6 });
    kf.push({ t: arrive + 0.3, x: tx + (tx - 160) * 0.3, y: 40, h: th + 12 });
    move(GK, arrive + 0.45, dir ? diveX : 160, 84, dir ? 'dive' : 'stand', dir || 1);
    move(K, arrive + 0.4, 158, 151, 'down');
    ev.push({ t: arrive, sound: 'buzzer', banner: spec.banner || 'WIDE!', color: '#ef476f' });
    end(arrive + 1.9);
  }
  function end(d) {
    tl.duration = d;
  }
  return tl;
}

export function buildTimeline(spec, teams) {
  if (spec.sport === 'football') return buildFootball(spec, teams);
  if (spec.sport === 'tennis') return buildTennis(spec, teams);
  return buildSoccer(spec, teams);
}

// Static "waiting for the snap" scenes (also the first frame of every animation).
export function buildIdle(scene, teams) {
  const tl = newTimeline(scene.sport, scene, teams);
  tl.idle = true;
  tl.duration = Infinity;
  if (scene.sport === 'football') {
    buildFootballActors(tl, scene.yard, scene.offense);
    tl.ball = { kind: 'football', kf: [{ t: 0, carry: 'c', h: 3 }] };
  } else if (scene.sport === 'tennis') {
    addActor(tl, 'P0', 0, 30, scene.ys[0], { racket: true, face: 1 });
    addActor(tl, 'P1', 1, 290, scene.ys[1], { racket: true, face: -1 });
    tl.ball = { kind: 'tennis', kf: [{ t: 0, carry: `P${scene.hitter}`, h: 8 }] };
  } else {
    addActor(tl, 'K', scene.kicker, 150, 172, { face: 1 });
    addActor(tl, 'GK', 1 - scene.kicker, 160, 82, { swap: true, face: 1 });
    tl.ball = { kind: 'soccer', kf: [{ t: 0, x: 160, y: 150, h: 0 }] };
  }
  return tl;
}

/* =============================================================================
   4b. ARCADE_ENGINE  (real-time matches)
   -----------------------------------------------------------------------------
   You move your player with WASD. Passing / shooting / throwing / hitting
   FREEZES play and asks a trivia question; the answer's rarity decides how good
   the action is. The CPU never waits: it acts instantly with a rolled answer.

   Each sport module mutates one plain state object S:
     setup(S)                      build players + ball, first restart
     step(S, dt, input)            advance the sim; input[team] = {mx,my,action,secondary}
     resolve(S, pending, outcome)  apply a human's answered question
   Helpers on S: S.ask(team, kind, data) freezes for a question,
   S.cpu(team) returns an instant CPU outcome, S.say(text) shows a banner.
============================================================================= */
const AC = () => GAME_CONFIG.arcade;
const pdist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const TN_G = 320; // tennis ball gravity (px/s^2)

function steer(p, tx, ty, speed, dt) {
  const dx = tx - p.x;
  const dy = ty - p.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.75 || speed <= 0) {
    p.vx = 0;
    p.vy = 0;
    return true;
  }
  const s = Math.min(speed * dt, d);
  p.x += (dx / d) * s;
  p.y += (dy / d) * s;
  p.vx = (dx / d) * speed;
  p.vy = (dy / d) * speed;
  if (Math.abs(dx) > 0.4) p.face = Math.sign(dx);
  return d <= speed * dt;
}

function humanMove(p, inp, speed, dt) {
  let mx = inp.mx;
  let my = inp.my;
  const m = Math.hypot(mx, my);
  if (m > 0.1) {
    mx /= m;
    my /= m;
    p.x += mx * speed * dt;
    p.y += my * speed * dt;
    p.vx = mx * speed;
    p.vy = my * speed;
    if (Math.abs(mx) > 0.2) p.face = Math.sign(mx);
  } else {
    p.vx = 0;
    p.vy = 0;
  }
}

function makeAP(S, team, role, ref, x, y) {
  const wheels = ref && ref.ability && ref.ability.key === 'wheels' && ref.morale >= CAREER_CONFIG.morale.unhappyBelow ? ref.ability.mag : 0;
  return {
    team,
    role,
    ref: ref || null,
    name: ref ? ref.name : role,
    skin: ref ? ref.skin : null,
    hair: ref ? ref.hair : null,
    x,
    y,
    vx: 0,
    vy: 0,
    face: team === 0 ? 1 : -1,
    stun: 0,
    speed: AC().runSpeed * (1 + wheels),
    think: 0,
    pose: null,
    leg: 0,
    lane: null,
  };
}

function newBall() {
  return { x: 160, y: 100, z: 0, vx: 0, vy: 0, vz: 0, owner: -1, cd: 0, kicker: -1, lastTeam: 0, safe: false, passTo: -1, shot: null, flight: null, held: 0, bounces: 0, lastHitter: 0, hitLock: false, prevSide: undefined };
}

export function createArcade(setup, hooks) {
  const S = {
    sport: setup.sport,
    teams: setup.teams,
    humans: setup.teams.map((t) => !t.isCPU),
    rosters: setup.teams.map((t) => t.roster || {}),
    mods: hooks.mods,
    cpu: hooks.cpu,
    cpuSkill: hooks.cpuSkill || 1,
    players: [],
    ball: newBall(),
    control: [null, null],
    aim: [null, null],
    score: [0, 0],
    clock: 0,
    time: 0,
    phase: 'intro',
    timer: 0,
    after: null,
    banner: null,
    pending: null,
    sfx: [],
    possTeam: 0,
    celebrate: -1,
  };
  S.ask = (team, kind, data) => {
    S.phase = 'question';
    S.pending = { team, kind, ...data };
  };
  S.say = (text, color, size) => {
    S.banner = { text, color: color || '#ffd23f', t: S.time, size: size || 16 };
  };
  S.sound = (n) => S.sfx.push(n);
  S.dead = (sec, after) => {
    S.phase = 'dead';
    S.timer = sec;
    S.after = after;
  };
  ARCADE_SPORTS[S.sport].setup(S);
  S.phase = 'intro';
  return S;
}

export function arcadeStep(S, dt, input) {
  if (S.phase === 'question' || S.phase === 'intro' || S.phase === 'over') return;
  S.time += dt;
  if (S.phase === 'dead') {
    S.timer -= dt;
    if (S.timer <= 0) {
      S.phase = 'live';
      const f = S.after;
      S.after = null;
      if (f) f();
    }
    return;
  }
  ARCADE_SPORTS[S.sport].step(S, dt, input);
}

export function arcadeResolve(S, outcome) {
  const pend = S.pending;
  S.pending = null;
  S.phase = 'live';
  if (pend) ARCADE_SPORTS[S.sport].resolve(S, pend, outcome);
}

function arcadeEnd(S) {
  S.phase = 'over';
  S.banner = { text: 'FULL TIME', color: '#ffd23f', t: S.time, size: 18 };
  S.sound('whistle');
}

function nearestIdx(S, team, x, y, filter) {
  let best = -1;
  let bd = 1e9;
  S.players.forEach((p, i) => {
    if (p.team !== team || (filter && !filter(p, i))) return;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}

function nearestOppDist(S, q) {
  let bd = 1e9;
  S.players.forEach((o) => {
    if (o.team !== q.team) bd = Math.min(bd, pdist(o, q));
  });
  return bd;
}

function giveBall(S, idx) {
  const b = S.ball;
  b.owner = idx;
  b.vx = 0;
  b.vy = 0;
  b.vz = 0;
  b.safe = false;
  b.passTo = -1;
  b.shot = null;
  b.flight = null;
  b.held = 0;
  const p = S.players[idx];
  S.possTeam = p.team;
  if (S.humans[p.team] && p.role !== 'GK') S.control[p.team] = idx;
}

function autoSwitch(S, team, exclude) {
  if (!S.humans[team]) return;
  const b = S.ball;
  const i = nearestIdx(S, team, b.x, b.y, (p, j) => p.role !== 'GK' && j !== exclude);
  if (i >= 0) S.control[team] = i;
}

function otherHumansSwitch(S, gainedTeam) {
  [0, 1].forEach((t) => {
    if (S.humans[t] && t !== gainedTeam) autoSwitch(S, t);
  });
}

function pickPassTarget(S, from, ax, ay) {
  const p = S.players[from];
  const m = Math.hypot(ax, ay);
  const dx0 = m > 0.1 ? ax / m : p.team === 0 ? 1 : -1;
  const dy0 = m > 0.1 ? ay / m : 0;
  let best = -1;
  let bs = -1e9;
  S.players.forEach((q, i) => {
    if (i === from || q.team !== p.team || q.role === 'GK') return;
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const align = (dx * dx0 + dy * dy0) / d;
    const open = Math.min(40, nearestOppDist(S, q));
    const score = align * 70 + open * 0.6 - d * 0.1;
    if (score > bs) {
      bs = score;
      best = i;
    }
  });
  return best;
}

function kickBall(S, from, tx, ty, speed, opts = {}) {
  const b = S.ball;
  const p = S.players[from];
  b.owner = -1;
  b.kicker = from;
  b.cd = 0.22;
  b.x = p.x + p.face * 3;
  b.y = p.y;
  const dx = tx - b.x;
  const dy = ty - b.y;
  const d = Math.hypot(dx, dy) || 1;
  b.vx = (dx / d) * speed;
  b.vy = (dy / d) * speed;
  b.vz = opts.vz || 0;
  b.z = opts.z || 0;
  b.safe = !!opts.safe;
  b.passTo = opts.to != null ? opts.to : -1;
  b.shot = opts.shot || null;
  b.lastTeam = p.team;
}

function tryPickup(S, radius, zMax, gkRadius) {
  const b = S.ball;
  if (b.owner >= 0) return null;
  let best = -1;
  let bd = 1e9;
  S.players.forEach((p, i) => {
    if (p.stun > 0) return;
    if (i === b.kicker && b.cd > 0) return;
    if (b.safe && p.team !== b.lastTeam) return;
    const r = p.role === 'GK' ? gkRadius : radius;
    const d = Math.hypot(p.x - b.x, p.y - b.y);
    if (d < r && b.z < (p.role === 'GK' ? zMax + 10 : zMax) && d < bd) {
      bd = d;
      best = i;
    }
  });
  if (best < 0) return null;
  giveBall(S, best);
  otherHumansSwitch(S, S.players[best].team);
  return best;
}

function attemptSteal(S, idx, chance, word) {
  const b = S.ball;
  const p = S.players[idx];
  if (b.owner < 0) return;
  const c = S.players[b.owner];
  if (c.team === p.team || pdist(c, p) > AC().tackleRange) return;
  if (Math.random() < chance) {
    c.stun = 0.5;
    giveBall(S, idx);
    otherHumansSwitch(S, p.team);
    S.say(word, '#06d6a0', 12);
    S.sound('tackle');
  } else if (S.humans[p.team]) {
    p.stun = AC().stunSeconds;
    S.say('MISSED!', '#ef476f', 10);
  }
}

const tierWord = (tier) => ({ 5: 'PERFECT', 4: 'GREAT', 3: 'GOOD', 2: 'WEAK', 1: 'WEAK' })[tier] || 'BAD';

/* --- SOCCER (5-a-side, top-down) ------------------------------------------- */
const SOC = { x0: 14, x1: 306, y0: 26, y1: 172, gTop: 84, gBot: 114 };
const SOC_MID = 99;
const SOC_HOME = { GK: [0.015, 0.5], DEF: [0.2, 0.5], MID: [0.38, 0.28], WING: [0.4, 0.74], ST: [0.5, 0.5] };
const SOC_BOX = { x0: SOC.x0 + 2, x1: SOC.x1 - 2, y0: SOC.y0 + 2, y1: SOC.y1 - 2 };

function socSpot(S, p, kickoff) {
  const [fx, fy] = SOC_HOME[p.role];
  if (p.role === 'GK') return { x: p.team === 0 ? SOC.x0 + 5 : SOC.x1 - 5, y: clamp(S.ball.y, SOC.gTop + 3, SOC.gBot - 3) };
  let f;
  if (kickoff) f = Math.min(0.46, fx * 0.9);
  else {
    const attacking = S.possTeam === p.team;
    const prog = p.team === 0 ? (S.ball.x - SOC.x0) / (SOC.x1 - SOC.x0) : (SOC.x1 - S.ball.x) / (SOC.x1 - SOC.x0);
    f = clamp(fx + (attacking ? 0.16 : -0.06) + (prog - 0.5) * 0.35, 0.06, 0.93);
  }
  const x = p.team === 0 ? lerp(SOC.x0, SOC.x1, f) : lerp(SOC.x1, SOC.x0, f);
  const baseY = lerp(SOC.y0 + 10, SOC.y1 - 10, fy);
  return { x, y: kickoff ? baseY : lerp(baseY, S.ball.y, 0.25) };
}

function socKickoff(S, team) {
  S.possTeam = team;
  S.celebrate = -1;
  S.players.forEach((p) => {
    const sp = socSpot(S, p, true);
    p.x = sp.x;
    p.y = sp.y;
    p.stun = 0;
    p.vx = 0;
    p.vy = 0;
    p.pose = null;
    p.lane = null;
  });
  const st = S.players.findIndex((p) => p.team === team && p.role === 'ST');
  S.players[st].x = 160 - (team === 0 ? 5 : -5);
  S.players[st].y = SOC_MID;
  S.ball = newBall();
  giveBall(S, st);
  otherHumansSwitch(S, team);
  S.say('KICK OFF', '#fff', 12);
  S.dead(1.0, null);
}

function socGoal(S, team) {
  S.score[team] += 1;
  S.celebrate = team;
  const b = S.ball;
  b.shot = null;
  b.owner = -1;
  b.vx *= 0.15;
  b.vy *= 0.15;
  S.say('GOAL!', '#ffd23f', 22);
  S.sound('cheer');
  S.dead(2.0, () => socKickoff(S, 1 - team));
}

function socPass(S, from, to, o) {
  const p = S.players[from];
  const q = S.players[to];
  const team = p.team;
  const tier = o.kind === 'answer' ? o.tier : 0;
  if (o.counter) {
    const opp = nearestIdx(S, 1 - team, (p.x + q.x) / 2, (p.y + q.y) / 2, (x) => x.role !== 'GK');
    if (opp >= 0) {
      giveBall(S, opp);
      otherHumansSwitch(S, 1 - team);
      S.say('INTERCEPTED!', '#ef476f');
      S.sound('buzzer');
      return;
    }
  }
  let tx = q.x + q.vx * 0.3;
  let ty = q.y + q.vy * 0.3;
  if (tier === 0) {
    tx += rand(-45, 45);
    ty += rand(-35, 35);
    S.say('MISPLACED PASS', '#ef476f', 11);
  }
  const d = Math.hypot(tx - p.x, ty - p.y);
  const speed = tier >= 3 ? Math.max(AC().passSpeed[tier], d * 1.35) : AC().passSpeed[tier];
  kickBall(S, from, tx, ty, speed, { to: tier > 0 ? to : -1, safe: tier >= 4 });
  S.sound('kick');
  if (S.humans[team]) {
    if (tier > 0) S.control[team] = to;
    else autoSwitch(S, team);
  }
  if (tier >= 4) S.say(`${tierWord(tier)} PASS!`, '#06d6a0', 11);
}

function socShoot(S, from, o) {
  const p = S.players[from];
  const team = p.team;
  const keeper = S.players.findIndex((x) => x.team !== team && x.role === 'GK');
  const tier = o.kind === 'answer' ? o.tier : 0;
  const lineX = team === 0 ? SOC.x1 : SOC.x0;
  const dGoal = Math.abs(p.x - lineX);
  if (o.counter) {
    giveBall(S, keeper);
    S.counterLaunch = true;
    S.say('SMOTHERED! COUNTER!', '#ef476f', 12);
    S.sound('tackle');
    otherHumansSwitch(S, 1 - team);
    return;
  }
  const side = Math.random() < 0.5 ? -1 : 1;
  let result;
  let ty;
  if (tier === 0) {
    result = 'miss';
    ty = SOC_MID + side * rand(22, 32);
    S.say(o.kind === 'timeout' ? 'SHANKED IT!' : 'WIDE!', '#ef476f');
  } else {
    const M = S.mods[team];
    const save = clamp(AC().soccerSave[tier] + Math.max(0, (dGoal - 60) / 160) - (M.finisher || 0), 0, 0.97);
    result = Math.random() < save ? 'save' : 'goal';
    ty = SOC_MID + side * ({ 5: 13, 4: 11, 3: 7, 2: 4, 1: 2 }[tier] || 0);
  }
  kickBall(S, from, team === 0 ? SOC.x1 + 10 : SOC.x0 - 10, ty, 215 + tier * 14, { shot: { result, keeper, team, ty }, vz: tier >= 4 ? 45 : 12 });
  S.sound('kick');
}

function socKeeper(S, i, dt) {
  const p = S.players[i];
  const b = S.ball;
  const gx = p.team === 0 ? SOC.x0 + 5 : SOC.x1 - 5;
  if (b.owner === i) {
    b.held += dt;
    p.x = gx;
    if (b.held > (S.counterLaunch ? 0.3 : 0.9)) {
      const counter = S.counterLaunch;
      const wantRole = counter ? 'ST' : Math.random() < 0.5 ? 'MID' : 'DEF';
      const st = S.players.findIndex((x) => x.team === p.team && x.role === wantRole);
      const q = S.players[st];
      kickBall(S, i, q.x + (p.team === 0 ? 20 : -20), q.y, counter ? 240 : 170, { to: st, safe: counter, vz: 60 });
      if (counter) S.say('COUNTER-ATTACK!', '#ef476f', 12);
      S.counterLaunch = false;
      if (S.humans[p.team]) S.control[p.team] = st;
      S.sound('kick');
    }
    return;
  }
  if (b.shot && b.shot.keeper === i) {
    const ty = b.shot.result === 'save' ? b.shot.ty : clamp(b.shot.ty + (b.shot.ty > SOC_MID ? -16 : 16), SOC.gTop, SOC.gBot);
    steer(p, gx, ty, 130, dt);
    p.pose = Math.abs(p.y - ty) > 2 ? 'dive' : null;
    return;
  }
  p.pose = null;
  if (b.owner < 0 && Math.abs(b.x - gx) < 34 && Math.abs(b.y - SOC_MID) < 30) {
    steer(p, b.x, b.y, p.speed, dt);
    return;
  }
  steer(p, gx, clamp(b.y, SOC.gTop + 2, SOC.gBot - 2), p.speed * 0.9, dt);
}

function socCarrierAI(S, i, dt) {
  const p = S.players[i];
  const b = S.ball;
  const team = p.team;
  const gx = team === 0 ? SOC.x1 : SOC.x0;
  if (p.lane == null) p.lane = rand(-22, 22);
  steer(p, gx, SOC_MID + p.lane, p.speed * 0.9 * S.cpuSkill, dt);
  p.x = clamp(p.x, SOC_BOX.x0, SOC_BOX.x1);
  p.y = clamp(p.y, SOC_BOX.y0, SOC_BOX.y1);
  p.think -= dt;
  if (p.think > 0) return;
  p.think = 0.3;
  const dGoal = Math.abs(p.x - gx);
  const press = nearestOppDist(S, p);
  if ((dGoal < 78 && (press > 16 || Math.random() < 0.3)) || b.held > 6.5) {
    socShoot(S, i, S.cpu(team));
    return;
  }
  if (press < 13 && Math.random() < 0.65) {
    const t = pickPassTarget(S, i, team === 0 ? 1 : -1, 0);
    if (t >= 0) socPass(S, i, t, S.cpu(team));
  }
}

function socAI(S, i, dt, chasers) {
  const p = S.players[i];
  const b = S.ball;
  if (p.stun > 0) {
    p.stun -= dt;
    p.vx = 0;
    p.vy = 0;
    return;
  }
  if (S.celebrate >= 0) return;
  if (p.role === 'GK') return socKeeper(S, i, dt);
  if (b.owner === i) {
    if (!S.humans[p.team]) socCarrierAI(S, i, dt);
    return;
  }
  const sp = p.speed * (S.humans[p.team] ? 0.92 : S.cpuSkill);
  if (b.owner < 0 && b.passTo === i) {
    steer(p, b.x + b.vx * 0.12, b.y + b.vy * 0.12, sp, dt);
    return;
  }
  if (chasers[p.team] === i) {
    const tgt = b.owner >= 0 ? S.players[b.owner] : b;
    steer(p, tgt.x, tgt.y, sp, dt);
    if (b.owner >= 0 && S.players[b.owner].team !== p.team && pdist(p, S.players[b.owner]) < 7) {
      const rate = S.humans[p.team] ? 0.35 : AC().cpuStealPerSec * S.cpuSkill;
      if (Math.random() < rate * dt) attemptSteal(S, i, 1, 'STOLEN!');
    }
    return;
  }
  const s = socSpot(S, p);
  steer(p, s.x, s.y, sp * 0.8, dt);
}

function socHuman(S, team, inp, dt) {
  const idx = S.control[team];
  if (idx == null) return;
  const p = S.players[idx];
  const b = S.ball;
  if (p.stun > 0) {
    p.stun -= dt;
    return;
  }
  humanMove(p, inp, p.speed * (b.owner === idx ? AC().carrySpeedMult : 1), dt);
  p.x = clamp(p.x, SOC_BOX.x0, SOC_BOX.x1);
  p.y = clamp(p.y, SOC_BOX.y0, SOC_BOX.y1);
  S.aim[team] = b.owner === idx ? pickPassTarget(S, idx, inp.mx, inp.my) : null;
  if (inp.action) {
    if (b.owner === idx) {
      if (S.aim[team] >= 0) S.ask(team, 'pass', { from: idx, to: S.aim[team] });
    } else attemptSteal(S, idx, AC().humanTackleChance, 'TACKLED!');
  } else if (inp.secondary) {
    if (b.owner === idx) S.ask(team, 'shoot', { from: idx });
    else autoSwitch(S, team, idx);
  }
}

function socBall(S, dt) {
  const b = S.ball;
  if (b.cd > 0) b.cd -= dt;
  if (b.owner >= 0) {
    const p = S.players[b.owner];
    b.x = p.x + p.face * 3;
    b.y = p.y + 1;
    b.z = 0;
    b.held += dt;
    return;
  }
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.z += b.vz * dt;
  b.vz -= 320 * dt;
  if (b.z <= 0) {
    b.z = 0;
    b.vz = b.vz < -40 ? -b.vz * 0.35 : 0;
  }
  if (!b.shot && b.z <= 0) {
    const k = Math.exp(-1.1 * dt);
    b.vx *= k;
    b.vy *= k;
  }
  if (b.shot) {
    const sh = b.shot;
    const keeper = S.players[sh.keeper];
    if (sh.result === 'save' && Math.abs(b.x - keeper.x) < 6) {
      keeper.y = b.y;
      giveBall(S, sh.keeper);
      keeper.pose = null;
      otherHumansSwitch(S, keeper.team);
      S.say('SAVED!', '#ef476f');
      S.sound('tackle');
      return;
    }
    const lineX = sh.team === 0 ? SOC.x1 : SOC.x0;
    if (sh.team === 0 ? b.x >= lineX : b.x <= lineX) {
      if (sh.result === 'goal') return socGoal(S, sh.team);
      b.shot = null;
      giveBall(S, sh.keeper);
      otherHumansSwitch(S, keeper.team);
      S.say('GOAL KICK', '#fff', 10);
    }
    return;
  }
  if (tryPickup(S, 6, 6, 9) != null) return;
  const outX = b.x < SOC.x0 - 1 || b.x > SOC.x1 + 1;
  const outY = b.y < SOC.y0 - 1 || b.y > SOC.y1 + 1;
  if (outX && b.y > SOC.gTop && b.y < SOC.gBot) return socGoal(S, b.x > SOC.x1 ? 0 : 1);
  if (outX || outY) {
    const team = 1 - b.lastTeam;
    const bx = clamp(b.x, SOC.x0 + 4, SOC.x1 - 4);
    const by = clamp(b.y, SOC.y0 + 3, SOC.y1 - 3);
    const i = outX ? S.players.findIndex((p) => p.team === team && p.role === 'GK') : nearestIdx(S, team, bx, by, (p) => p.role !== 'GK');
    const p = S.players[i];
    if (!outX) {
      p.x = bx;
      p.y = by;
    }
    b.vx = 0;
    b.vy = 0;
    giveBall(S, i);
    otherHumansSwitch(S, team);
    S.say(outX ? 'GOAL KICK' : 'THROW-IN', '#fff', 10);
    S.dead(0.6, null);
  }
}

const SoccerArcade = {
  roles: ['GK', 'DEF', 'MID', 'WING', 'ST'],
  setup(S) {
    S.clock = AC().soccerSeconds;
    [0, 1].forEach((team) => this.roles.forEach((role) => S.players.push(makeAP(S, team, role, S.rosters[team][role], 160, SOC_MID))));
    socKickoff(S, 0);
  },
  step(S, dt, input) {
    S.clock -= dt;
    if (S.clock <= 0) {
      S.clock = 0;
      arcadeEnd(S);
      return;
    }
    [0, 1].forEach((team) => {
      if (!S.humans[team]) return;
      if (S.control[team] == null) autoSwitch(S, team);
      socHuman(S, team, input[team], dt);
    });
    if (S.phase !== 'live') return;
    const b = S.ball;
    const ctrl = new Set(S.control.filter((c) => c != null));
    const chasers = [0, 1].map((team) => {
      if (b.owner >= 0 && S.players[b.owner].team === team) return -1;
      return nearestIdx(S, team, b.x, b.y, (p, i) => p.role !== 'GK' && !ctrl.has(i));
    });
    S.players.forEach((p, i) => {
      if (!ctrl.has(i)) socAI(S, i, dt, chasers);
    });
    socBall(S, dt);
  },
  resolve(S, pend, o) {
    if (pend.kind === 'pass') socPass(S, pend.from, pend.to, o);
    else socShoot(S, pend.from, o);
  },
};

/* --- BASKETBALL (5-on-5 full court) ---------------------------------------- */
const BB = { x0: 14, x1: 306, y0: 36, y1: 170, three: 68 };
BB.hoops = [
  { x: 30, y: 103 },
  { x: 290, y: 103 },
];
const BB_BOX = { x0: BB.x0 + 2, x1: BB.x1 - 2, y0: BB.y0 + 2, y1: BB.y1 - 2 };
const BB_OFF = { PG: [0.6, 0.5], SG: [0.7, 0.18], SF: [0.72, 0.84], PF: [0.84, 0.3], C: [0.86, 0.68] };
const bbAttackHoop = (team) => BB.hoops[team === 0 ? 1 : 0];
const bbOwnHoop = (team) => BB.hoops[team === 0 ? 0 : 1];

function bbSpot(S, p) {
  if (S.possTeam === p.team) {
    const [fx, fy] = BB_OFF[p.role];
    return { x: p.team === 0 ? lerp(BB.x0, BB.x1, fx) : lerp(BB.x1, BB.x0, fx), y: lerp(BB.y0 + 8, BB.y1 - 8, fy) };
  }
  const m = S.players.find((q) => q.team !== p.team && q.role === p.role) || S.players[0];
  const h = bbOwnHoop(p.team);
  return { x: lerp(m.x, h.x, 0.28), y: lerp(m.y, h.y, 0.28) };
}

function bbInbound(S, team) {
  const pg = S.players.findIndex((p) => p.team === team && p.role === 'PG');
  const h = bbOwnHoop(team);
  const p = S.players[pg];
  p.x = h.x + (team === 0 ? 12 : -12);
  p.y = h.y + 22;
  S.ball = newBall();
  giveBall(S, pg);
  otherHumansSwitch(S, team);
}

function bbPass(S, from, to, o) {
  const p = S.players[from];
  const q = S.players[to];
  const team = p.team;
  const tier = o.kind === 'answer' ? o.tier : 0;
  if (o.counter) {
    const opp = nearestIdx(S, 1 - team, (p.x + q.x) / 2, (p.y + q.y) / 2);
    giveBall(S, opp);
    otherHumansSwitch(S, 1 - team);
    S.say('STOLEN!', '#ef476f');
    S.sound('buzzer');
    return;
  }
  let tx = q.x + q.vx * 0.25;
  let ty = q.y + q.vy * 0.25;
  if (tier === 0) {
    tx += rand(-40, 40);
    ty += rand(-30, 30);
    S.say('BAD PASS', '#ef476f', 11);
  }
  const d = Math.hypot(tx - p.x, ty - p.y);
  kickBall(S, from, tx, ty, tier >= 3 ? Math.max(AC().passSpeed[tier], d * 1.5) : AC().passSpeed[tier], { to: tier > 0 ? to : -1, safe: tier >= 4, z: 8 });
  S.sound('throw');
  if (S.humans[team]) {
    if (tier > 0) S.control[team] = to;
    else autoSwitch(S, team);
  }
}

function bbShoot(S, from, o) {
  const p = S.players[from];
  const team = p.team;
  const h = bbAttackHoop(team);
  const d = Math.hypot(p.x - h.x, p.y - h.y);
  const tier = o.kind === 'answer' ? o.tier : 0;
  if (o.counter) {
    const opp = nearestIdx(S, 1 - team, p.x, p.y);
    giveBall(S, opp);
    otherHumansSwitch(S, 1 - team);
    S.say('BLOCKED!', '#ef476f');
    S.sound('smash');
    return;
  }
  const M = S.mods[team];
  const make = tier === 0 ? 0 : clamp(AC().basketMake[tier] - Math.max(0, d - 40) * 0.0025 + (d < 18 ? 0.15 : 0) + (M.shooter || 0), 0.02, 0.98);
  const made = Math.random() < make;
  const b = S.ball;
  b.owner = -1;
  b.kicker = from;
  b.lastTeam = team;
  b.flight = { t: 0, T: 0.55 + d / 400, x0: p.x, y0: p.y, x1: h.x, y1: h.y, made, points: d > BB.three ? 3 : 2, team, dunk: d < 18 };
  if (tier === 0) S.say(o.kind === 'timeout' ? 'SHOT CLOCK!' : 'AIRBALL!', '#ef476f', 12);
  S.sound('throw');
}

function bbCarrierAI(S, i, dt) {
  const p = S.players[i];
  const b = S.ball;
  const h = bbAttackHoop(p.team);
  if (p.lane == null) p.lane = rand(-1.1, 1.1);
  const tx = h.x + (p.team === 0 ? -1 : 1) * Math.cos(p.lane) * 46;
  const ty = h.y + Math.sin(p.lane) * 46;
  steer(p, tx, ty, p.speed * 0.9 * S.cpuSkill, dt);
  p.think -= dt;
  if (p.think > 0) return;
  p.think = 0.35;
  const d = Math.hypot(p.x - h.x, p.y - h.y);
  const press = nearestOppDist(S, p);
  if ((d < 75 && (press > 12 || Math.random() < 0.35)) || b.held > 7) {
    bbShoot(S, i, S.cpu(p.team));
    return;
  }
  if (press < 10 && Math.random() < 0.5) {
    const t = pickPassTarget(S, i, p.team === 0 ? 1 : -1, 0);
    if (t >= 0) bbPass(S, i, t, S.cpu(p.team));
  }
}

function bbBall(S, dt) {
  const b = S.ball;
  if (b.cd > 0) b.cd -= dt;
  if (b.owner >= 0) {
    const p = S.players[b.owner];
    b.x = p.x + p.face * 4;
    b.y = p.y + 1;
    b.z = 2 + Math.abs(Math.sin(S.time * 11)) * 5;
    b.held += dt;
    return;
  }
  if (b.flight) {
    const f = b.flight;
    f.t += dt;
    const u = Math.min(1, f.t / f.T);
    b.x = lerp(f.x0, f.x1, u);
    b.y = lerp(f.y0, f.y1, u);
    b.z = 10 + 4 * 34 * u * (1 - u) + 8 * u;
    if (u >= 1) {
      b.flight = null;
      if (f.made) {
        S.score[f.team] += f.points;
        S.say(f.dunk ? 'SLAM DUNK!' : f.points === 3 ? 'THREE!' : 'BUCKET!', '#ffd23f', 18);
        S.sound('cheer');
        S.dead(1.1, () => bbInbound(S, 1 - f.team));
      } else {
        const ang = rand(0, Math.PI * 2);
        b.vx = Math.cos(ang) * 55;
        b.vy = Math.sin(ang) * 55;
        b.vz = 50;
        b.z = 20;
        b.kicker = -1;
        b.cd = 0.15;
        b.safe = false;
        S.say('MISS!', '#fff', 10);
      }
    }
    return;
  }
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.z += b.vz * dt;
  b.vz -= 260 * dt;
  if (b.z <= 0) {
    b.z = 0;
    b.vz = b.vz < -30 ? -b.vz * 0.5 : 0;
    const k = Math.exp(-1.5 * dt);
    b.vx *= k;
    b.vy *= k;
  }
  if (tryPickup(S, 7, 22, 7) != null) return;
  if (b.x < BB.x0 - 1 || b.x > BB.x1 + 1 || b.y < BB.y0 - 1 || b.y > BB.y1 + 1) {
    const team = 1 - b.lastTeam;
    const bx = clamp(b.x, BB.x0 + 3, BB.x1 - 3);
    const by = clamp(b.y, BB.y0 + 3, BB.y1 - 3);
    const i = nearestIdx(S, team, bx, by);
    S.players[i].x = bx;
    S.players[i].y = by;
    b.vx = 0;
    b.vy = 0;
    giveBall(S, i);
    otherHumansSwitch(S, team);
    S.say('OUT OF BOUNDS', '#fff', 10);
    S.dead(0.6, null);
  }
}

const BasketballArcade = {
  roles: ['PG', 'SG', 'SF', 'PF', 'C'],
  setup(S) {
    S.clock = AC().basketballSeconds;
    [0, 1].forEach((team) => this.roles.forEach((role) => S.players.push(makeAP(S, team, role, S.rosters[team][role], 160, 103))));
    S.possTeam = 0;
    S.players.forEach((p) => {
      const s = bbSpot(S, p);
      p.x = p.team === 0 ? Math.min(s.x, 150) : Math.max(s.x, 170);
      p.y = s.y;
    });
    const pg = S.players.findIndex((p) => p.team === 0 && p.role === 'PG');
    S.players[pg].x = 150;
    S.players[pg].y = 103;
    giveBall(S, pg);
    otherHumansSwitch(S, 0);
    S.say('TIP OFF', '#fff', 12);
    S.dead(1.0, null);
  },
  step(S, dt, input) {
    S.clock -= dt;
    if (S.clock <= 0) {
      S.clock = 0;
      arcadeEnd(S);
      return;
    }
    const b = S.ball;
    [0, 1].forEach((team) => {
      if (!S.humans[team]) return;
      if (S.control[team] == null) autoSwitch(S, team);
      const idx = S.control[team];
      const p = S.players[idx];
      const inp = input[team];
      if (p.stun > 0) {
        p.stun -= dt;
        return;
      }
      humanMove(p, inp, p.speed * (b.owner === idx ? AC().carrySpeedMult : 1), dt);
      p.x = clamp(p.x, BB_BOX.x0, BB_BOX.x1);
      p.y = clamp(p.y, BB_BOX.y0, BB_BOX.y1);
      S.aim[team] = b.owner === idx ? pickPassTarget(S, idx, inp.mx, inp.my) : null;
      if (inp.action) {
        if (b.owner === idx) {
          if (S.aim[team] >= 0) S.ask(team, 'pass', { from: idx, to: S.aim[team] });
        } else attemptSteal(S, idx, AC().humanStealChance, 'STEAL!');
      } else if (inp.secondary) {
        if (b.owner === idx) S.ask(team, 'shoot', { from: idx });
        else autoSwitch(S, team, idx);
      }
    });
    if (S.phase !== 'live') return;
    const ctrl = new Set(S.control.filter((c) => c != null));
    const chasers = [0, 1].map((team) => (b.owner >= 0 && S.players[b.owner].team === team ? -1 : nearestIdx(S, team, b.x, b.y, (p, i) => !ctrl.has(i))));
    S.players.forEach((p, i) => {
      if (ctrl.has(i)) return;
      if (p.stun > 0) {
        p.stun -= dt;
        return;
      }
      if (b.owner === i) {
        if (!S.humans[p.team]) bbCarrierAI(S, i, dt);
        return;
      }
      const sp = p.speed * (S.humans[p.team] ? 0.92 : S.cpuSkill);
      if (b.owner < 0 && b.passTo === i) return steer(p, b.x, b.y, sp, dt);
      if (chasers[p.team] === i && !b.flight) {
        const tgt = b.owner >= 0 ? S.players[b.owner] : b;
        steer(p, tgt.x, tgt.y, sp, dt);
        if (b.owner >= 0 && pdist(p, S.players[b.owner]) < 7) {
          const rate = S.humans[p.team] ? 0.3 : AC().cpuStealPerSec * 0.8 * S.cpuSkill;
          if (Math.random() < rate * dt) attemptSteal(S, i, 1, 'STOLEN!');
        }
        return;
      }
      const s = bbSpot(S, p);
      steer(p, s.x, s.y, sp * 0.85, dt);
    });
    bbBall(S, dt);
  },
  resolve(S, pend, o) {
    if (pend.kind === 'pass') bbPass(S, pend.from, pend.to, o);
    else bbShoot(S, pend.from, o);
  },
};

/* --- FOOTBALL (5-on-5, one play at a time) ---------------------------------- */
const FB_SLOTS = { QB: 'S', RB: 'LB', WR: 'CB1', TE: 'CB2', OL: 'DL' }; // offense role -> matching defender slot

function fbSetupPlay(S) {
  const f = S.f;
  const off = f.offense;
  const def = 1 - off;
  const x0 = FY(f.yard);
  S.players = [];
  const add = (team, rosterRole, slot, x, y) => {
    const p = makeAP(S, team, slot, S.rosters[team][rosterRole], x, y);
    p.face = team === off ? 1 : -1;
    S.players.push(p);
    return S.players.length - 1;
  };
  S.fb = {
    qb: add(off, 'QB', 'QB', x0 - 12, 110),
    rb: add(off, 'RB', 'RB', x0 - 22, 118),
    wr: add(off, 'WR', 'WR', x0 - 3, 62),
    te: add(off, 'TE', 'TE', x0 - 3, 148),
    ol: add(off, 'OL', 'OL', x0 - 3, 110),
    dl: add(def, 'OL', 'DL', x0 + 5, 110),
    lb: add(def, 'RB', 'LB', x0 + 18, 112),
    cb1: add(def, 'WR', 'CB1', x0 + 10, 64),
    cb2: add(def, 'TE', 'CB2', x0 + 10, 146),
    s: add(def, 'QB', 'S', x0 + 46, 108),
    state: 'pre',
    lineX: x0,
    t: 0,
    thrown: false,
    broke: false,
    qbHold: rand(1.1, 1.9) / S.cpuSkill,
  };
  S.ball = newBall();
  fbGive(S, S.fb.qb);
  S.control = [null, null];
  if (S.humans[off]) S.control[off] = S.fb.qb;
  if (S.humans[def]) S.control[def] = S.fb.lb;
  S.possTeam = off;
  S.celebrate = -1;
  if (S.humans[off]) S.say('PRESS SPACE TO HIKE', '#fff', 10);
}

function fbGive(S, idx) {
  const b = S.ball;
  b.owner = idx;
  b.flight = null;
  const p = S.players[idx];
  if (S.humans[p.team]) S.control[p.team] = idx;
}

function fbRoute(S, p, sp, dt) {
  const lx = S.fb.lineX;
  const routes = {
    WR: [
      [lx + 60, 62],
      [lx + 100, 92],
      [lx + 170, 96],
    ],
    TE: [
      [lx + 28, 148],
      [lx + 44, 128],
      [lx + 100, 124],
    ],
    RB: [
      [lx - 6, 140],
      [lx + 24, 152],
      [lx + 80, 150],
    ],
  }[p.role];
  if (!routes) {
    p.vx = 0;
    p.vy = 0;
    return;
  }
  const [tx, ty] = routes[Math.min(p.leg, routes.length - 1)];
  if (steer(p, Math.min(tx, FY(106)), ty, sp, dt) && p.leg < routes.length - 1) p.leg += 1;
}

function fbOpenness(S, r) {
  return nearestOppDist(S, r);
}

function fbPickReceiver(S, from, inp) {
  const F = S.fb;
  const qb = S.players[from];
  const m = Math.hypot(inp.mx, inp.my);
  let best = null;
  let bs = -1e9;
  [F.wr, F.te, F.rb].forEach((i) => {
    const r = S.players[i];
    const dx = r.x - qb.x;
    const dy = r.y - qb.y;
    const d = Math.hypot(dx, dy) || 1;
    const align = m > 0.1 ? (dx * inp.mx + dy * inp.my) / (d * m) : 0;
    const score = align * 80 + Math.min(30, fbOpenness(S, r)) + dx * 0.05;
    if (score > bs) {
      bs = score;
      best = i;
    }
  });
  return best;
}

function fbThrow(S, qbIdx, recvIdx, o) {
  const F = S.fb;
  const qb = S.players[qbIdx];
  const r = S.players[recvIdx];
  const team = qb.team;
  F.thrown = true;
  if (o.kind === 'timeout') {
    S.say('SACKED! TOO SLOW', '#ef476f', 11);
    fbWhistle(S, 'sack');
    return;
  }
  const tier = o.kind === 'answer' ? o.tier : 0;
  const d = pdist(qb, r);
  const T = clamp(d / 165, 0.35, 1.1);
  let tx = r.x + r.vx * T;
  let ty = clamp(r.y + r.vy * T, FIELD_TOP + 4, FIELD_BOT - 4);
  let result;
  let interceptor = -1;
  if (o.counter) {
    result = 'int';
    interceptor = nearestIdx(S, 1 - team, tx, ty);
  } else if (tier === 0) {
    result = 'inc';
    tx += rand(-30, 30);
    ty = clamp(ty + rand(-25, 25), FIELD_TOP, FIELD_BOT);
  } else {
    let pc = AC().throwCatch[tier];
    let cover = 1e9;
    S.players.forEach((q) => {
      if (q.team !== team) cover = Math.min(cover, Math.hypot(q.x - tx, q.y - ty));
    });
    if (cover < 12 && tier <= 3) pc *= 0.7;
    result = Math.random() < pc ? 'catch' : 'inc';
  }
  const b = S.ball;
  b.owner = -1;
  b.x = qb.x + qb.face * 3;
  b.y = qb.y;
  b.flight = { t: 0, T, x0: b.x, y0: b.y, tx, ty, result, recv: recvIdx, interceptor, team, tier };
  S.sound('throw');
  if (S.humans[1 - team]) {
    const i = nearestIdx(S, 1 - team, tx, ty);
    if (i >= 0) S.control[1 - team] = i;
  }
}

function fbWhistle(S, kind) {
  const F = S.fb;
  const f = S.f;
  const b = S.ball;
  if (F.state !== 'live') return;
  F.state = 'dead';
  const off = f.offense;
  const def = 1 - off;
  const round = f.drives[off] - 1;
  const add = (team, pts) => {
    f.scores[team] += pts;
    f.byRound[team][round] = (f.byRound[team][round] || 0) + pts;
  };
  const carrier = b.owner >= 0 ? S.players[b.owner] : null;
  const x = carrier ? carrier.x : S.players[F.qb].x;
  const yardAt = Math.round((x - 20) / 2.8);
  let msg;
  let color = '#fff';
  let endDrive = false;
  if (kind === 'td') {
    add(off, GAME_CONFIG.football.touchdownPoints);
    msg = 'TOUCHDOWN!';
    color = '#ffd23f';
    endDrive = true;
    S.celebrate = off;
    S.sound('cheer');
  } else if (kind === 'pick6') {
    add(def, GAME_CONFIG.football.pickSixPoints);
    msg = 'PICK SIX!';
    color = '#ef476f';
    endDrive = true;
    S.celebrate = def;
    S.sound('cheer');
  } else if (carrier && carrier.team !== off) {
    msg = 'TURNOVER!';
    color = '#ef476f';
    endDrive = true;
    S.sound('buzzer');
  } else if (kind === 'inc') {
    f.down += 1;
    msg = 'INCOMPLETE';
    S.sound('buzzer');
  } else if (yardAt <= 0) {
    add(def, GAME_CONFIG.football.safetyPoints);
    msg = 'SAFETY!';
    color = '#ef476f';
    endDrive = true;
    S.sound('buzzer');
  } else {
    const gain = yardAt - f.yard;
    f.yard = clamp(yardAt, 1, 99);
    if (gain >= f.toGo) {
      f.down = 1;
      f.toGo = Math.min(GAME_CONFIG.football.firstDownYards, 100 - f.yard);
      msg = `+${gain} YDS · FIRST DOWN!`;
      color = '#06d6a0';
    } else {
      f.down += 1;
      f.toGo -= gain;
      msg = `${kind === 'sack' ? 'SACKED! ' : ''}${gain >= 0 ? '+' : ''}${gain} YDS`;
      color = gain > 0 ? '#fff' : '#ef476f';
    }
    S.sound('tackle');
  }
  if (!endDrive && f.down > 4) {
    endDrive = true;
    msg += ' · TURNOVER ON DOWNS';
    color = '#ef476f';
  }
  S.say(msg, color, msg.length > 14 ? 10 : 16);
  S.score = f.scores;
  S.dead(1.7, () => {
    if (endDrive) footballNextDrive(f);
    if (f.over) {
      arcadeEnd(S);
      return;
    }
    fbSetupPlay(S);
  });
}

function fbAI(S, i, dt) {
  const p = S.players[i];
  const F = S.fb;
  const b = S.ball;
  const off = S.f.offense;
  if (p.stun > 0) {
    p.stun -= dt;
    p.vx = 0;
    p.vy = 0;
    return;
  }
  const sp = p.speed * (S.humans[p.team] ? 0.9 : S.cpuSkill);
  if (b.owner === i) {
    if (S.humans[p.team]) return;
    const preQB = i === F.qb && !F.thrown && p.x < F.lineX + 2;
    if (preQB) {
      steer(p, F.lineX - 26, p.y, sp * 0.6, dt);
      F.qbHold -= dt;
      const dl = S.players[F.dl];
      if (F.qbHold <= 0 || pdist(dl, p) < 13) {
        let best = F.wr;
        let bo = -1;
        [F.wr, F.te, F.rb].forEach((r) => {
          const o = fbOpenness(S, S.players[r]) + (S.players[r].x - p.x) * 0.08;
          if (o > bo) {
            bo = o;
            best = r;
          }
        });
        fbThrow(S, i, best, S.cpu(p.team));
      }
      return;
    }
    const dir = p.team === off ? 1 : -1;
    const goalX = dir > 0 ? FY(103) : FY(-3);
    const threat = S.players[nearestIdx(S, 1 - p.team, p.x, p.y)];
    const dy = p.y - threat.y || 1;
    steer(p, goalX, clamp(p.y + Math.sign(dy) * 22, FIELD_TOP + 6, FIELD_BOT - 6), sp * 0.95, dt);
    return;
  }
  const carrier = b.owner >= 0 ? S.players[b.owner] : null;
  if (b.flight) {
    const fl = b.flight;
    if (p.team === off) {
      if (i === fl.recv) steer(p, fl.tx, fl.ty, sp, dt);
      else fbRoute(S, p, sp * 0.8, dt);
      return;
    }
    if (p.role === 'DL') return steer(p, S.players[F.qb].x, S.players[F.qb].y, sp * 0.6, dt);
    return steer(p, fl.tx, fl.ty, sp * 0.95, dt);
  }
  const preThrow = carrier && b.owner === F.qb && !F.thrown && carrier.x < F.lineX + 2;
  if (preThrow) {
    const qb = S.players[F.qb];
    if (p.team === off) {
      if (p.role === 'OL') {
        const dl = S.players[F.dl];
        steer(p, lerp(dl.x, qb.x, 0.35), lerp(dl.y, qb.y, 0.35), sp * 0.85, dt);
      } else fbRoute(S, p, sp, dt);
      return;
    }
    if (p.role === 'DL') {
      const blocked = pdist(S.players[F.ol], p) < 8;
      return steer(p, qb.x, qb.y, sp * (blocked ? 0.3 : 0.85), dt);
    }
    if (p.role === 'LB') return steer(p, F.lineX + 14, qb.y, sp * 0.7, dt);
    if (p.role === 'CB1') return steer(p, S.players[F.wr].x + 5, S.players[F.wr].y + 3, sp * 0.97, dt);
    if (p.role === 'CB2') return steer(p, S.players[F.te].x + 5, S.players[F.te].y - 3, sp * 0.95, dt);
    return steer(p, Math.max(F.lineX + 50, S.players[F.wr].x + 18), lerp(108, b.y, 0.4), sp * 0.8, dt);
  }
  if (carrier) {
    if (p.team === carrier.team) {
      const q = S.players[nearestIdx(S, 1 - p.team, carrier.x, carrier.y)];
      return steer(p, lerp(q.x, carrier.x, 0.35), lerp(q.y, carrier.y, 0.35), sp * 0.85, dt);
    }
    return steer(p, carrier.x + carrier.vx * 0.25, carrier.y + carrier.vy * 0.25, sp, dt);
  }
}

function fbBall(S, dt) {
  const b = S.ball;
  const F = S.fb;
  if (b.owner >= 0) {
    const p = S.players[b.owner];
    b.x = p.x + p.face * 3;
    b.y = p.y + 0.5;
    b.z = 6;
    return;
  }
  if (!b.flight) return;
  const fl = b.flight;
  fl.t += dt;
  const u = Math.min(1, fl.t / fl.T);
  b.x = lerp(fl.x0, fl.tx, u);
  b.y = lerp(fl.y0, fl.ty, u);
  b.z = 6 + (10 + Math.hypot(fl.tx - fl.x0, fl.ty - fl.y0) * 0.08) * 4 * u * (1 - u);
  if (u < 1) return;
  b.flight = null;
  if (fl.result === 'int' && fl.interceptor >= 0) {
    const q = S.players[fl.interceptor];
    q.x = b.x;
    q.y = b.y;
    fbGive(S, fl.interceptor);
    S.possTeam = q.team;
    S.say('INTERCEPTED!', '#ef476f', 14);
    S.sound('buzzer');
    if (S.humans[1 - q.team]) autoSwitch(S, 1 - q.team);
    return;
  }
  const r = S.players[fl.recv];
  if (fl.result === 'catch' && Math.hypot(r.x - b.x, r.y - b.y) < 16) {
    r.x = b.x;
    r.y = b.y;
    fbGive(S, fl.recv);
    S.say(fl.tier >= 4 ? `${tierWord(fl.tier)} CATCH!` : 'CAUGHT!', '#06d6a0', 12);
    if (S.humans[1 - r.team]) autoSwitch(S, 1 - r.team);
    return;
  }
  fbWhistle(S, 'inc');
}

function fbContact(S) {
  const F = S.fb;
  const b = S.ball;
  if (F.state !== 'live' || b.owner < 0) return;
  const c = S.players[b.owner];
  const off = S.f.offense;
  if (c.team === off && c.x >= FY(100)) return fbWhistle(S, 'td');
  if (c.team !== off && c.x <= FY(0)) return fbWhistle(S, 'pick6');
  if (c.y < FIELD_TOP + 1 || c.y > FIELD_BOT - 1) return fbWhistle(S, 'oob');
  for (const q of S.players) {
    if (q.team === c.team || q.stun > 0 || pdist(q, c) > 6) continue;
    const M = S.mods[c.team];
    if (!F.broke && M.power && Math.random() < M.power) {
      F.broke = true;
      q.stun = 0.8;
      S.say('BROKE A TACKLE!', '#06d6a0', 11);
      continue;
    }
    const preQB = b.owner === F.qb && !F.thrown && c.x < F.lineX + 2;
    return fbWhistle(S, preQB ? 'sack' : 'tackle');
  }
}

const FootballArcade = {
  roles: ['QB', 'RB', 'WR', 'TE', 'OL'],
  setup(S) {
    S.f = FootballEngine.init();
    S.f.totalDrives = AC().footballDrives;
    S.score = S.f.scores;
    fbSetupPlay(S);
  },
  step(S, dt, input) {
    const F = S.fb;
    const f = S.f;
    const off = f.offense;
    F.t += dt;
    if (F.state === 'pre') {
      if ((S.humans[off] && input[off].action) || (!S.humans[off] && F.t > 1.0)) {
        F.state = 'live';
        F.t = 0;
        S.sound('whistle');
        S.say('HIKE!', '#fff', 12);
      }
      return;
    }
    if (F.state !== 'live') return;
    [0, 1].forEach((team) => {
      if (!S.humans[team]) return;
      const idx = S.control[team];
      if (idx == null) return;
      const p = S.players[idx];
      const inp = input[team];
      if (p.stun > 0) {
        p.stun -= dt;
        return;
      }
      humanMove(p, inp, p.speed, dt);
      p.x = clamp(p.x, 2, 318);
      p.y = clamp(p.y, FIELD_TOP + 2, FIELD_BOT - 2);
      const isQB = idx === F.qb && S.ball.owner === idx && !F.thrown && p.x < F.lineX + 2;
      if (team === off && isQB) {
        S.aim[team] = fbPickReceiver(S, idx, inp);
        if (inp.action && S.aim[team] != null) S.ask(team, 'throw', { from: idx, to: S.aim[team] });
        else if (inp.secondary && pdist(p, S.players[F.rb]) < 28) {
          fbGive(S, F.rb);
          F.thrown = true;
          S.say('HANDOFF', '#fff', 10);
        }
      } else {
        S.aim[team] = null;
        if (inp.secondary && S.ball.owner !== idx) {
          const i = nearestIdx(S, team, S.ball.x, S.ball.y, (q, j) => j !== idx);
          if (i >= 0) S.control[team] = i;
        }
      }
    });
    if (S.phase !== 'live') return;
    S.players.forEach((p, i) => {
      if (!S.control.includes(i)) fbAI(S, i, dt);
    });
    fbBall(S, dt);
    fbContact(S);
    if (F.state === 'live' && F.t > 15) fbWhistle(S, 'tackle');
  },
  resolve(S, pend, o) {
    fbThrow(S, pend.from, pend.to, o);
  },
};

/* --- TENNIS (tiebreak) --------------------------------------------------------- */
function tnServe(S) {
  const t = S.t;
  const P = S.players;
  const flip = t.pointNo % 2 ? -1 : 1;
  P[0].x = 30;
  P[0].y = 110 + 16 * flip;
  P[1].x = 290;
  P[1].y = 110 - 16 * flip;
  P.forEach((p) => {
    p.vx = 0;
    p.vy = 0;
    p.pose = null;
  });
  S.ball = newBall();
  S.ball.owner = t.server;
  t.serving = true;
  t.waitT = 0;
  t.oppSmash = false;
  if (S.humans[t.server]) S.say('PRESS SPACE TO SERVE', '#fff', 10);
}

function tnPoint(S, winner, word) {
  const t = S.t;
  t.points[winner] += 1;
  S.score = t.points;
  S.say(word, S.humans[winner] ? '#06d6a0' : '#ef476f', 14);
  S.sound(S.humans[winner] ? 'cheer' : 'buzzer');
  const c = GAME_CONFIG.tennis;
  S.ball.vx = 0;
  S.ball.vy = 0;
  S.ball.vz = 0;
  if (t.points[winner] >= c.pointsToWin && t.points[winner] - t.points[1 - winner] >= c.winBy) {
    S.dead(1.6, () => arcadeEnd(S));
    return;
  }
  t.pointNo += 1;
  t.server = tennisServerFor(t.pointNo);
  S.dead(1.4, () => tnServe(S));
}

function tnHit(S, team, o, serve) {
  const t = S.t;
  const b = S.ball;
  const p = S.players[team];
  const opp = S.players[1 - team];
  t.serving = false;
  let tier = o.kind === 'answer' ? o.tier : 0;
  const M = S.mods[team];
  if (tier === 3 && M.bigserve && Math.random() < M.bigserve) tier = 5;
  if (t.oppSmash && tier > 0) {
    tier = 5;
    S.say('SMASH!', S.humans[team] ? '#06d6a0' : '#ef476f', 14);
  }
  t.oppSmash = false;
  const dir = team === 0 ? 1 : -1;
  b.owner = -1;
  b.x = p.x + dir * 4;
  b.y = p.y;
  b.z = 10;
  b.bounces = 0;
  b.lastHitter = team;
  b.hitLock = false;
  b.prevSide = team;
  t.lastTier = tier;
  p.pose = 'armsUp';
  p.poseT = 0.25;
  S.sound(tier >= 5 ? 'smash' : 'hit');
  let tx;
  let ty;
  let T;
  if (tier === 0) {
    if (Math.random() < 0.5) {
      tx = COURT.net - dir * 8;
      ty = p.y;
      T = 0.4;
    } else {
      tx = team === 0 ? COURT.x1 + 20 : COURT.x0 - 20;
      ty = p.y + rand(-20, 20);
      T = 0.75;
    }
    S.say(o.kind === 'timeout' ? 'TOO SLOW!' : serve ? 'DOUBLE FAULT!' : 'UNFORCED ERROR!', '#ef476f', 11);
  } else if (o.counter) {
    tx = team === 0 ? COURT.net + 40 : COURT.net - 40;
    ty = 110;
    T = 1.3;
    t.oppSmash = true;
    S.say('SITTER... UH OH', '#ef476f', 10);
  } else {
    const far = team === 0 ? COURT.x1 : COURT.x0;
    if (serve) tx = team === 0 ? rand(172, 214) : rand(106, 148);
    else tx = tier >= 4 ? far - dir * rand(6, 14) : far - dir * rand(28, 60);
    if (tier === 5) ty = opp.y < 110 ? COURT.y1 - 5 : COURT.y0 + 5;
    else if (tier === 4) ty = Math.random() < 0.5 ? COURT.y0 + 8 : COURT.y1 - 8;
    else if (tier === 3) ty = rand(COURT.y0 + 14, COURT.y1 - 14);
    else ty = lerp(opp.y, 110, 0.5) + rand(-8, 8);
    T = AC().tennisPace[tier] * (serve ? 0.95 : 1);
    if (tier === 5) S.say(serve ? 'ACE!' : 'WINNER!', S.humans[team] ? '#ffd23f' : '#ef476f', 16);
  }
  b.vx = (tx - b.x) / T;
  b.vy = (ty - b.y) / T;
  b.vz = (0 - b.z + 0.5 * TN_G * T * T) / T;
}

function tnCpuMove(S, team, dt) {
  const b = S.ball;
  const p = S.players[team];
  let tx = team === 0 ? 30 : 290;
  let ty = 110;
  if (b.owner < 0 && b.lastHitter !== team) {
    if (b.bounces >= 1) {
      tx = b.x + b.vx * 0.15;
      ty = b.y + b.vy * 0.15;
    } else {
      const disc = b.vz * b.vz + 2 * TN_G * b.z;
      const tl = (b.vz + Math.sqrt(Math.max(0, disc))) / TN_G;
      tx = b.x + b.vx * tl + b.vx * 0.8 * 0.2;
      ty = b.y + b.vy * tl + b.vy * 0.8 * 0.2;
    }
  }
  tx = team === 0 ? clamp(tx, 4, COURT.net - 6) : clamp(tx, COURT.net + 6, 316);
  ty = clamp(ty, COURT.y0 - 14, COURT.y1 + 14);
  steer(p, tx, ty, p.speed * 0.92 * S.cpuSkill, dt);
}

const TennisArcade = {
  roles: ['SINGLES'],
  setup(S) {
    S.t = { points: [0, 0], pointNo: 0, server: 0, serving: true, waitT: 0, oppSmash: false, lastTier: 0 };
    S.players = [makeAP(S, 0, 'SINGLES', S.rosters[0].SINGLES, 30, 110), makeAP(S, 1, 'SINGLES', S.rosters[1].SINGLES, 290, 110)];
    S.players.forEach((p) => (p.speed *= AC().tennisSpeedMult));
    S.control = [S.humans[0] ? 0 : null, S.humans[1] ? 1 : null];
    S.score = S.t.points;
    tnServe(S);
  },
  step(S, dt, input) {
    const t = S.t;
    const b = S.ball;
    const P = S.players;
    P.forEach((p) => {
      if (p.poseT > 0) {
        p.poseT -= dt;
        if (p.poseT <= 0) p.pose = null;
      }
    });
    if (t.serving && b.owner >= 0) {
      const sv = b.owner;
      if (S.humans[sv]) {
        if (input[sv].action) S.ask(sv, 'serve', { from: sv });
      } else {
        t.waitT += dt;
        if (t.waitT > 0.7) tnHit(S, sv, S.cpu(sv), true);
      }
      if (b.owner >= 0) {
        b.x = P[sv].x + P[sv].face * 3;
        b.y = P[sv].y;
        b.z = 10 + Math.abs(Math.sin(S.time * 4)) * 6;
      }
      [0, 1].forEach((team) => {
        if (S.humans[team] && team !== sv) {
          humanMove(P[team], input[team], P[team].speed, dt);
          P[team].x = team === 0 ? clamp(P[team].x, 4, COURT.net - 6) : clamp(P[team].x, COURT.net + 6, 316);
          P[team].y = clamp(P[team].y, COURT.y0 - 14, COURT.y1 + 14);
        }
      });
      return;
    }
    [0, 1].forEach((team) => {
      if (S.humans[team]) {
        humanMove(P[team], input[team], P[team].speed, dt);
        P[team].x = team === 0 ? clamp(P[team].x, 4, COURT.net - 6) : clamp(P[team].x, COURT.net + 6, 316);
        P[team].y = clamp(P[team].y, COURT.y0 - 14, COURT.y1 + 14);
      } else tnCpuMove(S, team, dt);
    });
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    b.vz -= TN_G * dt;
    const side = b.x < COURT.net ? 0 : 1;
    if (b.prevSide !== undefined && side !== b.prevSide) {
      if (b.z < 5) return tnPoint(S, 1 - b.lastHitter, 'NET!');
      b.prevSide = side;
    }
    if (b.z <= 0 && b.vz < 0) {
      b.z = 0;
      b.bounces += 1;
      const inCourt = b.x > COURT.x0 - 1 && b.x < COURT.x1 + 1 && b.y > COURT.y0 - 1 && b.y < COURT.y1 + 1;
      const onOpp = b.lastHitter === 0 ? b.x > COURT.net : b.x < COURT.net;
      if (b.bounces === 1 && (!inCourt || !onOpp)) return tnPoint(S, 1 - b.lastHitter, 'OUT!');
      if (b.bounces >= 2) return tnPoint(S, b.lastHitter, t.lastTier >= 5 ? 'WINNER!' : 'POINT!');
      b.vz = -b.vz * 0.62;
      b.vx *= 0.8;
      b.vy *= 0.8;
    }
    if (b.x < -12 || b.x > 332 || b.y < -12 || b.y > 192) return tnPoint(S, b.bounces >= 1 ? b.lastHitter : 1 - b.lastHitter, b.bounces >= 1 ? 'WINNER!' : 'OUT!');
    const recv = 1 - b.lastHitter;
    const rp = P[recv];
    if (!b.hitLock && b.bounces >= 1 && b.z < 18 && Math.hypot(rp.x - b.x, rp.y - b.y) < 12) {
      b.hitLock = true;
      if (S.humans[recv]) S.ask(recv, 'hit', { from: recv });
      else tnHit(S, recv, S.cpu(recv), false);
    }
  },
  resolve(S, pend, o) {
    tnHit(S, pend.team, o, pend.kind === 'serve');
  },
};

const ARCADE_SPORTS = { football: FootballArcade, basketball: BasketballArcade, soccer: SoccerArcade, tennis: TennisArcade };

/* --- Arcade rendering ------------------------------------------------------------ */
function bgSoccerPitch(ctx, teams, clock, cheer) {
  drawCrowd(ctx, teams, 0, 22, clock, cheer);
  for (let x = 0, i = 0; x < CW; x += 20, i++) {
    ctx.fillStyle = i % 2 ? '#3a8c3f' : '#348238';
    ctx.fillRect(x, 22, 20, CH - 22);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const r = (x0, y0, w, h) => {
    ctx.fillRect(x0, y0, w, 1);
    ctx.fillRect(x0, y0 + h, w + 1, 1);
    ctx.fillRect(x0, y0, 1, h);
    ctx.fillRect(x0 + w, y0, 1, h);
  };
  r(SOC.x0, SOC.y0, SOC.x1 - SOC.x0, SOC.y1 - SOC.y0);
  ctx.fillRect(160, SOC.y0, 1, SOC.y1 - SOC.y0);
  for (let a = 0; a < Math.PI * 2; a += 0.08) ctx.fillRect(Math.round(160 + Math.cos(a) * 20), Math.round(SOC_MID + Math.sin(a) * 20), 1, 1);
  r(SOC.x0, SOC_MID - 34, 40, 68);
  r(SOC.x1 - 40, SOC_MID - 34, 40, 68);
  r(SOC.x0, SOC_MID - 16, 14, 32);
  r(SOC.x1 - 14, SOC_MID - 16, 14, 32);
  [SOC.x0, SOC.x1].forEach((gx, side) => {
    const dx = side ? 1 : -9;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(gx + dx, SOC.gTop, 8, SOC.gBot - SOC.gTop);
    ctx.fillStyle = 'rgba(230,230,230,0.55)';
    for (let y = SOC.gTop; y <= SOC.gBot; y += 3) ctx.fillRect(gx + dx, y, 8, 1);
    for (let x = 0; x <= 8; x += 3) ctx.fillRect(gx + dx + x, SOC.gTop, 1, SOC.gBot - SOC.gTop);
    ctx.fillStyle = '#fff';
    ctx.fillRect(gx - 1, SOC.gTop - 1, 3, 3);
    ctx.fillRect(gx - 1, SOC.gBot - 1, 3, 3);
  });
  drawPixelText(ctx, shortName(teams[0].name), 60, 30, 6, inkFor(teams[0].primary), 'center', 1);
  drawPixelText(ctx, shortName(teams[1].name), 260, 30, 6, inkFor(teams[1].primary), 'center', 1);
}

function bgBasketball(ctx, teams, clock, cheer) {
  drawCrowd(ctx, teams, 0, 30, clock, cheer);
  for (let y = 30, i = 0; y < CH; y += 4, i++) {
    ctx.fillStyle = i % 2 ? '#c98d52' : '#c4874b';
    ctx.fillRect(0, y, CW, 4);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let x = 0; x < CW; x += 24) ctx.fillRect(x, 30, 1, CH - 30);
  // painted keys in team colors
  [0, 1].forEach((side) => {
    const h = BB.hoops[side];
    const tm = teams[side];
    ctx.fillStyle = tm.primary;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(side ? h.x - 44 : BB.x0, h.y - 16, side ? BB.x1 - (h.x - 44) : h.x + 44 - BB.x0, 32);
    ctx.globalAlpha = 1;
  });
  ctx.fillStyle = '#fff';
  const r = (x0, y0, w, h) => {
    ctx.fillRect(x0, y0, w, 1);
    ctx.fillRect(x0, y0 + h, w + 1, 1);
    ctx.fillRect(x0, y0, 1, h);
    ctx.fillRect(x0 + w, y0, 1, h);
  };
  r(BB.x0, BB.y0, BB.x1 - BB.x0, BB.y1 - BB.y0);
  ctx.fillRect(160, BB.y0, 1, BB.y1 - BB.y0);
  for (let a = 0; a < Math.PI * 2; a += 0.08) ctx.fillRect(Math.round(160 + Math.cos(a) * 16), Math.round(103 + Math.sin(a) * 16), 1, 1);
  BB.hoops.forEach((h, side) => {
    const s = side ? -1 : 1;
    for (let a = -1.25; a <= 1.25; a += 0.03) ctx.fillRect(Math.round(h.x + s * Math.cos(a) * BB.three), Math.round(h.y + Math.sin(a) * BB.three), 1, 1);
    r(side ? h.x - 44 : BB.x0, h.y - 16, 44 + (side ? BB.x1 - h.x : h.x - BB.x0), 32);
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(h.x - s * 6, h.y - 10, 2, 20);
    ctx.fillStyle = '#ff7b00';
    for (let a = 0; a < Math.PI * 2; a += 0.4) ctx.fillRect(Math.round(h.x + Math.cos(a) * 4), Math.round(h.y + Math.sin(a) * 4), 1, 1);
    ctx.fillStyle = '#fff';
  });
  drawPixelText(ctx, shortName(teams[0].name), 80, 38, 6, inkFor(teams[0].primary), 'center', 1);
  drawPixelText(ctx, shortName(teams[1].name), 240, 38, 6, inkFor(teams[1].primary), 'center', 1);
}

const ARCADE_BALL = { football: 'football', basketball: 'basketball', soccer: 'soccer', tennis: 'tennis' };

export function arcadeRender(ctx, S, clock) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, CW, CH);
  const bn = S.banner;
  const cheer = bn && S.time - bn.t < 2.2 && /GOAL|TOUCHDOWN|THREE|DUNK|PICK|WINNER|ACE|BUCKET/.test(bn.text) ? 1 - (S.time - bn.t) / 2.2 : 0;
  const teams = S.teams;
  if (S.sport === 'football') bgFootball(ctx, { offense: S.f.offense, yard: S.f.yard, toGo: S.f.toGo }, teams, clock, cheer);
  else if (S.sport === 'tennis') bgTennis(ctx, {}, teams, clock, cheer);
  else if (S.sport === 'basketball') bgBasketball(ctx, teams, clock, cheer);
  else bgSoccerPitch(ctx, teams, clock, cheer);

  const head = S.sport === 'football' ? 'helmet' : 'hair';
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  S.players.forEach((p) => ctx.fillRect(Math.round(p.x - 4), Math.round(p.y) - 1, 8, 2));
  const b = S.ball;
  const showBall = !(S.sport === 'tennis' && b.owner < 0 && S.phase === 'dead' && b.vx === 0);
  if (showBall) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(Math.round(b.x - 1), Math.round(b.y), 3, 1);
  }
  // aim ring under the current pass/throw target
  [0, 1].forEach((team) => {
    const a = S.aim[team];
    if (a == null || a < 0 || !S.players[a] || S.phase !== 'live') return;
    const q = S.players[a];
    ctx.fillStyle = team === 0 ? '#ffd23f' : '#4cc9f0';
    for (let k = 0; k < 12; k++) {
      const ang = (k / 12) * Math.PI * 2 + clock * 3;
      ctx.fillRect(Math.round(q.x + Math.cos(ang) * 7), Math.round(q.y + Math.sin(ang) * 3), 1, 1);
    }
  });
  const items = S.players.map((p, i) => ({
    y: p.y,
    draw: () => {
      const team = teams[p.team];
      const gk = p.role === 'GK';
      const moving = Math.hypot(p.vx, p.vy) > 5;
      let pose = p.pose || (p.stun > 0 ? 'down' : moving ? (Math.floor(clock * 10 + i) % 2 ? 'run1' : 'run2') : 'stand');
      if (S.celebrate === p.team && S.phase === 'dead') pose = 'armsUp';
      const spr = getSprite(pose, head, gk ? team.secondary : team.primary, gk ? team.primary : team.secondary, p.face < 0, p.skin, p.hair);
      ctx.drawImage(spr, Math.round(p.x - spr.width / 2), Math.round(p.y - spr.height));
      if (S.sport === 'tennis') drawRacket(ctx, { x: p.x, y: p.y, face: p.face, pose });
    },
  }));
  if (showBall) items.push({ y: b.y + 0.1, draw: () => drawBall(ctx, ARCADE_BALL[S.sport], b, clock) });
  items.sort((p, q) => p.y - q.y).forEach((it) => it.draw());
  // controlled-player markers + name tags
  [0, 1].forEach((team) => {
    const c = S.control[team];
    if (c == null || !S.players[c] || S.phase === 'over') return;
    const p = S.players[c];
    const col = team === 0 ? '#ffd23f' : '#4cc9f0';
    const bob = Math.round(Math.sin(clock * 6));
    const hx = Math.round(p.x);
    const hy = Math.round(p.y - 15 + bob);
    ctx.fillStyle = '#000';
    ctx.fillRect(hx - 3, hy - 1, 7, 4);
    ctx.fillStyle = col;
    ctx.fillRect(hx - 2, hy, 5, 1);
    ctx.fillRect(hx - 1, hy + 1, 3, 1);
    ctx.fillRect(hx, hy + 2, 1, 1);
    const tag = (p.name || '').split(' ').slice(-1)[0].toUpperCase().slice(0, 9);
    drawPixelText(ctx, tag, hx, hy - 5, 5, col, 'center', 1);
  });
  if (bn && S.time - bn.t < 1.8) {
    const dt = S.time - bn.t;
    const pop = Math.min(1, dt / 0.12);
    const size = fitFont(ctx, bn.text, bn.size || 16, 300);
    ctx.save();
    ctx.translate(CW / 2, 96);
    ctx.scale(0.5 + 0.5 * pop, 0.5 + 0.5 * pop);
    drawPixelText(ctx, bn.text, 0, 0, size, bn.color);
    ctx.restore();
  }
  if (S.phase === 'question') {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, CW, CH);
  }
}

/* =============================================================================
   5. GAME_ENGINE  (pure logic: no React, no canvas)
============================================================================= */
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clone = (o) => JSON.parse(JSON.stringify(o));
const ORD = ['', '1ST', '2ND', '3RD', '4TH', '4TH'];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- Fuzzy answer matching ---------------------------------------------------
export function normalizeAnswer(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/\+/g, ' plus ')
    .replace(/#/g, ' sharp ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(the|a|an) /, '')
    .replace(/\s/g, '');
}

function levenshtein(a, b, max) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

const allowedTypos = (len) => GAME_CONFIG.fuzzy.typoAllowance.find((r) => len <= r.maxLen).typos;
const candidateCache = new WeakMap();
function candidatesFor(prompt) {
  let c = candidateCache.get(prompt);
  if (!c) {
    c = [];
    prompt.answers.forEach((ans, idx) => {
      [ans.text, ...(ans.aliases || [])].forEach((s) => {
        const n = normalizeAnswer(s);
        if (n) c.push({ idx, n });
      });
    });
    candidateCache.set(prompt, c);
  }
  return c;
}

/** Returns { idx, answer, dist } for the best match, or null. */
export function matchAnswer(guess, prompt) {
  const g = normalizeAnswer(guess);
  if (!g) return null;
  // also try simple singular forms: "cherries" -> "cherry", "foxes" -> "fox", "dogs" -> "dog"
  const variants = [[g, 0]];
  if (g.length > 4 && g.endsWith('ies')) variants.push([`${g.slice(0, -3)}y`, 0.25]);
  if (g.length > 4 && g.endsWith('es')) variants.push([g.slice(0, -2), 0.25]);
  if (g.length > 3 && g.endsWith('s')) variants.push([g.slice(0, -1), 0.25]);
  let best = null;
  for (const { idx, n } of candidatesFor(prompt)) {
    for (const [v, penalty] of variants) {
      const max = allowedTypos(Math.min(v.length, n.length));
      const d = levenshtein(v, n, max);
      if (d > max) continue;
      const score = d + penalty;
      const ans = prompt.answers[idx];
      if (!best || score < best.dist || (score === best.dist && ans.tier > best.answer.tier)) best = { idx, answer: ans, dist: score };
    }
  }
  return best;
}

// --- Prompt deck + CPU brain -------------------------------------------------
const usedKey = (promptId, idx) => `${promptId}#${idx}`;

function drawPrompt(g) {
  for (let tries = 0; tries < TRIVIA_BANK.length * 2; tries++) {
    if (g.deckPos >= g.deck.length) {
      g.deck = shuffle(TRIVIA_BANK.map((_, i) => i));
      g.deckPos = 0;
    }
    const p = TRIVIA_BANK[g.deck[g.deckPos++]];
    const used = p.answers.filter((_, i) => g.used.has(usedKey(p.id, i))).length;
    if (used / p.answers.length < GAME_CONFIG.prompts.retireWhenUsedRatio) return p;
  }
  g.used.clear(); // every prompt is exhausted: recycle the whole bank
  return TRIVIA_BANK[g.deck[0]];
}

function weightedPick(weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return Number(k);
  }
  return Number(entries[entries.length - 1][0]);
}

function cpuAnswer(prompt, used, difficulty, weightsOverride) {
  const diff = GAME_CONFIG.cpu.difficulties[difficulty] || GAME_CONFIG.cpu.difficulties.pro;
  const tier = weightedPick(weightsOverride || diff.tierWeights);
  if (tier === 0) return { kind: 'invalid', text: pick(GAME_CONFIG.cpu.whiffs) };
  for (const delta of [0, -1, 1, -2, 2, -3, 3, -4, 4]) {
    const t = tier + delta;
    const options = prompt.answers.map((a, idx) => ({ a, idx })).filter(({ a, idx }) => a.tier === t && !used.has(usedKey(prompt.id, idx)));
    if (options.length) {
      const { a, idx } = pick(options);
      return { kind: 'answer', text: a.text, matchedText: a.text, idx, tier: a.tier };
    }
  }
  return { kind: 'invalid', text: pick(GAME_CONFIG.cpu.whiffs) };
}

// --- Sport engines --------------------------------------------------------------
// Interface:
//   init() -> state            currentActor(s) -> team index to answer next
//   resolve(s, outcome, actor, teams, mods?) -> { state, anim, headline, detail, tone, quick, toast?, triggers? }
//   mods = [team0Mods, team1Mods] from player abilities (see computeMods)
//   isOver(s)  scores(s)  status(s, teams)  scene(s)  boxScore(s)  pips?(s, team)
// `outcome` = { kind: 'answer'|'invalid'|'duplicate'|'timeout', tier?, counter?, text, matchedText? }

function footballNextDrive(n) {
  const c = GAME_CONFIG.football;
  const start = (team) => {
    n.offense = team;
    n.drives[team] += 1;
    n.yard = c.startYard;
    n.down = 1;
    n.toGo = c.firstDownYards;
  };
  if (n.drives[0] >= n.totalDrives && n.drives[1] >= n.totalDrives) {
    if (n.scores[0] === n.scores[1] && n.ot < c.maxOvertimeRounds) {
      n.ot += 1;
      n.totalDrives += 1;
      start(0);
    } else n.over = true;
  } else start(1 - n.offense);
}

const FootballEngine = {
  id: 'football',
  label: 'FOOTBALL DRIVE',
  icon: '🏈',
  head: 'helmet',
  blurb: 'Start at your own 20 with 4 downs to gain 10 yards. Ultra-rare answers are touchdown bombs. Obvious answers risk a PICK SIX.',
  init() {
    const c = GAME_CONFIG.football;
    return { offense: 0, yard: c.startYard, down: 1, toGo: c.firstDownYards, drives: [1, 0], totalDrives: c.drivesPerTeam, ot: 0, scores: [0, 0], byRound: [[], []], over: false };
  },
  currentActor: (s) => s.offense,
  isOver: (s) => s.over,
  scores: (s) => s.scores,
  resolve(s, o, actor, teams, mods) {
    const c = GAME_CONFIG.football;
    const M = mods ? mods[actor] : null;
    const triggers = [];
    const n = clone(s);
    const off = s.offense;
    const def = 1 - off;
    const round = s.drives[off] - 1;
    const from = s.yard;
    const add = (team, pts) => {
      n.scores[team] += pts;
      n.byRound[team][round] = (n.byRound[team][round] || 0) + pts;
    };
    let play;
    let headline;
    let detail;
    let tone;
    let sub = null;
    let endDrive = false;
    if (o.kind === 'timeout' && c.timeoutCausesFumble) {
      play = { type: 'fumble' };
      headline = 'FUMBLE!';
      detail = `The play clock hit zero and the snap was botched. ${teams[def].name} recover. Turnover!`;
      tone = 'bad';
      endDrive = true;
    } else if (o.kind !== 'answer') {
      const why = o.kind === 'duplicate' ? 'Already used!' : o.kind === 'timeout' ? 'Too slow!' : 'Not on the board!';
      const to = from - c.sackYards;
      if (to <= 0) {
        add(def, c.safetyPoints);
        play = { type: 'sack', to: Math.max(-5, to), banner: 'SAFETY!' };
        headline = 'SAFETY!';
        detail = `${why} Sacked in the end zone: +${c.safetyPoints} for ${teams[def].name}.`;
        endDrive = true;
      } else {
        n.yard = to;
        n.down += 1;
        n.toGo += c.sackYards;
        play = { type: 'sack', to, banner: 'SACKED!' };
        headline = 'SACKED!';
        detail = `${why} Loss of ${c.sackYards} yards.`;
      }
      tone = 'bad';
    } else if (o.counter) {
      add(def, c.pickSixPoints);
      play = { type: 'pick6' };
      headline = 'PICK SIX!';
      detail = `Too predictable! ${teams[def].name} jumped the route and took it to the house. +${c.pickSixPoints}.`;
      tone = 'bad';
      endDrive = true;
    } else {
      const power = M && M.power && (o.tier === 3 || o.tier === 4) ? Math.round(M.power) : 0;
      if (power) triggers.push(`BULLDOZER (${M.src.power}): +${power} yards`);
      const gain = o.tier === 5 ? 100 - from : c.yardsByTier[o.tier] + power;
      const to = Math.min(100, from + gain);
      if (to >= 100) {
        add(off, c.touchdownPoints);
        play = { type: 'pass', to: 100, td: true, banner: 'TOUCHDOWN!' };
        headline = o.tier === 5 ? 'UNSTOPPABLE TOUCHDOWN!' : 'TOUCHDOWN!';
        detail = `${100 - from}-yard scoring strike! +${c.touchdownPoints} for ${teams[off].name}.`;
        tone = 'great';
        endDrive = true;
      } else {
        n.yard = to;
        const first = gain >= s.toGo;
        if (first) {
          n.down = 1;
          n.toGo = Math.min(c.firstDownYards, 100 - to);
          sub = 'FIRST DOWN!';
        } else {
          n.down += 1;
          n.toGo -= gain;
        }
        play = { type: o.tier >= 3 ? 'pass' : 'run', to, dive: o.tier === 4, banner: `+${gain} YDS` };
        headline = o.tier === 4 ? 'DIVING CATCH!' : o.tier === 3 ? 'COMPLETE!' : 'SHORT GAIN';
        detail = `${gain}-yard gain. ${first ? 'Moving the chains!' : n.down <= 4 ? `${ORD[n.down]} & ${n.toGo}.` : ''}`;
        tone = o.tier >= 4 ? 'great' : o.tier === 3 ? 'good' : 'meh';
      }
    }
    if (!endDrive && n.down > 4) {
      endDrive = true;
      sub = 'TURNOVER ON DOWNS';
      detail += ' Turnover on downs!';
      tone = 'bad';
    }
    if (endDrive) footballNextDrive(n);
    return { state: n, anim: { sport: 'football', offense: off, from, toGo: s.toGo, tone, sub, ...play }, headline, detail, tone, quick: false, triggers };
  },
  status(s) {
    if (s.over) return 'FINAL';
    const goal = s.yard + s.toGo >= 100;
    const spot = s.yard < 50 ? `OWN ${s.yard}` : s.yard === 50 ? 'MIDFIELD' : `OPP ${100 - s.yard}`;
    return `${ORD[s.down]} & ${goal ? 'GOAL' : s.toGo} · ${spot} · ${s.ot ? `OVERTIME ${s.ot}` : `DRIVE ${s.drives[s.offense]}/${s.totalDrives}`}`;
  },
  scene: (s) => ({ sport: 'football', offense: s.offense, yard: s.yard, toGo: s.toGo }),
  boxScore(s) {
    const reg = GAME_CONFIG.football.drivesPerTeam;
    const columns = Array.from({ length: s.totalDrives }, (_, i) => (i < reg ? `D${i + 1}` : `OT${i + 1 - reg}`));
    return { columns, rows: [0, 1].map((t) => columns.map((_, i) => s.byRound[t][i] || 0)) };
  },
};

const tennisServerFor = (pointNo) => (pointNo === 0 ? 0 : Math.floor((pointNo + 1) / 2) % 2);
const newStats = () => ({ plays: 0, correct: 0, tiers: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, tierSum: 0, invalid: 0, timeouts: 0, dupes: 0, countered: 0, forced: 0, best: null });

function recordStats(mine, theirs, o) {
  mine.plays += 1;
  if (o.kind === 'answer') {
    mine.correct += 1;
    mine.tiers[o.tier] += 1;
    mine.tierSum += o.tier;
    if (!o.forgiven && (!mine.best || o.tier > mine.best.tier)) mine.best = { text: o.matchedText, tier: o.tier };
    if (o.counter) {
      mine.countered += 1;
      theirs.forced += 1;
    }
  } else if (o.kind === 'timeout') mine.timeouts += 1;
  else if (o.kind === 'duplicate') mine.dupes += 1;
  else mine.invalid += 1;
}

/* =============================================================================
   5b. CAREER_ENGINE  (pure functions over a JSON save: club, league, market)
============================================================================= */
const SPORT_IDS = ['football', 'basketball', 'soccer', 'tennis'];
export const ROLES = {
  football: ['QB', 'RB', 'WR', 'TE', 'OL'],
  basketball: ['PG', 'SG', 'SF', 'PF', 'C'],
  soccer: ['GK', 'DEF', 'MID', 'WING', 'ST'],
  tennis: ['SINGLES'],
};
const ROLE_NAMES = { QB: 'QUARTERBACK', RB: 'RUNNING BACK', WR: 'WIDE RECEIVER', TE: 'TIGHT END', OL: 'LINEMAN', PG: 'POINT GUARD', SG: 'SHOOTING GUARD', SF: 'SMALL FORWARD', PF: 'POWER FORWARD', C: 'CENTER', GK: 'GOALKEEPER', DEF: 'DEFENDER', MID: 'MIDFIELDER', WING: 'WINGER', ST: 'STRIKER', SINGLES: 'SINGLES' };
const FIRST_NAMES = ['Ace', 'Blaze', 'Chip', 'Dex', 'Echo', 'Flash', 'Gus', 'Hank', 'Ivy', 'Jett', 'Kit', 'Lux', 'Max', 'Nova', 'Ozzy', 'Pip', 'Quinn', 'Rex', 'Sky', 'Tess', 'Uma', 'Vin', 'Wren', 'Zed', 'Bo', 'Cruz', 'Dot', 'Fizz', 'Juno', 'Koda', 'Remy', 'Sol', 'Mika', 'Taz'];
const LAST_NAMES = ['Byte', 'Pixel', 'Turbo', 'Voltage', 'McCoy', 'Rocket', 'Blitz', 'Crunch', 'Dash', 'Glitch', 'Hammer', 'Joystick', 'Laser', 'Megabit', 'Nitro', 'Overdrive', 'Quasar', 'Raster', 'Sprite', 'Thunder', 'Vector', 'Warp', 'Zapper', 'Bitmap', 'Combo', 'Cartridge', 'Chiptune', 'Hiscore'];
const SKIN_TONES = ['#ffdbac', '#f2c18d', '#e0a370', '#c68642', '#8d5524', '#5c3a1e'];
const HAIR_COLORS = ['#3b2414', '#1a1a1a', '#d9a441', '#a33c1c', '#e8e8e8', '#6b3fa0', '#2b59c3'];
const MOD_KEY = { clock: 'extraTime', scout: 'hintChance', retry: 'retries' };
const MOD_CAPS = { hintChance: 0.9, shield: 0.8, ballhawk: 0.35, clutch: 0.95, composure: 0.7, bigserve: 0.6, finisher: 0.4, power: 0.7, shooter: 0.35 };
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const triviaCategories = () => [...new Set(TRIVIA_BANK.map((p) => p.category))];
const isHappy = (p) => p.morale >= CAREER_CONFIG.morale.unhappyBelow;

export const emptyMods = () => ({ extraTime: 0, hintChance: 0, retries: 0, shield: 0, ballhawk: 0, clutch: 0, composure: 0, power: 0, bigserve: 0, finisher: 0, shooter: 0, specialists: {}, src: {} });
export const abilityName = (a) => (a.key === 'specialist' ? `${a.cat} BRAIN` : ABILITIES[a.key].name);
export const abilityDesc = (a) => ABILITIES[a.key].desc(a.mag, a.cat);

/** Stack the abilities of a lineup into match modifiers (unhappy players contribute nothing). */
export function computeMods(players) {
  const m = emptyMods();
  players.filter(isHappy).forEach((p) => {
    const a = p.ability;
    if (a.key === 'specialist') {
      const prev = m.specialists[a.cat];
      m.specialists[a.cat] = { chance: Math.min(0.95, (prev ? prev.chance : 0) + a.mag), src: prev ? `${prev.src} + ${p.name}` : p.name };
      return;
    }
    if (a.key === 'wheels') return; // per-player: applied to that player's run speed on the field
    const k = MOD_KEY[a.key] || a.key;
    m[k] += a.mag;
    m.src[k] = m.src[k] ? `${m.src[k]} + ${p.name}` : p.name;
  });
  Object.entries(MOD_CAPS).forEach(([k, cap]) => (m[k] = Math.min(cap, m[k])));
  return m;
}

function varyMag(key, stars) {
  const base = ABILITIES[key].mags[stars - 1];
  if (key === 'clock' || key === 'retry') return base;
  return Math.round(base * rand(0.9, 1.1) * 100) / 100;
}

const priceFor = (stars) => Math.round((CAREER_CONFIG.stars[stars].value * rand(0.9, 1.15)) / 5) * 5;

function makePlayer(c, stars, sport, role) {
  const keys = ['clock', 'scout', 'retry', 'shield', 'ballhawk', 'clutch', 'composure', 'wheels', 'specialist', 'specialist'];
  Object.keys(ABILITIES).forEach((k) => ABILITIES[k].sport === sport && keys.push(k, k));
  let ability = null;
  for (let i = 0; i < 30; i++) {
    const key = pick(keys);
    const cat = key === 'specialist' ? pick(triviaCategories()) : null;
    ability = { key, mag: varyMag(key, stars), cat };
    const sig = `${sport}|${key}|${cat || ''}|${ability.mag}`;
    if (!c.sigs[sig]) {
      c.sigs[sig] = 1; // no two players in a career share the exact same ability roll
      break;
    }
  }
  const id = `p${c.nextId++}`;
  const p = { id, name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`, sport, pos: role || pick(ROLES[sport]), stars, ability, value: priceFor(stars), salary: CAREER_CONFIG.stars[stars].salary, contract: randInt(1, 3), morale: CAREER_CONFIG.morale.start, skin: pick(SKIN_TONES), hair: pick(HAIR_COLORS), refused: null };
  c.players[id] = p;
  return p;
}

function upgradeStars(p) {
  p.stars += 1;
  p.ability.mag = varyMag(p.ability.key, p.stars);
  p.value = priceFor(p.stars);
  p.salary = CAREER_CONFIG.stars[p.stars].salary;
}

const rivalStar = (mean) => clamp(Math.round(mean + (Math.random() + Math.random() + Math.random() - 1.5) * 1.2), 1, 5);

function marketStar(season) {
  const w = {};
  for (let s = 1; s <= 5; s++) w[s] = CAREER_CONFIG.stars[s].weight + (s === 4 ? (season - 1) * 2 : s === 5 ? season - 1 : 0);
  return weightedPick(w);
}

function addNews(c, msg) {
  c.news.unshift(`S${c.season} · ${msg}`);
  c.news = c.news.slice(0, 25);
}

function refreshFreeAgents(c) {
  c.freeAgents.forEach((id) => delete c.players[id]);
  const fa = Array.from({ length: CAREER_CONFIG.freeAgentsPerWeek }, () => {
    const sport = pick(SPORT_IDS);
    return makePlayer(c, marketStar(c.season), sport, pick(ROLES[sport])).id;
  });
  // Always offer an affordable option for positions your club still has empty.
  if (c.lineups) {
    let extra = 0;
    SPORT_IDS.forEach((sport) =>
      ROLES[sport].forEach((role) => {
        if (extra >= CAREER_CONFIG.coverageAgents || c.lineups[sport][role]) return;
        const covered = fa.some((id) => c.players[id].sport === sport && c.players[id].pos === role);
        if (covered) return;
        fa.push(makePlayer(c, Math.random() < 0.7 ? 1 : 2, sport, role).id);
        extra += 1;
      })
    );
  }
  c.freeAgents = fa;
}

function makeSchedule(n, season) {
  const ids = Array.from({ length: n }, (_, i) => i);
  const out = [];
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = ids[i];
      const b = ids[n - 1 - i];
      const home = (r + i + season) % 2 ? a : b;
      out.push({ week: r, sport: null, home, away: home === a ? b : a, result: null }); // the sport is picked when the match is played
    }
    ids.splice(1, 0, ids.pop()); // circle-method rotation
  }
  return out;
}

export function newCareer(club) {
  const CC = CAREER_CONFIG;
  const c = { version: 2, nextId: 1, sigs: {}, season: 1, week: 0, phase: 'regular', coins: CC.startingCoins, players: {}, teams: [], lineups: emptyLineups(), schedule: [], playoffs: null, freeAgents: [], news: [], lastReport: null, offseason: null, history: [] };
  const user = { name: club.name, primary: club.primary, secondary: club.secondary, roster: [] };
  c.teams.push(user);
  // Free starter squad: it does NOT fill every position, so you have to buy the rest.
  SPORT_IDS.forEach((sport) => {
    const roles = shuffle(ROLES[sport]).slice(0, CC.freeStartersPerSport[sport]);
    roles.forEach((role) => {
      const p = makePlayer(c, 1, sport, role);
      p.contract = 2;
      user.roster.push(p.id);
      c.lineups[sport][role] = p.id;
    });
  });
  CC.rivals.forEach((r) => {
    const t = { ...r, roster: [] };
    SPORT_IDS.forEach((sport) => ROLES[sport].forEach((role) => t.roster.push(makePlayer(c, rivalStar(CC.rivalStarsMean), sport, role).id)));
    c.teams.push(t);
  });
  c.schedule = makeSchedule(c.teams.length, c.season);
  refreshFreeAgents(c);
  addNews(c, `${club.name} founded! Your free squad only covers some positions: fill every role of a sport in the MARKET before you can play it.`);
  return c;
}

export const seasonWeeks = (c) => c.teams.length - 1;

export function standings(c) {
  const rows = c.teams.map((_, i) => ({ i, w: 0, l: 0, t: 0, pf: 0, pa: 0 }));
  c.schedule.forEach((f) => {
    if (!f.result) return;
    const [h, a] = f.result.scores;
    rows[f.home].pf += h;
    rows[f.home].pa += a;
    rows[f.away].pf += a;
    rows[f.away].pa += h;
    if (h > a) {
      rows[f.home].w++;
      rows[f.away].l++;
    } else if (a > h) {
      rows[f.away].w++;
      rows[f.home].l++;
    } else {
      rows[f.home].t++;
      rows[f.away].t++;
    }
  });
  return rows.sort((x, y) => y.w * 2 + y.t - (x.w * 2 + x.t) || y.pf - y.pa - (x.pf - x.pa) || y.pf - x.pf);
}

export const teamPlayers = (c, i) => c.teams[i].roster.map((id) => c.players[id]);

/** Players whose abilities are active for team i in a given sport. */
/** Players whose abilities are active for team i in a given sport. */
export function activeFor(c, i, sport) {
  return Object.values(rosterFor(c, i, sport)).filter(Boolean);
}

export function teamRating(c, i, sport) {
  const r = Object.values(rosterFor(c, i, sport)).map((p) => (!p ? 0.5 : isHappy(p) ? p.stars : p.stars * 0.6));
  return r.reduce((s, v) => s + v, 0) / r.length;
}

export function cpuWeightsForRating(r) {
  const D = GAME_CONFIG.cpu.difficulties;
  const t = clamp((r - 1) / 4, 0, 1);
  const [A, B, u] = t < 0.5 ? [D.rookie.tierWeights, D.pro.tierWeights, t * 2] : [D.pro.tierWeights, D.legend.tierWeights, (t - 0.5) * 2];
  const w = {};
  Object.keys(A).forEach((k) => (w[k] = lerp(A[k], B[k], u)));
  return w;
}

function simScore(sport) {
  if (sport === 'football') {
    const w = 7 * randInt(2, 5) + (Math.random() < 0.3 ? 3 : 0);
    return [w, 7 * randInt(0, Math.floor(w / 7) - 1) + (Math.random() < 0.2 ? 2 : 0)];
  }
  if (sport === 'tennis') {
    if (Math.random() < 0.8) return [7, randInt(0, 5)];
    const w = randInt(8, 10);
    return [w, w - 2];
  }
  if (sport === 'basketball') {
    const w = randInt(14, 30);
    return [w, w - randInt(2, 10)];
  }
  const w = randInt(2, 5);
  return [w, Math.max(0, w - randInt(1, 2))];
}

function simFixture(c, f) {
  if (!f.sport) f.sport = pick(SPORT_IDS);
  const rh = teamRating(c, f.home, f.sport) + 0.15;
  const ra = teamRating(c, f.away, f.sport);
  const homeWins = Math.random() < 1 / (1 + Math.exp(-(rh - ra) * 1.3));
  const [w, l] = simScore(f.sport);
  f.result = { scores: homeWins ? [w, l] : [l, w] };
}

const winnerOf = (f) => (f.result.scores[0] >= f.result.scores[1] ? f.home : f.away); // ties go to the higher seed (home)
const isMine = (f) => !f.result && (f.home === 0 || f.away === 0);

export function currentFixture(c) {
  if (c.phase === 'regular') return c.schedule.find((f) => f.week === c.week && isMine(f)) || null;
  if (c.phase === 'playoffs') return (c.playoffs.round === 'semi' ? c.playoffs.semis : [c.playoffs.final]).find(isMine) || null;
  return null;
}

function startPlayoffs(c) {
  const R = CAREER_CONFIG.rewards;
  const seeds = standings(c)
    .slice(0, 4)
    .map((r) => r.i);
  c.phase = 'playoffs';
  c.playoffs = {
    round: 'semi',
    seeds,
    semis: [
      { home: seeds[0], away: seeds[3], sport: null, result: null, label: 'SEMIFINAL' },
      { home: seeds[1], away: seeds[2], sport: null, result: null, label: 'SEMIFINAL' },
    ],
    final: null,
    champion: null,
  };
  if (seeds.includes(0)) {
    c.coins += R.playoffBerth;
    addNews(c, `PLAYOFFS! ${c.teams[0].name} clinch the #${seeds.indexOf(0) + 1} seed (+${R.playoffBerth} coins).`);
  } else addNews(c, `${c.teams[0].name} miss the playoffs. Time to rebuild.`);
}

function endSeason(c) {
  const R = CAREER_CONFIG.rewards;
  const champ = c.playoffs.champion;
  const finish = standings(c).findIndex((r) => r.i === 0) + 1;
  const prize = champ === 0 ? R.title : 0;
  c.coins += prize;
  c.teams[0].roster.forEach((id) => (c.players[id].contract -= 1));
  const expiring = c.teams[0].roster.filter((id) => c.players[id].contract <= 0);
  c.offseason = { champion: champ, finish, prize, expiring };
  c.history.push({ season: c.season, champion: c.teams[champ].name, finish, won: champ === 0 });
  c.phase = 'offseason';
  addNews(c, champ === 0 ? `CHAMPIONS! ${c.teams[0].name} win the Season ${c.season} title! (+${R.title})` : `${c.teams[champ].name} win the Season ${c.season} championship.`);
}

/** Simulate every non-user fixture until the user has a match to play, or the season ends. */
/** Simulate every non-user fixture until the user has a match to play, or the season ends. */
function advance(c) {
  for (let guard = 0; guard < 50; guard++) {
    if (c.phase === 'regular') {
      const week = c.schedule.filter((f) => f.week === c.week);
      week.forEach((f) => !f.result && f.home !== 0 && f.away !== 0 && simFixture(c, f));
      if (!week.every((f) => f.result)) return;
      c.week += 1;
      refreshFreeAgents(c);
      Object.values(c.players).forEach((p) => (p.refused = null));
      if (c.week >= seasonWeeks(c)) startPlayoffs(c);
    } else if (c.phase === 'playoffs') {
      const P = c.playoffs;
      const round = P.round === 'semi' ? P.semis : [P.final];
      round.forEach((f) => !f.result && f.home !== 0 && f.away !== 0 && simFixture(c, f));
      if (!round.every((f) => f.result)) return;
      if (P.round === 'semi') {
        const [a, b] = P.semis.map(winnerOf);
        P.final = { home: a, away: b, sport: null, result: null, label: 'CHAMPIONSHIP' };
        P.round = 'final';
        if (a !== 0 && b !== 0 && P.semis.some((f) => f.home === 0 || f.away === 0)) addNews(c, `${c.teams[0].name} were knocked out in the semifinals.`);
      } else {
        P.champion = winnerOf(P.final);
        P.round = 'done';
        endSeason(c);
        return;
      }
    } else return;
  }
}

/** Apply the result of the user's match: score, coins, wages, morale, then sim the rest of the round. */
export function finishUserMatch(c0, res) {
  const c = clone(c0);
  const CC = CAREER_CONFIG;
  const R = CC.rewards;
  const f = currentFixture(c);
  if (!f) return c;
  f.sport = res.sport || f.sport || 'soccer';
  const userHome = f.home === 0;
  const rival = userHome ? f.away : f.home;
  const [us, them] = res.forfeit ? CC.forfeitScores[f.sport] : res.scores;
  f.result = { scores: userHome ? [us, them] : [them, us], forfeit: !!res.forfeit };
  const outcome = us > them ? 'win' : us < them ? 'loss' : 'draw';
  const playoff = c.phase === 'playoffs';
  const base = R[outcome] + (outcome !== 'loss' ? R.perSeason * (c.season - 1) : 0);
  const tiers = res.stats ? res.stats.tiers : { 4: 0, 5: 0 };
  const bonus = tiers[5] * R.tier5 + tiers[4] * R.tier4;
  const playoffBonus = playoff && outcome === 'win' ? R.playoffWin : 0;
  const roster = teamPlayers(c, 0);
  const wages = roster.reduce((s, p) => s + p.salary, 0);
  c.coins += base + bonus + playoffBonus;
  const paid = c.coins >= wages;
  c.coins = Math.max(0, c.coins - wages);
  const starters = new Set(Object.values(c.lineups[f.sport]).filter(Boolean));
  roster.forEach((p) => {
    let d = CC.morale[outcome];
    if (p.sport === f.sport) d += starters.has(p.id) ? CC.morale.starterBonus : CC.morale.benchedPenalty;
    if (!paid) d += CC.morale.unpaid;
    p.morale = clamp(p.morale + d, 0, 100);
  });
  c.lastReport = { rival: c.teams[rival].name, sport: f.sport, scores: [us, them], outcome, base, bonus, playoffBonus, wages, paid, label: playoff ? f.label : `WEEK ${c.week + 1}`, forfeit: !!res.forfeit };
  addNews(c, `${res.forfeit ? 'FORFEIT' : outcome.toUpperCase()} ${us}-${them} vs ${c.teams[rival].name} (${SPORT_INFO[f.sport].label}).`);
  if (!paid) addNews(c, `Couldn't cover ${wages} in wages. Morale is tanking!`);
  advance(c);
  return c;
}

export function startNextSeason(c0) {
  const c = clone(c0);
  const CC = CAREER_CONFIG;
  const leaving = c.teams[0].roster.filter((id) => c.players[id].contract <= 0);
  leaving.forEach((id) => {
    addNews(c, `${c.players[id].name} walked out when their contract expired.`);
    removeFromLineup(c, id);
    delete c.players[id];
  });
  c.teams[0].roster = c.teams[0].roster.filter((id) => !leaving.includes(id));
  c.season += 1;
  teamPlayers(c, 0).forEach((p) => {
    if (p.stars < 5 && p.morale >= 70 && Math.random() < CC.userDevelopChance) {
      upgradeStars(p);
      addNews(c, `DEVELOPMENT: ${p.name} is now a ${p.stars}-star player!`);
    }
    p.morale = Math.round(lerp(p.morale, CC.morale.start, 0.5));
  });
  const mean = CC.rivalStarsMean + (c.season - 1) * CC.rivalStarsPerSeason;
  c.teams.slice(1).forEach((t, k) => {
    const ti = k + 1;
    teamPlayers(c, ti).forEach((p) => p.stars < 5 && Math.random() < CC.rivalDevelopChance && upgradeStars(p));
    for (let n = 0; n < 2; n++) {
      const weakest = teamPlayers(c, ti).sort((a, b) => a.stars - b.stars)[0];
      if (!weakest) break;
      const fresh = makePlayer(c, Math.max(weakest.stars, rivalStar(mean)), weakest.sport, weakest.pos);
      t.roster = t.roster.filter((id) => id !== weakest.id).concat(fresh.id);
      delete c.players[weakest.id];
    }
  });
  c.week = 0;
  c.phase = 'regular';
  c.playoffs = null;
  c.offseason = null;
  c.lastReport = null;
  c.schedule = makeSchedule(c.teams.length, c.season);
  refreshFreeAgents(c);
  addNews(c, `Season ${c.season} kicks off. Every rival has reloaded.`);
  return c;
}

// --- Market & roster actions: each returns { c, ok, msg } -------------------------

function joinClub(c, p) {
  c.teams[0].roster.push(p.id);
  if (!c.lineups[p.sport][p.pos] || !c.players[c.lineups[p.sport][p.pos]]) c.lineups[p.sport][p.pos] = p.id;
  p.contract = randInt(2, 3);
  p.refused = null;
  p.morale = clamp(p.morale + CAREER_CONFIG.morale.newSigning, 0, 100);
}

export function buyPlayer(c0, id) {
  const c = clone(c0);
  const p = c.players[id];
  if (!p || !c.freeAgents.includes(id)) return { ok: false, msg: 'That player is no longer available.' };
  if (c.teams[0].roster.length >= CAREER_CONFIG.rosterMax) return { ok: false, msg: `Roster full (${CAREER_CONFIG.rosterMax}). Sell someone first.` };
  if (c.coins < p.value) return { ok: false, msg: `Not enough coins: ${p.name} costs ${p.value}.` };
  c.coins -= p.value;
  c.freeAgents = c.freeAgents.filter((x) => x !== id);
  joinClub(c, p);
  const starts = c.lineups[p.sport][p.pos] === p.id;
  addNews(c, `SIGNED ${p.name} (${p.stars}-STAR ${p.pos}, ${p.sport.toUpperCase()}) for ${p.value}.`);
  return { c, ok: true, msg: `${p.name} signed${starts ? ` and starts at ${p.pos}` : ' (on the bench)'}!` };
}

export function sellPlayer(c0, id) {
  const c = clone(c0);
  const p = c.players[id];
  if (!p || !c.teams[0].roster.includes(id)) return { ok: false, msg: 'Not on your roster.' };
  const fee = Math.round(p.value * CAREER_CONFIG.sellRatio);
  c.coins += fee;
  c.teams[0].roster = c.teams[0].roster.filter((x) => x !== id);
  removeFromLineup(c, id);
  delete c.players[id];
  addNews(c, `SOLD ${p.name} for ${fee}.`);
  return { c, ok: true, msg: `Sold ${p.name} for ${fee} coins.${missingRoles(c, p.sport).includes(p.pos) ? ` Your ${p.sport} ${p.pos} slot is now empty.` : ''}` };
}

/** Put a player into their position's lineup slot (benching whoever was there), or bench them. */
export function toggleStarter(c0, id) {
  const c = clone(c0);
  const p = c.players[id];
  if (!p) return { ok: false, msg: 'Player not found.' };
  if (c.lineups[p.sport][p.pos] === id) {
    c.lineups[p.sport][p.pos] = null;
    return { c, ok: true, msg: `${p.name} benched. Your ${p.pos} slot is empty until you start someone.` };
  }
  const prev = c.lineups[p.sport][p.pos] ? c.players[c.lineups[p.sport][p.pos]] : null;
  c.lineups[p.sport][p.pos] = id;
  return { c, ok: true, msg: `${p.name} now starts at ${p.pos}${prev ? ` (replacing ${prev.name})` : ''}.` };
}

export function offerChance(c, teamIdx, p, offer) {
  const st = standings(c);
  const ru = st.findIndex((r) => r.i === 0);
  const rr = st.findIndex((r) => r.i === teamIdx);
  return clamp(offer.chance + (rr - ru) * 0.04 - (p.stars - 3) * 0.05, 0.05, 0.97);
}

export function offerForPlayer(c0, teamIdx, id, offerId) {
  const c = clone(c0);
  const p = c.players[id];
  const t = c.teams[teamIdx];
  const offer = CAREER_CONFIG.offers.find((o) => o.id === offerId);
  const price = Math.round(p.value * offer.mult);
  if (p.refused) return { ok: false, msg: `${p.name} won't talk again until next week.` };
  if (c.teams[0].roster.length >= CAREER_CONFIG.rosterMax) return { ok: false, msg: 'Roster full. Sell someone first.' };
  if (c.coins < price) return { ok: false, msg: `You need ${price} coins for that offer.` };
  if (Math.random() >= offerChance(c, teamIdx, p, offer)) {
    p.refused = true;
    return { c, ok: false, msg: `${t.name} rejected your ${offer.label} offer for ${p.name}.` };
  }
  c.coins -= price;
  t.roster = t.roster.filter((x) => x !== id);
  const replacement = makePlayer(c, Math.max(1, p.stars - 1), p.sport, p.pos);
  t.roster.push(replacement.id);
  joinClub(c, p);
  addNews(c, `POACHED ${p.name} from ${t.name} for ${price}!`);
  return { c, ok: true, msg: `Deal! ${p.name} joins from ${t.name}.` };
}

export function resignPlayer(c0, id) {
  const c = clone(c0);
  const p = c.players[id];
  const fee = Math.round(p.value * CAREER_CONFIG.resignFeeRatio);
  if (!isHappy(p)) return { ok: false, msg: `${p.name} is unhappy and refuses to re-sign.` };
  if (c.coins < fee) return { ok: false, msg: `Re-signing ${p.name} costs ${fee} coins.` };
  c.coins -= fee;
  p.contract = randInt(2, 3);
  c.offseason.expiring = c.offseason.expiring.filter((x) => x !== id);
  addNews(c, `RE-SIGNED ${p.name} for ${p.contract} seasons.`);
  return { c, ok: true, msg: `${p.name} re-signed for ${p.contract} seasons.` };
}

export function loadCareer() {
  try {
    const raw = window.localStorage.getItem(CAREER_CONFIG.saveKey);
    return raw ? migrateCareer(JSON.parse(raw)) : null;
  } catch (e) {
    return null;
  }
}

export function saveCareer(c) {
  try {
    window.localStorage.setItem(CAREER_CONFIG.saveKey, JSON.stringify(c));
  } catch (e) {
    /* storage blocked: career still works for this session */
  }
}

/* =============================================================================
   6. APP_UI
============================================================================= */
const COLOR_SWATCHES = ['#e63946', '#f77f00', '#fcbf49', '#06d6a0', '#2a9d8f', '#457b9d', '#1d3557', '#7b2cbf', '#ff4d9d', '#f1faee', '#222222', '#8d5524'];
// Team colors used as text on the dark UI: lift very dark jerseys to a readable grey.
function inkFor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#e2e8f0';
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum < 0.32 ? '#cbd5e1' : hex;
}
const TONE_COLORS = { great: '#06d6a0', good: '#4cc9f0', meh: '#f4a261', bad: '#ef476f' };
const FONT_STYLE = { fontFamily: PIXEL_FONT };
// Side gutter that also clears a phone's side system bar.
const GUTTER = { paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' };

// Where the source lives, and a standalone single-file copy that runs offline.
const REPO_URL = 'https://github.com/siddharthsivaramancode/krillion-sports-spinoff';
const DOWNLOAD_URL = `${REPO_URL}/blob/main/retro-clash.html`;

function SideLinks({ rail = true }) {
  const link = 'border-2 border-black bg-[#1b1736] px-2 py-2 text-[8px] text-white shadow-[2px_2px_0_#000] hover:bg-[#2a2450] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffd23f]';
  return (
    <>
      {/* desktop: a rail pinned to the right edge */}
      <nav aria-label="Project links" className={`fixed top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-2 ${rail ? '2xl:flex' : ''}`} style={{ right: 'max(8px, env(safe-area-inset-right, 0px))' }}>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={link} style={{ ...FONT_STYLE, writingMode: 'vertical-rl' }}>
          GITHUB ↗
        </a>
        <a href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" className={`${link} text-[#ffd23f]`} style={{ ...FONT_STYLE, writingMode: 'vertical-rl' }} title="Open the standalone HTML file on GitHub, then use 'Download raw file'">
          DOWNLOAD HTML ↓
        </a>
      </nav>
      {/* phones/tablets: compact links in the top bar */}
      <span className={`flex gap-2 ${rail ? '2xl:hidden' : ''}`}>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="hidden whitespace-nowrap border-2 border-black bg-[#1b1736] px-2 py-1 text-[9px] text-white shadow-[2px_2px_0_#000] sm:inline-block" style={FONT_STYLE}>
          GITHUB
        </a>
        <a href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap border-2 border-black bg-[#1b1736] px-2 py-1 text-[9px] text-[#ffd23f] shadow-[2px_2px_0_#000]" style={FONT_STYLE} title="Standalone HTML file">
          ↓ HTML
        </a>
      </span>
    </>
  );
}

const SPORT_INFO = {
  football: { id: 'football', label: 'FOOTBALL', icon: '🏈', head: 'helmet', blurb: '5-on-5. Hike, scramble with WASD and throw. Every throw is a question: rare answers hit your receiver in stride, obvious ones get picked off.' },
  basketball: { id: 'basketball', label: 'BASKETBALL', icon: '🏀', head: 'hair', blurb: '5-on-5 full court. Dribble with WASD, pass to switch players, shoot from anywhere. Rare answers splash threes, obvious ones get blocked.' },
  soccer: { id: 'soccer', label: 'SOCCER', icon: '⚽', head: 'hair', blurb: '5-a-side. Dribble with WASD, pass to switch players, shoot to score. Rare answers find the top corner, obvious ones get smothered.' },
  tennis: { id: 'tennis', label: 'TENNIS', icon: '🎾', head: 'hair', blurb: 'Tiebreak to 7. Run to the ball with WASD; every shot is a question. Rare answers are aces and winners, obvious ones get smashed back.' },
};

const DEFAULT_SETUP = {
  sport: 'soccer',
  mode: '1p',
  difficulty: 'pro',
  teams: [
    { name: 'NEON KNIGHTS', primary: '#e63946', secondary: '#fcbf49' },
    { name: 'CPU CYBORGS', primary: '#457b9d', secondary: '#f1faee' },
  ],
};

function useFontLoader() {
  useEffect(() => {
    const id = 'retro-clash-font';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap';
    document.head.appendChild(link);
  }, []);
}

// Fires `handler` on Enter/Space while `active`; ignores the keypress that opened it.
function useConfirmKey(handler, active = true) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!active) return undefined;
    const armedAt = performance.now() + 300;
    const onKey = (e) => {
      if (performance.now() < armedAt) return;
      if (e.key === 'Enter' || (e.key === ' ' && e.target.tagName !== 'INPUT')) {
        e.preventDefault();
        ref.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);
}

function TierChip({ tier, small }) {
  const t = GAME_CONFIG.tiers[tier];
  return (
    <span className={`inline-block border-2 border-black ${small ? 'px-1 text-[8px]' : 'px-2 py-1 text-[10px]'}`} style={{ background: t.color, color: '#111' }}>
      {'★'.repeat(tier)}
      {'☆'.repeat(5 - tier)} {t.label}
    </span>
  );
}

function PixelButton({ children, onClick, color = '#ffd23f', textColor = '#111', className = '', disabled, type = 'button' }) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={(e) => {
        SOUND_ENGINE.unlock();
        SOUND_ENGINE.play('select');
        onClick && onClick(e);
      }}
      className={`border-4 border-black px-4 py-3 text-xs uppercase shadow-[4px_4px_0_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#000] disabled:opacity-40 ${className}`}
      style={{ background: color, color: textColor }}
    >
      {children}
    </button>
  );
}

function SpritePreview({ primary, secondary, head, pose = 'stand', scale = 5, skin, hair }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, c.width, c.height);
    const spr = getSprite(pose, head, primary, secondary, false, skin, hair);
    g.drawImage(spr, Math.round((c.width - spr.width * scale) / 2), c.height - spr.height * scale, spr.width * scale, spr.height * scale);
  }, [primary, secondary, head, pose, scale, skin, hair]);
  return <canvas ref={ref} width={12 * scale} height={12 * scale} style={{ imageRendering: 'pixelated' }} />;
}

function ColorPicker({ label, value, onChange }) {
  return (
    <div>
      <div className="mb-1 text-[8px] text-slate-300">{label}</div>
      <div className="flex flex-wrap items-center gap-1">
        {COLOR_SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`${label} ${c}`}
            onClick={() => onChange(c)}
            className={`h-5 w-5 border-2 ${value.toLowerCase() === c ? 'border-white ring-2 ring-yellow-300' : 'border-black'}`}
            style={{ background: c }}
          />
        ))}
        <label className="relative ml-1 h-5 w-5 cursor-pointer border-2 border-black" title="Custom color" style={{ background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }}>
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        </label>
      </div>
    </div>
  );
}

function TeamCard({ index, team, onChange, isCPU, head }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % 4), 220);
    return () => clearInterval(id);
  }, []);
  const poses = ['stand', 'run1', 'stand', 'run2'];
  return (
    <div className="border-4 border-black bg-[#1b1736] p-3 shadow-[4px_4px_0_#000]">
      <div className="mb-2 flex items-center justify-between text-[10px]">
        <span style={{ color: team.primary }}>{index === 0 ? 'HOME' : 'AWAY'}</span>
        <span className="text-slate-400">{isCPU ? 'CPU' : `PLAYER ${index + 1}`}</span>
      </div>
      <div className="flex gap-3">
        <div className="flex items-end gap-1 border-2 border-black bg-[#3d9140] px-1 pt-2">
          <SpritePreview primary={team.primary} secondary={team.secondary} head={head} pose={poses[frame]} />
          <SpritePreview primary={team.primary} secondary={team.secondary} head={head} pose="armsUp" scale={3} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <input
            value={team.name}
            maxLength={14}
            onChange={(e) => onChange({ ...team, name: e.target.value.toUpperCase() })}
            className="w-full border-2 border-black bg-black px-2 py-2 text-[10px] text-white outline-none focus:border-yellow-300"
            aria-label="Team name"
            style={FONT_STYLE}
          />
          <ColorPicker label="PRIMARY" value={team.primary} onChange={(primary) => onChange({ ...team, primary })} />
          <ColorPicker label="SECONDARY" value={team.secondary} onChange={(secondary) => onChange({ ...team, secondary })} />
        </div>
      </div>
    </div>
  );
}

function SetupScreen({ initial, onStart }) {
  const [setup, setSetup] = useState(initial);
  const info = SPORT_INFO[setup.sport] || SPORT_INFO.soccer;
  const setTeam = (i, t) => setSetup((s) => ({ ...s, teams: s.teams.map((x, j) => (j === i ? t : x)) }));
  const start = () => {
    const teams = setup.teams.map((t, i) => ({ ...t, name: t.name.trim() || (i === 0 ? 'HOME' : 'AWAY'), isCPU: setup.mode === '1p' && i === 1, roster: quickRoster(setup.sport, 2) }));
    onStart({ ...setup, teams });
  };
  return (
    <div className="m-auto flex w-full max-w-6xl flex-col gap-5">
      <h1 className="text-center text-xl leading-relaxed text-[#ffd23f] sm:text-3xl" style={{ textShadow: '3px 3px 0 #e63946, 6px 6px 0 #000' }}>
        QUICK MATCH
      </h1>
      <section>
        <div className="mb-2 text-[10px] text-slate-400">1. PICK A SPORT</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.values(SPORT_INFO).map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => {
                SOUND_ENGINE.unlock();
                SOUND_ENGINE.play('select');
                setSetup((s) => ({ ...s, sport: e.id }));
              }}
              className={`border-4 border-black p-3 text-left shadow-[4px_4px_0_#000] transition-transform hover:-translate-y-1 ${setup.sport === e.id ? 'bg-[#ffd23f] text-black' : 'bg-[#1b1736] text-white'}`}
              style={FONT_STYLE}
            >
              <div className="text-2xl">{e.icon}</div>
              <div className="mt-1 text-[11px]">{e.label}</div>
              <div className={`mt-2 text-[8px] leading-relaxed ${setup.sport === e.id ? 'text-black/70' : 'text-slate-400'}`}>{e.blurb}</div>
            </button>
          ))}
        </div>
      </section>
      <section className="flex flex-wrap items-end gap-4">
        <div>
          <div className="mb-2 text-[10px] text-slate-400">2. PLAYERS</div>
          <div className="flex gap-2">
            {[
              ['1p', '1P VS CPU'],
              ['2p', '2P SAME KEYBOARD'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setSetup((s) => ({ ...s, mode: id, teams: s.teams.map((t, i) => (i === 1 && id === '2p' && t.name === 'CPU CYBORGS' ? { ...t, name: 'PIXEL PIRATES' } : i === 1 && id === '1p' && t.name === 'PIXEL PIRATES' ? { ...t, name: 'CPU CYBORGS' } : t)) }))}
                className={`border-4 border-black px-3 py-2 text-[10px] shadow-[3px_3px_0_#000] ${setup.mode === id ? 'bg-[#4cc9f0] text-black' : 'bg-[#1b1736] text-white'}`}
                style={FONT_STYLE}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {setup.mode === '1p' ? (
          <div>
            <div className="mb-2 text-[10px] text-slate-400">CPU SKILL</div>
            <div className="flex gap-2">
              {Object.entries(GAME_CONFIG.cpu.difficulties).map(([id, d]) => (
                <button key={id} type="button" onClick={() => setSetup((s) => ({ ...s, difficulty: id }))} className={`border-4 border-black px-3 py-2 text-[10px] shadow-[3px_3px_0_#000] ${setup.difficulty === id ? 'bg-[#c77dff] text-black' : 'bg-[#1b1736] text-white'}`} style={FONT_STYLE}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-[8px] leading-relaxed text-slate-400">P1: WASD + F / G · P2: ARROWS + K / L</div>
        )}
      </section>
      <section>
        <div className="mb-2 text-[10px] text-slate-400">3. TEAMS & JERSEYS</div>
        <div className="grid gap-4 md:grid-cols-2">
          {setup.teams.map((t, i) => (
            <TeamCard key={i} index={i} team={t} isCPU={setup.mode === '1p' && i === 1} head={info.head} onChange={(nt) => setTeam(i, nt)} />
          ))}
        </div>
      </section>
      <div className="flex justify-center pb-4">
        <PixelButton onClick={start} className="px-10 text-sm">
          ▶ PLAY {info.label}
        </PixelButton>
      </div>
    </div>
  );
}

function PromptPanel({ prompt, team, seconds, onSubmit, onTimeout, hint, bonusSeconds }) {
  const [text, setText] = useState('');
  const [left, setLeft] = useState(seconds);
  const [notice, setNotice] = useState(null);
  const doneRef = useRef(false);
  const inputRef = useRef(null);
  const timeoutRef = useRef(onTimeout);
  timeoutRef.current = onTimeout;

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
    const end = performance.now() + seconds * 1000;
    let lastWhole = Math.ceil(seconds);
    const id = setInterval(() => {
      const rem = Math.max(0, (end - performance.now()) / 1000);
      setLeft(rem);
      const whole = Math.ceil(rem);
      if (whole < lastWhole) {
        lastWhole = whole;
        if (whole <= 5 && whole > 0) SOUND_ENGINE.play('tick');
      }
      if (rem <= 0 && !doneRef.current) {
        doneRef.current = true;
        clearInterval(id);
        timeoutRef.current();
      }
    }, 50);
    return () => clearInterval(id);
  }, [seconds]);

  const submit = (e) => {
    e.preventDefault();
    if (doneRef.current || !text.trim()) return;
    doneRef.current = true;
    const retryMsg = onSubmit(text);
    if (typeof retryMsg === 'string') {
      // a SECOND WIND retry was used: keep the clock running and let them type again
      doneRef.current = false;
      setText('');
      setNotice(retryMsg);
      if (inputRef.current) inputRef.current.focus();
    }
  };
  const pct = (left / seconds) * 100;
  const barColor = left <= 5 ? '#ef476f' : left <= 9 ? '#ffd23f' : '#06d6a0';
  return (
    <form onSubmit={submit} className="border-4 border-t-0 border-black bg-[#1b1736] p-3">
      <div className="mb-2 flex items-center justify-between text-[8px]">
        <span className="border-2 border-black bg-black px-2 py-1 text-[#c77dff]">{prompt.category}</span>
        <span style={{ color: inkFor(team.primary) }}>{team.name} ON THE CLOCK</span>
      </div>
      <div className="mb-3 text-center text-[11px] leading-relaxed text-white sm:text-sm">{prompt.prompt}</div>
      {hint && (
        <div className="mb-3 text-center text-[8px] leading-relaxed text-[#4cc9f0]">
          ⚡ FILM STUDY ({hint.src}): a T{hint.tier} answer looks like <span className="tracking-[0.2em] text-white">{hint.text}</span>
        </div>
      )}
      <div className="mb-3 h-4 w-full border-2 border-black bg-black">
        <div className="h-full transition-[width] duration-75 ease-linear" style={{ width: `${pct}%`, background: barColor }} />
      </div>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="TYPE AN ANSWER"
          maxLength={48}
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 border-4 border-black bg-black px-3 py-3 text-[11px] text-white placeholder-slate-600 outline-none focus:border-[#ffd23f]"
          style={FONT_STYLE}
        />
        <PixelButton type="submit" disabled={!text.trim()}>
          GO
        </PixelButton>
      </div>
      {notice && <div className="mt-2 text-[8px] leading-relaxed text-[#ffd23f]">⚡ {notice}</div>}
      <div className="mt-2 flex justify-between text-[8px] text-slate-500">
        <span>
          {Math.ceil(left)}s{bonusSeconds ? <span className="text-[#4cc9f0]"> (+{bonusSeconds}s CLOCK MANAGER)</span> : null}
        </span>
        <span className="hidden sm:inline">T1-T2 ANSWERS RISK A COUNTER-ATTACK</span>
      </div>
    </form>
  );
}

const SPORT_ICON = { football: '🏈', tennis: '🎾', soccer: '⚽' };
const KIND_COLOR = { TRIVIA: '#4cc9f0', RISK: '#06d6a0', STAT: '#f4a261', SPECIALIST: '#c77dff' };
const FA_COLORS = { primary: '#8d99ae', secondary: '#edf2f4' };

// The pixel font has no star glyph, so stars are drawn as tiny crisp SVGs.
function StarIcon({ on = true, size = 9 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden="true" className="inline-block align-[-1px]">
      <polygon points="5,0 6.2,3.6 10,3.6 6.9,5.8 8.1,9.5 5,7.2 1.9,9.5 3.1,5.8 0,3.6 3.8,3.6" fill={on ? '#ffd23f' : '#334155'} />
    </svg>
  );
}

function Stars({ n }) {
  return (
    <span className="inline-flex shrink-0 gap-[1px]" role="img" aria-label={`${n} stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon key={i} on={i <= n} />
      ))}
    </span>
  );
}

function SmallBtn({ children, onClick, disabled, color = '#ffd23f', title }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={(e) => {
        SOUND_ENGINE.unlock();
        onClick && onClick(e);
      }}
      className="border-2 border-black px-2 py-1 text-[8px] text-black shadow-[2px_2px_0_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-40"
      style={{ background: color, ...FONT_STYLE }}
    >
      {children}
    </button>
  );
}

function PlayerCard({ p, colors, children, footer, starter }) {
  const a = p.ability;
  const kind = ABILITIES[a.key].kind;
  const happy = p.morale >= CAREER_CONFIG.morale.unhappyBelow;
  return (
    <div className={`flex gap-3 border-4 bg-[#1b1736] p-2 shadow-[3px_3px_0_#000] ${starter ? 'border-[#06d6a0]' : 'border-black'}`}>
      <div className="flex shrink-0 items-end self-start border-2 border-black bg-[#3d9140] px-1 pt-1">
        <SpritePreview primary={colors.primary} secondary={colors.secondary} head={SPORT_INFO[p.sport].head} skin={p.skin} hair={p.hair} scale={4} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 truncate text-[10px] text-white">{p.name}</div>
          <Stars n={p.stars} />
        </div>
        <div className="mt-1 text-[8px] text-slate-400">
          {SPORT_INFO[p.sport].icon} <span className="text-white">{p.pos}</span> · {ROLE_NAMES[p.pos]}
          {starter && <span className="text-[#06d6a0]"> · STARTER</span>}
        </div>
        <div className="mt-2 text-[8px]" style={{ color: KIND_COLOR[kind] }}>
          ⚡ {abilityName(a)} <span className="text-slate-500">· {kind}</span>
        </div>
        <div className="mt-1 text-[8px] leading-relaxed text-slate-300">
          {abilityDesc(a)}
          {!happy && <span className="text-[#ef476f]"> (UNHAPPY: ABILITY OFF)</span>}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[7px] text-slate-400">{footer}</div>
        {children && <div className="mt-2 flex flex-wrap gap-2">{children}</div>}
      </div>
    </div>
  );
}

function MoraleBar({ value }) {
  return (
    <span className="flex items-center gap-1">
      MORALE
      <span className="inline-block h-2 w-12 border border-black bg-black">
        <span className="block h-full" style={{ width: `${value}%`, background: value >= 60 ? '#06d6a0' : value >= CAREER_CONFIG.morale.unhappyBelow ? '#ffd23f' : '#ef476f' }} />
      </span>
    </span>
  );
}

function Panel({ title, right, children }) {
  return (
    <section className="border-4 border-black bg-[#120f26] p-3 shadow-[4px_4px_0_#000]">
      {(title || right) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[10px] text-[#ffd23f]">{title}</h2>
          {right && <div className="text-[8px] text-slate-400">{right}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

function TeamBadge({ team, head = 'helmet', scale = 3 }) {
  return (
    <span className="inline-flex shrink-0 items-end border-2 border-black bg-[#3d9140] px-[2px] pt-[2px]">
      <SpritePreview primary={team.primary} secondary={team.secondary} head={head} scale={scale} />
    </span>
  );
}

function MatchPreview({ sport, teams }) {
  const ref = useRef(null);
  useEffect(() => {
    const ctx = ref.current.getContext('2d');
    const S = createArcade({ sport, mode: '1p', difficulty: 'pro', teams: teams.map((t) => ({ ...t, isCPU: true, roster: t.roster || {} })) }, { mods: [emptyMods(), emptyMods()], cpu: () => ({ kind: 'answer', tier: 3 }), cpuSkill: 1 });
    S.banner = null;
    let raf;
    const loop = (now) => {
      try {
        arcadeRender(ctx, S, now / 1000);
      } catch (e) {
        /* decorative */
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [sport, teams]);
  return <canvas ref={ref} width={CW} height={CH} className="block w-full border-4 border-black bg-black" style={{ imageRendering: 'pixelated', aspectRatio: '16 / 9' }} aria-hidden="true" />;
}

function SeasonCard({ career }) {
  const weeks = seasonWeeks(career);
  const done = career.phase === 'regular' ? career.week : weeks;
  const roster = teamPlayers(career, 0);
  const wages = roster.reduce((s, p) => s + p.salary, 0);
  const phase = career.phase === 'regular' ? 'REGULAR SEASON' : career.phase === 'playoffs' ? 'PLAYOFFS' : 'OFF-SEASON';
  return (
    <Panel title={`SEASON ${career.season}`} right={phase}>
      <div className="mb-1 flex justify-between text-[8px] text-slate-400">
        <span>WEEKS PLAYED</span>
        <span>
          {done}/{weeks}
        </span>
      </div>
      <div className="h-3 w-full border-2 border-black bg-black">
        <div className="h-full bg-[#06d6a0]" style={{ width: `${(done / weeks) * 100}%` }} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[8px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {[
          ['COINS', `${career.coins.toLocaleString()}c`, '#ffd23f'],
          ['WAGES / MATCH', `${wages}c`, '#ef476f'],
          ['ROSTER', `${roster.length}/${CAREER_CONFIG.rosterMax}`, '#fff'],
          ['TITLES', career.history.filter((h) => h.won).length, '#ffd23f'],
        ].map(([k, v, c]) => (
          <div key={k} className="border-2 border-black bg-black/40 p-2">
            <div className="text-slate-500">{k}</div>
            <div className="mt-1 text-[11px]" style={{ color: c }}>
              {v}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function MiniStandings({ career, onOpen }) {
  const st = standings(career);
  return (
    <Panel
      title="STANDINGS"
      right={
        <button type="button" onClick={onOpen} className="underline hover:text-white">
          FULL TABLE ▶
        </button>
      }
    >
      <table className="w-full text-[8px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <tbody>
          {st.map((r, k) => {
            const t = career.teams[r.i];
            return (
              <tr key={r.i} className={`border-t border-black ${k === 3 ? 'border-b-2 border-b-[#ffd23f]' : ''}`}>
                <td className="w-5 py-1 text-slate-500">{k + 1}</td>
                <td className="py-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="inline-block h-2 w-2 shrink-0 border border-black" style={{ background: t.primary }} />
                    <span className="truncate" style={{ color: r.i === 0 ? '#ffd23f' : '#e2e8f0' }}>
                      {t.name}
                    </span>
                  </span>
                </td>
                <td className="py-1 text-right text-slate-300">
                  {r.w}-{r.l}-{r.t}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}

function SquadOverview({ career, onOpen }) {
  return (
    <Panel
      title="YOUR SQUAD"
      right={
        <button type="button" onClick={onOpen} className="underline hover:text-white">
          MANAGE ROSTER ▶
        </button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {SPORT_IDS.map((sport) => {
          const missing = missingRoles(career, sport);
          const filled = ROLES[sport].length - missing.length;
          return (
            <button key={sport} type="button" onClick={onOpen} className={`border-2 p-3 text-left hover:bg-[#241f48] ${missing.length ? 'border-[#ef476f] bg-[#1b1736]' : 'border-[#06d6a0] bg-[#1b1736]'}`} style={FONT_STYLE}>
              <div className="flex items-center justify-between gap-2 text-[9px]">
                <span className="text-white">
                  {SPORT_INFO[sport].icon} {SPORT_INFO[sport].label}
                </span>
                <span className="text-slate-300">
                  <StarIcon /> {teamRating(career, 0, sport).toFixed(1)}
                </span>
              </div>
              <div className="mt-2 h-2 w-full border border-black bg-black">
                <div className="h-full" style={{ width: `${(filled / ROLES[sport].length) * 100}%`, background: missing.length ? '#ef476f' : '#06d6a0' }} />
              </div>
              <div className={`mt-2 text-[7px] ${missing.length ? 'text-[#ef476f]' : 'text-[#06d6a0]'}`}>{missing.length ? `NEED: ${missing.join(', ')}` : `READY · ${filled}/${ROLES[sport].length} POSITIONS`}</div>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

function HomeTab({ career, onPlay, act, setTab, goMarket }) {
  const f = currentFixture(career);
  const rep = career.lastReport;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
        {career.phase === 'offseason' ? (
          <OffseasonPanel career={career} act={act} />
        ) : f ? (
          <NextFixture key={`${career.season}-${career.week}-${career.phase}`} career={career} f={f} onPlay={onPlay} goMarket={goMarket} />
        ) : (
          <Panel title="WAITING">
            <div className="text-[9px] text-slate-400">No fixture right now.</div>
          </Panel>
        )}
        {rep && (
          <Panel title={`LAST RESULT · ${rep.label}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div className="text-base leading-relaxed sm:text-xl" style={{ color: rep.outcome === 'win' ? '#06d6a0' : rep.outcome === 'loss' ? '#ef476f' : '#ffd23f' }}>
                {rep.forfeit ? 'FORFEIT' : rep.outcome.toUpperCase()} {rep.scores[0]}-{rep.scores[1]}
              </div>
              <div className="text-[8px] text-slate-400">
                {SPORT_ICON[rep.sport]} vs {rep.rival}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-1 text-[8px] sm:grid-cols-4">
              <span className="text-slate-300">RESULT +{rep.base}</span>
              <span className="text-slate-300">RARE ANSWERS +{rep.bonus}</span>
              {rep.playoffBonus > 0 && <span className="text-[#06d6a0]">PLAYOFF WIN +{rep.playoffBonus}</span>}
              <span className={rep.paid ? 'text-slate-300' : 'text-[#ef476f]'}>
                WAGES -{rep.wages}
                {rep.paid ? '' : ' (UNPAID!)'}
              </span>
            </div>
          </Panel>
        )}
        <SquadOverview career={career} onOpen={() => setTab('roster')} />
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        <SeasonCard career={career} />
        <MiniStandings career={career} onOpen={() => setTab('league')} />
        <Panel title="CLUB NEWS">
          <ul className="flex flex-col gap-2">
            {career.news.slice(0, 7).map((n, i) => (
              <li key={i} className="text-[8px] leading-relaxed text-slate-300">
                {n}
              </li>
            ))}
          </ul>
        </Panel>
        {career.history.length > 0 && (
          <Panel title="TROPHY CABINET">
            <ul className="flex flex-col gap-1 text-[8px] text-slate-300">
              {career.history.map((h) => (
                <li key={h.season}>
                  S{h.season}: {h.won ? <span className="text-[#ffd23f]">🏆 CHAMPIONS</span> : `finished #${h.finish} · champion ${h.champion}`}
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </div>
  );
}

function NextFixture({ career, f, onPlay, goMarket }) {
  const rivalIdx = f.home === 0 ? f.away : f.home;
  const rival = career.teams[rivalIdx];
  const club = career.teams[0];
  const firstReady = SPORT_IDS.find((s) => missingRoles(career, s).length === 0);
  const [sport, setSport] = useState(firstReady || 'soccer');
  const missing = missingRoles(career, sport);
  const mine = activeFor(career, 0, sport);
  const theirs = activeFor(career, rivalIdx, sport);
  const myR = teamRating(career, 0, sport);
  const theirR = teamRating(career, rivalIdx, sport);
  const info = SPORT_INFO[sport];
  const label = career.phase === 'playoffs' ? f.label : `WEEK ${career.week + 1} OF ${seasonWeeks(career)}`;
  const previewTeams = useMemo(
    () => [
      { name: club.name, primary: club.primary, secondary: club.secondary, roster: rosterFor(career, 0, sport) },
      { name: rival.name, primary: rival.primary, secondary: rival.secondary, roster: rosterFor(career, rivalIdx, sport) },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [club.name, club.primary, club.secondary, rival.name, sport, career.lineups]
  );
  const unit = (team, players, rating) => (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <TeamBadge team={team} head={info.head} />
        <div className="min-w-0">
          <div className="truncate text-[10px] sm:text-xs" style={{ color: inkFor(team.primary) }}>
            {team.name}
          </div>
          <div className="mt-1 text-[8px] text-slate-400">
            LINEUP <StarIcon /> {rating.toFixed(1)}
          </div>
        </div>
      </div>
      <ul className="mt-2 flex flex-col gap-1">
        {players.map((p) => (
          <li key={p.id} className="truncate text-[7px] leading-relaxed text-slate-300 sm:text-[8px]">
            <span className="text-white">{p.pos}</span> <Stars n={p.stars} /> {p.name} · <span style={{ color: KIND_COLOR[ABILITIES[p.ability.key].kind] }}>{abilityName(p.ability)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <Panel title={`NEXT UP · ${label} · VS ${rival.name}`} right="YOU PICK THE SPORT">
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SPORT_IDS.map((s) => {
          const miss = missingRoles(career, s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => {
                SOUND_ENGINE.play('select');
                setSport(s);
              }}
              className={`border-4 border-black px-2 py-2 text-left shadow-[3px_3px_0_#000] ${sport === s ? 'bg-[#ffd23f] text-black' : 'bg-[#1b1736] text-white'}`}
              style={FONT_STYLE}
            >
              <div className="text-[10px]">
                {SPORT_INFO[s].icon} {SPORT_INFO[s].label}
              </div>
              <div className={`mt-1 text-[7px] ${miss.length ? (sport === s ? 'text-[#a4133c]' : 'text-[#ef476f]') : sport === s ? 'text-[#05603f]' : 'text-[#06d6a0]'}`}>{miss.length ? `NEED ${miss.join(', ')}` : '✓ READY'}</div>
            </button>
          );
        })}
      </div>
      <div className="relative">
        <MatchPreview sport={sport} teams={previewTeams} />
        {missing.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-3 text-center">
            <div>
              <div className="text-[10px] leading-relaxed text-[#ef476f] sm:text-sm">YOUR {info.label} LINEUP IS MISSING: {missing.join(', ')}</div>
              <div className="mt-3">
                <PixelButton onClick={() => goMarket(sport)} color="#ef476f">
                  SIGN PLAYERS ▶
                </PixelButton>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row">
        {unit(club, mine, myR)}
        <div className="self-center text-[10px] text-slate-500">VS</div>
        {unit(rival, theirs, theirR)}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-[8px] leading-relaxed text-slate-400">{missing.length ? 'Fill every position to play this sport, or pick a sport you are ready for.' : myR >= theirR + 0.4 ? "FAVOURITES. Don't get countered." : theirR >= myR + 0.4 ? 'UNDERDOGS. Go for the rare answers.' : 'EVEN MATCHUP.'}</div>
        <PixelButton onClick={() => onPlay(f, sport)} disabled={missing.length > 0} className="px-8 text-sm">
          ▶ PLAY {info.label}
        </PixelButton>
      </div>
    </Panel>
  );
}

function OffseasonPanel({ career, act }) {
  const o = career.offseason;
  const champ = career.teams[o.champion];
  return (
    <Panel title={`SEASON ${career.season} COMPLETE`}>
      <div className="text-sm leading-relaxed" style={{ color: o.champion === 0 ? '#ffd23f' : '#fff' }}>
        {o.champion === 0 ? '🏆 YOU ARE CHAMPIONS!' : `${champ.name} WIN THE TITLE`}
      </div>
      <div className="mt-2 text-[8px] text-slate-400">
        REGULAR SEASON FINISH: #{o.finish}
        {o.prize ? ` · TITLE PRIZE +${o.prize}` : ''}
      </div>
      <div className="mt-4 text-[9px] text-[#ffd23f]">EXPIRING CONTRACTS</div>
      {o.expiring.length === 0 ? (
        <div className="mt-2 text-[8px] text-slate-400">Nobody's contract is up. Nice.</div>
      ) : (
        <>
          <div className="mt-2 text-[8px] leading-relaxed text-slate-400">Unsigned players leave when the new season starts.</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {o.expiring.map((id) => {
              const p = career.players[id];
              const fee = Math.round(p.value * CAREER_CONFIG.resignFeeRatio);
              return (
                <PlayerCard key={id} p={p} colors={career.teams[0]} footer={<MoraleBar value={p.morale} />}>
                  <SmallBtn onClick={() => act((c) => resignPlayer(c, id))} disabled={career.coins < fee}>
                    RE-SIGN {fee}c
                  </SmallBtn>
                </PlayerCard>
              );
            })}
          </div>
        </>
      )}
      <div className="mt-4 flex justify-end">
        <PixelButton onClick={() => act((c) => ({ c: startNextSeason(c), ok: true, msg: `Season ${c.season + 1} is go!` }))}>START SEASON {career.season + 1} ▶</PixelButton>
      </div>
    </Panel>
  );
}

function RosterTab({ career, act, goMarket }) {
  const [confirm, setConfirm] = useState(null);
  const roster = teamPlayers(career, 0);
  const club = career.teams[0];
  const wages = roster.reduce((s, p) => s + p.salary, 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="text-[8px] leading-relaxed text-slate-400">
        {roster.length}/{CAREER_CONFIG.rosterMax} PLAYERS · WAGES {wages}c PER MATCH · A SPORT IS ONLY PLAYABLE WHEN EVERY POSITION HAS A STARTER
      </div>
      {SPORT_IDS.map((sport) => {
        const lineup = lineupOf(career, sport);
        const missing = missingRoles(career, sport);
        const list = roster.filter((p) => p.sport === sport).sort((a, b) => ROLES[sport].indexOf(a.pos) - ROLES[sport].indexOf(b.pos) || b.stars - a.stars);
        return (
          <Panel
            key={sport}
            title={`${SPORT_INFO[sport].icon} ${SPORT_INFO[sport].label}`}
            right={
              <span className={missing.length ? 'text-[#ef476f]' : 'text-[#06d6a0]'}>
                {missing.length ? `NEED ${missing.join(', ')}` : 'READY TO PLAY'} · <StarIcon /> {teamRating(career, 0, sport).toFixed(1)}
              </span>
            }
          >
            <div className={`grid gap-2 ${ROLES[sport].length > 1 ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-1 sm:max-w-xs'}`}>
              {ROLES[sport].map((role) => {
                const p = lineup[role];
                return (
                  <div key={role} className={`border-2 p-2 ${p ? 'border-[#06d6a0] bg-[#06d6a0]/10' : 'border-dashed border-[#ef476f] bg-[#ef476f]/10'}`}>
                    <div className="text-[8px] text-slate-400">
                      {role} <span className="text-slate-600">{ROLE_NAMES[role]}</span>
                    </div>
                    {p ? (
                      <div className="mt-1 flex items-center gap-2">
                        <SpritePreview primary={club.primary} secondary={club.secondary} head={SPORT_INFO[sport].head} skin={p.skin} hair={p.hair} scale={2} />
                        <div className="min-w-0">
                          <div className="truncate text-[8px] text-white">{p.name}</div>
                          <Stars n={p.stars} />
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => goMarket(sport)} className="mt-1 text-[8px] text-[#ef476f] underline">
                        EMPTY · SIGN ONE ▶
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {list.length > 0 && (
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {list.map((p) => {
                  const starts = career.lineups[sport][p.pos] === p.id;
                  const fee = Math.round(p.value * CAREER_CONFIG.sellRatio);
                  return (
                    <PlayerCard
                      key={p.id}
                      p={p}
                      colors={club}
                      starter={starts}
                      footer={
                        <>
                          <MoraleBar value={p.morale} />
                          <span>
                            {p.contract} SEASON{p.contract === 1 ? '' : 'S'} LEFT
                          </span>
                          <span>{p.salary}c/MATCH</span>
                        </>
                      }
                    >
                      <SmallBtn onClick={() => act((c) => toggleStarter(c, p.id))} color={starts ? '#8d99ae' : '#06d6a0'}>
                        {starts ? 'BENCH' : `START AT ${p.pos}`}
                      </SmallBtn>
                      <SmallBtn
                        color={confirm === p.id ? '#ef476f' : '#f4a261'}
                        onClick={() => {
                          if (confirm === p.id) {
                            setConfirm(null);
                            act((c) => sellPlayer(c, p.id));
                          } else setConfirm(p.id);
                        }}
                      >
                        {confirm === p.id ? `CONFIRM SELL +${fee}c` : `SELL ${fee}c`}
                      </SmallBtn>
                    </PlayerCard>
                  );
                })}
              </div>
            )}
          </Panel>
        );
      })}
    </div>
  );
}

function MarketTab({ career, act, filter, setFilter }) {
  const full = career.teams[0].roster.length >= CAREER_CONFIG.rosterMax;
  const needed = (p) => missingRoles(career, p.sport).includes(p.pos);
  const list = career.freeAgents
    .map((id) => career.players[id])
    .filter((p) => (filter === 'all' ? true : filter === 'needed' ? needed(p) : p.sport === filter))
    .sort((a, b) => Number(needed(b)) - Number(needed(a)) || b.stars - a.stars);
  const chips = [['all', 'ALL'], ['needed', 'FILLS A GAP'], ...SPORT_IDS.map((s) => [s, `${SPORT_INFO[s].icon} ${SPORT_INFO[s].label}`])];
  return (
    <Panel title="FREE AGENT MARKET" right="NEW PLAYERS EVERY WEEK">
      <div className="mb-3 flex flex-wrap gap-2">
        {chips.map(([id, label]) => (
          <button key={id} type="button" onClick={() => setFilter(id)} className={`border-2 border-black px-2 py-1 text-[8px] shadow-[2px_2px_0_#000] ${filter === id ? 'bg-[#ffd23f] text-black' : 'bg-[#1b1736] text-white'}`} style={FONT_STYLE}>
            {label}
          </button>
        ))}
      </div>
      <div className="mb-3 text-[8px] leading-relaxed text-slate-400">
        5-star players are rare and expensive. Everyone has a unique ability. {full && <span className="text-[#ef476f]">Your roster is full: sell someone first.</span>}
      </div>
      {list.length === 0 ? (
        <div className="text-[9px] text-slate-400">Nobody matches this filter this week. Try ALL, or check back after your next match.</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => (
            <PlayerCard key={p.id} p={p} colors={FA_COLORS} footer={<span>{p.salary}c/MATCH WAGES</span>}>
              {needed(p) && <span className="border-2 border-black bg-[#ef476f] px-1 text-[8px] text-black">FILLS YOUR EMPTY {p.pos}</span>}
              <SmallBtn onClick={() => act((c) => buyPlayer(c, p.id))} disabled={full || career.coins < p.value}>
                SIGN {p.value}c
              </SmallBtn>
            </PlayerCard>
          ))}
        </div>
      )}
    </Panel>
  );
}

function LeagueTab({ career, act }) {
  const [open, setOpen] = useState(null);
  const st = standings(career);
  const full = career.teams[0].roster.length >= CAREER_CONFIG.rosterMax;
  return (
    <div className="flex flex-col gap-4">
      <Panel title={`SEASON ${career.season} STANDINGS`} right="TOP 4 MAKE THE PLAYOFFS">
        <div className="overflow-x-auto">
          <table className="w-full text-[8px] sm:text-[9px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
            <thead className="text-slate-500">
              <tr>
                <th className="px-1 py-1 text-left">#</th>
                <th className="px-1 py-1 text-left">CLUB</th>
                <th className="px-1 py-1">W-L-T</th>
                <th className="px-1 py-1">+/-</th>
                <th className="px-1 py-1" />
              </tr>
            </thead>
            <tbody>
              {st.map((r, k) => {
                const t = career.teams[r.i];
                return (
                  <tr key={r.i} className={`border-t border-black ${k === 3 ? 'border-b-2 border-b-[#ffd23f]' : ''} ${r.i === 0 ? 'bg-white/5' : ''}`}>
                    <td className="px-1 py-2 text-slate-500">{k + 1}</td>
                    <td className="px-1 py-2">
                      <span className="flex items-center gap-2">
                        <span className="inline-block h-3 w-3 shrink-0 border border-black" style={{ background: t.primary }} />
                        <span className="truncate" style={{ color: r.i === 0 ? '#ffd23f' : '#e2e8f0' }}>
                          {t.name}
                        </span>
                      </span>
                    </td>
                    <td className="px-1 py-2 text-center text-white">
                      {r.w}-{r.l}-{r.t}
                    </td>
                    <td className="px-1 py-2 text-center text-slate-300">{r.pf - r.pa > 0 ? `+${r.pf - r.pa}` : r.pf - r.pa}</td>
                    <td className="px-1 py-2 text-right">
                      {r.i !== 0 && (
                        <SmallBtn color={open === r.i ? '#4cc9f0' : '#c77dff'} onClick={() => setOpen(open === r.i ? null : r.i)}>
                          {open === r.i ? 'CLOSE' : 'SCOUT'}
                        </SmallBtn>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      {open !== null && (
        <Panel title={`${career.teams[open].name} ROSTER`} right="MAKE AN OFFER TO POACH A PLAYER">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {teamPlayers(career, open)
              .sort((a, b) => b.stars - a.stars)
              .map((p) => (
                <PlayerCard key={p.id} p={p} colors={career.teams[open]} footer={<span>VALUE {p.value}c</span>}>
                  {p.refused ? (
                    <span className="text-[8px] text-[#ef476f]">REFUSED · TRY AGAIN NEXT WEEK</span>
                  ) : (
                    CAREER_CONFIG.offers.map((o) => {
                      const price = Math.round(p.value * o.mult);
                      return (
                        <SmallBtn key={o.id} onClick={() => act((c) => offerForPlayer(c, open, p.id, o.id))} disabled={full || career.coins < price} color={o.id === 'big' ? '#ffd23f' : o.id === 'fair' ? '#06d6a0' : '#8d99ae'} title={`${Math.round(offerChance(career, open, p, o) * 100)}% chance they accept`}>
                          {o.label} {price}c · {Math.round(offerChance(career, open, p, o) * 100)}%
                        </SmallBtn>
                      );
                    })
                  )}
                </PlayerCard>
              ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

function ScheduleTab({ career }) {
  const rows = career.schedule.filter((f) => f.home === 0 || f.away === 0);
  const P = career.playoffs;
  const playoffRows = P ? [...P.semis, ...(P.final ? [P.final] : [])].filter((f) => f.home === 0 || f.away === 0) : [];
  const next = currentFixture(career);
  const line = (f, label, key) => {
    const userHome = f.home === 0;
    const rival = career.teams[userHome ? f.away : f.home];
    let res = <span className="text-slate-500">-</span>;
    if (f.result) {
      const [h, a] = f.result.scores;
      const us = userHome ? h : a;
      const them = userHome ? a : h;
      res = (
        <span style={{ color: us > them ? '#06d6a0' : us < them ? '#ef476f' : '#ffd23f' }}>
          {us > them ? 'W' : us < them ? 'L' : 'T'} {us}-{them}
        </span>
      );
    }
    const current = next === f;
    return (
      <li key={key} className={`flex items-center justify-between gap-2 border-t border-black py-2 text-[8px] ${current ? 'text-[#ffd23f]' : 'text-slate-300'}`}>
        <span className="w-24 shrink-0 text-slate-500">{label}</span>
        <span className="min-w-0 flex-1 truncate">
          {f.sport ? SPORT_INFO[f.sport].icon : '🎲'} {userHome ? 'vs' : '@'} {rival.name}
        </span>
        <span className="shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {current ? 'NEXT · YOU PICK THE SPORT' : res}
        </span>
      </li>
    );
  };
  return (
    <Panel title={`SEASON ${career.season} SCHEDULE`} right="YOU CHOOSE THE SPORT FOR EACH MATCH">
      <ul>
        {rows.map((f, i) => line(f, `WEEK ${f.week + 1}`, `r${i}`))}
        {playoffRows.map((f, i) => line(f, f.label, `p${i}`))}
      </ul>
    </Panel>
  );
}

function CareerHub({ career, setCareer, onPlay, onHelp }) {
  const [tab, setTab] = useState('home');
  const [marketFilter, setMarketFilter] = useState('all');
  const goMarket = (sport) => {
    setMarketFilter(sport && missingRoles(career, sport).length ? 'needed' : 'all');
    setTab('market');
  };
  const [flash, setFlash] = useState(null);
  const club = career.teams[0];
  const st = standings(career);
  const rank = st.findIndex((r) => r.i === 0) + 1;
  const me = st[rank - 1];
  const act = (fn) => {
    const r = fn(career);
    if (r.c) setCareer(r.c);
    if (r.msg) setFlash({ text: r.msg, ok: r.ok, id: Date.now() });
    SOUND_ENGINE.play(r.ok ? 'correct' : 'wrong');
  };
  useEffect(() => {
    if (!flash) return undefined;
    const id = setTimeout(() => setFlash(null), 2600);
    return () => clearTimeout(id);
  }, [flash]);
  const phaseLabel = career.phase === 'regular' ? `WEEK ${Math.min(career.week + 1, seasonWeeks(career))}/${seasonWeeks(career)}` : career.phase === 'playoffs' ? 'PLAYOFFS' : 'OFF-SEASON';
  const tabs = [
    ['home', 'HOME'],
    ['roster', 'ROSTER'],
    ['market', 'MARKET'],
    ['league', 'LEAGUE'],
    ['schedule', 'SCHEDULE'],
  ];
  const stat = (k, v, c = '#fff') => (
    <div className="border-2 border-black bg-black/50 px-3 py-2">
      <div className="text-[7px] text-slate-500">{k}</div>
      <div className="mt-1 text-[10px] sm:text-sm" style={{ color: c, fontVariantNumeric: 'tabular-nums' }}>
        {v}
      </div>
    </div>
  );
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4">
      <header className="border-4 border-black bg-[#120f26] p-3 shadow-[4px_4px_0_#000] sm:p-4">
        <div className="flex flex-wrap items-center gap-4">
          <TeamBadge team={club} scale={6} />
          <div className="min-w-0 flex-1">
            <div className="text-[8px] text-slate-500">CLUBHOUSE</div>
            <div className="truncate text-lg sm:text-3xl" style={{ color: inkFor(club.primary), textShadow: '3px 3px 0 #000' }}>
              {club.name}
            </div>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 lg:w-auto">
            {stat('SEASON', `${career.season} · ${phaseLabel}`)}
            {stat('RECORD', `${me.w}-${me.l}-${me.t}`)}
            {stat('RANK', `#${rank} OF ${career.teams.length}`, rank <= 4 ? '#06d6a0' : '#fff')}
            {stat('COINS', `${career.coins.toLocaleString()}c`, '#ffd23f')}
          </div>
        </div>
      </header>
      <nav className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Clubhouse">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              SOUND_ENGINE.unlock();
              SOUND_ENGINE.play('select');
              setTab(id);
            }}
            className={`border-4 border-black px-2 py-3 text-[9px] shadow-[3px_3px_0_#000] sm:text-[11px] ${tab === id ? 'bg-[#ffd23f] text-black' : 'bg-[#1b1736] text-white hover:bg-[#241f48]'}`}
            style={FONT_STYLE}
          >
            {label}
          </button>
        ))}
        <button type="button" onClick={onHelp} className="border-4 border-black bg-[#06d6a0] px-2 py-3 text-[9px] text-black shadow-[3px_3px_0_#000] sm:text-[11px]" style={FONT_STYLE}>
          ? HELP
        </button>
      </nav>
      {flash && (
        <div role="status" className="border-2 border-black bg-black px-3 py-2 text-[8px] leading-relaxed" style={{ color: flash.ok ? '#06d6a0' : '#ef476f' }}>
          {flash.text}
        </div>
      )}
      {tab === 'home' && <HomeTab career={career} onPlay={onPlay} act={act} setTab={setTab} goMarket={goMarket} />}
      {tab === 'roster' && <RosterTab career={career} act={act} goMarket={goMarket} />}
      {tab === 'market' && <MarketTab career={career} act={act} filter={marketFilter} setFilter={setMarketFilter} />}
      {tab === 'league' && <LeagueTab career={career} act={act} />}
      {tab === 'schedule' && <ScheduleTab career={career} />}
    </div>
  );
}

function NewCareerScreen({ hasSave, onCreate, onBack }) {
  const [club, setClub] = useState({ name: 'NEON KNIGHTS', primary: '#e63946', secondary: '#fcbf49' });
  const [armed, setArmed] = useState(false);
  const create = () => {
    if (hasSave && !armed) {
      setArmed(true);
      return;
    }
    onCreate({ ...club, name: club.name.trim() || 'MY CLUB' });
  };
  return (
    <div className="m-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-center text-lg leading-relaxed text-[#ffd23f] sm:text-2xl" style={{ textShadow: '3px 3px 0 #e63946, 6px 6px 0 #000' }}>
        FOUND YOUR CLUB
      </h1>
      <p className="text-center text-[8px] leading-relaxed text-slate-400">One club, three sports. You start with a free squad that only covers some positions. Win games, earn coins, sign stars.</p>
      <TeamCard index={0} team={club} onChange={setClub} head="helmet" />
      <div className="flex flex-wrap justify-center gap-3">
        <PixelButton onClick={onBack} color="#8d99ae">
          ◀ BACK
        </PixelButton>
        <PixelButton onClick={create} color={armed ? '#ef476f' : '#ffd23f'}>
          {armed ? 'OVERWRITE OLD SAVE?' : 'START CAREER ▶'}
        </PixelButton>
      </div>
    </div>
  );
}

const DEMO_TEAMS = [
  { name: 'NEON KNIGHTS', primary: '#e63946', secondary: '#fcbf49' },
  { name: 'LASER SHARKS', primary: '#00b4d8', secondary: '#ffd60a' },
];
const DEMO_PLAYS = [
  { sport: 'football', offense: 0, from: 22, toGo: 10, type: 'pass', to: 100, td: true, banner: 'TOUCHDOWN!', tone: 'great' },
  { sport: 'soccer', kicker: 1, result: 'goal', gx: -0.86, gy: 0.9, flight: 0.3, diveDir: 1, diveHigh: false, banner: 'TOP BINS!' },
  { sport: 'tennis', hitter: 0, fromY: 110, recvY: 104, toY: 110, result: 'ace', banner: 'ACE!', serve: true, errorType: 'net' },
  { sport: 'football', offense: 1, from: 30, toGo: 10, type: 'pick6', tone: 'bad' },
];

// Silent attract-mode loop of real game animations behind the title screen.
function StadiumBackdrop() {
  const ref = useRef(null);
  useEffect(() => {
    const ctx = ref.current.getContext('2d');
    let raf;
    let idx = 0;
    let tl = buildTimeline(DEMO_PLAYS[0], DEMO_TEAMS);
    let t0 = performance.now();
    const loop = (now) => {
      let t = (now - t0) / 1000;
      if (t > tl.duration + 0.9) {
        idx = (idx + 1) % DEMO_PLAYS.length;
        tl = buildTimeline(DEMO_PLAYS[idx], DEMO_TEAMS);
        t0 = now;
        t = 0;
      }
      try {
        renderFrame(ctx, tl, Math.min(t, tl.duration), now / 1000);
      } catch (e) {
        /* decorative only */
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} width={CW} height={CH} aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" style={{ imageRendering: 'pixelated' }} />;
}

function MenuTile({ title, sub, color, onClick, big }) {
  return (
    <button
      type="button"
      onClick={() => {
        SOUND_ENGINE.unlock();
        SOUND_ENGINE.play('select');
        onClick();
      }}
      className={`group flex w-full flex-col gap-2 border-4 border-black text-left text-black shadow-[6px_6px_0_#000] transition-transform hover:-translate-y-1 active:translate-x-[3px] active:translate-y-[3px] active:shadow-[3px_3px_0_#000] ${big ? 'px-5 py-4 [@media(min-height:820px)]:px-6 [@media(min-height:820px)]:py-6' : 'px-5 py-3 [@media(min-height:820px)]:py-5'}`}
      style={{ background: color, ...FONT_STYLE }}
    >
      <span className={big ? 'text-base sm:text-2xl' : 'text-sm sm:text-lg'}>{title}</span>
      <span className="text-[8px] leading-relaxed text-black/70 sm:text-[9px]">{sub}</span>
    </button>
  );
}

function TitleScreen({ career, onContinue, onNew, onQuick, onTutorial }) {
  const answerCount = useMemo(() => TRIVIA_BANK.reduce((s, p) => s + p.answers.length, 0), []);
  const categories = useMemo(() => new Set(TRIVIA_BANK.map((p) => p.category)).size, []);
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <StadiumBackdrop />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(13,11,30,0.82) 0%, rgba(13,11,30,0.55) 40%, rgba(13,11,30,0.9) 78%, #0d0b1e 100%)' }} />
      <div style={GUTTER} className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4 py-4 text-center [@media(min-height:820px)]:gap-8 [@media(min-height:820px)]:py-8">
        <div>
          <h1 className="text-[#ffd23f]" style={{ fontSize: 'clamp(2rem, min(9vw, 11vh), 8rem)', lineHeight: 1.05, textShadow: '0.06em 0.06em 0 #e63946, 0.12em 0.12em 0 #000' }}>
            RETRO CLASH
          </h1>
          <div className="mt-3 text-[#4cc9f0]" style={{ fontSize: 'clamp(0.9rem, min(3.4vw, 4.4vh), 2.6rem)', textShadow: '0.08em 0.08em 0 #000' }}>
            TRIVIA BOWL
          </div>
          <p className="mx-auto mt-4 max-w-2xl text-[9px] leading-relaxed text-slate-200 sm:text-xs">Real-time arcade sports where every pass, shot and throw asks a trivia question. Name the answer nobody else would: rare answers score, obvious ones get intercepted.</p>
        </div>
        <div className="grid w-full max-w-4xl gap-4 sm:grid-cols-2">
          {career ? (
            <MenuTile big title={`▶ CONTINUE CAREER`} sub={`${career.teams[0].name} · SEASON ${career.season} · ${career.coins.toLocaleString()} COINS`} color="#ffd23f" onClick={onContinue} />
          ) : (
            <MenuTile big title="▶ START A CAREER" sub="Found a club, fill every position, and chase the title across all 4 sports." color="#ffd23f" onClick={onNew} />
          )}
          <MenuTile big title="QUICK MATCH" sub="One real-time game. Pick any of the 4 sports and play the CPU or a friend on the same keyboard." color="#c77dff" onClick={onQuick} />
          {career && <MenuTile title="NEW CAREER" sub="Start over with a new club (replaces your current save)." color="#4cc9f0" onClick={onNew} />}
          <div className={career ? '' : 'sm:col-span-2'}>
            <MenuTile title="? HOW TO PLAY" sub="Controls, rarity tiers, counter-attacks, all four sports and career mode." color="#06d6a0" onClick={onTutorial} />
          </div>
        </div>
      </div>
      <div style={GUTTER} className="relative z-10 grid gap-3 pb-4 sm:grid-cols-2 lg:grid-cols-4 [@media(max-height:700px)]:hidden">
        {Object.values(SPORT_INFO).map((e) => (
          <div key={e.id} className="flex items-start gap-3 border-4 border-black bg-[#1b1736]/90 p-3 shadow-[4px_4px_0_#000]">
            <span className="text-2xl" aria-hidden="true">
              {e.icon}
            </span>
            <div className="min-w-0">
              <div className="text-[10px] text-[#ffd23f]">{e.label}</div>
              <div className="mt-1 text-[8px] leading-relaxed text-slate-300 [@media(max-height:860px)]:hidden">{e.blurb}</div>
            </div>
          </div>
        ))}
        <div className="text-center text-[8px] text-slate-400 sm:col-span-2 lg:col-span-4" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {TRIVIA_BANK.length} PROMPTS · {answerCount.toLocaleString()} RANKED ANSWERS · {categories} CATEGORIES · CAREER SAVES IN THIS BROWSER
        </div>
      </div>
    </div>
  );
}

const TUTORIAL_SEEN_KEY = 'retro-clash-tutorial-seen';
const pctOf = (x) => `${Math.round(x * 100)}%`;

function TutTable({ rows, head }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-2 border-black text-left text-[8px] sm:text-[9px]">
        {head && (
          <thead className="bg-black text-slate-400">
            <tr>
              {head.map((h) => (
                <th key={h} className="px-2 py-1">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-black/70 align-top">
              {r.map((c, j) => (
                <td key={j} className="px-2 py-2 leading-relaxed text-slate-200">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function tutorialPages() {
  const C = GAME_CONFIG;
  const A = C.arcade;
  const CC = CAREER_CONFIG;
  const cut = [0, ...RARITY_CUTOFFS, 1];
  const sample = TRIVIA_BANK.find((p) => p.id === 'us-states') || TRIVIA_BANK[0];
  const ex = (tier) =>
    sample.answers
      .filter((a) => a.tier === tier)
      .slice(0, 3)
      .map((a) => a.text)
      .join(', ');
  const chip = (t) => <TierChip tier={t} small />;
  const answers = TRIVIA_BANK.reduce((s, p) => s + p.answers.length, 0);
  return [
    {
      title: 'WELCOME TO RETRO CLASH',
      body: (
        <>
          <p>It's a real-time arcade sports game where trivia powers every big play. Move your player with WASD (or the arrow keys).</p>
          <p>
            <span className="text-[#ffd23f]">When you pass, shoot, throw or hit, the game freezes and asks you a question</span>, like "{sample.prompt}". You have {C.timerSeconds} seconds to type an answer that's on the board.
          </p>
          <p>The rarer your answer, the better the play. The CPU never waits: it acts instantly.</p>
          <div className="flex items-end justify-center gap-4 border-4 border-black bg-[#3d9140] px-4 pt-3">
            <SpritePreview primary="#e63946" secondary="#fcbf49" head="helmet" pose="armsUp" />
            <SpritePreview primary="#457b9d" secondary="#f1faee" head="hair" pose="run1" skin="#8d5524" hair="#1a1a1a" />
            <SpritePreview primary="#ff7b00" secondary="#1d3557" head="hair" pose="run2" skin="#c68642" hair="#3b2414" />
            <SpritePreview primary="#06d6a0" secondary="#1d3557" head="hair" pose="stand" skin="#ffdbac" hair="#d9a441" />
          </div>
        </>
      ),
    },
    {
      title: 'RARITY TIERS',
      body: (
        <>
          <p>
            The bank has {TRIVIA_BANK.length} prompts and {answers.toLocaleString()} answers. Each prompt lists every valid answer from most common to rarest, and the tier comes from where an answer sits on that list:
          </p>
          <TutTable
            head={['TIER', 'WHERE IT RANKS', `EXAMPLE: ${sample.prompt.toUpperCase()}`]}
            rows={[5, 4, 3, 2, 1].map((t) => [chip(t), t === 1 ? `Top ${pctOf(cut[1])} most common` : t === 5 ? `Rarest ${pctOf(1 - cut[4])}` : `${pctOf(cut[t - 1])}-${pctOf(cut[t])} down the list`, ex(t)])}
          />
          <p className="text-slate-400">Typing is forgiving: case, accents, punctuation, "the", plurals and small typos are fine. Nicknames work too ("Niners", "JFK").</p>
        </>
      ),
    },
    {
      title: 'THE RISK: COUNTER-ATTACKS',
      body: (
        <>
          <TutTable
            head={['ANSWER', 'COUNTER CHANCE', 'WHAT HAPPENS']}
            rows={[
              [chip(1), pctOf(C.counterAttackChance[1]), 'Interception, blocked shot, keeper launches a counter, or the rival smashes your sitter'],
              [chip(2), pctOf(C.counterAttackChance[2]), 'Same, just less likely'],
              [chip(3), '0%', 'Safe, steady play'],
              ['WRONG / REPEAT', '-', 'Misplaced pass, airball, wide shot, incomplete throw, unforced error'],
              ['TIME RUNS OUT', '-', 'Same as wrong. In football you get sacked.'],
            ]}
          />
          <p className="text-[#ffd23f]">Tip: think of the 2nd or 3rd answer that comes to mind. The first one everyone thinks of is a T1.</p>
        </>
      ),
    },
    {
      title: '⚽ SOCCER · 🏀 BASKETBALL',
      body: (
        <>
          <p>5-on-5. You control the player with the yellow arrow. When you pass, control jumps to the player who receives it.</p>
          <TutTable
            head={['KEY', 'WITH THE BALL', 'WITHOUT IT']}
            rows={[
              ['WASD', 'Dribble', 'Run / chase'],
              ['SPACE', 'Pass to the circled teammate (question)', 'Tackle / steal'],
              ['SHIFT', 'Shoot (question)', 'Switch to the teammate nearest the ball'],
            ]}
          />
          <TutTable
            head={['ANSWER', 'PASS', 'SHOT']}
            rows={[
              [chip(5), 'Perfect: cannot be intercepted', `Top bins / swish (keeper save ${pctOf(A.soccerSave[5])}, make ${pctOf(A.basketMake[5])})`],
              [chip(4), 'Sharp: cannot be intercepted', `Save ${pctOf(A.soccerSave[4])} · make ${pctOf(A.basketMake[4])}`],
              [chip(3), 'Normal speed', `Save ${pctOf(A.soccerSave[3])} · make ${pctOf(A.basketMake[3])}`],
              ['T1-T2', 'Slow, and can be intercepted outright', `Save ${pctOf(A.soccerSave[1])} · make ${pctOf(A.basketMake[1])} (+ block risk)`],
            ]}
          />
          <p className="text-slate-400">Long shots are harder. Basketball shots from outside the arc are worth 3. Each match lasts {Math.round(A.soccerSeconds / 60 * 10) / 10} minutes of game time; the clock stops during questions.</p>
        </>
      ),
    },
    {
      title: '🏈 FOOTBALL',
      body: (
        <>
          <p>
            5-on-5, one play at a time. Start at your own {C.football.startYard} with 4 downs to gain {C.football.firstDownYards} yards. Each team gets {A.footballDrives} drives.
          </p>
          <TutTable
            head={['KEY', 'ON OFFENSE', 'ON DEFENSE']}
            rows={[
              ['SPACE', 'Hike, then throw to the circled receiver (question)', '-'],
              ['WASD', 'Scramble as the QB, run after the catch', 'Chase and touch the ball carrier to tackle'],
              ['SHIFT', 'Hand off to the running back', 'Switch defender'],
            ]}
          />
          <TutTable
            head={['THROW', 'RESULT']}
            rows={[
              [chip(5), `Catch ${pctOf(A.throwCatch[5])}, in stride`],
              [chip(4), `Catch ${pctOf(A.throwCatch[4])}`],
              [chip(3), `Catch ${pctOf(A.throwCatch[3])} (less if covered)`],
              ['T1-T2', 'Often dropped, and can be INTERCEPTED'],
              ['TIME UP', 'Sacked'],
            ]}
          />
        </>
      ),
    },
    {
      title: '🎾 TENNIS',
      body: (
        <>
          <p>
            Tiebreak: first to {C.tennis.pointsToWin}, win by {C.tennis.winBy}. Run to where the ball is going with WASD. When you reach it after the bounce, the game asks a question and your answer is the shot.
          </p>
          <TutTable
            head={['ANSWER', 'SHOT']}
            rows={[
              [chip(5), 'Ace / clean winner the rival can\'t reach'],
              [chip(4), 'Deep corner: hard to chase down'],
              [chip(3), 'Solid return: the rally continues'],
              ['T1-T2', 'Weak ball. If countered, the rival SMASHES it past you'],
              ['WRONG / TIME UP', 'Net, out, or double fault'],
            ]}
          />
          <p className="text-slate-400">Press SPACE to serve when it's your serve. If the ball bounces twice on your side, you lose the point.</p>
        </>
      ),
    },
    {
      title: 'CAREER MODE',
      body: (
        <TutTable
          rows={[
            ['YOUR CLUB', 'One club plays all four sports in an 8-team league.'],
            ['PICK THE SPORT', 'Before every match you choose which sport to play, from the sports your lineup is ready for.'],
            ['FULL LINEUPS', `Every sport has positions (soccer GK/DEF/MID/WING/ST, basketball PG/SG/SF/PF/C, football QB/RB/WR/TE/OL, tennis SINGLES). You can only play a sport when every position has a starter. Your free squad doesn't cover them all, so you have to buy the rest.`],
            ['SEASON', `${CC.rivals.length} weeks, then the top 4 play semifinals and a championship.`],
            ['COINS', `Win +${CC.rewards.win}, draw +${CC.rewards.draw}, loss +${CC.rewards.loss}. Every T5 answer +${CC.rewards.tier5}, every T4 +${CC.rewards.tier4}. Title +${CC.rewards.title}.`],
            ['WAGES', "Every player is paid after every match. If you can't pay, morale crashes."],
          ]}
        />
      ),
    },
    {
      title: 'YOUR PLAYERS',
      body: (
        <>
          <p>Players are rated 1-5 stars (5-star players are rare and pricey). Each one plays one position in one sport and has their own ability. Only starters' abilities count, and the players you see on the field are your actual starters.</p>
          <TutTable
            head={['TYPE', 'EXAMPLES']}
            rows={[
              [<span style={{ color: KIND_COLOR.TRIVIA }}>TRIVIA</span>, 'CLOCK MANAGER (+seconds), FILM STUDY (hint for a rare answer), SECOND WIND (retry a wrong answer)'],
              [<span style={{ color: KIND_COLOR.RISK }}>RISK</span>, 'IRON DEFENSE (fewer counters vs you), BALLHAWK (more counters vs them), CLUTCH GENE (T2 plays as T3), COMPOSURE (wrong answer forgiven)'],
              [<span style={{ color: KIND_COLOR.STAT }}>STAT</span>, 'WHEELS (faster runner), BULLDOZER (breaks tackles), SHARPSHOOTER (+make %), FINISHER (beats the keeper), BIG SERVE (SOLID shots become winners)'],
              [<span style={{ color: KIND_COLOR.SPECIALIST }}>SPECIALIST</span>, 'e.g. GEOGRAPHY BRAIN: answers in that category can jump up a tier'],
            ]}
          />
        </>
      ),
    },
    {
      title: 'BUILDING A DYNASTY',
      body: (
        <TutTable
          rows={[
            ['MARKET', `${CC.freeAgentsPerWeek}+ new free agents every week, always including cheap options for positions you're missing. Use the FILLS A GAP filter.`],
            ['POACH', "Scout a rival in LEAGUE and make a LOWBALL, FAIR or BLOCKBUSTER offer. Players who refuse won't talk again until next week."],
            ['SELL', `Sell any player for ${pctOf(CC.sellRatio)} of their value. Selling a starter leaves that position empty.`],
            ['MORALE', `Wins and starting raise it; losses, the bench and unpaid wages lower it. Below ${CC.morale.unhappyBelow}, a player's ability switches OFF.`],
            ['CONTRACTS', 'Re-sign expiring players in the off-season or let them walk. Happy players can gain a star between seasons.'],
          ]}
        />
      ),
    },
    {
      title: 'CONTROLS',
      body: (
        <TutTable
          rows={[
            ['WASD / ARROWS', 'Move'],
            ['SPACE (or J)', 'Pass, throw, hike, serve, tackle, steal'],
            ['SHIFT (or K)', 'Shoot, hand off, switch player'],
            ['ENTER', 'Submit an answer, start a match'],
            ['ESC / P', 'Pause'],
            ['2 PLAYERS', 'Quick match only: P1 WASD + F/G, P2 arrows + K/L'],
            ['PHONE / TABLET', 'On-screen joystick and buttons appear automatically'],
          ]}
        />
      ),
    },
  ];
}

function Tutorial({ onClose }) {
  const pages = useMemo(tutorialPages, []);
  const [i, setI] = useState(0);
  const close = useCallback(() => {
    try {
      window.localStorage.setItem(TUTORIAL_SEEN_KEY, '1');
    } catch (e) {
      /* ignore */
    }
    onClose();
  }, [onClose]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight' || e.key === 'Enter') setI((x) => (x < pages.length - 1 ? x + 1 : x));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, pages.length]);
  const page = pages[i];
  const last = i === pages.length - 1;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="How to play">
      <div className="flex max-h-[94dvh] w-full max-w-3xl flex-col border-4 border-black bg-[#1b1736] shadow-[8px_8px_0_#000]" style={FONT_STYLE}>
        <div className="flex items-center justify-between gap-3 border-b-4 border-black bg-[#120f26] px-4 py-3">
          <div className="text-[8px] text-slate-400">
            HOW TO PLAY · {i + 1}/{pages.length}
          </div>
          <button type="button" onClick={close} className="text-[9px] text-slate-300 underline hover:text-white">
            SKIP ✕
          </button>
        </div>
        <div className="flex-1 overflow-auto px-4 py-4 sm:px-6">
          <h2 className="text-sm leading-relaxed text-[#ffd23f] sm:text-xl" style={{ textShadow: '3px 3px 0 #000' }}>
            {page.title}
          </h2>
          <div className="mt-4 flex flex-col gap-4 text-[9px] leading-relaxed text-slate-200 sm:text-[10px]">{page.body}</div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t-4 border-black px-4 py-3">
          <div className="flex gap-1" aria-hidden="true">
            {pages.map((_, k) => (
              <span key={k} className="h-2 w-2 border border-black" style={{ background: k === i ? '#ffd23f' : k < i ? '#4cc9f0' : '#334155' }} />
            ))}
          </div>
          <div className="flex gap-2">
            <PixelButton onClick={() => setI(Math.max(0, i - 1))} color="#8d99ae" disabled={i === 0}>
              ◀ BACK
            </PixelButton>
            <PixelButton onClick={() => (last ? close() : setI(i + 1))}>{last ? "LET'S PLAY ▶" : 'NEXT ▶'}</PixelButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function emptyLineups() {
  const l = {};
  SPORT_IDS.forEach((s) => {
    l[s] = {};
    ROLES[s].forEach((r) => (l[s][r] = null));
  });
  return l;
}

/** { role: player|null } for the user's lineup in a sport. */
export function lineupOf(c, sport) {
  const out = {};
  ROLES[sport].forEach((r) => {
    const id = c.lineups[sport][r];
    out[r] = id && c.players[id] ? c.players[id] : null;
  });
  return out;
}

export function missingRoles(c, sport) {
  return ROLES[sport].filter((r) => !c.lineups[sport][r] || !c.players[c.lineups[sport][r]]);
}

/** Lineup keyed by role for team i (rivals use their best player per role). */
export function rosterFor(c, i, sport) {
  if (i === 0) return lineupOf(c, sport);
  const out = {};
  ROLES[sport].forEach((r) => {
    const opts = teamPlayers(c, i).filter((p) => p.sport === sport && p.pos === r).sort((a, b) => b.stars - a.stars);
    out[r] = opts[0] || null;
  });
  return out;
}

function removeFromLineup(c, id) {
  SPORT_IDS.forEach((s) =>
    ROLES[s].forEach((r) => {
      if (c.lineups[s][r] === id) c.lineups[s][r] = null;
    })
  );
}

/** v1 saves (3 sports, free-form positions) -> v2 (4 sports, fixed roles + lineups). */
function migrateCareer(c) {
  if (!c || c.version === 2) return c;
  if (c.version !== 1) return null;
  c.version = 2;
  c.lineups = emptyLineups();
  Object.values(c.players).forEach((p) => {
    if (!ROLES[p.sport].includes(p.pos)) p.pos = pick(ROLES[p.sport]);
    if (p.ability && p.ability.key === 'power' && p.ability.mag > 1) p.ability.mag = Math.round((p.ability.mag / 20) * 100) / 100;
    delete p.starter;
  });
  c.teams.forEach((t, i) => {
    if (i === 0) return;
    SPORT_IDS.forEach((sport) =>
      ROLES[sport].forEach((role) => {
        if (!t.roster.some((id) => c.players[id].sport === sport && c.players[id].pos === role)) t.roster.push(makePlayer(c, rivalStar(CAREER_CONFIG.rivalStarsMean + (c.season - 1) * CAREER_CONFIG.rivalStarsPerSeason), sport, role).id);
      })
    );
  });
  teamPlayers(c, 0)
    .sort((a, b) => b.stars - a.stars)
    .forEach((p) => {
      if (!c.lineups[p.sport][p.pos]) c.lineups[p.sport][p.pos] = p.id;
    });
  c.schedule.forEach((f) => {
    if (!f.result) f.sport = null;
  });
  addNews(c, 'UPDATE: matches are now real-time, basketball joined the league, and every sport has positions to fill.');
  return c;
}

/** Shared answer pipeline for humans and CPU: abilities, counter roll, stats. */
function finalizeOutcome(m, mods, team, prompt, raw) {
  const M = mods[team];
  const O = mods[1 - team];
  const triggers = [];
  let o = { ...raw };
  if ((o.kind === 'invalid' || o.kind === 'duplicate') && M.composure > 0 && Math.random() < M.composure) {
    o = { kind: 'answer', tier: 2, text: o.text, matchedText: o.text, forgiven: true };
    triggers.push(`COMPOSURE (${M.src.composure}): wrong answer forgiven, plays as a safe T2`);
  }
  if (o.kind === 'answer' && !o.forgiven) {
    if (o.idx != null) m.used.add(usedKey(prompt.id, o.idx));
    const sp = M.specialists[prompt.category];
    if (sp && o.tier < 5 && Math.random() < sp.chance) {
      o.tier += 1;
      triggers.push(`${prompt.category} BRAIN (${sp.src}): upgraded to T${o.tier}`);
    }
    if (o.tier === 2 && M.clutch > 0 && Math.random() < M.clutch) {
      o.tier = 3;
      triggers.push(`CLUTCH GENE (${M.src.clutch}): T2 plays as T3`);
    }
  }
  if (o.kind === 'answer') {
    const base = o.forgiven ? 0 : GAME_CONFIG.counterAttackChance[o.tier] || 0;
    const p = base > 0 ? clamp(base * (1 - M.shield) + O.ballhawk, 0, 0.98) : 0;
    const r = Math.random();
    o.counter = r < p;
    if (!o.counter && M.shield > 0 && r < base) triggers.push(`IRON DEFENSE (${M.src.shield}) shut down a counter-attack`);
    if (o.counter && O.ballhawk > 0 && r >= base * (1 - M.shield)) triggers.push(`BALLHAWK (${O.src.ballhawk}) read it and pounced!`);
  }
  recordStats(m.stats[team], m.stats[1 - team], o);
  return { outcome: o, triggers };
}

const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyJ', 'KeyK', 'KeyF', 'KeyG', 'KeyL', 'ShiftLeft', 'ShiftRight']);
const P1_ACTION = ['Space', 'KeyJ', 'KeyF'];
const P1_SECOND = ['ShiftLeft', 'ShiftRight', 'KeyK', 'KeyG'];

/** Keyboard + touch input. 1P: WASD/arrows, SPACE/J action, SHIFT/K secondary. 2P: P1 WASD+F/G, P2 arrows+K/L. */
function useArcadeInput(twoPlayer) {
  const keys = useRef(new Set());
  const edges = useRef({ a0: false, b0: false, a1: false, b1: false });
  const touch = useRef({ mx: 0, my: 0 });
  useEffect(() => {
    const typing = (e) => e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
    const down = (e) => {
      if (typing(e)) return;
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      keys.current.add(e.code);
      const E = edges.current;
      if (twoPlayer) {
        if (e.code === 'KeyF' || e.code === 'Space') E.a0 = true;
        if (e.code === 'KeyG') E.b0 = true;
        if (e.code === 'KeyK') E.a1 = true;
        if (e.code === 'KeyL') E.b1 = true;
      } else {
        if (P1_ACTION.includes(e.code)) E.a0 = true;
        if (P1_SECOND.includes(e.code)) E.b0 = true;
      }
    };
    const up = (e) => keys.current.delete(e.code);
    const blur = () => keys.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [twoPlayer]);
  const read = useCallback(() => {
    const k = keys.current;
    const E = edges.current;
    const axis = (neg, pos) => (k.has(pos) ? 1 : 0) - (k.has(neg) ? 1 : 0);
    let p0;
    let p1 = { mx: 0, my: 0 };
    if (twoPlayer) {
      p0 = { mx: axis('KeyA', 'KeyD'), my: axis('KeyW', 'KeyS') };
      p1 = { mx: axis('ArrowLeft', 'ArrowRight'), my: axis('ArrowUp', 'ArrowDown') };
    } else {
      p0 = {
        mx: clamp(axis('KeyA', 'KeyD') + axis('ArrowLeft', 'ArrowRight') + touch.current.mx, -1, 1),
        my: clamp(axis('KeyW', 'KeyS') + axis('ArrowUp', 'ArrowDown') + touch.current.my, -1, 1),
      };
    }
    const out = [
      { ...p0, action: E.a0, secondary: E.b0 },
      { ...p1, action: E.a1, secondary: E.b1 },
    ];
    E.a0 = false;
    E.b0 = false;
    E.a1 = false;
    E.b1 = false;
    return out;
  }, [twoPlayer]);
  const press = useCallback((which) => {
    edges.current[which] = true;
  }, []);
  const clear = useCallback(() => {
    keys.current.clear();
    Object.keys(edges.current).forEach((k) => (edges.current[k] = false));
  }, []);
  return useMemo(() => ({ read, press, touch, clear }), [read, press, clear]);
}

function TouchControls({ input, sport }) {
  const [show] = useState(() => {
    try {
      return window.matchMedia('(pointer: coarse)').matches;
    } catch (e) {
      return false;
    }
  });
  const padRef = useRef(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  if (!show) return null;
  const move = (e) => {
    const r = padRef.current.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const m = Math.max(1, Math.hypot(dx, dy));
    input.touch.current = { mx: dx / m, my: dy / m };
    setKnob({ x: (dx / m) * 28, y: (dy / m) * 28 });
  };
  const end = () => {
    input.touch.current = { mx: 0, my: 0 };
    setKnob({ x: 0, y: 0 });
  };
  const labels = CONTROL_HINTS[sport];
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-2 z-20 flex items-end justify-between px-3">
      <div
        ref={padRef}
        className="pointer-events-auto relative h-24 w-24 touch-none rounded-full border-4 border-black bg-white/15"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          move(e);
        }}
        onPointerMove={(e) => e.buttons && move(e)}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <span className="absolute left-1/2 top-1/2 h-10 w-10 rounded-full border-4 border-black bg-[#ffd23f]" style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
      </div>
      <div className="pointer-events-auto flex gap-3">
        <button type="button" onPointerDown={() => input.press('b0')} className="h-16 w-16 touch-none rounded-full border-4 border-black bg-[#c77dff] text-[8px] text-black">
          {labels[2][1].split(' ')[0]}
        </button>
        <button type="button" onPointerDown={() => input.press('a0')} className="h-20 w-20 touch-none rounded-full border-4 border-black bg-[#ffd23f] text-[8px] text-black">
          {labels[1][1].split(' ')[0]}
        </button>
      </div>
    </div>
  );
}

const CONTROL_HINTS = {
  soccer: [
    ['WASD', 'MOVE'],
    ['SPACE', 'PASS / TACKLE'],
    ['SHIFT', 'SHOOT / SWITCH'],
  ],
  basketball: [
    ['WASD', 'MOVE'],
    ['SPACE', 'PASS / STEAL'],
    ['SHIFT', 'SHOOT / SWITCH'],
  ],
  football: [
    ['WASD', 'MOVE / SCRAMBLE'],
    ['SPACE', 'HIKE / THROW'],
    ['SHIFT', 'HANDOFF / SWITCH'],
  ],
  tennis: [
    ['WASD', 'RUN TO THE BALL'],
    ['SPACE', 'SERVE'],
    ['AUTO', 'SWING WHEN YOU REACH IT'],
  ],
};

function arcadeStatus(S) {
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  if (S.sport === 'football') {
    const f = S.f;
    if (f.over) return 'FINAL';
    const goal = f.yard + f.toGo >= 100;
    const spot = f.yard < 50 ? `OWN ${f.yard}` : f.yard === 50 ? 'MIDFIELD' : `OPP ${100 - f.yard}`;
    return `${S.teams[f.offense].name} BALL · ${ORD[Math.min(4, f.down)]} & ${goal ? 'GOAL' : f.toGo} · ${spot} · DRIVE ${f.drives[f.offense]}/${f.totalDrives}`;
  }
  if (S.sport === 'tennis') return `TIEBREAK TO ${GAME_CONFIG.tennis.pointsToWin} · ${S.teams[S.t.server].name} SERVING`;
  return mmss(Math.max(0, S.clock));
}

function ArcadeHud({ teams, hud, sport }) {
  if (!hud) return null;
  const side = (i) => (
    <div className={`flex min-w-0 flex-1 items-center gap-2 ${i === 1 ? 'flex-row-reverse text-right' : ''}`}>
      <span className="h-7 w-3 shrink-0 border-2 border-black" style={{ background: `linear-gradient(${teams[i].primary} 60%, ${teams[i].secondary} 60%)` }} />
      <div className="min-w-0">
        <div className="line-clamp-2 break-words text-[7px] leading-tight sm:text-[10px]" style={{ color: inkFor(teams[i].primary) }}>
          {teams[i].name}
        </div>
        <div className="hidden truncate text-[7px] text-slate-400 sm:block">{hud.ctrl[i] ? `▼ ${hud.ctrl[i]}` : teams[i].isCPU ? 'CPU' : ''}</div>
      </div>
      <div className="shrink-0 border-2 border-black bg-black px-1 py-1 text-sm text-[#ffd23f] sm:px-2 sm:text-2xl" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {String(hud.score[i]).padStart(2, '0')}
      </div>
    </div>
  );
  return (
    <div className="shrink-0 border-4 border-black bg-[#120f26] px-2 py-1 shadow-[4px_4px_0_#000]">
      <div className="flex items-center gap-2">
        {side(0)}
        <div className="shrink-0 px-1 text-center">
          <div className="text-lg" aria-hidden="true">
            {SPORT_INFO[sport].icon}
          </div>
        </div>
        {side(1)}
      </div>
      <div className="mt-1 truncate text-center text-[8px] text-[#4cc9f0] sm:text-[9px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {hud.status}
      </div>
    </div>
  );
}

const DIFF_SKILL = { rookie: 0.86, pro: 0.97, legend: 1.08 };

function makeHint(m, mods, team, prompt) {
  const M = mods[team];
  if (!(M.hintChance > 0) || Math.random() >= M.hintChance) return null;
  const opts = prompt.answers.filter((a, idx) => a.tier >= 4 && !m.used.has(usedKey(prompt.id, idx)));
  if (!opts.length) return null;
  const a = pick(opts);
  return { text: a.text.slice(0, 2).toUpperCase() + a.text.slice(2).toUpperCase().replace(/[A-Z0-9]/g, '_'), tier: a.tier, src: M.src.hintChance };
}

const ACTION_WORDS = { pass: 'PASS', shoot: 'SHOT', throw: 'THROW', hit: 'SHOT', serve: 'SERVE' };

function ArcadeScreen({ setup, career, onExit, onRematch }) {
  const sport = setup.sport;
  const twoP = setup.mode === '2p';
  const teams = setup.teams;
  const mods = useMemo(() => (career ? career.mods : [emptyMods(), emptyMods()]), [career]);
  const input = useArcadeInput(twoP);
  const canvasRef = useRef(null);
  const M = useRef(null);
  const [q, setQ] = useState(null);
  const [phase, setPhase] = useState('intro');
  const [hud, setHud] = useState(null);
  const [feed, setFeed] = useState(null);
  const [cpuFeed, setCpuFeed] = useState(null);
  const [paused, setPaused] = useState(false);
  const [forfeitArmed, setForfeitArmed] = useState(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused;
  const areaRef = useRef(null);
  const [box, setBox] = useState({ w: 320, h: 180, slack: 0 });
  useEffect(() => {
    const el = areaRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const fit = () => {
      const W = el.clientWidth;
      const H = el.clientHeight;
      let w = W;
      let h = (W * 9) / 16;
      if (h > H) {
        h = H;
        w = (H * 16) / 9;
      }
      setBox({ w: Math.floor(w), h: Math.floor(h), slack: H - Math.floor(h) });
    };
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    fit();
    return () => ro.disconnect();
  }, []);

  if (!M.current) {
    const m = { stats: [newStats(), newStats()], used: new Set(), deck: shuffle(TRIVIA_BANK.map((_, i) => i)), deckPos: 0, retries: [mods[0].retries, mods[1].retries], qid: 0, q: null, lastPhase: null, cpuLog: null };
    const weights = career ? career.cpuWeights : (GAME_CONFIG.cpu.difficulties[setup.difficulty] || GAME_CONFIG.cpu.difficulties.pro).tierWeights;
    m.S = createArcade(setup, {
      mods,
      cpuSkill: career ? career.cpuSkill : DIFF_SKILL[setup.difficulty] || 1,
      cpu: (team) => {
        const prompt = drawPrompt(m);
        const raw = cpuAnswer(prompt, m.used, setup.difficulty, weights);
        const { outcome } = finalizeOutcome(m, mods, team, prompt, raw);
        m.cpuLog = { id: (m.cpuLog ? m.cpuLog.id : 0) + 1, team, text: raw.kind === 'answer' ? raw.text : raw.text || '???', tier: outcome.kind === 'answer' ? outcome.tier : 0, prompt: prompt.prompt };
        return outcome;
      },
    });
    M.current = m;
  }

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    let raf;
    let last = performance.now();
    let hudT = 1;
    let lastCpu = 0;
    const loop = (now) => {
      const m = M.current;
      const S = m.S;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const inp = input.read();
      if (!pausedRef.current) arcadeStep(S, dt, inp);
      while (S.sfx.length) SOUND_ENGINE.play(S.sfx.shift());
      try {
        arcadeRender(ctx, S, now / 1000);
      } catch (e) {
        /* never freeze the loop on a draw error */
      }
      if (S.phase === 'question' && !m.q && S.pending) {
        const prompt = drawPrompt(m);
        m.q = { id: ++m.qid, team: S.pending.team, kind: S.pending.kind, prompt, hint: makeHint(m, mods, S.pending.team, prompt) };
        input.clear();
        setQ(m.q);
      }
      if (S.phase !== m.lastPhase) {
        m.lastPhase = S.phase;
        setPhase(S.phase);
      }
      if (m.cpuLog && m.cpuLog.id !== lastCpu) {
        lastCpu = m.cpuLog.id;
        setCpuFeed(m.cpuLog);
      }
      hudT += dt;
      if (hudT > 0.12) {
        hudT = 0;
        setHud({ score: [S.score[0], S.score[1]], status: arcadeStatus(S), ctrl: [0, 1].map((t) => (S.control[t] != null && S.players[S.control[t]] ? S.players[S.control[t]].name : '')) });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [input, mods]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' && e.key !== 'p' && e.key !== 'P') return;
      if (e.target && e.target.tagName === 'INPUT') return;
      const ph = M.current.S.phase;
      if (ph === 'question' || ph === 'over' || ph === 'intro') return;
      setPaused((x) => !x);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!feed) return undefined;
    const id = setTimeout(() => setFeed(null), 2800);
    return () => clearTimeout(id);
  }, [feed]);
  useEffect(() => {
    if (!cpuFeed) return undefined;
    const id = setTimeout(() => setCpuFeed(null), 2200);
    return () => clearTimeout(id);
  }, [cpuFeed]);

  const start = useCallback(() => {
    SOUND_ENGINE.unlock();
    SOUND_ENGINE.play('whistle');
    const S = M.current.S;
    S.phase = S.timer > 0 ? 'dead' : 'live';
    setTimeout(() => input.clear(), 0); // don't let the START keypress count as an action
  }, [input]);

  const answer = useCallback(
    (text, timedOut) => {
      const m = M.current;
      const S = m.S;
      const cur = m.q;
      if (!cur) return undefined;
      let raw;
      if (timedOut) raw = { kind: 'timeout', text: '' };
      else {
        const hit = matchAnswer(text, cur.prompt);
        if (!hit) raw = { kind: 'invalid', text };
        else if (m.used.has(usedKey(cur.prompt.id, hit.idx))) raw = { kind: 'duplicate', text, idx: hit.idx, tier: hit.answer.tier, matchedText: hit.answer.text };
        else raw = { kind: 'answer', text, idx: hit.idx, tier: hit.answer.tier, matchedText: hit.answer.text };
        if (raw.kind !== 'answer' && m.retries[cur.team] > 0) {
          m.retries[cur.team] -= 1;
          SOUND_ENGINE.play('wrong');
          return `SECOND WIND (${mods[cur.team].src.retries}): "${text}" ${raw.kind === 'duplicate' ? 'was already used' : "isn't on the board"}. Try again! (${m.retries[cur.team]} left)`;
        }
      }
      SOUND_ENGINE.play(raw.kind === 'answer' ? 'correct' : timedOut ? 'buzzer' : 'wrong');
      const { outcome, triggers } = finalizeOutcome(m, mods, cur.team, cur.prompt, raw);
      const best = cur.prompt.answers.filter((a, i) => a.tier === 5 && !m.used.has(usedKey(cur.prompt.id, i))).slice(0, 3).map((a) => a.text);
      setFeed({ id: cur.id, team: cur.team, kind: cur.kind, outcome, triggers, best, total: cur.prompt.answers.length });
      m.q = null;
      setQ(null);
      input.clear();
      arcadeResolve(S, outcome);
      return undefined;
    },
    [mods, input]
  );

  const finish = useCallback(() => {
    const m = M.current;
    if (career) career.onFinish({ scores: [m.S.score[0], m.S.score[1]], stats: m.stats[0], sport });
  }, [career, sport]);

  const m = M.current;
  const S = m.S;
  const hints = CONTROL_HINTS[sport];
  const scores = S.score;
  const winner = scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1;

  const panelBelow = box.slack >= 190; // tall screens: question goes under the field instead of over it
  const questionPanel = q && (
    <div className={panelBelow ? 'mt-2 w-full max-w-3xl shrink-0 border-t-4 border-black shadow-[6px_6px_0_#000]' : 'absolute inset-x-2 bottom-2 z-20 mx-auto max-w-3xl border-t-4 border-black shadow-[6px_6px_0_#000]'}>
      <div className="flex items-center justify-between gap-2 border-x-4 border-black bg-[#ffd23f] px-3 py-1 text-[8px] text-black sm:text-[9px]">
        <span className="truncate">
          {teams[q.team].name} · {ACTION_WORDS[q.kind]}!
        </span>
        <span className="hidden shrink-0 sm:inline">RARER = BETTER {ACTION_WORDS[q.kind]}</span>
      </div>
      <PromptPanel key={q.id} prompt={q.prompt} team={teams[q.team]} seconds={GAME_CONFIG.timerSeconds + mods[q.team].extraTime} bonusSeconds={mods[q.team].extraTime} hint={q.hint} onSubmit={(t) => answer(t, false)} onTimeout={() => answer('', true)} />
    </div>
  );

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col gap-2">
      <ArcadeHud teams={teams} hud={hud} sport={sport} />
      <div ref={areaRef} className={`relative flex min-h-0 flex-1 flex-col items-center ${panelBelow ? 'justify-start' : 'justify-center'}`}>
        <div className="relative shrink-0 overflow-hidden border-4 border-black bg-black shadow-[4px_4px_0_#000]" style={{ width: box.w, height: box.h }}>
          <canvas ref={canvasRef} width={CW} height={CH} className="absolute inset-0 h-full w-full" style={{ imageRendering: 'pixelated' }} aria-label={`${SPORT_INFO[sport].label} match`} />
          <div className="crt pointer-events-none absolute inset-0" aria-hidden="true" />
          {cpuFeed && !feed && phase !== 'question' && (
            <div key={cpuFeed.id} className="pointer-events-none absolute bottom-1 left-1 z-10 max-w-[80%] border-2 border-black bg-black/80 px-2 py-1 text-[7px] text-slate-300 sm:text-[8px]">
              <span style={{ color: inkFor(teams[cpuFeed.team].primary) }}>{teams[cpuFeed.team].name}</span>: "{cpuFeed.text}" {cpuFeed.tier ? <span style={{ color: GAME_CONFIG.tiers[cpuFeed.tier].color }}>T{cpuFeed.tier}</span> : <span className="text-[#ef476f]">MISS</span>}
            </div>
          )}
          {q && !panelBelow && questionPanel}
        </div>
        {q && panelBelow && questionPanel}

        {feed && (
          <div key={feed.id} className="pointer-events-none absolute left-1/2 z-10 w-[min(94%,640px)] -translate-x-1/2 border-4 border-black bg-[#120f26]/95 px-3 py-2 text-center shadow-[4px_4px_0_#000]" style={{ top: panelBelow ? box.h + 8 : Math.max(8, (box.slack || 0) / 2 + 8) }}>
            <div className="flex flex-wrap items-center justify-center gap-2 text-[9px]">
              <span className="text-white">"{feed.outcome.kind === 'timeout' ? 'TIME UP' : feed.outcome.text}"</span>
              {feed.outcome.kind === 'answer' ? <TierChip tier={feed.outcome.tier} small /> : <span className="border-2 border-black bg-[#ef476f] px-1 text-[8px] text-black">{feed.outcome.kind === 'duplicate' ? 'ALREADY USED' : feed.outcome.kind === 'timeout' ? 'TIME UP' : 'NOT ON THE BOARD'}</span>}
              {feed.outcome.counter && <span className="text-[8px] text-[#ef476f]">⚠ COUNTERED</span>}
            </div>
            {feed.triggers.map((t, i) => (
              <div key={i} className="mt-1 text-[7px] text-[#4cc9f0]">
                ⚡ {t}
              </div>
            ))}
            {feed.best.length > 0 && (feed.outcome.kind !== 'answer' || feed.outcome.tier < 5) && <div className="mt-1 text-[7px] text-slate-400">ULTRA-RARE YOU COULD'VE SAID: {feed.best.join(', ')}</div>}
          </div>
        )}

        {phase === 'intro' && <ArcadeIntro sport={sport} teams={teams} twoP={twoP} label={career ? career.label : null} onStart={start} />}

        {paused && phase !== 'over' && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-3">
            <div className="w-full max-w-sm border-4 border-black bg-[#1b1736] p-4 text-center shadow-[6px_6px_0_#000]">
              <div className="text-lg text-[#ffd23f]">PAUSED</div>
              <div className="mt-4 flex flex-col gap-3">
                <PixelButton onClick={() => setPaused(false)}>▶ RESUME</PixelButton>
                {career ? (
                  <PixelButton color={forfeitArmed ? '#ef476f' : '#8d99ae'} onClick={() => (forfeitArmed ? career.onFinish({ forfeit: true, sport }) : setForfeitArmed(true))}>
                    {forfeitArmed ? 'CONFIRM FORFEIT (LOSS)' : 'FORFEIT MATCH'}
                  </PixelButton>
                ) : (
                  <PixelButton color="#8d99ae" onClick={onExit}>
                    QUIT TO SETUP
                  </PixelButton>
                )}
              </div>
            </div>
          </div>
        )}

        {phase === 'over' && (
          <div className="absolute inset-0 z-30 flex items-center justify-center overflow-auto bg-black/75 p-3">
            <div className="max-h-full w-full max-w-xl overflow-auto border-4 border-black bg-[#1b1736] p-4 shadow-[6px_6px_0_#000]">
              <div className="text-center text-base leading-relaxed text-[#ffd23f] sm:text-2xl" style={{ textShadow: '3px 3px 0 #000' }}>
                {winner === null ? "IT'S A DRAW!" : `${teams[winner].name} WIN!`}
              </div>
              <div className="mt-2 text-center text-2xl text-white sm:text-4xl" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {scores[0]} - {scores[1]}
              </div>
              <MatchStats teams={teams} stats={m.stats} />
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                {career ? (
                  <PixelButton onClick={finish}>BACK TO CLUBHOUSE ▶</PixelButton>
                ) : (
                  <>
                    <PixelButton onClick={onRematch}>↻ REMATCH</PixelButton>
                    <PixelButton onClick={onExit} color="#4cc9f0">
                      NEW SETUP
                    </PixelButton>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
        {!q && <TouchControls input={input} sport={sport} />}
      </div>
      <div className="hidden shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[9px] text-slate-300 sm:flex">
        {twoP ? (
          <>
            <span>
              <b className="text-[#ffd23f]">P1</b> WASD · F ACTION · G SHOOT/SWITCH
            </span>
            <span>
              <b className="text-[#4cc9f0]">P2</b> ARROWS · K ACTION · L SHOOT/SWITCH
            </span>
          </>
        ) : (
          hints.map(([k, v]) => (
            <span key={k}>
              <span className="border-2 border-black bg-[#1b1736] px-1 text-[#ffd23f]">{k}</span> {v}
            </span>
          ))
        )}
        <span>
          <span className="border-2 border-black bg-[#1b1736] px-1 text-[#ffd23f]">ESC</span> PAUSE
        </span>
      </div>
    </div>
  );
}

function MatchStats({ teams, stats }) {
  const rows = [
    ['QUESTIONS', (s) => s.plays],
    ['CORRECT', (s) => s.correct],
    ['ULTRA-RARE / RARE', (s) => `${s.tiers[5]} / ${s.tiers[4]}`],
    ['AVG RARITY', (s) => (s.correct ? (s.tierSum / s.correct).toFixed(1) : '-')],
    ['MISSES / TIME-UPS', (s) => `${s.invalid + s.dupes} / ${s.timeouts}`],
    ['GOT COUNTERED', (s) => s.countered],
    ['BEST ANSWER', (s) => (s.best ? `${s.best.text} (T${s.best.tier})` : '-')],
  ];
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full border-2 border-black text-[8px] sm:text-[9px]">
        <thead className="bg-black text-slate-400">
          <tr>
            <th className="px-2 py-1 text-left">TRIVIA</th>
            {teams.map((t, i) => (
              <th key={i} className="px-2 py-1 text-left" style={{ color: inkFor(t.primary) }}>
                {t.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, fn]) => (
            <tr key={label} className="border-t border-black/60">
              <td className="px-2 py-1 text-slate-400">{label}</td>
              <td className="px-2 py-1 text-white">{fn(stats[0])}</td>
              <td className="px-2 py-1 text-white">{fn(stats[1])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ArcadeIntro({ sport, teams, twoP, label, onStart }) {
  useConfirmKey(onStart);
  const info = SPORT_INFO[sport];
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-auto bg-black/65 p-3">
      <div className="w-full max-w-lg border-4 border-black bg-[#1b1736] p-4 text-center shadow-[6px_6px_0_#000]">
        <div className="text-3xl" aria-hidden="true">
          {info.icon}
        </div>
        {label && <div className="mt-1 text-[8px] text-slate-400">{label}</div>}
        <div className="mt-2 text-sm text-[#ffd23f] sm:text-xl">{info.label}</div>
        <div className="mt-2 text-[9px]">
          <span style={{ color: inkFor(teams[0].primary) }}>{teams[0].name}</span> <span className="text-slate-500">VS</span> <span style={{ color: inkFor(teams[1].primary) }}>{teams[1].name}</span>
        </div>
        <p className="mx-auto mt-3 max-w-md text-[8px] leading-relaxed text-slate-300 sm:text-[9px]">{info.blurb}</p>
        <div className="mt-3 grid gap-1 text-left text-[8px] sm:text-[9px]">
          {(twoP
            ? [
                ['P1', 'WASD MOVE · F ACTION · G SHOOT/SWITCH'],
                ['P2', 'ARROWS MOVE · K ACTION · L SHOOT/SWITCH'],
              ]
            : CONTROL_HINTS[sport]
          ).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2">
              <span className="w-14 shrink-0 border-2 border-black bg-black px-1 text-center text-[#ffd23f]">{k}</span>
              <span className="text-slate-200">{v}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 text-[8px] text-[#4cc9f0]">Every {sport === 'tennis' ? 'shot' : sport === 'football' ? 'throw' : 'pass and shot'} freezes play for a question. Rarer answer = better play.</div>
        <div className="mt-4">
          <PixelButton onClick={onStart}>▶ START (ENTER)</PixelButton>
        </div>
      </div>
    </div>
  );
}

/** A throwaway lineup (names, looks, abilities) for quick matches. */
function quickRoster(sport, stars) {
  const tmp = { nextId: 1, sigs: {}, players: {} };
  const r = {};
  ROLES[sport].forEach((role) => (r[role] = makePlayer(tmp, stars, sport, role)));
  return r;
}

const RETRO_CSS = `
.crt{background:repeating-linear-gradient(0deg,rgba(0,0,0,.22) 0 1px,transparent 1px 3px),radial-gradient(ellipse at center,transparent 60%,rgba(0,0,0,.45) 100%);}
.retro-bg{background-color:#0d0b1e;background-image:radial-gradient(#1f1a40 1px,transparent 1px),linear-gradient(180deg,#120e2a 0%,#0d0b1e 60%);background-size:12px 12px,100% 100%;}
@keyframes rc-blink{50%{opacity:.25}}
.rc-blink{animation:rc-blink 1s steps(1) infinite}
@media (prefers-reduced-motion: reduce){.rc-blink{animation:none}}
`;

export default function RetroClashTriviaBowl() {
  useFontLoader();
  const [screen, setScreen] = useState('title'); // title | newCareer | hub | match | quickSetup | quickMatch
  const [career, setCareer] = useState(() => loadCareer());
  const [quickSetup, setQuickSetup] = useState(DEFAULT_SETUP);
  const [match, setMatch] = useState(null);
  const [gameKey, setGameKey] = useState(0);
  const [muted, setMuted] = useState(false);
  const [tutorial, setTutorial] = useState(false);

  useEffect(() => {
    if (career) saveCareer(career);
  }, [career]);

  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    SOUND_ENGINE.setMuted(m);
    if (!m) {
      SOUND_ENGINE.unlock();
      SOUND_ENGINE.play('select');
    }
  };

  const tutorialSeen = () => {
    try {
      return window.localStorage.getItem(TUTORIAL_SEEN_KEY) === '1';
    } catch (e) {
      return false;
    }
  };

  const playFixture = (f, sport) => {
    const rivalIdx = f.home === 0 ? f.away : f.home;
    const club = career.teams[0];
    const rival = career.teams[rivalIdx];
    const setup = {
      sport,
      mode: '1p',
      difficulty: 'pro',
      teams: [
        { name: club.name, primary: club.primary, secondary: club.secondary, isCPU: false, roster: rosterFor(career, 0, sport) },
        { name: rival.name, primary: rival.primary, secondary: rival.secondary, isCPU: true, roster: rosterFor(career, rivalIdx, sport) },
      ],
    };
    const rating = teamRating(career, rivalIdx, sport);
    const ctx = {
      mods: [computeMods(activeFor(career, 0, sport)), computeMods(activeFor(career, rivalIdx, sport))],
      cpuWeights: cpuWeightsForRating(rating),
      cpuSkill: 0.8 + rating * 0.06,
      label: career.phase === 'playoffs' ? f.label : `SEASON ${career.season} · WEEK ${career.week + 1}`,
      onFinish: (res) => {
        setCareer((c) => finishUserMatch(c, res));
        setScreen('hub');
      },
    };
    setMatch({ setup, career: ctx });
    setGameKey((k) => k + 1);
    setScreen('match');
  };

  const inMatch = screen === 'match' || screen === 'quickMatch';
  const barBtn = 'border-2 border-black bg-[#1b1736] px-2 py-1 text-[9px] shadow-[2px_2px_0_#000] hover:bg-[#241f48]';

  return (
    <div className={`retro-bg flex flex-col text-white ${inMatch ? 'h-[100dvh] overflow-hidden' : 'min-h-[100dvh]'}`} style={FONT_STYLE}>
      <style>{RETRO_CSS}</style>
      <div style={GUTTER} className="flex shrink-0 items-center justify-between gap-2 border-b-4 border-black bg-[#0a0818] py-2">
        <div className="flex min-w-0 items-center gap-2">
          {screen !== 'title' && !inMatch && (
            <button type="button" onClick={() => setScreen('title')} className={`${barBtn} whitespace-nowrap`} style={FONT_STYLE}>
              ◀ MENU
            </button>
          )}
          <span className={`truncate text-[9px] text-[#ffd23f] ${screen === 'title' ? '' : 'hidden sm:inline'}`}>{screen === 'title' ? <span className="rc-blink">INSERT COIN</span> : 'RETRO CLASH: TRIVIA BOWL'}</span>
        </div>
        <div className="flex items-center gap-2">
          {!inMatch && (
            <button type="button" onClick={() => setTutorial(true)} className={`${barBtn} hidden sm:block`} style={FONT_STYLE}>
              ? HOW TO PLAY
            </button>
          )}
          <SideLinks rail={!inMatch} />
          <button type="button" onClick={toggleMute} className={barBtn} style={FONT_STYLE} aria-label={muted ? 'Unmute' : 'Mute'}>
            {muted ? '🔇' : '🔊'}
            <span className="hidden sm:inline">{muted ? ' MUTED' : ' SOUND'}</span>
          </button>
        </div>
      </div>
      <main className={`flex flex-1 flex-col ${inMatch ? 'min-h-0' : ''}`}>
        {screen === 'title' ? (
          <TitleScreen career={career} onContinue={() => setScreen('hub')} onNew={() => setScreen('newCareer')} onQuick={() => setScreen('quickSetup')} onTutorial={() => setTutorial(true)} />
        ) : (
          <div style={GUTTER} className={`flex flex-1 flex-col ${inMatch ? 'min-h-0 py-2' : 'py-4'}`}>
            {screen === 'newCareer' && (
              <NewCareerScreen
                hasSave={!!career}
                onBack={() => setScreen('title')}
                onCreate={(club) => {
                  setCareer(newCareer(club));
                  setScreen('hub');
                  if (!tutorialSeen()) setTutorial(true);
                }}
              />
            )}
            {screen === 'hub' && career && <CareerHub career={career} setCareer={setCareer} onPlay={playFixture} onHelp={() => setTutorial(true)} />}
            {screen === 'match' && match && <ArcadeScreen key={gameKey} setup={match.setup} career={match.career} />}
            {screen === 'quickSetup' && (
              <SetupScreen
                initial={quickSetup}
                onStart={(s) => {
                  setQuickSetup(s);
                  setMatch({ setup: s, career: null });
                  setGameKey((k) => k + 1);
                  setScreen('quickMatch');
                }}
              />
            )}
            {screen === 'quickMatch' && match && (
              <ArcadeScreen
                key={gameKey}
                setup={match.setup}
                onExit={() => setScreen('quickSetup')}
                onRematch={() => setGameKey((k) => k + 1)}
              />
            )}
          </div>
        )}
      </main>
      {tutorial && <Tutorial onClose={() => setTutorial(false)} />}
    </div>
  );
}
