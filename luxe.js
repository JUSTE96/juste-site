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
    const boucle = (t) => { lenis.raf(t); requestAnimationFrame(boucle); };
    requestAnimationFrame(boucle);
  }

  /* ---------- menu ---------- */
  const menu = document.getElementById("menu"), bouton = document.getElementById("menu-btn");
  if (menu && bouton) {
    const fermer = () => { bouton.setAttribute("aria-expanded", "false"); bouton.firstElementChild.textContent = "Menu"; menu.classList.remove("ouvert"); lenis?.start(); setTimeout(() => { if (!menu.classList.contains("ouvert")) menu.hidden = true; }, calme ? 0 : 800); };
    const ouvrirMenu = () => { menu.hidden = false; bouton.setAttribute("aria-expanded", "true"); bouton.firstElementChild.textContent = "Fermer"; lenis?.stop(); requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add("ouvert"))); };
    bouton.addEventListener("click", () => bouton.getAttribute("aria-expanded") === "true" ? fermer() : ouvrirMenu());
    menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", fermer));
    addEventListener("keydown", (e) => { if (e.key === "Escape" && bouton.getAttribute("aria-expanded") === "true") { fermer(); bouton.focus(); } });
  }

  /* ---------- apparitions ---------- */
  document.querySelectorAll(".cascade").forEach((c) => c.querySelectorAll("section").forEach((s) => [...s.querySelectorAll("h3, .ref, .lignes li")].forEach((el, i) => el.style.setProperty("--i", i))));
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("vu"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -12% 0px" });
  document.querySelectorAll(".apparait, .cascade, .volet").forEach((el) => io.observe(el));

  /* ---------- barre d'action mobile : visible entre le héros et le dernier appel ---------- */
  const barreMobile = document.getElementById("barre-mobile");
  if (barreMobile) {
    const vus = new Map(), lien = barreMobile.querySelector("a");
    const obs = new IntersectionObserver((es) => {
      es.forEach((e) => vus.set(e.target, e.isIntersecting));
      const montrer = ![...vus.values()].some(Boolean);
      barreMobile.classList.toggle("visible", montrer); lien.tabIndex = montrer ? 0 : -1;
    });
    document.querySelectorAll(".heros, .fin, .pied").forEach((el) => { vus.set(el, true); obs.observe(el); });
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
    tete?.classList.toggle("fond", scrollY > 24);
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
