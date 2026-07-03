#!/usr/bin/env node
// Parse strictement chaque bloc <script type="application/ld+json"> de chaque
// page HTML du repo et vérifie la présence du/des @type attendu(s) par page.
// Zéro dépendance (Node natif uniquement). Usage: node scripts/validate-jsonld.mjs
// Sortie non-zéro si une erreur est trouvée (utilisable en pre-commit/CI).

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function findHtmlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findHtmlFiles(full));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

// @type requis par page (chemin relatif à la racine du repo).
// Toute page absente de cette table n'est vérifiée que pour la validité JSON.
const REQUIRED_TYPES = {
  'index.html': ['BeautySalon'],
  'prestations.html': ['BreadcrumbList'],
  'a-propos.html': ['BreadcrumbList'],
  'entreprises.html': ['BreadcrumbList'],
  'evenements.html': ['BreadcrumbList'],
  'reserver.html': ['BreadcrumbList'],
  'blog/index.html': ['BreadcrumbList'],
};

const files = findHtmlFiles(ROOT).sort();
let errorCount = 0;
let blockCount = 0;

for (const file of files) {
  const rel = relative(ROOT, file);
  const content = readFileSync(file, 'utf-8');
  const blocks = [...content.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);

  const types = [];
  blocks.forEach((raw, i) => {
    blockCount++;
    try {
      const parsed = JSON.parse(raw);
      types.push(parsed['@type']);
    } catch (e) {
      errorCount++;
      console.error(`ERREUR JSON  ${rel} (bloc ${i + 1}/${blocks.length}): ${e.message}`);
    }
  });

  const required = REQUIRED_TYPES[rel];
  if (required) {
    for (const t of required) {
      if (!types.includes(t)) {
        errorCount++;
        console.error(`TYPE MANQUANT  ${rel}: attendu "${t}", trouvé [${types.join(', ')}]`);
      }
    }
  }

  // Toutes les pages d'articles de blog doivent avoir BlogPosting + BreadcrumbList
  if (rel.startsWith('blog/') && rel !== 'blog/index.html') {
    for (const t of ['BlogPosting', 'BreadcrumbList']) {
      if (!types.includes(t)) {
        errorCount++;
        console.error(`TYPE MANQUANT  ${rel}: attendu "${t}", trouvé [${types.join(', ')}]`);
      }
    }
  }
}

console.log(`\n${files.length} pages HTML scannées, ${blockCount} blocs JSON-LD analysés.`);
if (errorCount > 0) {
  console.error(`${errorCount} erreur(s) trouvée(s).`);
  process.exit(1);
} else {
  console.log('Zéro erreur — tout le JSON-LD est valide et complet.');
}
