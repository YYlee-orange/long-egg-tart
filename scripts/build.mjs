import { access, cp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { siteAssets } from './site-assets.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'dist');
if (dirname(output) !== resolve(root) || basename(output) !== 'dist') throw new Error('Invalid build directory.');
const entries = ['index.html', 'src', 'levels', ...siteAssets];
// Fail before replacing a previous build if any source file is missing.
await Promise.all(entries.map(entry => access(join(root, entry))));
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const entry of entries) {
  const target = join(output, entry);
  await mkdir(dirname(target), { recursive: true });
  await cp(join(root, entry), target, { recursive: true });
}
await writeFile(join(output, '.nojekyll'), '');
const files = await readdir(output, { recursive: true, withFileTypes: true });
let bytes = 0, count = 0;
for (const file of files) if (file.isFile()) {
  bytes += (await stat(join(file.parentPath, file.name))).size;
  count++;
}
console.log(`Built dist/: ${count} files, ${(bytes / 1024 / 1024).toFixed(2)} MiB. All URLs remain relative for GitHub Pages project paths.`);
