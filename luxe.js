// Juste — accueil : rideau, menu, défilement doux, parallaxe, scène du cadran pilotée au défilement.
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

  /* ---------- rideau ---------- */
  const rideau = document.getElementById("rideau"), compte = document.getElementById("rideau-compte");
  const ouvrir = () => { document.body.classList.add("pret-page"); };
  if (!rideau || calme || sessionStorage.getItem("juste.vu")) { rideau?.classList.add("fini"); ouvrir(); }
  else {
    try { sessionStorage.setItem("juste.vu", "1"); } catch {}
    const t0 = performance.now(), D = 600;
    const pas = (t) => {
      const k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3);
      compte.textContent = String(Math.round(e * 100)).padStart(3, "0");
      if (k < 1) requestAnimationFrame(pas);
      else { rideau.classList.add("leve"); setTimeout(ouvrir, 180); setTimeout(() => rideau.classList.add("fini"), 1000); }
    };
    requestAnimationFrame(pas);
  }

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
    menu.setAttribute("role", "dialog"); menu.setAttribute("aria-modal", "true"); menu.setAttribute("aria-label", "Menu");
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
      menu.hidden = false; bouton.setAttribute("aria-expanded", "true"); bouton.firstElementChild.textContent = "Fermer";
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
    const bande = new IntersectionObserver(regler, { rootMargin: `-${Math.max(0, innerHeight - 92)}px 0px 0px 0px` });
    addEventListener("DOMContentLoaded", () => document.querySelectorAll(".scene-rail").forEach((el) => { vus.set(el, false); bande.observe(el); }));
  }

  /* ---------- cadran : construction ---------- */
  const NS = "http://www.w3.org/2000/svg", C = 300, VALEUR = 68, N = 12;
  const COUVERTS = [0, 1, 2, 4, 5, 7, 8, 10], PLAN = [3, 6, 9, 11];
  const minutes = document.getElementById("minutes"), gIndex = document.getElementById("index");
  const idx = [];
  if (gIndex) {
    const pt = (a, r) => [C + r * Math.sin(a), C - r * Math.cos(a)];
    const trait = (a, r1, r2, cl, parent) => { const [x1, y1] = pt(a, r1), [x2, y2] = pt(a, r2); const l = document.createElementNS(NS, "line"); Object.entries({ x1, y1, x2, y2, class: cl }).forEach(([k, v]) => l.setAttribute(k, v)); parent.appendChild(l); return l; };
    for (let i = 0; i < 60; i++) if (i % 5) trait((i / 60) * Math.PI * 2, 270, 278, "minute", minutes);
    for (let i = 0; i < N; i++) idx.push(trait((i / N) * Math.PI * 2, 222, 278, "index", gIndex));
  }
  const arc = document.getElementById("arc"), aiguille = document.getElementById("aiguille");
  const valeur = document.getElementById("valeur"), label = document.getElementById("valeur-label");
  const L = 2 * Math.PI * 252;
  if (arc) { arc.style.strokeDasharray = L; arc.style.strokeDashoffset = L; }

  /* ---------- scène pilotée au défilement ---------- */
  const scene = document.getElementById("mouvement"), temps = [...document.querySelectorAll("#temps li")], barre = document.getElementById("scene-barre");
  const borne = (x) => Math.max(0, Math.min(1, x));
  const doux = (x) => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  let dernierPas = -1;
  const dessiner = (p) => {
    const pas = Math.min(3, Math.floor(p * 4));
    if (pas !== dernierPas) { temps.forEach((li, i) => { li.classList.toggle("actif", i === pas); li.classList.toggle("passe", i < pas); }); dernierPas = pas; }
    barre.style.transform = `scaleX(${p})`;
    const lus = Math.round(borne(p / .24) * N);            // 1. lecture : les index s'allument
    const k = doux(borne((p - .5) / .22));                  // 3. écart : l'aiguille monte
    const nbCouverts = Math.round(k * COUVERTS.length);
    const plan = p > .78;                                   // 4. plan : les manques ressortent
    idx.forEach((l, i) => {
      l.classList.toggle("lu", i < lus);
      l.classList.toggle("couvert", COUVERTS.indexOf(i) > -1 && COUVERTS.indexOf(i) < nbCouverts);
      l.classList.toggle("plan", plan && PLAN.includes(i));
    });
    arc.style.strokeDashoffset = L * (1 - (VALEUR / 100) * k);
    aiguille.style.transform = `rotate(${VALEUR * 3.6 * k}deg)`;
    const ecrire = (el, t) => { t = String(t); if (el.textContent !== t) el.textContent = t; };
    if (p < .5) { ecrire(valeur, lus); ecrire(label, pas === 0 ? "exigences lues" : "exigences dans le profil cible"); }
    else if (!plan) { ecrire(valeur, Math.round(VALEUR * k)); ecrire(label, "% du profil cible"); }
    else { ecrire(valeur, PLAN.length); ecrire(label, "écarts dans le plan"); }
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
    if (scene && arc) {
      const r = scene.getBoundingClientRect();
      dessiner(borne(-r.top / (r.height - h)));
    }
  };
  const planifier = () => { if (!demande) { demande = true; requestAnimationFrame(maj); } };
  addEventListener("scroll", planifier, { passive: true }); addEventListener("resize", planifier);
  maj();
})();
