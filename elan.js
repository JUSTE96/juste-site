// JusteCV — élan : le motion design de l'accueil, par-dessus luxe.js.
// Chaque mouvement montre quelque chose : une offre lue ligne par ligne, une étape franchie, un titre qui se pose.
// Sous « animations réduites », rien ne bouge et l'état final est affiché d'emblée.
import { matchScore, WEIGHTS, CREDIT } from "./moteur/match-score.mjs";

const calme = matchMedia("(prefers-reduced-motion: reduce)").matches;
const pointeurFin = matchMedia("(hover: hover) and (pointer: fine)").matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const borne = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const rejouer = (el, cl = "tic") => { if (!el) return; el.classList.remove(cl); void el.offsetWidth; el.classList.add(cl); };

/* ---------- héros : lecture en direct ----------
   Les six lignes viennent du HTML (état final, lisible sans script). Le score est calculé par le vrai moteur.
   Une seule passe : elle part quand la carte est vraiment à l'écran, et se termine d'un trait si la carte s'en va,
   pour que personne ne quitte le héros sur un chiffre intermédiaire. */
const heros = $(".heros.plein"), lecture = $("#lecture");
let figerLecture = () => {};
if (lecture) {
  const ol = $("#lecture-lignes"), lignes = $$("li", ol), fenetre = ol.parentElement;
  const elScore = $("#lecture-score"), jauge = $("#lecture-jauge"), compte = $("#lecture-compte"), lues = $("#puce-lues");
  const corr = lignes.map((li) => ({ competence: li.firstElementChild.textContent, exigence: li.dataset.n, statut: li.dataset.s }));
  const final = matchScore(corr)?.score ?? Number(elScore.textContent);
  const possible = corr.reduce((t, c) => t + WEIGHTS[c.exigence], 0);
  elScore.textContent = final; jauge.style.setProperty("--v", final / 100);

  if (!calme) {
    let affiche = 0, image = 0, ratio = 0, parti = false, presse = false, reveil = null;
    const DUREE = { attente: 300, lue: 420, jugee: 520, presse: 70 };
    const monter = (vers, duree = 600) => {
      cancelAnimationFrame(image);
      const de = affiche, t0 = performance.now();
      const pas = (t) => {
        const k = duree ? borne((t - t0) / duree) : 1, e = 1 - Math.pow(1 - k, 3);
        affiche = de + (vers - de) * e; elScore.textContent = Math.round(affiche);
        if (k < 1) image = requestAnimationFrame(pas);
      };
      if (duree) image = requestAnimationFrame(pas); else pas(0);
      jauge.style.setProperty("--v", vers / 100);
    };
    const poser = (n, signe = true) => {
      compte.textContent = `${n} / ${lignes.length}`;
      if (lues) lues.textContent = n;
      if (signe) { rejouer(compte); if (lues) rejouer(lues); }
      const visibles = Number(getComputedStyle(fenetre).getPropertyValue("--n")) || 4;
      ol.style.transform = `translateY(calc(${-Math.max(0, n - visibles)} * var(--h)))`;
    };
    // État de départ posé tout de suite : la carte se révèle vide, puis se remplit, sans retour en arrière.
    lecture.classList.add("vive");
    lignes.forEach((li) => li.classList.remove("la", "juge"));
    poser(0, false); elScore.textContent = "0"; jauge.style.setProperty("--v", 0);

    // Une attente que l'avance rapide (ou la pause) peut écourter.
    const attendre = (ms) => new Promise((ok) => {
      const fin = () => { clearTimeout(t); reveil = null; ok(); };
      const t = setTimeout(fin, lecture.classList.contains("figee") ? 0 : presse ? DUREE.presse : ms); reveil = fin;
    }).then(async () => { while (document.hidden && !presse) await new Promise((ok) => setTimeout(ok, 350)); });
    const presser = () => { if (presse) return; presse = true; reveil?.(); };
    figerLecture = () => { lecture.classList.add("figee"); presser(); if (!parti) lire(); };

    const lire = async () => {
      parti = true;
      // la carte finit d'entrer (opacité, échelle) avant que la première ligne tombe
      if (!presse) {
        await new Promise(requestAnimationFrame);
        const entree = lecture.getAnimations().filter((a) => a.transitionProperty === "opacity").map((a) => a.finished.catch(() => {}));
        await Promise.race([Promise.all(entree), new Promise((ok) => setTimeout(ok, 1400))]);
      }
      await attendre(DUREE.attente);
      let acquis = 0;
      for (let i = 0; i < lignes.length; i++) {
        lignes[i].classList.add("la"); poser(i + 1, !presse);         // la ligne est lue
        await attendre(DUREE.lue);
        lignes[i].classList.add("juge");                              // puis jugée : le score suit
        acquis += WEIGHTS[corr[i].exigence] * CREDIT[corr[i].statut];
        const vers = i === lignes.length - 1 ? final : Math.round((acquis / possible) * 100);
        monter(vers, lecture.classList.contains("figee") ? 0 : presse ? 400 : 600);
        await attendre(DUREE.jugee);
      }
      lecture.classList.add("finie");
    };
    const essayer = () => { if (!parti && ratio >= .6 && document.body.classList.contains("pret-page")) lire(); };
    new IntersectionObserver(([e]) => {
      ratio = e.isIntersecting ? e.intersectionRatio : 0;
      if (parti && ratio < .35) presser();                             // la carte s'en va : on finit d'un trait
      essayer();
    }, { threshold: [0, .35, .6] }).observe(lecture);
    if (!document.body.classList.contains("pret-page")) new MutationObserver((_, o) => { if (document.body.classList.contains("pret-page")) { o.disconnect(); essayer(); } }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }
}

/* ---------- héros : un seul bouton pause pour tout ce qui bouge (vidéo, lecture, fond) ----------
   Caché sous animations réduites : rien n'y bouge. Une vidéo qui arrive après une pause ne démarre pas (film.dataset.arret). */
const pauseFilm = $("#pause-film"), film = $("#film");
if (heros && pauseFilm && !calme) {
  pauseFilm.hidden = false;
  const basculer = () => {
    const arret = pauseFilm.getAttribute("aria-pressed") !== "true";
    pauseFilm.setAttribute("aria-pressed", arret);
    heros.classList.toggle("en-pause", arret);
    if (arret) figerLecture();
    if (film) {
      if (arret) { film.dataset.arret = 1; film.pause(); }
      else { delete film.dataset.arret; if (film.classList.contains("pret")) film.play().catch(() => {}); }
    }
  };
  // Pris en phase de capture : ce bouton commande désormais l'ensemble, plus seulement la vidéo.
  heros.addEventListener("click", (e) => { if (e.target.closest?.("#pause-film")) { e.stopPropagation(); basculer(); } }, true);
}

/* ---------- titres : les mots montent un à un ---------- */
const vues = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("vu"); vues.unobserve(e.target); } }), { rootMargin: "0px 0px -10% 0px" });
if (!calme) {
  const decouper = (titre) => {
    let m = 0;
    const parcourir = (noeud) => {
      for (const n of [...noeud.childNodes]) {
        if (n.nodeType === 1) { parcourir(n); continue; }
        if (n.nodeType !== 3) continue;
        const morceaux = document.createDocumentFragment();
        for (const part of n.textContent.split(/([ \n\t]+)/)) {
          if (!part) continue;
          if (/^[ \n\t]+$/.test(part)) { morceaux.append(" "); continue; }
          const boite = document.createElement("span"), mot = document.createElement("span");
          boite.className = "mot"; mot.textContent = part; mot.style.setProperty("--m", m++);
          boite.append(mot); morceaux.append(boite);
        }
        n.replaceWith(morceaux);
      }
    };
    parcourir(titre); titre.classList.add("mots");
  };
  $$("main h2.moyen, main h2.grand, main h2.geant").forEach((h) => { decouper(h); vues.observe(h); });
}

/* ---------- arrivées en cascade ---------- */
$$(".elan").forEach((c) => { [...c.children].forEach((el, i) => el.style.setProperty("--i", i)); vues.observe(c); });

/* ---------- scène du cadran : fil d'étapes cliquable, teinte par temps ---------- */
const scene = $("#mouvement");
if (scene) {
  const temps = $$("#temps li"), barre = $(".scene-barre", scene);
  // Où s'arrête chaque lien : la fin de chaque temps, quand son dessin est complet.
  const CIBLES = [.215, .44, .735, .93];
  const rail = document.createElement("nav");
  rail.className = "scene-rail"; rail.setAttribute("aria-label", "Les quatre temps de la méthode");
  temps.forEach((li, i) => {
    const ancre = document.createElement("span");
    ancre.className = "scene-ancre"; ancre.id = `temps-${i + 1}`; ancre.style.setProperty("--p", CIBLES[i]);
    scene.append(ancre);
    const a = document.createElement("a");
    a.href = `#temps-${i + 1}`;
    a.innerHTML = `<div><b>0${i + 1}</b><span></span></div>`;
    a.querySelector("span").textContent = $(".petit-titre", li)?.textContent ?? "";
    a.setAttribute("aria-label", `${i + 1}. ${$(".petit-titre", li)?.textContent ?? ""}`);
    rail.append(a);
  });
  barre?.after(rail); scene.classList.add("a-rail");
  const liens = $$("a", rail);
  let dernier = -1, demande = false;
  const maj = () => {
    demande = false;
    const r = scene.getBoundingClientRect(), h = innerHeight;
    if (r.bottom < -h || r.top > 2 * h) return;
    const p = borne(-r.top / (r.height - h)), pas = Math.min(3, Math.floor(p * 4));
    liens.forEach((a, i) => a.style.setProperty("--k", borne(p * 4 - i).toFixed(3)));
    if (pas !== dernier) {
      scene.dataset.pas = pas; dernier = pas;
      liens.forEach((a, i) => (i === pas ? a.setAttribute("aria-current", "step") : a.removeAttribute("aria-current")));
    }
  };
  const planifier = () => { if (!demande) { demande = true; requestAnimationFrame(maj); } };
  addEventListener("scroll", planifier, { passive: true }); addEventListener("resize", planifier);
  maj();
  // Le libellé sous le chiffre change de sens d'un temps à l'autre : il se repose au lieu de sauter.
  const label = $("#valeur-label");
  if (label && !calme) { let vu = label.textContent; new MutationObserver(() => { if (label.textContent !== vu) { vu = label.textContent; rejouer(label); } }).observe(label, { childList: true, characterData: true, subtree: true }); }
}

/* ---------- bandeau : il suit la vitesse et le sens du défilement ---------- */
const piste = $(".defile-piste");
if (piste && !calme) {
  const anim = piste.getAnimations?.()[0];
  if (anim) {
    const DUREE = Number(anim.effect?.getComputedTiming().duration) || 38000;
    let y = scrollY, v = 0, sens = 1, actif = false, image = 0;
    const tic = () => {
      const d = scrollY - y; y = scrollY;
      v += (Math.min(70, Math.abs(d)) - v) * .1;
      if (Math.abs(d) > 1) sens = d > 0 ? 1 : -1;
      if (sens < 0 && anim.currentTime < 3000) anim.currentTime += DUREE;   // à rebours, on ne bute jamais sur le début
      anim.playbackRate = sens * (1 + v * .2);
      image = actif ? requestAnimationFrame(tic) : 0;
    };
    new IntersectionObserver(([e]) => { actif = e.isIntersecting; if (actif && !image) { y = scrollY; image = requestAnimationFrame(tic); } }).observe(piste.parentElement);
  }
}

/* ---------- pointeur : profondeur du héros, reflet des cartes, boutons aimantés ---------- */
if (pointeurFin && !calme) {
  const heros = $(".heros.plein"), media = $(".heros-media");
  if (heros && media) {
    heros.addEventListener("pointermove", (e) => {
      const r = heros.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 2 - 1, y = (e.clientY - r.top) / r.height * 2 - 1;
      media.style.setProperty("--rx", `${(-y * 2.2).toFixed(2)}deg`); media.style.setProperty("--ry", `${(x * 3).toFixed(2)}deg`);
      media.style.setProperty("--mx", x.toFixed(3)); media.style.setProperty("--my", y.toFixed(3));
    });
    heros.addEventListener("pointerleave", () => ["--rx", "--ry", "--mx", "--my"].forEach((p) => media.style.removeProperty(p)));
  }
  $$(".galerie figure").forEach((f) => {
    f.addEventListener("pointermove", (e) => {
      const r = f.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      f.style.setProperty("--gx", `${(x * 100).toFixed(1)}%`); f.style.setProperty("--gy", `${(y * 100).toFixed(1)}%`);
      f.style.setProperty("--tx", `${((.5 - y) * 4).toFixed(2)}deg`); f.style.setProperty("--ty", `${((x - .5) * 5).toFixed(2)}deg`);
    });
    f.addEventListener("pointerleave", () => ["--tx", "--ty"].forEach((p) => f.style.removeProperty(p)));
  });
  $$(".heros .btn.plein, .fin .btn.plein, .pied .btn.plein").forEach((b) => {
    b.classList.add("aimant");
    b.addEventListener("pointermove", (e) => {
      const r = b.getBoundingClientRect();
      b.style.setProperty("--ax", `${((e.clientX - r.left - r.width / 2) * .22).toFixed(1)}px`);
      b.style.setProperty("--ay", `${((e.clientY - r.top - r.height / 2) * .3).toFixed(1)}px`);
    });
    b.addEventListener("pointerleave", () => { b.style.removeProperty("--ax"); b.style.removeProperty("--ay"); });
  });
}
