import { readFile, stat } from 'node:fs/promises';

const deck = JSON.parse(await readFile(new URL('../Cards/cards.json', import.meta.url), 'utf8'));
if (!Array.isArray(deck) || deck.length === 0 || new Set(deck).size !== deck.length) {
  throw new Error('cards.json must list unique card filenames');
}

const assets = ['audio/start.mp3'];
for (const file of deck) {
  if (typeof file !== 'string' || !/^[^/\\]+\.webp$/.test(file)) {
    throw new Error(`Invalid card filename: ${file}`);
  }
  assets.push(`Cards/${file}`, `audio/${file.slice(0, -5)}.mp3`);
}

const missing = [];
for (const asset of assets) {
  const url = new URL(`../${asset.split('/').map(encodeURIComponent).join('/')}`, import.meta.url);
  const info = await stat(url).catch(() => null);
  if (!info?.isFile() || info.size === 0) missing.push(asset);
}
if (missing.length) throw new Error(`Missing or empty deck assets:\n${missing.join('\n')}`);

console.log(`Validated ${deck.length} card images and ${deck.length + 1} caller clips.`);
