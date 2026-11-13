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
     6. APP_UI           – team creator, HUD, prompt/timer, feedback modal, box score

   ADDING PROMPTS: append objects to TRIVIA_BANK with the same shape:
     { id, category, prompt, answers: [{ text, aliases: [], tier }] }
     tier 1 = most obvious answer ... tier 5 = ultra-rare deep cut.
     ids must be unique. Aliases are optional extra spellings; matching already
     ignores case, accents, punctuation, spaces, leading "the", and minor typos.
============================================================================= */

import React, { useState, useEffect, useRef, useCallback, useMemo, useReducer } from 'react';

/* =============================================================================
   1. TRIVIA_BANK
============================================================================= */
export const TRIVIA_BANK = [
  {
    id: 'nfl-teams',
    category: 'SPORTS',
    prompt: 'Name an NFL team',
    answers: [
      { text: 'Cowboys', aliases: ['dallas cowboys', 'dallas'], tier: 1 },
      { text: 'Patriots', aliases: ['new england patriots', 'new england', 'pats'], tier: 1 },
      { text: 'Packers', aliases: ['green bay packers', 'green bay'], tier: 1 },
      { text: 'Steelers', aliases: ['pittsburgh steelers', 'pittsburgh'], tier: 2 },
      { text: '49ers', aliases: ['niners', 'forty niners', 'san francisco 49ers', 'san francisco'], tier: 2 },
      { text: 'Chiefs', aliases: ['kansas city chiefs', 'kansas city', 'kc chiefs'], tier: 2 },
      { text: 'Eagles', aliases: ['philadelphia eagles', 'philadelphia', 'philly'], tier: 3 },
      { text: 'Bears', aliases: ['chicago bears', 'chicago'], tier: 3 },
      { text: 'Giants', aliases: ['new york giants', 'ny giants'], tier: 3 },
      { text: 'Broncos', aliases: ['denver broncos', 'denver'], tier: 3 },
      { text: 'Seahawks', aliases: ['seattle seahawks', 'seattle'], tier: 4 },
      { text: 'Ravens', aliases: ['baltimore ravens', 'baltimore'], tier: 4 },
      { text: 'Vikings', aliases: ['minnesota vikings', 'minnesota'], tier: 4 },
      { text: 'Jaguars', aliases: ['jacksonville jaguars', 'jacksonville', 'jags'], tier: 5 },
      { text: 'Texans', aliases: ['houston texans', 'houston'], tier: 5 },
      { text: 'Cardinals', aliases: ['arizona cardinals', 'arizona'], tier: 5 },
    ],
  },
  {
    id: 'africa-countries',
    category: 'GEOGRAPHY',
    prompt: 'Name a country in Africa',
    answers: [
      { text: 'Egypt', aliases: [], tier: 1 },
      { text: 'South Africa', aliases: [], tier: 1 },
      { text: 'Nigeria', aliases: [], tier: 1 },
      { text: 'Kenya', aliases: [], tier: 2 },
      { text: 'Morocco', aliases: [], tier: 2 },
      { text: 'Ethiopia', aliases: [], tier: 2 },
      { text: 'Ghana', aliases: [], tier: 3 },
      { text: 'Algeria', aliases: [], tier: 3 },
      { text: 'Tanzania', aliases: [], tier: 3 },
      { text: 'Senegal', aliases: [], tier: 4 },
      { text: 'Madagascar', aliases: [], tier: 4 },
      { text: 'Zimbabwe', aliases: [], tier: 4 },
      { text: 'Burkina Faso', aliases: [], tier: 5 },
      { text: 'Eritrea', aliases: [], tier: 5 },
      { text: 'Djibouti', aliases: [], tier: 5 },
      { text: 'Lesotho', aliases: [], tier: 5 },
    ],
  },
  {
    id: 'fruits',
    category: 'FOOD',
    prompt: 'Name a fruit',
    answers: [
      { text: 'Apple', aliases: [], tier: 1 },
      { text: 'Banana', aliases: [], tier: 1 },
      { text: 'Orange', aliases: [], tier: 1 },
      { text: 'Strawberry', aliases: [], tier: 2 },
      { text: 'Grape', aliases: ['grapes'], tier: 2 },
      { text: 'Mango', aliases: [], tier: 2 },
      { text: 'Pineapple', aliases: [], tier: 3 },
      { text: 'Watermelon', aliases: [], tier: 3 },
      { text: 'Peach', aliases: [], tier: 3 },
      { text: 'Cherry', aliases: ['cherries'], tier: 3 },
      { text: 'Kiwi', aliases: ['kiwifruit'], tier: 4 },
      { text: 'Papaya', aliases: [], tier: 4 },
      { text: 'Pomegranate', aliases: [], tier: 4 },
      { text: 'Lychee', aliases: ['litchi', 'lichee'], tier: 5 },
      { text: 'Durian', aliases: [], tier: 5 },
      { text: 'Rambutan', aliases: [], tier: 5 },
      { text: 'Persimmon', aliases: [], tier: 5 },
    ],
  },
  {
    id: 'us-states',
    category: 'GEOGRAPHY',
    prompt: 'Name a US state',
    answers: [
      { text: 'California', aliases: ['cali'], tier: 1 },
      { text: 'Texas', aliases: [], tier: 1 },
      { text: 'Florida', aliases: [], tier: 1 },
      { text: 'New York', aliases: [], tier: 1 },
      { text: 'Ohio', aliases: [], tier: 2 },
      { text: 'Washington', aliases: [], tier: 2 },
      { text: 'Georgia', aliases: [], tier: 2 },
      { text: 'Colorado', aliases: [], tier: 3 },
      { text: 'Arizona', aliases: [], tier: 3 },
      { text: 'Michigan', aliases: [], tier: 3 },
      { text: 'Oregon', aliases: [], tier: 4 },
      { text: 'Nevada', aliases: [], tier: 4 },
      { text: 'Kentucky', aliases: [], tier: 4 },
      { text: 'Wyoming', aliases: [], tier: 5 },
      { text: 'Delaware', aliases: [], tier: 5 },
      { text: 'North Dakota', aliases: [], tier: 5 },
      { text: 'Vermont', aliases: [], tier: 5 },
    ],
  },
  {
    id: 'dog-breeds',
    category: 'ANIMALS',
    prompt: 'Name a breed of dog',
    answers: [
      { text: 'Labrador', aliases: ['lab', 'labrador retriever'], tier: 1 },
      { text: 'Golden Retriever', aliases: ['golden'], tier: 1 },
      { text: 'German Shepherd', aliases: ['alsatian'], tier: 1 },
      { text: 'Poodle', aliases: [], tier: 2 },
      { text: 'Bulldog', aliases: ['english bulldog', 'french bulldog', 'frenchie'], tier: 2 },
      { text: 'Beagle', aliases: [], tier: 2 },
      { text: 'Husky', aliases: ['siberian husky'], tier: 3 },
      { text: 'Chihuahua', aliases: [], tier: 3 },
      { text: 'Dachshund', aliases: ['wiener dog', 'sausage dog'], tier: 3 },
      { text: 'Pug', aliases: [], tier: 3 },
      { text: 'Boxer', aliases: [], tier: 4 },
      { text: 'Great Dane', aliases: [], tier: 4 },
      { text: 'Corgi', aliases: ['welsh corgi', 'pembroke welsh corgi'], tier: 4 },
      { text: 'Shiba Inu', aliases: ['shiba'], tier: 5 },
      { text: 'Basenji', aliases: [], tier: 5 },
      { text: 'Vizsla', aliases: [], tier: 5 },
      { text: 'Weimaraner', aliases: [], tier: 5 },
    ],
  },
  {
    id: 'elements',
    category: 'SCIENCE',
    prompt: 'Name a chemical element',
    answers: [
      { text: 'Oxygen', aliases: [], tier: 1 },
      { text: 'Hydrogen', aliases: [], tier: 1 },
      { text: 'Carbon', aliases: [], tier: 1 },
      { text: 'Gold', aliases: [], tier: 2 },
      { text: 'Iron', aliases: [], tier: 2 },
      { text: 'Helium', aliases: [], tier: 2 },
      { text: 'Nitrogen', aliases: [], tier: 3 },
      { text: 'Silver', aliases: [], tier: 3 },
      { text: 'Sodium', aliases: [], tier: 3 },
      { text: 'Neon', aliases: [], tier: 4 },
      { text: 'Uranium', aliases: [], tier: 4 },
      { text: 'Calcium', aliases: [], tier: 4 },
      { text: 'Tungsten', aliases: ['wolfram'], tier: 5 },
      { text: 'Bismuth', aliases: [], tier: 5 },
      { text: 'Xenon', aliases: [], tier: 5 },
      { text: 'Molybdenum', aliases: [], tier: 5 },
    ],
  },
  {
    id: 'beatles-songs',
    category: 'MUSIC',
    prompt: 'Name a Beatles song',
    answers: [
      { text: 'Hey Jude', aliases: [], tier: 1 },
      { text: 'Let It Be', aliases: [], tier: 1 },
      { text: 'Yesterday', aliases: [], tier: 1 },
      { text: 'Yellow Submarine', aliases: [], tier: 2 },
      { text: 'Help!', aliases: ['help'], tier: 2 },
      { text: 'Come Together', aliases: [], tier: 2 },
      { text: 'Here Comes the Sun', aliases: [], tier: 3 },
      { text: 'Twist and Shout', aliases: [], tier: 3 },
      { text: 'All You Need Is Love', aliases: [], tier: 3 },
      { text: 'Eleanor Rigby', aliases: [], tier: 4 },
      { text: 'Penny Lane', aliases: [], tier: 4 },
      { text: 'Blackbird', aliases: [], tier: 4 },
      { text: 'Strawberry Fields Forever', aliases: ['strawberry fields'], tier: 5 },
      { text: "Octopus's Garden", aliases: ['octopus garden'], tier: 5 },
      { text: 'Norwegian Wood', aliases: [], tier: 5 },
      { text: 'Paperback Writer', aliases: [], tier: 5 },
    ],
  },
  {
    id: 'euro-capitals',
    category: 'GEOGRAPHY',
    prompt: 'Name a European capital city',
    answers: [
      { text: 'Paris', aliases: [], tier: 1 },
      { text: 'London', aliases: [], tier: 1 },
      { text: 'Rome', aliases: [], tier: 1 },
      { text: 'Berlin', aliases: [], tier: 2 },
      { text: 'Madrid', aliases: [], tier: 2 },
      { text: 'Moscow', aliases: [], tier: 2 },
      { text: 'Amsterdam', aliases: [], tier: 3 },
      { text: 'Athens', aliases: [], tier: 3 },
      { text: 'Vienna', aliases: ['wien'], tier: 3 },
      { text: 'Dublin', aliases: [], tier: 3 },
      { text: 'Lisbon', aliases: ['lisboa'], tier: 4 },
      { text: 'Prague', aliases: ['praha'], tier: 4 },
      { text: 'Stockholm', aliases: [], tier: 4 },
      { text: 'Ljubljana', aliases: [], tier: 5 },
      { text: 'Vilnius', aliases: [], tier: 5 },
      { text: 'Valletta', aliases: [], tier: 5 },
      { text: 'Tallinn', aliases: [], tier: 5 },
    ],
  },
  {
    id: 'olympic-sports',
    category: 'SPORTS',
    prompt: 'Name a Summer Olympic sport',
    answers: [
      { text: 'Swimming', aliases: [], tier: 1 },
      { text: 'Track and Field', aliases: ['athletics', 'track'], tier: 1 },
      { text: 'Gymnastics', aliases: [], tier: 1 },
      { text: 'Basketball', aliases: [], tier: 2 },
      { text: 'Soccer', aliases: ['football'], tier: 2 },
      { text: 'Tennis', aliases: [], tier: 2 },
      { text: 'Boxing', aliases: [], tier: 3 },
      { text: 'Volleyball', aliases: ['beach volleyball'], tier: 3 },
      { text: 'Diving', aliases: [], tier: 3 },
      { text: 'Cycling', aliases: ['bmx'], tier: 3 },
      { text: 'Fencing', aliases: [], tier: 4 },
      { text: 'Rowing', aliases: [], tier: 4 },
      { text: 'Wrestling', aliases: [], tier: 4 },
      { text: 'Modern Pentathlon', aliases: ['pentathlon'], tier: 5 },
      { text: 'Handball', aliases: ['team handball'], tier: 5 },
      { text: 'Trampoline', aliases: [], tier: 5 },
      { text: 'Water Polo', aliases: [], tier: 5 },
    ],
  },
  {
    id: 'pixar-movies',
    category: 'MOVIES',
    prompt: 'Name a Pixar movie',
    answers: [
      { text: 'Toy Story', aliases: [], tier: 1 },
      { text: 'Finding Nemo', aliases: [], tier: 1 },
      { text: 'Cars', aliases: [], tier: 1 },
      { text: 'Up', aliases: [], tier: 2 },
      { text: 'Monsters, Inc.', aliases: ['monsters inc', 'monsters incorporated'], tier: 2 },
      { text: 'The Incredibles', aliases: [], tier: 2 },
      { text: 'Inside Out', aliases: [], tier: 3 },
      { text: 'Coco', aliases: [], tier: 3 },
      { text: 'Ratatouille', aliases: [], tier: 3 },
      { text: 'WALL-E', aliases: ['walle'], tier: 3 },
      { text: 'Brave', aliases: [], tier: 4 },
      { text: "A Bug's Life", aliases: ['bugs life'], tier: 4 },
      { text: 'Soul', aliases: [], tier: 4 },
      { text: 'Luca', aliases: [], tier: 5 },
      { text: 'Onward', aliases: [], tier: 5 },
      { text: 'The Good Dinosaur', aliases: [], tier: 5 },
      { text: 'Elemental', aliases: [], tier: 5 },
    ],
  },
  {
    id: 'tennis-players',
    category: 'SPORTS',
    prompt: 'Name a famous tennis player (past or present)',
    answers: [
      { text: 'Serena Williams', aliases: ['serena'], tier: 1 },
      { text: 'Roger Federer', aliases: ['federer'], tier: 1 },
      { text: 'Rafael Nadal', aliases: ['nadal', 'rafa', 'rafa nadal'], tier: 1 },
      { text: 'Novak Djokovic', aliases: ['djokovic', 'novak'], tier: 2 },
      { text: 'Venus Williams', aliases: ['venus'], tier: 2 },
      { text: 'Andre Agassi', aliases: ['agassi'], tier: 2 },
      { text: 'Pete Sampras', aliases: ['sampras'], tier: 3 },
      { text: 'Maria Sharapova', aliases: ['sharapova'], tier: 3 },
      { text: 'Andy Murray', aliases: ['murray'], tier: 3 },
      { text: 'Carlos Alcaraz', aliases: ['alcaraz'], tier: 3 },
      { text: 'Steffi Graf', aliases: ['graf'], tier: 4 },
      { text: 'John McEnroe', aliases: ['mcenroe'], tier: 4 },
      { text: 'Billie Jean King', aliases: [], tier: 4 },
      { text: 'Rod Laver', aliases: ['laver'], tier: 5 },
      { text: 'Martina Navratilova', aliases: ['navratilova'], tier: 5 },
      { text: 'Bjorn Borg', aliases: ['borg'], tier: 5 },
      { text: 'Arthur Ashe', aliases: ['ashe'], tier: 5 },
    ],
  },
  {
    id: 'premier-league-clubs',
    category: 'SPORTS',
    prompt: 'Name an English Premier League club (any era)',
    answers: [
      { text: 'Manchester United', aliases: ['man united', 'man utd', 'man u'], tier: 1 },
      { text: 'Liverpool', aliases: [], tier: 1 },
      { text: 'Arsenal', aliases: [], tier: 1 },
      { text: 'Chelsea', aliases: [], tier: 2 },
      { text: 'Manchester City', aliases: ['man city'], tier: 2 },
      { text: 'Tottenham', aliases: ['tottenham hotspur', 'spurs'], tier: 2 },
      { text: 'Everton', aliases: [], tier: 3 },
      { text: 'Newcastle', aliases: ['newcastle united'], tier: 3 },
      { text: 'West Ham', aliases: ['west ham united'], tier: 3 },
      { text: 'Aston Villa', aliases: ['villa'], tier: 3 },
      { text: 'Leicester City', aliases: ['leicester'], tier: 4 },
      { text: 'Southampton', aliases: [], tier: 4 },
      { text: 'Leeds United', aliases: ['leeds'], tier: 4 },
      { text: 'Brentford', aliases: [], tier: 5 },
      { text: 'Bournemouth', aliases: ['afc bournemouth'], tier: 5 },
      { text: 'Wolves', aliases: ['wolverhampton', 'wolverhampton wanderers'], tier: 5 },
      { text: 'Brighton', aliases: ['brighton and hove albion', 'brighton hove albion'], tier: 5 },
    ],
  },
];

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
export function getSprite(pose, head, primary, secondary, flip) {
  const key = `${pose}|${head}|${primary}|${secondary}|${flip ? 1 : 0}`;
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
      const col = ch === 'P' ? primary : ch === 'S' ? secondary : FIXED_COLORS[ch];
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
  let best = null;
  for (const { idx, n } of candidatesFor(prompt)) {
    const max = allowedTypos(Math.min(g.length, n.length));
    const d = levenshtein(g, n, max);
    if (d > max) continue;
    const ans = prompt.answers[idx];
    if (!best || d < best.dist || (d === best.dist && ans.tier > best.answer.tier)) best = { idx, answer: ans, dist: d };
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

function cpuAnswer(prompt, used, difficulty) {
  const diff = GAME_CONFIG.cpu.difficulties[difficulty] || GAME_CONFIG.cpu.difficulties.pro;
  const tier = weightedPick(diff.tierWeights);
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
//   resolve(s, outcome, actor, teams) -> { state, anim, headline, detail, tone, quick, toast? }
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
  resolve(s, o, actor, teams) {
    const c = GAME_CONFIG.football;
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
      const gain = o.tier === 5 ? 100 - from : c.yardsByTier[o.tier];
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
    return { state: n, anim: { sport: 'football', offense: off, from, toGo: s.toGo, tone, sub, ...play }, headline, detail, tone, quick: false };
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
const newTennisStats = () => ({ aces: 0, winners: 0, smashes: 0, errors: 0 });

const TennisEngine = {
  id: 'tennis',
  label: 'TENNIS TIEBREAK',
  icon: '🎾',
  head: 'hair',
  blurb: 'First to 7, win by 2. Every answer is a shot. Ultra-rares are aces, rares paint the corners, obvious answers get SMASHED back.',
  init() {
    return { points: [0, 0], pointNo: 0, server: 0, rally: { hitter: 0, shots: 0, pressure: false }, ys: [110, 110], ts: [newTennisStats(), newTennisStats()], over: false };
  },
  currentActor: (s) => s.rally.hitter,
  isOver: (s) => s.over,
  scores: (s) => s.points,
  resolve(s, o, actor, teams) {
    const c = GAME_CONFIG.tennis;
    const n = clone(s);
    const opp = 1 - actor;
    const r = s.rally;
    const serve = r.shots === 0;
    let result;
    let winner = null;
    let banner = null;
    let errorType = 'net';
    let stretched = false;
    if (o.kind !== 'answer') {
      result = 'error';
      winner = opp;
      errorType = Math.random() < 0.5 ? 'net' : 'out';
      banner = serve ? 'DOUBLE FAULT!' : o.kind === 'timeout' ? 'TOO SLOW!' : 'UNFORCED ERROR!';
      n.ts[actor].errors++;
    } else if (r.pressure && o.tier < c.pressureMinTier) {
      result = 'error';
      winner = opp;
      stretched = true;
      banner = 'OVERPOWERED!';
      n.ts[opp].winners++;
    } else if (o.counter) {
      result = 'smash';
      winner = opp;
      banner = 'SMASH WINNER!';
      n.ts[opp].smashes++;
    } else if (o.tier === 5) {
      result = serve ? 'ace' : 'winner';
      winner = actor;
      banner = serve ? 'ACE!' : 'WINNER!';
      n.ts[actor][serve ? 'aces' : 'winners']++;
    } else if (o.tier === 4 && !(Math.random() < c.deepRetrieveChance && r.shots + 1 < c.maxRallyShots)) {
      result = 'winner';
      winner = actor;
      banner = 'CORNER WINNER!';
      n.ts[actor].winners++;
    } else if (o.tier === 4) {
      result = 'retrieved';
      banner = 'WHAT A GET!';
    } else if (r.shots + 1 >= c.maxRallyShots && o.tier >= 3) {
      result = 'winner';
      winner = actor;
      banner = 'RALLY WINNER!';
      n.ts[actor].winners++;
    } else {
      result = 'continue';
    }
    const toY = rand(78, 142);
    const anim = { sport: 'tennis', hitter: actor, fromY: s.ys[actor], recvY: s.ys[opp], toY, result, banner, serve, errorType, stretched };
    if (winner === null) {
      n.rally = { hitter: opp, shots: r.shots + 1, pressure: result === 'retrieved' };
      n.ys[opp] = toY;
      const shot = o.tier >= 3 ? 'returns it' : 'pops up a weak return';
      return {
        state: n,
        anim,
        quick: true,
        toast: result === 'retrieved' ? `${teams[opp].name} chases it down! Needs a SOLID+ reply...` : `${teams[actor].name} ${shot}: "${o.matchedText}"`,
        tone: o.tier >= 3 ? 'good' : 'meh',
      };
    }
    n.points[winner] += 1;
    if (n.points[winner] >= c.pointsToWin && n.points[winner] - n.points[1 - winner] >= c.winBy) n.over = true;
    n.pointNo += 1;
    n.server = tennisServerFor(n.pointNo);
    n.rally = { hitter: n.server, shots: 0, pressure: false };
    n.ys = [110, 110];
    const detail = `${teams[winner].name} take the point. Tiebreak: ${n.points[0]}-${n.points[1]}.${!n.over && n.server !== s.server ? ` ${teams[n.server].name} to serve.` : ''}`;
    return { state: n, anim, headline: banner, detail, tone: winner === actor ? 'great' : 'bad', quick: false };
  },
  status(s, teams) {
    if (s.over) return 'FINAL';
    const c = GAME_CONFIG.tennis;
    const tag = s.points.some((p) => p >= c.pointsToWin - 1) && Math.abs(s.points[0] - s.points[1]) >= 1 ? ' · SET POINT' : '';
    return `TIEBREAK · ${teams[s.server].name} SERVING · SHOT ${s.rally.shots + 1}${s.rally.pressure ? ' · UNDER PRESSURE' : ''}${tag}`;
  },
  scene: (s) => ({ sport: 'tennis', hitter: s.rally.hitter, ys: s.ys }),
  boxScore(s) {
    return { columns: ['ACES', 'WINNERS', 'SMASHES', 'ERRORS'], rows: s.ts.map((t) => [t.aces, t.winners, t.smashes, t.errors]) };
  },
};

const SoccerEngine = {
  id: 'soccer',
  label: 'SOCCER SHOOTOUT',
  icon: '⚽',
  head: 'hair',
  blurb: '5 penalties each, then sudden death. Rarity sets shot power & placement vs the diving keeper. Weak shots get stolen for a BREAKAWAY goal.',
  init() {
    return { kicks: [[], []], goals: [0, 0], bonus: [0, 0], kicker: 0, over: false };
  },
  currentActor: (s) => s.kicker,
  isOver: (s) => s.over,
  scores: (s) => s.goals,
  resolve(s, o, actor, teams) {
    const c = GAME_CONFIG.soccer;
    const n = clone(s);
    const opp = 1 - actor;
    const side = Math.random() < 0.5 ? -1 : 1;
    let result;
    let gx;
    let gy;
    let flight;
    let diveDir;
    let diveHigh = false;
    let banner;
    if (o.kind !== 'answer') {
      result = 'miss';
      const over = Math.random() < 0.5;
      gx = over ? side * 0.4 : side * 1.4;
      gy = over ? 1.35 : 0.3;
      flight = 0.5;
      diveDir = pick([-1, 0, 1]);
      banner = o.kind === 'timeout' ? 'SHANKED IT!' : over ? 'OVER THE BAR!' : 'WIDE!';
    } else if (o.counter) {
      result = 'breakaway';
      gx = side * 0.74;
      gy = 0.15;
      flight = 0.62;
      diveDir = side;
      banner = 'BREAKAWAY GOAL!';
    } else {
      const shot = c.shots[o.tier];
      flight = shot.flight;
      if (Math.random() < shot.save) {
        result = 'save';
        gx = side * 0.74;
        gy = rand(shot.gy[0], shot.gy[1]);
        diveDir = side;
        diveHigh = gy > 0.5;
        banner = 'SAVED!';
      } else {
        result = 'goal';
        gx = side * shot.gx;
        gy = rand(shot.gy[0], shot.gy[1]);
        diveDir = o.tier === 5 ? side : -side; // tier 5 beats a correct dive, others send the keeper the wrong way
        banner = o.tier === 5 ? 'TOP BINS!' : o.tier === 4 ? 'CORNER GOAL!' : 'GOAL!';
      }
    }
    n.kicks[actor].push(result === 'goal' ? 'G' : 'X');
    if (result === 'goal') n.goals[actor] += 1;
    if (result === 'breakaway' && c.counterAwardsGoal) {
      n.goals[opp] += 1;
      n.bonus[opp] += 1;
    }
    const k0 = n.kicks[0].length;
    const k1 = n.kicks[1].length;
    if (k0 <= c.rounds && k1 <= c.rounds) {
      const rem0 = c.rounds - k0;
      const rem1 = c.rounds - k1;
      if (n.goals[0] > n.goals[1] + rem1 || n.goals[1] > n.goals[0] + rem0) n.over = true;
    }
    if (k0 === k1 && k0 >= c.rounds && n.goals[0] !== n.goals[1]) n.over = true;
    if (k0 === k1 && k0 >= c.rounds + c.maxSuddenDeathRounds) n.over = true;
    n.kicker = k0 > k1 ? 1 : 0;
    const scoreLine = `Shootout: ${n.goals[0]}-${n.goals[1]}.`;
    const details = {
      goal: `${teams[actor].name} bury it! ${scoreLine}`,
      save: `${teams[opp].name}'s keeper reads it and parries. ${scoreLine}`,
      miss: `${o.kind === 'timeout' ? 'Ran out of time and' : 'Bad answer,'} the shot sails off target. ${scoreLine}`,
      breakaway: `Too obvious! The keeper smothers it and launches a counter: ${teams[opp].name} score on the breakaway. ${scoreLine}`,
    };
    return {
      state: n,
      anim: { sport: 'soccer', kicker: actor, result, gx, gy, flight, diveDir, diveHigh, banner },
      headline: banner,
      detail: details[result],
      tone: result === 'goal' ? 'great' : 'bad',
      quick: false,
    };
  },
  status(s) {
    if (s.over) return 'FINAL';
    const round = s.kicks[s.kicker].length + 1;
    return round > GAME_CONFIG.soccer.rounds ? `SUDDEN DEATH · ROUND ${round}` : `PENALTY SHOOTOUT · ROUND ${round}/${GAME_CONFIG.soccer.rounds}`;
  },
  scene: (s) => ({ sport: 'soccer', kicker: s.kicker }),
  pips(s, team) {
    const len = Math.max(GAME_CONFIG.soccer.rounds, s.kicks[0].length, s.kicks[1].length);
    return Array.from({ length: len }, (_, i) => s.kicks[team][i] || null);
  },
  boxScore(s) {
    const len = Math.max(GAME_CONFIG.soccer.rounds, s.kicks[0].length, s.kicks[1].length);
    const columns = [...Array.from({ length: len }, (_, i) => `K${i + 1}`), 'BRK'];
    return { columns, rows: [0, 1].map((t) => [...Array.from({ length: len }, (_, i) => (s.kicks[t][i] === 'G' ? 'O' : s.kicks[t][i] === 'X' ? 'X' : '-')), s.bonus[t]]) };
  },
};

export const SPORT_ENGINES = { football: FootballEngine, tennis: TennisEngine, soccer: SoccerEngine };

const newStats = () => ({ plays: 0, correct: 0, tiers: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, tierSum: 0, invalid: 0, timeouts: 0, dupes: 0, countered: 0, forced: 0, best: null });

function recordStats(mine, theirs, o) {
  mine.plays += 1;
  if (o.kind === 'answer') {
    mine.correct += 1;
    mine.tiers[o.tier] += 1;
    mine.tierSum += o.tier;
    if (!mine.best || o.tier > mine.best.tier) mine.best = { text: o.matchedText, tier: o.tier };
    if (o.counter) {
      mine.countered += 1;
      theirs.forced += 1;
    }
  } else if (o.kind === 'timeout') mine.timeouts += 1;
  else if (o.kind === 'duplicate') mine.dupes += 1;
  else mine.invalid += 1;
}

function createMatch(setup) {
  return {
    sport: SPORT_ENGINES[setup.sport].init(),
    stats: [newStats(), newStats()],
    used: new Set(),
    deck: shuffle(TRIVIA_BANK.map((_, i) => i)),
    deckPos: 0,
    lastHumanActor: null,
    turn: null,
    turnId: 0,
    result: null,
    shownSport: null,
  };
}

/* =============================================================================
   6. APP_UI
============================================================================= */
const COLOR_SWATCHES = ['#e63946', '#f77f00', '#fcbf49', '#06d6a0', '#2a9d8f', '#457b9d', '#1d3557', '#7b2cbf', '#ff4d9d', '#f1faee', '#222222', '#8d5524'];
const TONE_COLORS = { great: '#06d6a0', good: '#4cc9f0', meh: '#f4a261', bad: '#ef476f' };
const FONT_STYLE = { fontFamily: PIXEL_FONT };

const DEFAULT_SETUP = {
  sport: 'football',
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

function SpritePreview({ primary, secondary, head, pose = 'stand', scale = 5 }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, c.width, c.height);
    const spr = getSprite(pose, head, primary, secondary, false);
    g.drawImage(spr, Math.round((c.width - spr.width * scale) / 2), c.height - spr.height * scale, spr.width * scale, spr.height * scale);
  }, [primary, secondary, head, pose, scale]);
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
  const engine = SPORT_ENGINES[setup.sport];
  const setTeam = (i, t) => setSetup((s) => ({ ...s, teams: s.teams.map((x, j) => (j === i ? t : x)) }));
  const start = () => {
    const teams = setup.teams.map((t, i) => ({ ...t, name: t.name.trim() || (i === 0 ? 'HOME' : 'AWAY'), isCPU: setup.mode === '1p' && i === 1 }));
    onStart({ ...setup, teams });
  };
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <div className="text-center">
        <h1 className="text-2xl leading-relaxed text-[#ffd23f] sm:text-4xl" style={{ textShadow: '4px 4px 0 #e63946, 8px 8px 0 #000' }}>
          RETRO CLASH
        </h1>
        <div className="mt-2 text-sm text-[#4cc9f0] sm:text-lg" style={{ textShadow: '3px 3px 0 #000' }}>
          TRIVIA BOWL
        </div>
        <p className="mx-auto mt-3 max-w-xl text-[9px] leading-relaxed text-slate-300">
          Answer survey-style prompts. RARE answers make big plays. OBVIOUS answers invite a counter-attack.
        </p>
      </div>

      <section>
        <div className="mb-2 text-[10px] text-slate-400">1. SPORT MODE</div>
        <div className="grid gap-3 sm:grid-cols-3">
          {Object.values(SPORT_ENGINES).map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => {
                SOUND_ENGINE.unlock();
                SOUND_ENGINE.play('select');
                setSetup((s) => ({ ...s, sport: e.id }));
              }}
              className={`border-4 border-black p-3 text-left shadow-[4px_4px_0_#000] ${setup.sport === e.id ? 'bg-[#ffd23f] text-black' : 'bg-[#1b1736] text-white'}`}
              style={FONT_STYLE}
            >
              <div className="text-xl">{e.icon}</div>
              <div className="mt-1 text-[10px]">{e.label}</div>
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
              ['2p', '2P PASS & PLAY'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() =>
                  setSetup((s) => ({
                    ...s,
                    mode: id,
                    teams: s.teams.map((t, i) => (i === 1 && id === '2p' && t.name === 'CPU CYBORGS' ? { ...t, name: 'PIXEL PIRATES' } : i === 1 && id === '1p' && t.name === 'PIXEL PIRATES' ? { ...t, name: 'CPU CYBORGS' } : t)),
                  }))
                }
                className={`border-4 border-black px-3 py-2 text-[10px] shadow-[3px_3px_0_#000] ${setup.mode === id ? 'bg-[#4cc9f0] text-black' : 'bg-[#1b1736] text-white'}`}
                style={FONT_STYLE}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {setup.mode === '1p' && (
          <div>
            <div className="mb-2 text-[10px] text-slate-400">CPU SKILL</div>
            <div className="flex gap-2">
              {Object.entries(GAME_CONFIG.cpu.difficulties).map(([id, d]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSetup((s) => ({ ...s, difficulty: id }))}
                  className={`border-4 border-black px-3 py-2 text-[10px] shadow-[3px_3px_0_#000] ${setup.difficulty === id ? 'bg-[#c77dff] text-black' : 'bg-[#1b1736] text-white'}`}
                  style={FONT_STYLE}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 text-[10px] text-slate-400">3. TEAMS & JERSEYS</div>
        <div className="grid gap-4 md:grid-cols-2">
          {setup.teams.map((t, i) => (
            <TeamCard key={i} index={i} team={t} isCPU={setup.mode === '1p' && i === 1} head={engine.head} onChange={(nt) => setTeam(i, nt)} />
          ))}
        </div>
      </section>

      <div className="flex justify-center pb-4">
        <PixelButton onClick={start} className="px-8 text-sm">
          ▶ {setup.sport === 'football' ? 'KICK OFF' : setup.sport === 'tennis' ? 'SERVE IT UP' : 'STEP UP'}
        </PixelButton>
      </div>
    </div>
  );
}

function GameCanvas({ timeline, onEnd }) {
  const canvasRef = useRef(null);
  const tlRef = useRef(timeline);
  const startRef = useRef(0);
  const firedRef = useRef(new Set());
  const endedRef = useRef(false);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  useEffect(() => {
    tlRef.current = timeline;
    startRef.current = performance.now();
    firedRef.current = new Set();
    endedRef.current = false;
  }, [timeline]);

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    let raf;
    const loop = (now) => {
      const tl = tlRef.current;
      if (tl) {
        const t = (now - startRef.current) / 1000;
        tl.events.forEach((ev, i) => {
          if (ev.sound && ev.t <= t && !firedRef.current.has(i)) {
            firedRef.current.add(i);
            SOUND_ENGINE.play(ev.sound);
          }
        });
        try {
          renderFrame(ctx, tl, tl.idle ? t : Math.min(t, tl.duration), now / 1000);
        } catch (e) {
          /* never let a draw error freeze the loop */
        }
        if (!tl.idle && t >= tl.duration && !endedRef.current) {
          endedRef.current = true;
          if (onEndRef.current) onEndRef.current();
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} width={CW} height={CH} className="block w-full border-4 border-black bg-black" style={{ imageRendering: 'pixelated', aspectRatio: '16 / 9' }} />;
}

function Scoreboard({ teams, engine, sportState, activeTeam }) {
  const scores = engine.scores(sportState);
  const side = (i) => (
    <div className={`flex min-w-0 flex-1 items-center gap-2 ${i === 1 ? 'flex-row-reverse text-right' : ''}`}>
      <div className="h-8 w-3 shrink-0 border-2 border-black" style={{ background: `linear-gradient(${teams[i].primary} 60%, ${teams[i].secondary} 60%)` }} />
      <div className="min-w-0">
        <div className="truncate text-[9px] sm:text-[11px]" style={{ color: teams[i].primary === '#222222' ? '#ddd' : teams[i].primary }}>
          {activeTeam === i && <span className="text-[#ffd23f]">{i === 0 ? '▶ ' : ''}</span>}
          {teams[i].name}
          {activeTeam === i && i === 1 && <span className="text-[#ffd23f]"> ◀</span>}
        </div>
        {engine.pips && (
          <div className={`mt-1 flex gap-[3px] ${i === 1 ? 'justify-end' : ''}`}>
            {engine.pips(sportState, i).map((p, k) => (
              <span key={k} className="inline-block h-2 w-2 border border-black" style={{ background: p === 'G' ? '#06d6a0' : p === 'X' ? '#ef476f' : '#444' }} />
            ))}
          </div>
        )}
      </div>
      <div className="shrink-0 border-2 border-black bg-black px-2 py-1 text-lg text-[#ffd23f] sm:text-2xl">{String(scores[i]).padStart(2, '0')}</div>
    </div>
  );
  return (
    <div className="border-4 border-b-0 border-black bg-[#120f26] px-2 py-2">
      <div className="flex items-center gap-2">
        {side(0)}
        <div className="hidden text-[10px] text-slate-500 sm:block">VS</div>
        {side(1)}
      </div>
      <div className="mt-2 text-center text-[8px] leading-relaxed text-[#4cc9f0] sm:text-[9px]">{engine.status(sportState, teams)}</div>
    </div>
  );
}

function PromptPanel({ prompt, team, seconds, onSubmit, onTimeout }) {
  const [text, setText] = useState('');
  const [left, setLeft] = useState(seconds);
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
    onSubmit(text);
  };
  const pct = (left / seconds) * 100;
  const barColor = left <= 5 ? '#ef476f' : left <= 9 ? '#ffd23f' : '#06d6a0';
  return (
    <form onSubmit={submit} className="border-4 border-t-0 border-black bg-[#1b1736] p-3">
      <div className="mb-2 flex items-center justify-between text-[8px]">
        <span className="border-2 border-black bg-black px-2 py-1 text-[#c77dff]">{prompt.category}</span>
        <span style={{ color: team.primary === '#222222' ? '#ddd' : team.primary }}>{team.name} ON THE CLOCK</span>
      </div>
      <div className="mb-3 text-center text-[11px] leading-relaxed text-white sm:text-sm">{prompt.prompt}</div>
      <div className="mb-3 h-4 w-full border-2 border-black bg-black">
        <div className="h-full transition-[width] duration-75 ease-linear" style={{ width: `${pct}%`, background: barColor }} />
      </div>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="TYPE A RARE ANSWER..."
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
      <div className="mt-2 flex justify-between text-[8px] text-slate-500">
        <span>{Math.ceil(left)}s</span>
        <span>T1-T2 ANSWERS RISK A COUNTER-ATTACK</span>
      </div>
    </form>
  );
}

function CpuPanel({ prompt, team }) {
  return (
    <div className="border-4 border-t-0 border-black bg-[#1b1736] p-3 text-center">
      <div className="mb-2 text-[8px] text-[#c77dff]">{prompt.category}</div>
      <div className="mb-3 text-[11px] leading-relaxed text-white sm:text-sm">{prompt.prompt}</div>
      <div className="animate-pulse text-[10px]" style={{ color: team.primary === '#222222' ? '#ddd' : team.primary }}>
        {team.name} IS THINKING...
      </div>
    </div>
  );
}

function AnswerBoard({ prompt, used, highlightIdx }) {
  const byTier = [5, 4, 3, 2, 1].map((tier) => ({ tier, list: prompt.answers.map((a, idx) => ({ a, idx })).filter(({ a }) => a.tier === tier) }));
  return (
    <div className="mt-3 border-2 border-black bg-black/60 p-2">
      <div className="mb-2 text-[8px] text-slate-400">THE BOARD</div>
      <div className="flex flex-col gap-1">
        {byTier.map(({ tier, list }) => (
          <div key={tier} className="flex flex-wrap items-center gap-1">
            <span className="w-6 text-[8px]" style={{ color: GAME_CONFIG.tiers[tier].color }}>
              T{tier}
            </span>
            {list.map(({ a, idx }) => {
              const isUsed = used.has(usedKey(prompt.id, idx));
              const hl = idx === highlightIdx;
              return (
                <span
                  key={idx}
                  className={`border px-1 py-[2px] text-[8px] ${hl ? 'border-white text-black' : 'border-slate-700'} ${isUsed && !hl ? 'text-slate-600 line-through' : hl ? '' : 'text-slate-200'}`}
                  style={hl ? { background: GAME_CONFIG.tiers[tier].color } : undefined}
                >
                  {a.text}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function FeedbackModal({ result, teams, used, onContinue, autoMs }) {
  useConfirmKey(onContinue);
  useEffect(() => {
    if (!autoMs) return undefined;
    const id = setTimeout(onContinue, autoMs);
    return () => clearTimeout(id);
  }, [autoMs, onContinue]);
  const { outcome: o, actor, prompt } = result;
  const team = teams[actor];
  const tc = TONE_COLORS[result.tone] || '#fff';
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-auto border-4 border-black bg-[#1b1736] p-4 shadow-[6px_6px_0_#000]" style={FONT_STYLE}>
        <div className="flex items-center justify-between text-[8px] text-slate-400">
          <span style={{ color: team.primary === '#222222' ? '#ddd' : team.primary }}>{team.name}</span>
          <span>{prompt.category}</span>
        </div>
        <div className="mt-2 text-[9px] leading-relaxed text-slate-300">{prompt.prompt}</div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-white">&gt; "{o.kind === 'timeout' ? '...' : o.text}"</span>
          {o.kind === 'answer' && <TierChip tier={o.tier} />}
          {o.kind === 'invalid' && <span className="border-2 border-black bg-[#ef476f] px-2 py-1 text-[9px] text-black">NOT ON THE BOARD</span>}
          {o.kind === 'duplicate' && <span className="border-2 border-black bg-[#ef476f] px-2 py-1 text-[9px] text-black">ALREADY USED</span>}
          {o.kind === 'timeout' && <span className="border-2 border-black bg-[#ef476f] px-2 py-1 text-[9px] text-black">TIME UP</span>}
        </div>
        {o.kind === 'answer' && o.matchedText && normalizeAnswer(o.matchedText) !== normalizeAnswer(o.text) && <div className="mt-1 text-[8px] text-slate-400">MATCHED: {o.matchedText}</div>}
        {o.counter && <div className="mt-3 animate-pulse text-[10px] text-[#ef476f]">⚠ COUNTER-ATTACK TRIGGERED!</div>}
        <div className="mt-4 text-base leading-relaxed sm:text-xl" style={{ color: tc, textShadow: '3px 3px 0 #000' }}>
          {result.headline}
        </div>
        <div className="mt-2 text-[9px] leading-relaxed text-slate-200">{result.detail}</div>
        <AnswerBoard prompt={prompt} used={used} highlightIdx={o.kind === 'answer' || o.kind === 'duplicate' ? o.idx : -1} />
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-[8px] text-slate-500">{autoMs ? 'AUTO-CONTINUE...' : 'PRESS ENTER'}</span>
          <PixelButton onClick={onContinue}>CONTINUE ▶</PixelButton>
        </div>
      </div>
    </div>
  );
}

function CenterOverlay({ children }) {
  return <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 p-3 text-center">{children}</div>;
}

function IntroOverlay({ engine, teams, onStart }) {
  useConfirmKey(onStart);
  return (
    <CenterOverlay>
      <div className="max-w-md border-4 border-black bg-[#1b1736] p-4 shadow-[4px_4px_0_#000]">
        <div className="text-2xl">{engine.icon}</div>
        <div className="mt-2 text-xs text-[#ffd23f] sm:text-sm">{engine.label}</div>
        <div className="mt-2 text-[9px]">
          <span style={{ color: teams[0].primary }}>{teams[0].name}</span> <span className="text-slate-500">VS</span> <span style={{ color: teams[1].primary }}>{teams[1].name}</span>
        </div>
        <p className="mt-3 hidden text-[8px] leading-relaxed text-slate-300 sm:block">{engine.blurb}</p>
        <div className="mt-4">
          <PixelButton onClick={onStart}>▶ START</PixelButton>
        </div>
      </div>
    </CenterOverlay>
  );
}

function HandoffOverlay({ team, onReady }) {
  useConfirmKey(onReady);
  return (
    <CenterOverlay>
      <div className="border-4 border-black bg-[#1b1736] p-4 shadow-[4px_4px_0_#000]">
        <div className="text-[9px] text-slate-400">PASS THE DEVICE TO</div>
        <div className="mt-3 text-sm sm:text-lg" style={{ color: team.primary === '#222222' ? '#ddd' : team.primary, textShadow: '3px 3px 0 #000' }}>
          {team.name}
        </div>
        <div className="mt-4">
          <PixelButton onClick={onReady}>READY ▶</PixelButton>
        </div>
      </div>
    </CenterOverlay>
  );
}

function BoxScore({ teams, engine, sportState, stats, onRematch, onExit }) {
  const box = engine.boxScore(sportState);
  const scores = engine.scores(sportState);
  const winner = scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1;
  const statRows = [
    ['CORRECT', (s) => `${s.correct}/${s.plays}`],
    ['ULTRA-RARE (T5)', (s) => s.tiers[5]],
    ['RARE (T4)', (s) => s.tiers[4]],
    ['SOLID (T3)', (s) => s.tiers[3]],
    ['COMMON (T1-2)', (s) => s.tiers[1] + s.tiers[2]],
    ['AVG RARITY', (s) => (s.correct ? (s.tierSum / s.correct).toFixed(1) : '-')],
    ['MISSES / TIME-UPS', (s) => `${s.invalid + s.dupes} / ${s.timeouts}`],
    ['GOT COUNTERED', (s) => s.countered],
    ['BEST ANSWER', (s) => (s.best ? `${s.best.text} (T${s.best.tier})` : '-')],
  ];
  const nameCell = (i) => (
    <td className="whitespace-nowrap px-2 py-1 text-left" style={{ color: teams[i].primary === '#222222' ? '#ddd' : teams[i].primary }}>
      {teams[i].name}
    </td>
  );
  return (
    <div className="border-4 border-t-0 border-black bg-[#1b1736] p-3">
      <div className="text-center text-sm leading-relaxed sm:text-lg" style={{ color: '#ffd23f', textShadow: '3px 3px 0 #000' }}>
        {winner === null ? "IT'S A DRAW!" : `${teams[winner].name} WIN!`}
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-2 border-black text-center text-[9px]">
          <thead className="bg-black text-slate-400">
            <tr>
              <th className="px-2 py-1 text-left">TEAM</th>
              {box.columns.map((c) => (
                <th key={c} className="px-2 py-1">
                  {c}
                </th>
              ))}
              <th className="px-2 py-1 text-[#ffd23f]">FINAL</th>
            </tr>
          </thead>
          <tbody>
            {[0, 1].map((i) => (
              <tr key={i} className="border-t-2 border-black">
                {nameCell(i)}
                {box.rows[i].map((v, k) => (
                  <td key={k} className="px-2 py-1 text-white">
                    {v}
                  </td>
                ))}
                <td className="px-2 py-1 text-[#ffd23f]">{scores[i]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-2 border-black text-[8px] sm:text-[9px]">
          <thead className="bg-black text-slate-400">
            <tr>
              <th className="px-2 py-1 text-left">TRIVIA STATS</th>
              {nameCell(0)}
              {nameCell(1)}
            </tr>
          </thead>
          <tbody>
            {statRows.map(([label, fn]) => (
              <tr key={label} className="border-t border-black/60">
                <td className="px-2 py-1 text-slate-400">{label}</td>
                <td className="px-2 py-1 text-white">{fn(stats[0])}</td>
                <td className="px-2 py-1 text-white">{fn(stats[1])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <PixelButton onClick={onRematch}>↻ REMATCH</PixelButton>
        <PixelButton onClick={onExit} color="#4cc9f0">
          NEW SETUP
        </PixelButton>
      </div>
    </div>
  );
}

function GameScreen({ setup, onExit, onRematch }) {
  const engine = SPORT_ENGINES[setup.sport];
  const teams = setup.teams;
  const G = useRef(null);
  if (!G.current) G.current = createMatch(setup);
  const [, bump] = useReducer((x) => x + 1, 0);
  const [phase, setPhase] = useState('intro'); // intro | handoff | prompt | cpu | animating | feedback | over
  const [anim, setAnim] = useState(null);
  const [toast, setToast] = useState(null);
  const g = G.current;

  const beginTurn = useCallback(() => {
    const m = G.current;
    setAnim(null);
    if (engine.isOver(m.sport)) {
      m.turn = null;
      setPhase('over');
      SOUND_ENGINE.play('whistle');
      setTimeout(() => SOUND_ENGINE.play('cheer'), 500);
      bump();
      return;
    }
    const actor = engine.currentActor(m.sport);
    m.turnId += 1;
    m.turn = { id: m.turnId, actor, prompt: drawPrompt(m) };
    // 2P: hand the device over when control changes (but not mid-rally in tennis)
    const midRally = setup.sport === 'tennis' && m.sport.rally.shots > 0;
    if (teams[actor].isCPU) setPhase('cpu');
    else if (setup.mode === '2p' && m.lastHumanActor !== actor && !midRally) setPhase('handoff');
    else {
      m.lastHumanActor = actor;
      setPhase('prompt');
    }
    bump();
  }, [engine, teams, setup.mode, setup.sport]);

  const resolveOutcome = useCallback(
    (raw) => {
      const m = G.current;
      const turn = m.turn;
      if (!turn) return;
      const outcome = { ...raw };
      if (outcome.kind === 'answer') {
        m.used.add(usedKey(turn.prompt.id, outcome.idx));
        outcome.counter = Math.random() < (GAME_CONFIG.counterAttackChance[outcome.tier] || 0);
      }
      recordStats(m.stats[turn.actor], m.stats[1 - turn.actor], outcome);
      const res = engine.resolve(m.sport, outcome, turn.actor, teams);
      m.shownSport = m.sport; // scoreboard keeps pre-play numbers until the animation lands
      m.sport = res.state;
      m.result = { ...res, outcome, actor: turn.actor, prompt: turn.prompt, turnId: turn.id };
      setAnim(res.anim);
      setPhase('animating');
      bump();
    },
    [engine, teams]
  );

  const handleSubmit = useCallback(
    (text) => {
      const m = G.current;
      const prompt = m.turn.prompt;
      const hit = matchAnswer(text, prompt);
      let outcome;
      if (!hit) outcome = { kind: 'invalid', text };
      else if (m.used.has(usedKey(prompt.id, hit.idx))) outcome = { kind: 'duplicate', text, idx: hit.idx, tier: hit.answer.tier, matchedText: hit.answer.text };
      else outcome = { kind: 'answer', text, idx: hit.idx, tier: hit.answer.tier, matchedText: hit.answer.text };
      SOUND_ENGINE.play(outcome.kind === 'answer' ? 'correct' : 'wrong');
      resolveOutcome(outcome);
    },
    [resolveOutcome]
  );

  const handleTimeout = useCallback(() => {
    SOUND_ENGINE.play('buzzer');
    resolveOutcome({ kind: 'timeout', text: '' });
  }, [resolveOutcome]);

  // CPU turn: think, then answer.
  const turnId = g.turn ? g.turn.id : 0;
  useEffect(() => {
    if (phase !== 'cpu') return undefined;
    const m = G.current;
    const quickRally = setup.sport === 'tennis' && m.sport.rally && m.sport.rally.shots > 0;
    const [lo, hi] = GAME_CONFIG.cpu.thinkMs;
    const id = setTimeout(() => resolveOutcome(cpuAnswer(m.turn.prompt, m.used, setup.difficulty)), quickRally ? lo * 0.6 : rand(lo, hi));
    return () => clearTimeout(id);
  }, [phase, turnId, resolveOutcome, setup.difficulty, setup.sport]);

  const handleAnimEnd = useCallback(() => {
    const r = G.current.result;
    if (!r) return;
    if (r.quick) {
      setToast({ id: r.turnId, text: r.toast, tone: r.tone });
      beginTurn();
    } else setPhase('feedback');
  }, [beginTurn]);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(id);
  }, [toast]);

  const scene = engine.scene(g.sport);
  const sceneKey = JSON.stringify(scene);
  const timeline = useMemo(
    () => (anim ? buildTimeline(anim, teams) : buildIdle(JSON.parse(sceneKey), teams)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [anim, sceneKey, teams]
  );

  const turn = g.turn;
  const activeTeam = turn ? turn.actor : null;
  const result = g.result;

  return (
    <div className="mx-auto max-w-4xl">
      <Scoreboard teams={teams} engine={engine} sportState={phase === 'animating' && g.shownSport ? g.shownSport : g.sport} activeTeam={phase === 'over' ? null : activeTeam} />
      <div className="relative">
        <GameCanvas timeline={timeline} onEnd={handleAnimEnd} />
        {phase === 'intro' && (
          <IntroOverlay
            engine={engine}
            teams={teams}
            onStart={() => {
              SOUND_ENGINE.unlock();
              beginTurn();
            }}
          />
        )}
        {phase === 'handoff' && turn && (
          <HandoffOverlay
            team={teams[turn.actor]}
            onReady={() => {
              G.current.lastHumanActor = turn.actor;
              setPhase('prompt');
            }}
          />
        )}
        {toast && (
          <div key={toast.id} className="pointer-events-none absolute left-1/2 top-3 z-10 w-[90%] -translate-x-1/2 border-2 border-black bg-black/80 px-3 py-2 text-center text-[8px] leading-relaxed sm:text-[9px]" style={{ color: TONE_COLORS[toast.tone] || '#fff' }}>
            {toast.text}
          </div>
        )}
        {phase === 'over' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="border-4 border-black bg-black/70 px-4 py-2 text-lg text-[#ffd23f] sm:text-3xl" style={{ textShadow: '3px 3px 0 #e63946' }}>
              FINAL
            </div>
          </div>
        )}
      </div>

      {phase === 'prompt' && turn && <PromptPanel key={turn.id} prompt={turn.prompt} team={teams[turn.actor]} seconds={GAME_CONFIG.timerSeconds} onSubmit={handleSubmit} onTimeout={handleTimeout} />}
      {phase === 'cpu' && turn && <CpuPanel prompt={turn.prompt} team={teams[turn.actor]} />}
      {(phase === 'animating' || phase === 'feedback' || phase === 'handoff' || phase === 'intro') && (
        <div className="border-4 border-t-0 border-black bg-[#1b1736] p-3 text-center text-[9px] text-slate-400">
          {phase === 'animating' && result ? `${teams[result.actor].name}: "${result.outcome.kind === 'timeout' ? 'TIME UP' : result.outcome.text}"` : phase === 'intro' ? 'PRESS START' : phase === 'handoff' ? 'GET READY...' : ' '}
        </div>
      )}
      {phase === 'over' && <BoxScore teams={teams} engine={engine} sportState={g.sport} stats={g.stats} onRematch={onRematch} onExit={onExit} />}

      {phase === 'feedback' && result && (
        <FeedbackModal key={result.turnId} result={result} teams={teams} used={g.used} onContinue={beginTurn} autoMs={teams[result.actor].isCPU ? GAME_CONFIG.cpu.autoContinueMs : 0} />
      )}

      {phase !== 'over' && (
        <div className="mt-3 flex justify-center">
          <button type="button" onClick={onExit} className="text-[8px] text-slate-500 underline hover:text-slate-300" style={FONT_STYLE}>
            QUIT TO SETUP
          </button>
        </div>
      )}
    </div>
  );
}

export default function RetroClashTriviaBowl() {
  useFontLoader();
  const [lastSetup, setLastSetup] = useState(DEFAULT_SETUP);
  const [active, setActive] = useState(null);
  const [gameKey, setGameKey] = useState(0);
  const [muted, setMuted] = useState(false);

  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    SOUND_ENGINE.setMuted(m);
    if (!m) {
      SOUND_ENGINE.unlock();
      SOUND_ENGINE.play('select');
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0b1e] px-3 py-4 text-white sm:px-6" style={{ ...FONT_STYLE, backgroundImage: 'radial-gradient(#1f1a40 1px, transparent 1px)', backgroundSize: '12px 12px' }}>
      <div className="mx-auto mb-4 flex max-w-4xl items-center justify-between">
        <div className="text-[9px] text-slate-500">{active ? 'RETRO CLASH: TRIVIA BOWL' : 'INSERT COIN'}</div>
        <button type="button" onClick={toggleMute} className="border-2 border-black bg-[#1b1736] px-2 py-1 text-[9px] shadow-[2px_2px_0_#000]" style={FONT_STYLE} aria-label={muted ? 'Unmute' : 'Mute'}>
          {muted ? '🔇 MUTED' : '🔊 SOUND'}
        </button>
      </div>
      {active ? (
        <GameScreen
          key={gameKey}
          setup={active}
          onExit={() => setActive(null)}
          onRematch={() => setGameKey((k) => k + 1)}
        />
      ) : (
        <SetupScreen
          initial={lastSetup}
          onStart={(s) => {
            setLastSetup(s);
            setActive(s);
            setGameKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
