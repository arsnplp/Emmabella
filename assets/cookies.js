// ── Carte Google Maps + bandeau cookies ───────────────────────────────────
// Consentement préalable (RGPD) : aucun contenu Google n'est chargé avant le
// choix. Le bandeau s'affiche dès l'arrivée ; « OK pour moi » charge toutes
// les cartes du site, « Refuser » les remplace par un lien Google Maps.
// Le choix est mémorisé dans le navigateur (localStorage).
(function () {
  var KEY = 'emmabella-cookies';
  var MAPS_LINK = 'https://www.google.com/maps/search/?api=1&query=9+rue+de+la+Carraire+Les+Logissons+13770+Venelles';
  var inBlog = /\/blog\//.test(location.pathname);
  var privacyHref = (inBlog ? '../' : '') + 'confidentialite.html';

  function getChoice() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function setChoice(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  function loadMaps() {
    document.querySelectorAll('[data-map-embed]').forEach(function (box) {
      if (box.querySelector('iframe')) return;
      var f = document.createElement('iframe');
      f.src = box.getAttribute('data-src');
      f.title = box.getAttribute('data-title') || 'Carte';
      f.loading = 'lazy';
      f.setAttribute('allowfullscreen', '');
      f.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
      box.innerHTML = '';
      box.appendChild(f);
      box.classList.remove('map-refused', 'map-pending-box');
    });
  }

  function unloadMaps() {
    document.querySelectorAll('[data-map-embed]').forEach(function (box) {
      box.innerHTML =
        '<div class="map-fallback"><p>Carte Google Maps désactivée (cookies refusés).</p>' +
        '<a href="' + MAPS_LINK + '" target="_blank" rel="noopener">Ouvrir l\'adresse dans Google Maps</a></div>';
      box.classList.add('map-refused');
    });
  }

  function pendingMaps() {
    document.querySelectorAll('[data-map-embed]').forEach(function (box) {
      box.innerHTML =
        '<div class="map-fallback map-pending"><p>La carte s\'affiche dès que vous acceptez les cookies Google Maps.</p>' +
        '<button type="button" class="btn btn-primary" data-cookie="accepted">Afficher la carte</button>' +
        '<a href="' + MAPS_LINK + '" target="_blank" rel="noopener">Ouvrir l\'adresse dans Google Maps</a></div>';
      box.classList.add('map-pending-box');
    });
  }

  function choose(v) {
    setChoice(v);
    if (v === 'refused') unloadMaps(); else loadMaps();
    var b = document.querySelector('.cookie-banner');
    if (b) { b.classList.add('is-hidden'); setTimeout(function () { b.remove(); }, 400); }
  }

  function showBanner() {
    var b = document.createElement('div');
    b.className = 'cookie-banner';
    b.setAttribute('role', 'dialog');
    b.setAttribute('aria-live', 'polite');
    b.setAttribute('aria-label', 'Information sur les cookies');
    b.innerHTML =
      '<p>Pour vous aider à trouver l\'institut, ce site peut afficher une carte Google Maps, qui dépose des cookies. Acceptez-vous ? ' +
      'Aucun autre cookie ni outil de mesure n\'est utilisé. <a href="' + privacyHref + '">En savoir plus</a></p>' +
      '<div class="cookie-banner-actions">' +
      '<button type="button" class="btn btn-outline-light" data-cookie="refused">Refuser la carte</button>' +
      '<button type="button" class="btn btn-primary" data-cookie="accepted">OK pour moi</button>' +
      '</div>';
    document.body.appendChild(b);
    requestAnimationFrame(function () { b.classList.add('is-visible'); });
  }

  function init() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-cookie]');
      if (btn) choose(btn.getAttribute('data-cookie'));
    });
    var choice = getChoice();
    if (choice === 'accepted') { loadMaps(); return; }
    if (choice === 'refused') { unloadMaps(); return; }
    pendingMaps();
    showBanner();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
