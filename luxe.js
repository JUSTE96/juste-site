// Juste — accueil : ouverture, menu, défilement doux, parallaxe, scène du cadran pilotée au défilement.
(() => {
  const calme = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const racine = document.documentElement;
  // Réfraction du verre : seulement là où backdrop-filter accepte un filtre SVG (navigateurs Chromium).
  if (navigator.userAgentData) racine.classList.add("verre-liquide");

  /* ---------- clips : la liste de clips.js fait foi (aucune requête pour un clip qui n'y est pas) ---------- */
  const CLIPS = window.JUSTE_CLIPS || {};
  const charger = (v, nom) => new Promise((ok) => {
    if (!CLIPS[nom]) return ok(false);
    v.onloadeddata = () => { v.classList.add("pret"); v.closest("figure")?.classList.add("charge"); ok(true); };
    v.onerror = () => ok(false);
    v.src = CLIPS[nom]; v.load();
  });
  // Section « À propos » : sans clip, le texte prend toute la largeur.
  if (!CLIPS.podcast) document.querySelector(".apropos-grille")?.classList.add("sans-clip");
  // Économie de données ou animations réduites : aucune vidéo n'est chargée, le décor reste.
  const sobre = calme || navigator.connection?.saveData === true;
  const film = document.getElementById("film"), pauseFilm = document.getElementById("pause-film");
  if (!sobre) {
    // Hors écran : rien n'est téléchargé. À l'écran : lecture. Sorti de l'écran : pause.
    const vue = new IntersectionObserver((es) => es.forEach(async (e) => {
      const v = e.target;
      if (e.isIntersecting) { if (!v.dataset.vu) { v.dataset.vu = 1; await charger(v, v.dataset.clip); } if (v.classList.contains("pret") && !v.dataset.arret) v.play().catch(() => {}); }
      else v.pause();
    }), { rootMargin: "200px" });
    document.querySelectorAll("video.clip").forEach((v) => vue.observe(v));
    if (film) {
      film.addEventListener("loadeddata", () => { pauseFilm.hidden = false; }, { once: true });
      pauseFilm.addEventListener("click", () => {
        const arret = !film.paused; if (arret) { film.dataset.arret = 1; film.pause(); } else { delete film.dataset.arret; film.play(); }
        pauseFilm.setAttribute("aria-pressed", arret);
        pauseFilm.setAttribute("aria-label", arret ? "Relancer la vidéo" : "Mettre la vidéo en pause");
      });
    }
  }

  /* ---------- ouverture ----------
     Plus de rideau ni de compteur : l'entrée du héros (titre, cadre, lecture) est l'ouverture.
     La classe est posée à l'image suivante pour que les transitions d'entrée se jouent. */
  const ouvrir = () => { document.body.classList.add("pret-page"); };
  if (calme) ouvrir(); else requestAnimationFrame(() => requestAnimationFrame(ouvrir));

  /* ---------- défilement doux ---------- */
  let lenis = null;
  if (!calme && window.Lenis) {
    lenis = new Lenis({ duration: 1.15, anchors: true });
    // Boucle à la demande : elle tourne pendant un défilement et 400 ms après le dernier geste, puis la page se repose.
    // Tout geste (molette, toucher, clavier, clic, défilement, retour sur l'onglet) la réveille.
    // À la reprise, l'horloge de Lenis est recalée : sinon la première image compterait toute la pause et sauterait au bout.
    let image = 0, reveil = 0, reprise = false;
    const boucle = (t) => {
      if (reprise) { lenis.time = t; reprise = false; }
      lenis.raf(t);
      image = (lenis.isScrolling || t - reveil < 400) ? requestAnimationFrame(boucle) : 0;
    };
    const reveiller = () => { reveil = performance.now(); if (!image) { reprise = true; image = requestAnimationFrame(boucle); } };
    ["wheel", "touchstart", "keydown", "pointerdown", "click", "scroll", "resize"].forEach((ev) => addEventListener(ev, reveiller, { passive: true, capture: true }));
    document.addEventListener("visibilitychange", reveiller);
    reveiller();
  }

  /* ---------- menu ----------
     Feuille plein écran, modale : le reste de la page devient inerte et ne défile plus (même sans Lenis).
     L'en-tête (logo, bouton Fermer, lune quand elle y est) reste atteignable. */
  const menu = document.getElementById("menu"), bouton = document.getElementById("menu-btn");
  if (menu && bouton) {
    const SECTIONS = ["metiers", "mouvement", "vitrine", "apropos", "prix", "faq"];
    const liens = [...menu.querySelectorAll("nav a")];
    let attente = 0;
    // Pas d'aria-modal : le bouton Fermer vit dans l'en-tête, hors du dialogue, et certains lecteurs d'écran ne l'atteindraient plus.
    // inert suffit à rendre le reste de la page muet. data-lenis-prevent : le menu défile nativement quand il dépasse (téléphone en paysage).
    menu.setAttribute("role", "dialog"); menu.setAttribute("aria-label", "Menu"); menu.setAttribute("data-lenis-prevent", "");
    const ouvert = () => bouton.getAttribute("aria-expanded") === "true";
    // Une seule fonction pose et retire le verrou : aucun chemin (bouton, Échap, lien) ne laisse la page inerte.
    // La requête est refaite à chaque fois : le bouton lune est créé plus tard par nuit.js.
    const verrouiller = (oui) => {
      document.querySelectorAll("main, footer, #barre-mobile, .ciel-btn, a.sr").forEach((el) => { el.inert = oui && !el.closest(".tete"); });
      racine.style.overflow = oui ? "hidden" : ""; racine.style.scrollbarGutter = oui ? "stable" : "";
      racine.classList.toggle("menu-ouvert", oui);
      if (oui) lenis?.stop(); else lenis?.start();
    };
    // « Vous êtes ici » : la dernière section dont le haut a passé le milieu de l'écran (jamais L'atelier, qui est une autre page).
    const situer = () => {
      let ici = null;
      for (const id of SECTIONS) { const s = document.getElementById(id); if (s && s.getBoundingClientRect().top <= innerHeight / 2) ici = id; }
      liens.forEach((a) => { if (ici && a.getAttribute("href") === "#" + ici) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current"); });
    };
    const fermer = (cible) => {
      if (!ouvert()) return;
      bouton.setAttribute("aria-expanded", "false"); bouton.firstElementChild.textContent = "Menu";
      menu.classList.remove("ouvert");
      verrouiller(false);
      if (cible) {
        // Saut franc sous le volet : la page est déjà à la bonne section quand il se lève, puis la section reçoit le focus.
        if (lenis) lenis.scrollTo(cible, { immediate: true, force: true }); else cible.scrollIntoView({ block: "start", behavior: "instant" });
        if (!cible.hasAttribute("tabindex")) { cible.setAttribute("tabindex", "-1"); cible.addEventListener("blur", () => cible.removeAttribute("tabindex"), { once: true }); }
        cible.focus({ preventScroll: true });
      }
      clearTimeout(attente);
      attente = setTimeout(() => { if (!menu.classList.contains("ouvert")) menu.hidden = true; }, calme ? 0 : 450);
    };
    const ouvrirMenu = () => {
      clearTimeout(attente);
      situer();
      menu.hidden = false; menu.scrollTop = 0; // en paysage, une ouverture précédente a pu le laisser défilé : on repart du haut
      bouton.setAttribute("aria-expanded", "true"); bouton.firstElementChild.textContent = "Fermer";
      verrouiller(true);
      requestAnimationFrame(() => requestAnimationFrame(() => { menu.classList.add("ouvert"); liens[0]?.focus({ preventScroll: true }); }));
    };
    bouton.addEventListener("click", () => ouvert() ? fermer() : ouvrirMenu());
    menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", (e) => {
      const id = a.getAttribute("href").startsWith("#") ? a.getAttribute("href").slice(1) : "";
      const cible = id && document.getElementById(id);
      if (!cible) { fermer(); return; }
      e.preventDefault();
      if (location.hash !== "#" + id) history.pushState(null, "", "#" + id);
      fermer(cible);
    }));
    addEventListener("keydown", (e) => { if (e.key === "Escape" && ouvert()) { fermer(); bouton.focus(); } });
  }

  /* ---------- apparitions ---------- */
  document.querySelectorAll(".cascade").forEach((c) => c.querySelectorAll("section").forEach((s) => [...s.querySelectorAll("h3, .ref, .lignes li")].forEach((el, i) => el.style.setProperty("--i", i))));
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("vu"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -12% 0px" });
  document.querySelectorAll(".apparait, .cascade, .volet").forEach((el) => io.observe(el));

  /* ---------- barre d'action mobile : visible entre le héros et le dernier appel, sauf là où la démo ou les prix proposent déjà l'atelier ---------- */
  const barreMobile = document.getElementById("barre-mobile");
  if (barreMobile) {
    const vus = new Map(), lien = barreMobile.querySelector("a");
    const regler = (es) => {
      es.forEach((e) => vus.set(e.target, e.isIntersecting));
      const montrer = ![...vus.values()].some(Boolean);
      barreMobile.classList.toggle("visible", montrer); lien.tabIndex = montrer ? 0 : -1;
    };
    const obs = new IntersectionObserver(regler);
    document.querySelectorAll(".heros, #demo, #prix, .fin, .pied").forEach((el) => { vus.set(el, true); obs.observe(el); });
    // Sur les écrans bas, le fil d'étapes de la scène descend dans la bande où vit la barre : elle lui laisse la place.
    // (Le fil est construit par elan.js, d'où l'attente de DOMContentLoaded.)
    // La bande dépend de la hauteur de l'écran : l'observateur est recréé quand elle change (rotation, barre du navigateur).
    let bande = null, hauteur = 0, delai = 0;
    const observerBande = () => {
      if (innerHeight === hauteur) return;
      hauteur = innerHeight; bande?.disconnect();
      bande = new IntersectionObserver(regler, { rootMargin: `-${Math.max(0, hauteur - 92)}px 0px 0px 0px` });
      document.querySelectorAll(".scene-rail").forEach((el) => { vus.set(el, false); bande.observe(el); });
    };
    addEventListener("DOMContentLoaded", observerBande);
    addEventListener("resize", () => { clearTimeout(delai); delai = setTimeout(observerBande, 150); }, { passive: true });
  }

  /* ---------- cadran : construction ----------
     Le cadran est construit et dessiné par elan.js, à partir des lignes lues dans le héros et du vrai moteur de score.
     Ici ne reste que la bascule des textes de la scène. */

  /* ---------- scène pilotée au défilement : le texte du temps en cours ---------- */
  const scene = document.getElementById("mouvement"), temps = [...document.querySelectorAll("#temps li")], barre = document.getElementById("scene-barre");
  const borne = (x) => Math.max(0, Math.min(1, x));
  let dernierPas = -1;
  const dessiner = (p) => {
    const pas = Math.min(3, Math.floor(p * 4));
    if (pas !== dernierPas) { temps.forEach((li, i) => { li.classList.toggle("actif", i === pas); li.classList.toggle("passe", i < pas); }); dernierPas = pas; }
    if (barre) barre.style.transform = `scaleX(${p})`;
  };

  /* ---------- boucle de défilement : en-tête, parallaxe, scène ---------- */
  const tete = document.getElementById("tete");
  const paras = calme ? [] : [...document.querySelectorAll("[data-parallaxe]")];
  let demande = false;
  const maj = () => {
    demande = false;
    const h = innerHeight;
    // En-tête rétréci : le bouton passe en corail (au premier écran, le héros porte déjà le bouton corail).
    if (tete) { const fond = scrollY > 24; tete.classList.toggle("fond", fond); tete.querySelector(".cadre > .btn")?.classList.toggle("plein", fond); }
    for (const el of paras) {
      const r = el.parentElement.getBoundingClientRect();
      if (r.bottom < 0 || r.top > h) continue;
      el.style.transform = `translate3d(0, ${(r.top + r.height / 2 - h / 2) * -Number(el.dataset.parallaxe)}px, 0)`;
    }
    // Sous animations réduites, la scène est mise à plat (les quatre temps lisibles d'un trait) : rien à piloter.
    if (scene && temps.length && !calme) {
      const r = scene.getBoundingClientRect();
      dessiner(borne(-r.top / (r.height - h)));
    }
  };
  const planifier = () => { if (!demande) { demande = true; requestAnimationFrame(maj); } };
  addEventListener("scroll", planifier, { passive: true }); addEventListener("resize", planifier);
  maj();
})();
