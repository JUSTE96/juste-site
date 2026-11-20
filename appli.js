// JusteCV — mode application : quand le site est installé sur l'écran d'accueil (ou emballé dans l'appli iPhone/Android),
// une barre d'onglets remplace le menu : Mesurer, Modèles, Suivi, Guides. Dans un navigateur ordinaire, rien ne change.
(function () {
  var base = (document.currentScript && document.currentScript.src || "").replace(/appli\.js.*$/, "");
  // Hors connexion : les pages déjà vues restent lisibles (réseau d'abord, copie gardée en secours).
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register(base + "sw.js").catch(function () {});
  var force = /[?&]appli=1/.test(location.search);
  try { if (force) sessionStorage.setItem("juste.appli", "1"); force = force || sessionStorage.getItem("juste.appli") === "1"; } catch (e) {}
  var installe = force || window.Capacitor || navigator.standalone === true || (window.matchMedia && matchMedia("(display-mode: standalone)").matches);
  if (!installe) return;
  var html = document.documentElement; html.classList.add("en-appli");
  var ONGLETS = [["atelier.html", "Mesurer", "score"], ["modeles.html", "Modèles", "cv"], ["suivi.html", "Suivi", "liste"], ["guides.html", "Guides", "feuille"]];
  var ici = location.pathname.split("/").pop() || "index.html";
  if (/\/metiers\//.test(location.pathname) || ici === "metiers.html") ici = "guides.html";   // les fiches métiers se rangent avec les guides
  var css = ".en-appli body{padding-bottom:calc(64px + env(safe-area-inset-bottom,0px))}"
    + ".en-appli .nav-links,.en-appli .nav-cta,.en-appli .nav-menu,.en-appli .tete nav,.en-appli .tete-liens,.en-appli .tete-actions .btn,.en-appli #menu-btn,.en-appli .barre-mobile{display:none!important}"
    + ".onglets-appli{position:fixed;left:0;right:0;bottom:0;z-index:2000;display:grid;grid-template-columns:repeat(4,1fr);padding:6px 8px calc(6px + env(safe-area-inset-bottom,0px));background:rgba(255,250,244,.96);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border-top:1px solid rgba(28,32,64,.12)}"
    + ".onglets-appli a{display:grid;justify-items:center;gap:3px;min-height:52px;padding:6px 2px;border-radius:14px;font:600 11.5px/1 'Schibsted Grotesk',-apple-system,sans-serif;color:#535a78;text-decoration:none;-webkit-tap-highlight-color:transparent}"
    + ".onglets-appli svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}"
    + ".onglets-appli a[aria-current]{color:#1c2040;background:rgba(255,107,74,.16)}"
    + ".onglets-appli a:focus-visible{outline:2px solid #1c2040;outline-offset:-2px}"
    + "html[data-nuit] .onglets-appli{background:rgba(20,25,54,.96);border-top-color:#f7f1e824}html[data-nuit] .onglets-appli a{color:#a9b0d6}html[data-nuit] .onglets-appli a[aria-current]{color:#f7f1e8;background:rgba(255,107,74,.24)}"
    + ".en-appli .ciel-btn:not(.dans-barre){bottom:calc(76px + env(safe-area-inset-bottom,0px))}"
    + "@media print{.onglets-appli{display:none!important}.en-appli body{padding-bottom:0}}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  function poser() {
    var nav = document.createElement("nav"); nav.className = "onglets-appli"; nav.setAttribute("aria-label", "Application JusteCV");
    nav.innerHTML = ONGLETS.map(function (o) {
      return '<a href="' + base + o[0] + '"' + (o[0] === ici ? ' aria-current="page"' : "") + '><svg aria-hidden="true"><use href="' + base + "assets/icones.svg#" + o[2] + '"></use></svg>' + o[1] + "</a>";
    }).join("");
    document.body.appendChild(nav);
  }
  if (document.body) poser(); else document.addEventListener("DOMContentLoaded", poser);
})();
