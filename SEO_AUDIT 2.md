# Audit SEO technique — emmabella.fr

**Date de l'audit :** 03/07/2026
**Périmètre analysé :** `index.html` (page d'accueil, single-page-app) + `blog/index.html` + 14 articles de blog (`blog/*.html`)
**Méthode :** analyse statique du code source, requêtes HTTP sur le site en production (https://www.emmabella.fr), validation JSON-LD, Lighthouse CLI (mobile + desktop, plusieurs runs).
**Aucune modification n'a été appliquée** — ce document est un état des lieux.

---

## Résumé exécutif

Le blog (14 articles + page liste) est **globalement bien optimisé** : canonical, OG/Twitter, JSON-LD BlogPosting, alt text et lazy loading sont présents partout, sans erreur de syntaxe JSON-LD.

Le problème principal du site est **architectural et concerne la page d'accueil** : `index.html` est une fausse single-page application (aucune gestion d'URL/`history.pushState`) qui encapsule Accueil, Prestations, À propos, Réserver **et une copie intégrale de 11 des 14 articles de blog** dans un seul fichier de 452 Ko avec **18 balises `<h1>`**. Cela dilue le signal thématique de la page la plus importante du site, crée du contenu dupliqué, et plombe le poids de page (2,2 Mo transférés, dont 273 Ko de logo encodé en base64 inutile).

**Les 5 problèmes à corriger en priorité :**
1. `index.html` contient 18 `<h1>` et duplique 11 articles de blog en entier (caché en `display:none`) — critique.
2. "Prestations", "À propos" et "Réserver" n'ont aucune URL propre indexable — critique.
3. Logo encodé en base64 inline, dupliqué 2×, ~273 Ko de code mort dans le HTML — critique.
4. Aucun en-tête `Cache-Control` sur les assets statiques (images, etc.) — critique.
5. Plusieurs images utilisées en production pèsent 1 à 3 Mo (ex. `soins-visage.jpg` = 1,6 Mo, en réalité un PNG mal nommé) — critique.

---

## 1. Robots.txt & Sitemap.xml

| Gravité | Constat |
|---|---|
| ✅ OK | `robots.txt` présent, accessible, `Allow: /` et référence correcte du sitemap. |
| ✅ OK | `sitemap.xml` accessible, contient les 16 URLs réelles du site (accueil, blog/, 14 articles) — **100 % de correspondance** avec les fichiers publiés, `lastmod` à jour sur les 3 nouveaux articles. |
| 🟡 Mineur | Le sitemap ne référence pas de sections comme "Prestations" ou "À propos" — cohérent puisque ces sections n'ont pas d'URL dédiée (voir section 9), mais cela signifie que ces contenus ne sont jamais soumis explicitement à Google via sitemap. |
| 🟡 Mineur | Pas de balise `<lastmod>` sur l'URL racine (`https://www.emmabella.fr/`) dans le sitemap. |

---

## 2. Balises `<title>` et `<meta description>`

**Unicité :** ✅ tous les titles et toutes les meta descriptions sont uniques (aucun doublon détecté sur les 16 pages).

**Longueur — 🟠 Important, généralisé :**

| Élément | Recommandation | Constat |
|---|---|---|
| `<title>` | ≤ 60 caractères (troncature Google au-delà) | **16 / 16 pages dépassent 60 caractères** (77 à 123 caractères). Tous les titles seront tronqués dans les résultats de recherche. |
| `<meta description>` | 120–160 caractères | **13 / 16 pages dépassent 160 caractères** (jusqu'à 211 caractères pour `index.html`). Le texte sera coupé dans le snippet Google. |

Exemples les plus critiques :
- `index.html` : title 114 car. / description **211 car.** (le plus long du site)
- `blog/reflexologie-plantaire-venelles.html` : title **123 car.**
- `blog/massage-visage-venelles.html`, `rehaussement-cils-venelles.html`, `restructuration-sourcils-venelles.html` : les 3 seules pages sous les 160 car. en description (152–156 car.), mais leurs titles dépassent quand même 60 car.

**Mots-clés :** ✅ présence cohérente des mots-clés cibles (ville "Venelles", "Aix-en-Provence", nom du soin) dans title, H1 et description sur toutes les pages — bon point.

---

## 3. Structure de titres (H1 / H2 / H3)

| Gravité | Page(s) | Constat |
|---|---|---|
| 🔴 Critique | `index.html` | **18 balises `<h1>`** sur une seule page : le vrai H1 de marque, "Nos Prestations", "À propos", "Notre Blog", "Je me déplace chez vous", "Un moment d'exception...", "Prendre rendez-vous", **+ 11 H1 issus des articles de blog dupliqués en entier** (ex. `<h1>Les bienfaits de la madérothérapie</h1>`, `<h1>Massage assis en entreprise...</h1>`, etc.). Aucun signal H1 clair pour Google sur le sujet de la page d'accueil. |
| ✅ OK | Les 14 articles de blog | Exactement **1 seul `<h1>`** par page, hiérarchie H2 → H3 → H4 cohérente et sans saut. |
| ✅ OK | `blog/index.html` | 1 seul H1 ("Notre Blog"). |
| 🟡 Mineur | `blog/index.html` | La hiérarchie saute de H1 directement à H3 (titres des cartes d'articles) sans H2 intermédiaire ; un H2 n'apparaît qu'ensuite pour la section CTA. Confirmé par l'audit Lighthouse ("Heading elements are not in a sequentially-descending order"). |

---

## 4. hreflang / langue

| Gravité | Constat |
|---|---|
| ✅ OK | `<html lang="fr">` correctement déclaré sur les 16 pages. |
| ✅ OK | Site mono-langue (français uniquement) → aucune balise `hreflang` requise. Aucune trouvée, ce qui est cohérent. |

---

## 5. Schema.org (données structurées)

**Validité syntaxique :** ✅ tous les blocs JSON-LD du site sont syntaxiquement valides (aucune erreur de parsing sur 16 pages).

| Gravité | Constat |
|---|---|
| ✅ OK | `index.html` : schema `BeautySalon` (sous-type de `LocalBusiness`) complet — nom, description, url, telephone, email, image, `priceRange`, `PostalAddress`, `GeoCoordinates`, `sameAs` (Instagram/Facebook), `hasOfferCatalog` avec les 4 familles de prestations. |
| ✅ OK | Les 14 articles de blog ont un schema `BlogPosting` complet (headline, description, image, url, datePublished/dateModified, author, publisher avec logo, mainEntityOfPage). |
| 🔴 Critique | **Aucune balise `BreadcrumbList`** nulle part sur le site, alors que le fil d'Ariane visuel (`<p class="breadcrumb">Accueil › Blog › ...`) existe sur les 14 pages d'articles. C'est une opportunité de rich snippet perdue (affichage du chemin dans les résultats Google) et demandée explicitement dans le brief. |
| 🔴 Critique | `index.html` contient **11 schémas `BlogPosting` dupliqués** (un par article caché), en plus d'un schema `Blog`. Ces mêmes `BlogPosting` existent déjà, à l'identique, sur les pages dédiées `blog/*.html`. Duplication de données structurées entre deux contextes différents pour le même contenu. |
| 🟡 Mineur | Le schema `BeautySalon` n'a pas d'`openingHoursSpecification` (horaires d'ouverture) — recommandé pour le SEO local / Google Business, actuellement absent. |
| 🟡 Mineur | Pas d'`aggregateRating` — normal si aucun système d'avis vérifié n'est en place (à ajouter uniquement si des avis réels existent, ne jamais fabriquer cette donnée). |

---

## 6. Open Graph & Twitter Card

| Gravité | Constat |
|---|---|
| ✅ OK | 100 % des pages ont un jeu complet de balises OG (`og:type`, `og:title`, `og:description`, `og:url`, `og:image`, `og:site_name`, `og:locale`) et Twitter Card (`twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`). |
| ✅ OK | Les `og:image` pointent vers des images existantes et pertinentes par article. |
| 🟡 Mineur | Aucune balise `og:image:width` / `og:image:height` — non bloquant mais recommandé pour accélérer le rendu des cartes de partage. |

---

## 7. Balises Canonical

| Gravité | Constat |
|---|---|
| ✅ OK | **16 / 16 pages** ont une balise `<link rel="canonical">` correcte, auto-référencée, en HTTPS et avec le domaine `www`. |
| 🟠 Important | Le serveur répond en **HTTP 200 à la fois sur `https://www.emmabella.fr/` et `https://emmabella.fr/`** (pas de redirection 301 vers une version canonique unique). Le `<link rel="canonical">` pointe bien vers la version `www` depuis les deux, ce qui limite le risque, mais **ce n'est pas un substitut à une redirection serveur** : sans 301, Google peut crawler/indexer les deux hôtes séparément et l'autorité (liens) peut se diluer entre les deux versions. |

---

## 8. Images : alt, formats modernes, lazy loading

| Gravité | Constat |
|---|---|
| ✅ OK | **119 balises `<img>` sur le site, 100 % ont un attribut `alt` renseigné** et descriptif (aucun alt vide ou générique détecté). |
| ✅ OK | Lazy loading (`loading="lazy"`) appliqué systématiquement sur les images hors-écran ; seules les logos (header/footer, non critiques) n'ont pas d'attribut `loading`, ce qui est acceptable. |
| 🟠 Important | **Formats modernes incomplets** : seuls `index.html` et `blog/index.html` utilisent `<picture>` avec sources AVIF/WebP. **Les 14 pages d'articles individuelles n'utilisent aucun `<picture>` / AVIF** pour les vignettes "Articles similaires" — elles chargent directement des `.jpg` (parfois lourds) même quand une version `.avif` existe déjà sur le serveur pour la même image. |
| 🔴 Critique | **`images/soins-visage.jpg` pèse 1,64 Mo** et est utilisé sur **5 pages**. Ce fichier est en réalité un **PNG non compressé renommé en `.jpg`** (vérifié via `file` : "PNG image data"), alors que des versions `.avif` (31 Ko) et `.webp` (41 Ko) existent déjà à côté — elles ne sont simplement pas utilisées par les pages qui chargent ce fichier en fallback direct. |
| 🔴 Critique | **14 images utilisées en production pèsent chacune 300 Ko à 3,2 Mo** (non compressées), certaines réutilisées sur 5 à 8 pages : `massageassis.png` (1,5 Mo × 6 pages), `browliftBlog.png` (560 Ko × 8 pages), `soins-visage.jpg` (1,6 Mo × 5 pages), `massages.jpg` (1,6 Mo), `sourcils.png` (1,9 Mo), `cils.png` (1,8 Mo), `a1`–`a4.png`, `slide1`–`3.png`, `insta1`/`insta4.png`, `values-bg.png`, `mariageest.png`, `babys.png`, etc. Ce sont les plus gros contributeurs au mauvais score de performance mobile/desktop. |
| ⚠️ Non audité en détail | De nombreuses autres images (`insta2`, `insta3`, `insta5`, `insta6`, `22.4x.xx.png`, `anniv.png`, `bg-fleurs.png`, etc.) font aussi 1 à 3 Mo dans `/images/` mais n'ont pas été trouvées référencées dans le HTML actuel — probablement des fichiers orphelins (captures d'écran, exports non utilisés). Ils n'impactent pas la performance des pages mais alourdissent inutilement le dépôt. À vérifier avant suppression. |

---

## 9. Architecture d'URL (constat transverse, hors checklist initiale mais critique)

| Gravité | Constat |
|---|---|
| 🔴 Critique | Le site n'a **aucune gestion d'URL côté client** (`history.pushState` absent). Les liens `href="prestations.html"`, `href="reserver.html"`, `href="a-propos.html"` sont interceptés en JavaScript (`event.preventDefault()`) et ne font qu'afficher/masquer des `<div class="page">` dans `index.html` — **ces fichiers `.html` n'existent pas physiquement** et l'URL du navigateur ne change jamais. |
| **Conséquences SEO directes :** | Les sections "Prestations" (page commerciale la plus importante après l'accueil), "À propos" et "Réserver" n'ont **aucune URL indexable propre**, donc : impossible de les faire ranker sur des requêtes spécifiques ("prestations institut beauté Venelles"), impossible de les partager/linker directement, absentes du sitemap, et leur contenu n'est visible à Google qu'à travers le rendu JS de la page d'accueil unique — qui contient déjà 18 H1 et 452 Ko de contenu, dilué par ailleurs par les 11 articles de blog cachés. |
| 🟠 Important | `blog/index.html` a lui aussi des cartes qui interceptent le clic (`onclick="event.preventDefault(); showArticle(...)"`) pour afficher la copie cachée dans `index.html` plutôt que de naviguer vers la vraie page `blog/*.html` — mais ici le `href` réel pointe vers une page qui, elle, existe et est indexable, donc le risque est surtout une incohérence UX/duplication de contenu plutôt qu'un problème de crawl. |
| 🟠 Important | Liens cassés détectés dans `index.html` : `href="prestations.html"` (7 occurrences) et `href="reserver.html"` (4 occurrences) pointent vers des fichiers physiquement inexistants. Sans exécution JS (outils SEO comme Screaming Frog en mode "text only", anciens robots, etc.), ce sont des liens morts. |

---

## 10. Core Web Vitals — Lighthouse (mobile + desktop)

Tests effectués en conditions réelles sur `https://www.emmabella.fr/` (production), plusieurs runs. Les scores de performance varient sensiblement d'un run à l'autre (variance réseau normale avec Lighthouse), la fourchette est indiquée.

| Catégorie | Mobile | Desktop |
|---|---|---|
| **Performance** | 🟠 72–87 / 100 | 🔴 65–80 / 100 |
| **Accessibilité** | 🟡 89 / 100 | 89 / 100 |
| **Bonnes pratiques** | ✅ 100 / 100 | 100 / 100 |
| **SEO (audit auto Lighthouse)** | ✅ 100 / 100 | 100 / 100 |

> ⚠️ Le 100/100 SEO de Lighthouse ne valide que des critères basiques (meta description présente, texte lisible, liens crawlables, viewport, etc.) — il **ne détecte pas** les problèmes structurels relevés dans ce rapport (18 H1, absence d'URL pour Prestations/À propos, longueur des titles, BreadcrumbList manquant). Le score ne doit pas être lu comme "aucun problème SEO".

**Métriques Core Web Vitals (mobile) :**

| Métrique | Valeur | Seuil "Bon" Google | Statut |
|---|---|---|---|
| LCP (Largest Contentful Paint) | 2,2 s | < 2,5 s | ✅ Bon |
| CLS (Cumulative Layout Shift) | 0,003 | < 0,1 | ✅ Excellent |
| TBT (Total Blocking Time) | 0 ms | < 200 ms | ✅ Excellent |
| **Speed Index** | **10,2 s** | < 4,3 s | 🔴 **Très mauvais** (score Lighthouse 0,08/1) |

**Métriques Core Web Vitals (desktop) :**

| Métrique | Valeur | Statut |
|---|---|---|
| LCP | 1,5–3,2 s | 🟡 Variable |
| CLS | 0,01 | ✅ Bon |
| TBT | 0 ms | ✅ Excellent |
| Speed Index | 3,0–10,6 s | 🔴 Très variable / mauvais dans le pire cas |

**Diagnostic principal — pourquoi le Speed Index est mauvais malgré un bon LCP :**
Le LCP (élément principal visible) apparaît vite, mais la page continue de "travailler" visuellement très longtemps après (chargement différé de tout le contenu cache/dupliqué, DOM énorme). Causes identifiées par Lighthouse :

| Gravité | Opportunité Lighthouse | Estimation |
|---|---|---|
| 🔴 Critique | **Cache-lifetimes inefficaces** — confirmé manuellement : **aucun header `Cache-Control` n'est envoyé par le serveur** (nginx), ni sur le HTML ni sur les images. Chaque visite retélécharge tout. | ~1,9 Mo d'économie potentielle |
| 🔴 Critique | **Amélioration de la diffusion des images** (formats modernes non utilisés en fallback, images surdimensionnées) | ~1,5 Mo d'économie potentielle |
| 🟠 Important | **Ressources bloquant le rendu** (CSS 40 Ko entièrement inline + police Google Fonts) | ~1,2 s d'économie potentielle |
| 🟠 Important | Poids total de page : **2,2 Mo** transférés pour la seule page d'accueil | — |
| 🟡 Mineur | CSS non minifié | ~5 Ko d'économie |
| 🟡 Mineur | Images sans attribut `width`/`height` explicite (risque de CLS) | — |

**Cause racine confirmée manuellement :** `index.html` (452 Ko) contient **2 copies du logo encodées en base64** directement dans le HTML (≈273 Ko de texte base64, alors que le fichier `logo.png` ne pèse que 10 Ko). Cette image ne peut pas être mise en cache par le navigateur indépendamment du HTML — elle est retéléchargée à chaque chargement de page.

**Accessibilité — points bloquants relevés par Lighthouse :**
- 🟡 Contraste insuffisant entre certains textes et leur arrière-plan.
- 🟡 Cibles tactiles (boutons/liens) trop petites ou trop rapprochées sur mobile.
- 🟡 Hiérarchie de titres non séquentielle (cf. section 3).

---

## Tableau récapitulatif par gravité

### 🔴 Critique (à corriger en priorité)
1. `index.html` : 18 `<h1>`, dont 11 articles de blog entiers dupliqués en `display:none`.
2. Sections "Prestations", "À propos", "Réserver" sans URL propre indexable (fausse SPA sans routing).
3. Logo en base64 inline dupliqué ×2 (~273 Ko de HTML mort, non cacheable).
4. Aucun header `Cache-Control` côté serveur sur les assets statiques.
5. Images de production surdimensionnées (1 à 3,2 Mo), dont `soins-visage.jpg` = un PNG mal nommé de 1,6 Mo utilisé sur 5 pages.
6. Aucune donnée structurée `BreadcrumbList` sur tout le site malgré les fils d'Ariane visuels existants.
7. 11 schémas `BlogPosting` dupliqués entre `index.html` et les pages `blog/*.html`.

### 🟠 Important
8. 16/16 titles dépassent 60 caractères (troncature Google systématique).
9. 13/16 meta descriptions dépassent 160 caractères.
10. Pas de redirection 301 serveur entre `emmabella.fr` et `www.emmabella.fr` (les deux répondent 200).
11. Liens `href="prestations.html"` / `href="reserver.html"` cassés sans exécution JS.
12. Pages d'articles individuelles n'utilisent pas `<picture>`/AVIF pour leurs vignettes "Articles similaires" malgré la disponibilité des fichiers.
13. CSS 40 Ko entièrement inline + police externe bloquant le rendu (~1,2 s estimé).
14. Score de performance Lighthouse mobile/desktop tirés vers le bas par le Speed Index (jusqu'à 10+ s).
15. Contraste et taille des cibles tactiles insuffisants par endroits (accessibilité 89/100).

### 🟡 Mineur
16. `blog/index.html` : saut de hiérarchie H1 → H3 sans H2 intermédiaire.
17. Schema `BeautySalon` sans `openingHoursSpecification`.
18. Meta `robots` explicite absente sur 10 des 14 anciens articles (valeur par défaut correcte, mais incohérence avec les 3 nouveaux articles qui l'ont).
19. Pas de `lastmod` sur l'URL racine du sitemap.
20. Pas d'`og:image:width`/`height`.
21. CSS non minifié (~5 Ko).
22. Nombreuses images volumineuses (1–3 Mo) potentiellement orphelines dans `/images/`, à vérifier avant nettoyage.

---

*Rapport généré à partir d'une analyse statique du code source et de tests Lighthouse CLI sur https://www.emmabella.fr. Aucun fichier du site n'a été modifié.*
