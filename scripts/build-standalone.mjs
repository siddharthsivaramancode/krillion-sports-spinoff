// Builds retro-clash.html: one self-contained file (React + game + Tailwind CSS inlined).
// Open it by double-clicking; it needs no server and no internet (the pixel font
// loads from Google Fonts when online and falls back to monospace offline).
// Usage: npm install && npm run build
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'retro-clash-'));

const js = (
  await build({
    entryPoints: [join(root, 'scripts/standalone-entry.jsx')],
    bundle: true,
    minify: true,
    format: 'iife',
    write: false,
    jsx: 'transform',
    define: { 'process.env.NODE_ENV': '"production"' },
  })
).outputFiles[0].text.replace(/<\/script/gi, '<\/script');

const cssIn = join(tmp, 'in.css');
const cssOut = join(tmp, 'out.css');
writeFileSync(cssIn, '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
execSync(`npx tailwindcss -i "${cssIn}" -o "${cssOut}" --content "${join(root, 'RetroClashTriviaBowl.jsx')}" --minify`, { cwd: root, stdio: 'inherit' });
const css = readFileSync(cssOut, 'utf8');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Retro Clash: Trivia Bowl</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap">
<style>${css}</style>
<style>
  :root { --bg: #0d0b1e; --fg: #ffffff; color-scheme: dark; }
  html, body { margin: 0; background: var(--bg); color: var(--fg); }
  body { font-family: 'Press Start 2P', ui-monospace, monospace; }
  button:focus-visible, input:focus-visible, a:focus-visible { outline: 2px solid #ffd23f; outline-offset: 2px; }
</style>
</head>
<body>
<div id="root"></div>
<script>${js}</script>
</body>
</html>
`;
writeFileSync(join(root, 'retro-clash.html'), html);
console.log(`retro-clash.html written (${Math.round(html.length / 1024)} KB)`);
