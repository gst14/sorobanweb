// Descarga el modelo de MediaPipe Hand Landmarker a public/models/, verificado por SHA-256.
// Corre antes de `dev` y `build`. Si el archivo ya está y el hash coincide, no descarga nada.
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODEL = {
  url: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  sha256: 'fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1',
  file: 'hand_landmarker.task',
};

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const target = join(root, 'public', 'models', MODEL.file);
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function current() {
  try {
    return sha256(await readFile(target));
  } catch {
    return null;
  }
}

if ((await current()) === MODEL.sha256) {
  console.log(`fetch-model: ${MODEL.file} ya está y el hash coincide`);
} else {
  console.log(`fetch-model: descargando ${MODEL.url}`);
  const res = await fetch(MODEL.url);
  if (!res.ok) throw new Error(`fetch-model: HTTP ${res.status} al descargar ${MODEL.url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const got = sha256(buf);
  if (got !== MODEL.sha256) {
    throw new Error(`fetch-model: SHA-256 inesperado (${got}); se esperaba ${MODEL.sha256}`);
  }
  await mkdir(dirname(target), { recursive: true });
  await writeFile(`${target}.tmp`, buf);
  await rename(`${target}.tmp`, target);
  console.log(`fetch-model: ${MODEL.file} (${buf.length} B) verificado`);
}
