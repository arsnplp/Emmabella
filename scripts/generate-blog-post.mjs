#!/usr/bin/env node
// Génère un nouvel article de blog SEO (prestation + mot-clé + Venelles) à partir de
// scripts/blog-topics.json, rédigé par Claude, dans le gabarit exact des articles
// existants. Met à jour blog/index.html et sitemap.xml, puis retire le sujet traité de
// la file d'attente. Zéro dépendance npm (Node >= 18 natif).
//
// Le contenu est rédigé en invoquant le CLI `claude` en mode headless (`claude -p`),
// authentifié via CLAUDE_CODE_OAUTH_TOKEN (abonnement Pro/Max, généré une fois avec
// `claude setup-token`) — pas besoin de clé API facturée à l'usage. ANTHROPIC_API_KEY
// reste supporté en repli si tu préfères une clé API classique.
//
// Usage :
//   CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-... node scripts/generate-blog-post.mjs
//   DRY_RUN=1 node scripts/generate-blog-post.mjs   (pas d'appel Claude, contenu factice, pour tester le gabarit)

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BLOG_DIR = join(ROOT, 'blog');
const IMAGES_DIR = join(ROOT, 'images');
const TOPICS_FILE = join(ROOT, 'scripts', 'blog-topics.json');
const SITE_URL = 'https://emmabella.fr';
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5';

const todayISO = () => new Date().toISOString().slice(0, 10);

// ── Sujets en attente ───────────────────────────────────────────────────

function loadQueue() {
  return JSON.parse(readFileSync(TOPICS_FILE, 'utf-8'));
}

function saveQueue(queue) {
  writeFileSync(TOPICS_FILE, JSON.stringify(queue, null, 2) + '\n');
}

// ── Articles déjà publiés (pour les liens internes "Articles similaires") ─

function readPublishedArticles() {
  const files = readdirSync(BLOG_DIR).filter(
    (f) => f.endsWith('.html') && f !== 'index.html'
  );
  return files.map((file) => {
    const slug = file.replace(/\.html$/, '');
    const html = readFileSync(join(BLOG_DIR, file), 'utf-8');
    const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [, slug])[1]
      .replace(/<[^>]+>/g, '')
      .trim();
    const tag = (html.match(/<span class="blog-card-tag">([^<]*)<\/span>/) || [, ''])[1].trim();
    const description = (html.match(/<meta name="description" content="([^"]*)"/) || [, ''])[1];
    const ogImage = (html.match(/<meta property="og:image" content="([^"]*)"/) || [, ''])[1];
    const imageBase = ogImage
      .replace(/^.*\/images\//, '')
      .replace(/\.(avif|webp|jpe?g|png)$/i, '');
    return { slug, h1, tag, description, imageBase };
  });
}

function pickRelated(articles, tag, count = 3) {
  const sameTag = articles.filter((a) => a.tag === tag);
  const rest = articles.filter((a) => a.tag !== tag);
  const pool = [...sameTag, ...rest];
  return pool.slice(0, count);
}

// ── Résolution des variantes d'image disponibles (avif/webp/jpg/png) ──────

function resolveImage(basename) {
  const exts = ['avif', 'webp', 'jpg', 'jpeg', 'png'];
  const found = exts.filter((ext) => existsSync(join(IMAGES_DIR, `${basename}.${ext}`)));
  const fallback =
    found.find((e) => e === 'jpg' || e === 'jpeg' || e === 'png') || found.find((e) => e === 'webp');
  return {
    avif: found.includes('avif') ? `${basename}.avif` : null,
    webp: found.includes('webp') ? `${basename}.webp` : null,
    fallback: fallback ? `${basename}.${fallback}` : `${basename}.jpg`,
  };
}

function pictureTag(basename, altText, imgAttrs = 'loading="lazy"', pathPrefix = '../images/') {
  const img = resolveImage(basename);
  const sources = [
    img.avif ? `<source srcset="${pathPrefix}${img.avif}" type="image/avif">` : '',
    img.webp ? `<source srcset="${pathPrefix}${img.webp}" type="image/webp">` : '',
  ]
    .filter(Boolean)
    .join('\n              ');
  return `<picture>
              ${sources}
              <img src="${pathPrefix}${img.fallback}" alt="${altText}" ${imgAttrs}>
            </picture>`;
}

// ── Sanitisation légère du contenu rédigé (autorise seulement <strong>/<em>) ─

function sanitizeInline(str = '') {
  return String(str).replace(/<\/?([a-zA-Z0-9]+)[^>]*>/g, (m, tag) => {
    const t = tag.toLowerCase();
    if (t === 'strong' || t === 'em') return m.startsWith('</') ? `</${t}>` : `<${t}>`;
    return '';
  });
}

function escapeAttr(str = '') {
  return String(str).replace(/"/g, '&quot;');
}

// ── Appel à l'API Claude pour rédiger le contenu ──────────────────────────

async function generateContent(topic, existingArticles) {
  if (process.env.DRY_RUN) {
    return {
      pageTitle: `${topic.service} à Venelles | Emmabella`,
      metaDescription: `${topic.service} à Venelles : tout savoir sur cette prestation chez Emmabella, institut de beauté près d'Aix-en-Provence. [DRY_RUN]`,
      h1: `${topic.service} à Venelles : ce qu'il faut savoir`,
      intro: `Ceci est un contenu factice généré en mode DRY_RUN pour tester le gabarit HTML sans appeler l'API. Sujet : ${topic.service}.`,
      sections: [
        {
          heading: 'Section de test',
          paragraphs: [
            'Premier paragraphe de test avec un <strong>terme en gras</strong> pour vérifier la sanitisation.',
            'Second paragraphe de test.',
          ],
        },
      ],
      calloutTitle: 'À savoir',
      calloutText: 'Texte de test pour l’encadré "À savoir".',
      infoBoxText: `Prenez rendez-vous chez Emmabella à Venelles pour ${topic.service.toLowerCase()}.`,
    };
  }

  if (!process.env.CLAUDE_CODE_OAUTH_TOKEN && !process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "Aucune authentification trouvée. Ajoute CLAUDE_CODE_OAUTH_TOKEN (généré avec `claude setup-token`, abonnement Pro/Max) ou ANTHROPIC_API_KEY comme secret GitHub Actions."
    );
  }

  const relatedTitles = existingArticles.slice(0, 6).map((a) => `- ${a.h1}`).join('\n');

  const prompt = `Tu rédiges un article de blog SEO en français pour Emmabella, institut de beauté à Venelles (13770), près d'Aix-en-Provence. Le ton est chaleureux, professionnel, rassurant, jamais promotionnel à outrance. Public : femmes de la région d'Aix-en-Provence.

Sujet de l'article : "${topic.service}"
Mot-clé principal à intégrer naturellement (dans le H1, l'intro, un H2, la meta description) : "${topic.keyword}"
Catégorie : ${topic.tag}

Articles déjà publiés sur le blog (pour éviter les redites) :
${relatedTitles}

Contraintes SEO :
- meta description : 140 à 155 caractères, contient le mot-clé et "Venelles".
- pageTitle : environ 55-60 caractères, au format "<Titre court> à Venelles | Emmabella".
- h1 : accrocheur, contient le mot-clé, peut être une question ou une affirmation.
- intro : 2-3 phrases qui posent le sujet et mentionnent Venelles / Emma / Emmabella.
- 3 à 4 sections (h2) qui structurent l'article (ex : présentation, déroulé, bénéfices, conseils, pour qui...), chacune avec 1 à 2 paragraphes de 2-4 phrases.
- Un encadré "À savoir" (calloutTitle/calloutText) : une info pratique concrète (fréquence, durée, précaution...).
- infoBoxText : une phrase invitant à prendre rendez-vous chez Emmabella à Venelles pour cette prestation.
- Tu peux utiliser des balises <strong> pour mettre en valeur des termes clés dans les paragraphes, aucune autre balise HTML.
- N'invente aucun tarif, durée exacte ou allégation médicale/thérapeutique non vérifiable.

Réponds UNIQUEMENT avec un objet JSON valide (aucun texte avant/après, aucun bloc markdown), au format exact :
{
  "pageTitle": "string",
  "metaDescription": "string",
  "h1": "string",
  "intro": "string",
  "sections": [ { "heading": "string", "paragraphs": ["string", "..."] } ],
  "calloutTitle": "string",
  "calloutText": "string",
  "infoBoxText": "string"
}`;

  const text = runClaudeHeadless(prompt);
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Réponse de Claude sans JSON exploitable :\n${text}`);
  }
  return JSON.parse(jsonMatch[0]);
}

// Invoque le CLI `claude` en mode headless, dans un dossier vide isolé (pas d'accès
// au dépôt, pas d'outils), pour obtenir une simple réponse texte au prompt donné.
function runClaudeHeadless(prompt) {
  const scratch = mkdtempSync(join(tmpdir(), 'emmabella-blog-'));
  try {
    return execFileSync(
      'claude',
      ['-p', prompt, '--model', MODEL, '--max-turns', '1', '--allowedTools', ''],
      {
        cwd: scratch,
        env: process.env,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
      }
    );
  } catch (err) {
    throw new Error(`Appel du CLI \`claude\` échoué : ${err.stderr || err.message}`);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

// ── Assemblage du HTML de l'article ────────────────────────────────────────

function buildArticleHtml(topic, content, related, dateStr) {
  const url = `${SITE_URL}/blog/${topic.slug}.html`;
  const img = resolveImage(topic.image);
  const ogImageUrl = `${SITE_URL}/images/${img.fallback}`;
  const h1 = sanitizeInline(content.h1);
  const pageTitle = sanitizeInline(content.pageTitle);
  const metaDescription = sanitizeInline(content.metaDescription);

  const sectionsHtml = content.sections
    .map(
      (s) => `      <h2>${sanitizeInline(s.heading)}</h2>

      ${s.paragraphs.map((p) => `<p>${sanitizeInline(p)}</p>`).join('\n\n      ')}`
    )
    .join('\n\n');

  const relatedHtml = related
    .map((a) => {
      const alt = escapeAttr(a.h1);
      return `          <a href="${a.slug}.html" class="related-card">
            ${pictureTag(a.imageBase || 'blog1', alt, 'loading="lazy"')}
            <div class="related-card-body">
              <span class="related-card-tag">Lire l'article</span>
              <h3>${a.h1}</h3>
              <span class="related-card-link">Lire la suite →</span>
            </div>
          </a>`;
    })
    .join('\n');

  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  <meta name="description" content="${escapeAttr(metaDescription)}">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeAttr(pageTitle)}">
  <meta property="og:description" content="${escapeAttr(metaDescription)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${ogImageUrl}">
  <meta property="og:site_name" content="Emmabella — Institut de beauté à Venelles">
  <meta property="og:locale" content="fr_FR">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeAttr(pageTitle)}">
  <meta name="twitter:description" content="${escapeAttr(metaDescription)}">
  <meta name="twitter:image" content="${ogImageUrl}">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='80' font-family='serif' fill='%23e8719e'>E</text></svg>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Open+Sans+Condensed:wght@300;700&family=Lato:wght@300;400;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "${h1.replace(/"/g, '\\"')}",
    "description": "${metaDescription.replace(/"/g, '\\"')}",
    "image": "${ogImageUrl}",
    "url": "${url}",
    "datePublished": "${dateStr}",
    "dateModified": "${dateStr}",
    "author": {
      "@type": "Person",
      "name": "Emma",
      "url": "${SITE_URL}/"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Emmabella",
      "logo": {
        "@type": "ImageObject",
        "url": "${SITE_URL}/blog/logo.png"
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": "${url}"
    }
  }
  </script>
  <script type="application/ld+json">
  {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Accueil",
      "item": "${SITE_URL}/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Blog",
      "item": "${SITE_URL}/blog/"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "${h1.replace(/"/g, '\\"')}",
      "item": "${url}"
    }
  ]
}
  </script>
</head>
<body>

  <div class="nav-overlay" id="nav-overlay"></div>

  <header class="header" id="main-header">
    <div class="container">
      <a href="../index.html" class="logo">
        <img src="logo.png" alt="Emmabella" class="logo-img">
      </a>
      <nav class="nav-links" id="nav-links">
        <a href="../index.html">Accueil</a>
        <a href="../prestations.html">Prestations</a>
        <a href="index.html" class="active">Blog</a>
        <span class="nav-cta">
          <a href="https://www.planity.com/emmabella-13770-venelles" target="_blank" rel="noopener" class="btn">Prendre RDV</a>
        </span>
      </nav>
      <button class="burger" id="burger" aria-label="Menu">
        <span></span><span></span><span></span>
      </button>
    </div>
  </header>

  <main class="blog-page-main">

    <div class="blog-hero">
      <p class="breadcrumb"><a href="../index.html">Accueil</a> › <a href="index.html">Blog</a> › ${h1}</p>
      <h1 style="color:#fff; font-size: clamp(1.6rem, 4vw, 2.6rem); max-width:800px; margin:0 auto;">${h1}</h1>
    </div>

    <div class="blog-article-wrapper">
      <span class="blog-card-tag">${escapeAttr(topic.tag)}</span>
      <p>${sanitizeInline(content.intro)}</p>

${sectionsHtml}

      <div class="warning-box">
        <h3>${sanitizeInline(content.calloutTitle)}</h3>
        <p>${sanitizeInline(content.calloutText)}</p>
      </div>

      <div class="info-box">
        <h3>Prendre rendez-vous</h3>
        <p>${sanitizeInline(content.infoBoxText)}</p>
      </div>
    </div>

    <section class="article-cta">
      <div class="container" style="max-width:700px;">
        <h2>Prête à prendre soin de vous ?</h2>
        <p>Prenez rendez-vous chez Emmabella à Venelles — soins du regard, du visage, du corps et bien-être. À deux pas d'Aix-en-Provence.</p>
        <a href="https://www.planity.com/emmabella-13770-venelles" target="_blank" rel="noopener" class="btn-cta">Prendre RDV en ligne</a>
      </div>
    </section>

    <section class="related-articles">
      <div class="container">
        <h2>Articles similaires</h2>
        <div class="related-divider"></div>
        <div class="related-grid">
${relatedHtml}
        </div>
      </div>
    </section>

  </main>

  <footer class="footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <img src="logo.png" alt="Emmabella" style="height:22px; width:auto; margin-bottom:1rem; filter:brightness(0) invert(1);">
          <p>Institut de beauté à Venelles, près d'Aix-en-Provence.</p>
          <div class="footer-social">
            <a href="https://www.instagram.com/emmabella_beaute/" target="_blank" rel="noopener" aria-label="Instagram">
              <svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            </a>
            <a href="https://www.facebook.com/emmabellabeaute" target="_blank" rel="noopener" aria-label="Facebook">
              <svg viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </a>
          </div>
        </div>
        <div>
          <h4>Navigation</h4>
          <ul class="footer-links">
            <li><a href="../index.html">Accueil</a></li>
            <li><a href="../prestations.html">Prestations</a></li>
            <li><a href="index.html">Blog</a></li>
            <li><a href="https://www.planity.com/emmabella-13770-venelles" target="_blank" rel="noopener">Prendre RDV</a></li>
          </ul>
        </div>
        <div>
          <h4>Contact</h4>
          <ul class="footer-contact">
            <li>
              <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              5 avenue Ribas, 13770 Venelles
            </li>
            <li>
              <svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
              <a href="tel:+33622534526">06 22 53 45 26</a>
            </li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <p>&copy; ${year} Emmabella — Institut de beauté à Venelles. Tous droits réservés.</p>
        <p style="margin-top:0.75rem; font-size:0.85rem; color:rgba(255,255,255,0.75);">Site réalisé par <a href="https://acco-lab.fr/" target="_blank" rel="noopener" style="color:#fff; font-weight:600; text-decoration:underline;">ACCO LAB</a></p>
      </div>
    </div>
  </footer>

  <script>
    const burger = document.getElementById('burger');
    const navLinks = document.getElementById('nav-links');
    const overlay = document.getElementById('nav-overlay');
    if (burger) {
      burger.addEventListener('click', () => {
        burger.classList.toggle('active');
        navLinks.classList.toggle('open');
        overlay.classList.toggle('active');
        document.body.style.overflow = navLinks.classList.contains('open') ? 'hidden' : '';
      });
      overlay.addEventListener('click', () => {
        burger.classList.remove('active');
        navLinks.classList.remove('open');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
      });
    }
  </script>

</body>
</html>
`;
}

// ── Insertion de la carte dans blog/index.html ─────────────────────────────

function insertIntoBlogIndex(topic, content) {
  const indexPath = join(BLOG_DIR, 'index.html');
  let html = readFileSync(indexPath, 'utf-8');

  const excerpt = sanitizeInline(content.intro).replace(/<[^>]+>/g, '').slice(0, 160);
  const alt = escapeAttr(topic.imageAlt);

  const cardHtml = `          <!-- Article généré automatiquement -->
          <a href="${topic.slug}.html" class="blog-card">
            <div class="blog-card-img">
              ${pictureTag(topic.image, alt, 'loading="lazy"')}
            </div>
            <div class="blog-card-body">
              <span class="blog-card-tag">${escapeAttr(topic.tag)}</span>
              <h3>${sanitizeInline(content.h1)}</h3>
              <p>${excerpt}${excerpt.length >= 160 ? '…' : ''}</p>
              <span class="blog-card-link">Lire la suite →</span>
            </div>
          </a>

        </div>`;

  const marker = /\n\s*<\/div>\s*\n\s*<\/div>\s*\n\s*<\/section>/;
  if (!marker.test(html)) {
    throw new Error("Impossible de localiser la fin de la grille .blog-grid dans blog/index.html");
  }
  html = html.replace(/\n(\s*)<\/div>(\s*)\n(\s*)<\/div>(\s*)\n(\s*)<\/section>/, (m, a, b, c, d, e) => {
    return `\n${cardHtml}${b}\n${c}</div>${d}\n${e}</section>`;
  });

  writeFileSync(indexPath, html);
}

// ── Ajout de l'URL dans sitemap.xml ────────────────────────────────────────

function insertIntoSitemap(topic, dateStr) {
  const sitemapPath = join(ROOT, 'sitemap.xml');
  let xml = readFileSync(sitemapPath, 'utf-8');
  const entry = `  <url>
    <loc>${SITE_URL}/blog/${topic.slug}.html</loc>
    <lastmod>${dateStr}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
`;
  if (!xml.includes('</urlset>')) {
    throw new Error('sitemap.xml : balise </urlset> introuvable');
  }
  xml = xml.replace(/\n<\/urlset>\s*$/, `\n${entry}\n</urlset>\n`);
  writeFileSync(sitemapPath, xml);
}

// ── Programme principal ─────────────────────────────────────────────────

async function main() {
  const queue = loadQueue();
  if (queue.length === 0) {
    console.log('File d’attente vide (scripts/blog-topics.json) — aucun article à publier cette semaine. Ajoute de nouveaux sujets pour continuer les publications hebdomadaires.');
    return;
  }

  const topic = queue[0];
  const targetPath = join(BLOG_DIR, `${topic.slug}.html`);
  if (existsSync(targetPath)) {
    console.log(`blog/${topic.slug}.html existe déjà — sujet retiré de la file sans republier.`);
    saveQueue(queue.slice(1));
    return;
  }

  console.log(`Sujet retenu : ${topic.service} (${topic.slug})`);
  const articles = readPublishedArticles();
  const content = await generateContent(topic, articles);
  const related = pickRelated(articles, topic.tag, 3);
  const dateStr = todayISO();

  const html = buildArticleHtml(topic, content, related, dateStr);
  writeFileSync(targetPath, html);
  console.log(`Écrit : blog/${topic.slug}.html`);

  insertIntoBlogIndex(topic, content);
  console.log('blog/index.html mis à jour.');

  insertIntoSitemap(topic, dateStr);
  console.log('sitemap.xml mis à jour.');

  saveQueue(queue.slice(1));
  console.log('scripts/blog-topics.json mis à jour (sujet retiré de la file).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
