import { access, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { siteAssets } from './site-assets.mjs';
const root = new URL('../', import.meta.url);
for (const file of ['src/main.js', 'src/engine.js', 'src/renderer.js', 'src/geometry.js', 'src/motion.js', 'src/curves.js', 'src/countdown.js', 'src/countdown-cue.js', 'src/intro.js', 'src/crumbs.js', 'scripts/serve.mjs', 'scripts/build.mjs', 'scripts/site-assets.mjs', 'assets/snake/source/body-geometry-v2.mjs']) {
  execFileSync(process.execPath, ['--check', fileURLToPath(new URL(file, root))], { stdio: 'inherit' });
}
for (const file of [
  'index.html', 'src/style.css', 'levels/open-table.json', 'levels/bakery-walls.json', ...siteAssets,
]) await access(new URL(file, root));
for (const file of ['levels/open-table.json', 'levels/bakery-walls.json']) JSON.parse(await readFile(new URL(file, root), 'utf8'));
console.log('Source syntax and required runtime assets verified.');
