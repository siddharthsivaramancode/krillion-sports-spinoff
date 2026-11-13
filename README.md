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

Append objects to `TRIVIA_BANK` at the top of `RetroClashTriviaBowl.jsx`:

```js
{ id: 'unique-id', category: 'SPORTS', prompt: 'Name a ...', answers: [{ text: 'Answer', aliases: ['alt spelling'], tier: 3 }] }
```

Tier 1 is the most obvious answer, tier 5 the rarest. New categories automatically get their own "category specialist" players in career mode. Tune gameplay in `GAME_CONFIG` and `CAREER_CONFIG`.

## Rebuild the standalone file

```sh
npm install
npm run build
```
