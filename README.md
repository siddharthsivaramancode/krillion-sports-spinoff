# Retro Clash: Trivia Bowl

A retro pixel-art trivia sports game. Rare answers make big plays; obvious answers invite a counter-attack. Play a quick match, or run a multi-sport club in career mode: sign and poach players with unique abilities and climb an 8-team league across football, tennis and soccer.

## Play

- **Download and play offline:** grab [`retro-clash.html`](retro-clash.html) (open it, then use **Download raw file**) and double-click it. It's a single self-contained file: no install, no server, no internet needed.
- **Hosted page:** https://claude.ai/artifact/6x3DKkTJBjwU1Viv9a6psz (private unless shared).

Career progress saves in your browser's local storage, separately for each browser and for the hosted page vs. the downloaded file.

## Files

| File | What it is |
| --- | --- |
| `RetroClashTriviaBowl.jsx` | The whole game: trivia bank, config, sound, canvas renderer, engines, career mode, UI |
| `retro-clash.html` | Built standalone copy (generated, don't edit by hand) |
| `index.html` | Dev harness that loads the `.jsx` directly (serve the folder over http, e.g. `npx serve .`) |
| `scripts/build-standalone.mjs` | Builds `retro-clash.html` |

## Adding trivia prompts

The bank has 70 prompts and about 3,900 answers. Add to `RANKED_PROMPTS` at the top of `RetroClashTriviaBowl.jsx`, listing every valid answer **from most common to rarest**:

```js
{ id: 'unique-id', category: 'SPORTS', prompt: 'Name a ...', rankedBy: 'what popularity signal you ordered by',
  ranked: ['Most Common|alias', 'Next', /* ... */ 'Rarest'] }
```

Tiers are computed from each answer's position using `RARITY_CUTOFFS` (top 12% = T1, next 18% = T2, next 30% = T3, next 25% = T4, rarest 15% = T5). Hand-tiered prompts can go in `CUSTOM_PROMPTS`. Matching already handles case, accents, punctuation, "the", plurals and small typos. New categories automatically get "category specialist" players in career mode. Tune gameplay in `GAME_CONFIG` and `CAREER_CONFIG`.

## Rebuild the standalone file

```sh
npm install
npm run build
```
