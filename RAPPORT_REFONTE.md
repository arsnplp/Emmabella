# Rapport de refonte SEO — emmabella.fr

**Date :** 03/07/2026
**Portée :** casser `index.html` (fausse single-page-app, 452 Ko, 18 `<h1>`) en 6 vraies pages statiques + refonte technique complète des 14 articles de blog existants (texte non modifié) + nettoyage images/fichiers exposés + régénération sitemap/robots.
**19 commits atomiques**, tous locaux. **Rien n'a été poussé vers `origin/main`** — à valider avant push.

---

## 1. Poids de la page d'accueil, avant / après

| | Avant | Après | Écart |
|---|---|---|---|
| **Poids HTML seul** (`index.html`) | 452 Ko | 38,5 Ko | **-91 %** |
| **Poids total transféré** (Lighthouse, navigateur mobile réel) | 2 223 Ko | 364 Ko | **-84 %** |
| **Nombre de `<h1>`** | 18 | 1 | — |
| **Contenu dupliqué** | 11 articles de blog entiers cachés en `display:none` | aucun (liens réels vers `/blog/[slug].html`) | — |
| **Images encodées en base64 inline** | 4 (272,9 Ko de HTML mort) | 0 (extraites vers `/assets`, mises en cache) | — |
| **Dossier `/images/`** | ~46 Mo (dont ~25 Mo de fichiers jamais référencés) | 3,7 Mo | **-92 %** |

*Le poids "avant" (2 223 Ko) a été mesuré sur la production (`https://www.emmabella.fr/`) lors de l'audit initial. Le poids "après" (364 Ko) a été mesuré en local sur un serveur statique simple (`python3 -m http.server`, sans compression ni cache HTTP) — donc **sans encore bénéficier** des gains de `nginx.seo.conf` (Brotli/gzip, `Cache-Control`). Une fois ce fichier déployé en production, le poids réellement transféré à chaque visite (hors premier chargement) sera encore inférieur grâce au cache navigateur, et le poids du premier chargement lui-même baissera encore avec la compression Brotli/gzip du HTML/CSS/JS.*

---

## 2. Score Lighthouse mobile, avant / après

| Catégorie | Avant (production) | Après (local, sans nginx.seo.conf) |
|---|---|---|
| **Performance** | 72–87 / 100 (variable selon les runs) | **91 / 100** |
| **Accessibilité** | 89 / 100 | 89 / 100 *(non traité dans cette passe — voir § 6)* |
| **Bonnes pratiques** | 100 / 100 | 100 / 100 |
| **SEO (audit auto Lighthouse)** | 100 / 100* | 100 / 100* |

*\*Rappel de l'audit initial : ce score ne couvre que des critères basiques et ne détectait aucun des problèmes structurels corrigés dans cette refonte (18 H1, absence d'URL pour Prestations/À propos, etc.).*

**Le changement le plus significatif : Speed Index.**

| | Avant | Après |
|---|---|---|
| Speed Index (mobile) | **10,2 s** (score Lighthouse 0,08/1 — très mauvais) | **2,6 s** |
| Largest Contentful Paint | 2,2 s | 2,9 s (local, voir note ci-dessous) |
| Cumulative Layout Shift | 0,003 | 0,005 |
| Total Blocking Time | 0 ms | 0 ms |

Le Speed Index était l'anomalie principale de l'audit initial (page visuellement "en travaux" pendant 10 secondes malgré un LCP correct) — directement causé par les 452 Ko de HTML et le DOM énorme dupliquant 11 articles. Résolu : plus qu'un seul HTML léger, aucun contenu caché à parser.

*Note LCP : légèrement plus élevé en local (2,9 s vs 2,2 s en prod) — attendu, un serveur de développement Python mono-thread sans HTTP/2 ni compression est plus lent que le nginx de production. Ce chiffre devrait s'améliorer une fois déployé, pas se dégrader.*

**Desktop (local) :** Performance 69/100, Accessibilité 89/100, Bonnes pratiques 100/100, SEO 100/100 — poids total 418 Ko. Le score Performance desktop reste pénalisé par l'absence de compression/cache HTTP en local (exactement ce que corrige `nginx.seo.conf`) ; à remesurer après déploiement pour un chiffre représentatif.

---

## 3. URLs créées / modifiées / supprimées

### Créées (indexables pour la première fois)
- `/prestations.html`
- `/a-propos.html`
- `/entreprises.html`
- `/evenements.html`
- `/reserver.html`

Ces 5 pages n'avaient **aucune URL propre** avant la refonte — leur contenu vivait caché dans `index.html` sans jamais être accessible par une adresse dédiée, donc jamais indexable individuellement par Google.

### Modifiée en profondeur
- `/index.html` — réécrite de zéro (452 Ko → 38,5 Ko), garde uniquement hero + aperçus + 3 derniers articles + footer.

### Modifiées (technique uniquement, texte intact)
- `blog/index.html` — hiérarchie de titres corrigée, domaine non-www, `BreadcrumbList`, liens de nav réparés.
- Les 14 articles (`blog/bienfaits-maderotherapie.html` → `blog/soins-visage-venelles.html`) — domaine non-www, `BreadcrumbList`, `og:image:width/height`, `<picture>` AVIF/WebP sur les vignettes "Articles similaires", liens morts réparés. **Aucune phrase, aucun titre d'article modifié.**
- `sitemap.xml` — régénéré : 21 URLs réelles, domaine non-www, `<lastmod>` partout.
- `robots.txt` — sitemap non-www, `Disallow` sur les fichiers déplacés.

### Supprimées / déplacées
- 65 fichiers image orphelins dans `/images/` (~46 Mo → 3,7 Mo).
- `emmabella-update.tar.gz` (27 Mo) et `blog/Ma déclaration d'activité.pdf` — déplacés hors du dépôt vers `/Users/lecoqarsene/Desktop/site/private-files/` (conservés, juste retirés de ce que nginx sert).

### Nouveaux fichiers structurels
- `/assets/site.css`, `/assets/site.js` — design system partagé (remplace le `<style>` inline de 41 Ko et duplication avec `blog/style.css`).
- `/assets/logo.{png,webp,avif}`, `/assets/a-propos-1/2.{jpg,webp,avif}` — images extraites du base64 inline.
- `/scripts/optimize-images.mjs` — conversion AVIF/WebP/fallback via `sharp`, réutilisable.
- `/scripts/validate-jsonld.mjs` — validation stricte du JSON-LD, zéro dépendance.
- `nginx.seo.conf` — voir § 4.
- `SEO_META_PROPOSAL.md` — voir § 5.

---

## 4. Action manuelle restante n°1 : déployer `nginx.seo.conf`

Fichier livré à la racine du repo, **non déployé** (pas d'accès SSH production dans cette tâche). Contient :
- Redirection 301 `www.emmabella.fr` → `emmabella.fr` (les deux domaines répondent actuellement 200 sans redirection).
- `Cache-Control: public, max-age=31536000, immutable` sur `/assets/*` et `/images/*`.
- `Cache-Control: public, max-age=3600` sur les pages HTML.
- Compression gzip + Brotli (le module Brotli nginx doit être installé séparément si absent — instructions dans le fichier).
- Blocage direct des archives/scripts par précaution.

**À faire côté serveur :** fusionner les blocs de ce fichier dans la config nginx existante, `nginx -t` pour valider la syntaxe, puis `systemctl reload nginx`. Commandes de vérification post-déploiement incluses en tête du fichier.

## 5. Action manuelle restante n°2 : valider `SEO_META_PROPOSAL.md`

15 pages (blog/index + 14 articles) ont une proposition de title/description raccourcie en attente — **rien n'a été appliqué**. Une fois validé (en tout ou en partie), j'applique les changements dans un commit dédié.

## 6. Hors périmètre de cette passe (signalé, non traité)

- **Accessibilité (89/100 inchangé) :** contraste insuffisant par endroits et cibles tactiles trop petites/rapprochées sur mobile, déjà relevés dans l'audit initial — pas dans le périmètre de ce brief SEO.
- **Push vers `origin/main` :** aucun commit n'a été poussé. À confirmer explicitement.
- **Domaine non-www vs www :** le code est prêt (tous les `canonical`/OG/JSON-LD/sitemap pointent vers `emmabella.fr`), mais tant que `nginx.seo.conf` n'est pas déployé, les deux domaines continueront de répondre 200 sans redirection en production.

---

## Vérifications effectuées avant chaque commit concerné

- `node scripts/validate-jsonld.mjs` → 21 pages, 36 blocs JSON-LD, zéro erreur.
- Crawl complet des liens internes (`href`/`src`) sur un serveur statique local → 54 ressources uniques vérifiées, zéro lien cassé (2 cassés trouvés et corrigés en cours de route : fallback `<img>` de deux vignettes pointant vers des `.png` renommés en `.jpg`).
- `grep -c '<h1'` = 1 sur chacune des 21 pages HTML.
- Recherche `www.emmabella.fr` dans `*.html`/`sitemap.xml` → aucune occurrence restante (hors `nginx.seo.conf`, dont c'est justement l'objet).
- `git diff --stat` sur les 14 articles relu pour confirmer qu'aucun texte visible n'a changé, seulement meta/JSON-LD/`<picture>`.
