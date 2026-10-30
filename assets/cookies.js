// ── Carte Google Maps + bandeau cookies ───────────────────────────────────
// La carte est affichée dès l'arrivée sur le site. Un bandeau informe que
// Google Maps peut déposer des cookies ; si la visiteuse refuse, les cartes
// sont remplacées par un lien vers Google Maps et le choix est mémorisé.
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
      box.classList.remove('map-refused');
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

  function showBanner() {
    var b = document.createElement('div');
    b.className = 'cookie-banner';
    b.setAttribute('role', 'dialog');
    b.setAttribute('aria-live', 'polite');
    b.setAttribute('aria-label', 'Information sur les cookies');
    b.innerHTML =
      '<p>Ce site affiche une carte Google Maps pour vous aider à trouver l\'institut. Google peut déposer des cookies à cette occasion. ' +
      'Aucun autre cookie ni outil de mesure n\'est utilisé. <a href="' + privacyHref + '">En savoir plus</a></p>' +
      '<div class="cookie-banner-actions">' +
      '<button type="button" class="btn btn-outline-light" data-cookie="refused">Refuser la carte</button>' +
      '<button type="button" class="btn btn-primary" data-cookie="accepted">OK pour moi</button>' +
      '</div>';
    b.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-cookie]');
      if (!btn) return;
      var v = btn.getAttribute('data-cookie');
      setChoice(v);
      if (v === 'refused') unloadMaps(); else loadMaps();
      b.classList.add('is-hidden');
      setTimeout(function () { b.remove(); }, 400);
    });
    document.body.appendChild(b);
    requestAnimationFrame(function () { b.classList.add('is-visible'); });
  }

  function init() {
    var choice = getChoice();
    if (choice === 'refused') { unloadMaps(); return; }
    loadMaps();
    if (choice !== 'accepted') showBanner();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
