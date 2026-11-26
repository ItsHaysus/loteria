import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const webDir = join(projectRoot, 'android-web');
const assetsDir = join(projectRoot, 'android-assets');

const webFiles = [
  'index.html',
  'styles.css',
  'script.js',
  'ai-clue.js',
  'service-worker.js',
  'manifest.webmanifest',
];
const webDirectories = ['Cards', 'audio', 'Background', 'icons'];

rmSync(webDir, { recursive: true, force: true });
rmSync(assetsDir, { recursive: true, force: true });
mkdirSync(webDir, { recursive: true });
mkdirSync(assetsDir, { recursive: true });

for (const file of webFiles) {
  cpSync(join(projectRoot, file), join(webDir, file));
}

for (const directory of webDirectories) {
  cpSync(join(projectRoot, directory), join(webDir, directory), { recursive: true });
}

cpSync(join(projectRoot, 'icons/loteria-icon.svg'), join(assetsDir, 'icon.svg'));
