# Retro Clash: Trivia Bowl

A retro pixel-art, **real-time** arcade sports game powered by trivia. Move with WASD; every pass, shot, throw and tennis stroke freezes play and asks a survey-style question. Rare answers make great plays, obvious ones get intercepted, blocked or smashed back.

- **4 sports:** soccer and basketball (5-on-5, control switches to whoever you pass to), football (5-on-5, hike / throw / run), tennis (tiebreak; run to the ball, every shot is a question).
- **Career mode:** one club, 8-team league with playoffs. You choose the sport for every match. Each sport has positions (e.g. soccer GK/DEF/MID/WING/ST) and you can only play a sport once every position has a starter, so you buy players in the market, poach from rivals, manage contracts, wages and morale. Every player has a unique ability.
- **Trivia bank:** 174 prompts and ~11,300 answers across 12 categories, each ranked from most common to rarest.

## Play

- **Download and play offline:** grab [`retro-clash.html`](retro-clash.html) (open it, then **Download raw file**) and double-click it. One self-contained file: no install, no server, no internet.
- **Hosted page:** https://claude.ai/artifact/6x3DKkTJBjwU1Viv9a6psz (private unless shared).

Controls: WASD / arrows move · SPACE (or J) pass / throw / hike / serve / tackle · SHIFT (or K) shoot / handoff / switch player · ESC pause. 2-player quick match: P1 WASD + F/G, P2 arrows + K/L. Phones and tablets get an on-screen joystick. The ♪ button in the top bar switches the background music on/off (remembered), and 🔊 switches sound effects.

Career progress saves in your browser's local storage (separately per browser, and separately for the hosted page vs the downloaded file).

## Files

| File | What it is |
| --- | --- |
| `trivia-bank.js` | Every prompt and answer. Paste new prompts here. |
| `RetroClashTriviaBowl.jsx` | The game: config, sound, renderer, real-time engine, career mode, UI |
| `retro-clash.html` | Built standalone copy (generated, don't edit by hand) |
| `index.html` | Dev harness that loads the source files directly (serve the folder over http, e.g. `npx serve .`) |
| `scripts/build-standalone.mjs` | Builds `retro-clash.html` |

## Adding trivia prompts

Add to `RANKED_PROMPTS` in `trivia-bank.js`, listing every valid answer **from most common to rarest**:

```js
{ id: 'unique-id', category: 'SPORTS', prompt: 'Name a ...', rankedBy: 'what popularity signal you ordered by',
  ranked: ['Most Common|alias', 'Next', /* ... */ 'Rarest'] }
```

Tiers come from each answer's position via `RARITY_CUTOFFS` (top 12% = T1, next 18% = T2, next 30% = T3, next 25% = T4, rarest 15% = T5). `MERGED_PROMPTS` builds "name ANY ..." prompts from several lists; hand-tiered prompts can go in `CUSTOM_PROMPTS`. Matching already handles case, accents, punctuation, "the", plurals and small typos. New categories automatically get "category specialist" players in career mode. Gameplay numbers live in `GAME_CONFIG` (including `GAME_CONFIG.arcade`) and `CAREER_CONFIG` in the `.jsx`.

## Rebuild the standalone file

```sh
npm install
npm run build
```
