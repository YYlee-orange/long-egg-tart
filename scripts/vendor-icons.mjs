import { mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const output = new URL('assets/ui/', root);
await mkdir(output, { recursive: true });
for (const name of ['play', 'pause', 'house', 'arrow-clockwise']) {
  await copyFile(new URL(`node_modules/@phosphor-icons/core/assets/fill/${name}-fill.svg`, root), new URL(`${name}-fill.svg`, output));
}
await copyFile(new URL('node_modules/@phosphor-icons/core/LICENSE', root), new URL('PHOSPHOR-LICENSE.txt', output));
console.log(`Vendored Phosphor icons to ${fileURLToPath(output)}`);
