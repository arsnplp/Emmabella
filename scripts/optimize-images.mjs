#!/usr/bin/env node
// Convertit les images ciblées en AVIF + WebP + fallback compressé.
// EXIF (dont GPS) systématiquement retiré. Usage: node scripts/optimize-images.mjs

import sharp from 'sharp';
import { mkdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// [source absolu, basename de sortie, dossier de sortie, largeur max px]
// Convention: le fichier source doit être nommé différemment du nom de sortie
// (ex: `_nom-src.png`) pour éviter d'écrire par-dessus le fichier en cours de lecture.
const TARGETS = [
  // Priorité explicite du brief
  [join(ROOT, 'images/_massageassis-src.png'), 'massageassis', join(ROOT, 'images'), 1200],
  [join(ROOT, 'images/_browliftBlog-src.png'), 'browliftBlog', join(ROOT, 'images'), 1200],
  [join(ROOT, 'images/_soins-visage-src.png'), 'soins-visage', join(ROOT, 'images'), 1200],
  // Autres images utilisées > 300 Ko
  [join(ROOT, 'images/_slide1-src.png'), 'slide1', join(ROOT, 'images'), 1920],
  [join(ROOT, 'images/_slide2-src.png'), 'slide2', join(ROOT, 'images'), 1920],
  [join(ROOT, 'images/_slide3-src.png'), 'slide3', join(ROOT, 'images'), 1920],
  [join(ROOT, 'images/_cils-src.png'), 'cils', join(ROOT, 'images'), 1000],
  [join(ROOT, 'images/_sourcils-src.png'), 'sourcils', join(ROOT, 'images'), 1000],
  [join(ROOT, 'images/_massages-src.jpg'), 'massages', join(ROOT, 'images'), 1000],
  [join(ROOT, 'images/_mariageest-src.png'), 'mariageest', join(ROOT, 'images'), 1000],
  [join(ROOT, 'images/_a1-src.png'), 'a1', join(ROOT, 'images'), 900],
  [join(ROOT, 'images/_a2-src.png'), 'a2', join(ROOT, 'images'), 900],
  [join(ROOT, 'images/_a3-src.png'), 'a3', join(ROOT, 'images'), 900],
  [join(ROOT, 'images/_a4-src.png'), 'a4', join(ROOT, 'images'), 900],
  [join(ROOT, 'images/_insta1-src.png'), 'insta1', join(ROOT, 'images'), 900],
  [join(ROOT, 'images/_insta4-src.png'), 'insta4', join(ROOT, 'images'), 900],
  // Photos "À propos" extraites du base64 inline d'index.html
  [join(ROOT, 'assets/_about-1-src.jpg'), 'a-propos-1', join(ROOT, 'assets'), 900],
  [join(ROOT, 'assets/_about-2-src.jpg'), 'a-propos-2', join(ROOT, 'assets'), 900],
  // Logo
  [join(ROOT, 'assets/_logo-src.png'), 'logo', join(ROOT, 'assets'), 284],
];

const BUDGETS_KB = {
  massageassis: 100,
  browliftBlog: 80,
  'soins-visage': 100,
};
const DEFAULT_BUDGET_KB = 150;

function kb(bytes) {
  return (bytes / 1024).toFixed(1);
}

// Seul le logo est affiché sans fond opaque derrière lui (header/footer colorés) :
// c'est la seule image dont le fallback legacy doit garder un canal alpha.
const ALPHA_FALLBACK_NAMES = new Set(['logo']);

async function convertOne(src, name, outDir, maxWidth) {
  if (!existsSync(src)) {
    console.log(`⚠️  SKIP (introuvable): ${src}`);
    return;
  }
  mkdirSync(outDir, { recursive: true });
  const budget = BUDGETS_KB[name] ?? DEFAULT_BUDGET_KB;
  const srcSizeKb = kb(statSync(src).size);

  const base = sharp(src).rotate().resize({ width: maxWidth, withoutEnlargement: true });
  const needsAlpha = ALPHA_FALLBACK_NAMES.has(name);

  const avifPath = join(outDir, `${name}.avif`);
  const webpPath = join(outDir, `${name}.webp`);
  const fallbackExt = needsAlpha ? 'png' : 'jpg';
  const fallbackPath = join(outDir, `${name}.${fallbackExt}`);

  await base.clone().avif({ quality: 55, effort: 6 }).toFile(avifPath);
  await base.clone().webp({ quality: 78 }).toFile(webpPath);
  if (needsAlpha) {
    await base.clone().png({ compressionLevel: 9, palette: true }).toFile(fallbackPath);
  } else {
    await base.clone().flatten({ background: '#ffffff' }).jpeg({ quality: 68, mozjpeg: true }).toFile(fallbackPath);
  }

  const avifKb = kb(statSync(avifPath).size);
  const webpKb = kb(statSync(webpPath).size);
  const fallbackKb = kb(statSync(fallbackPath).size);
  const flag = Number(fallbackKb) > budget ? '⚠️ AU-DESSUS DU BUDGET' : '✅';

  console.log(
    `${name.padEnd(16)} ${srcSizeKb.padStart(8)} Ko -> avif ${avifKb.padStart(7)} Ko | webp ${webpKb.padStart(7)} Ko | fallback ${fallbackKb.padStart(7)} Ko (budget ${budget} Ko) ${flag}`
  );
}

for (const [src, name, outDir, maxWidth] of TARGETS) {
  await convertOne(src, name, outDir, maxWidth);
}
