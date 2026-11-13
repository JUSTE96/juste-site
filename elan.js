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
   Les six lignes viennent du HTML (état final, lisible sans script). Le score est calculé par le vrai moteur. */
const lecture = $("#lecture");
if (lecture) {
  const ol = $("#lecture-lignes"), lignes = $$("li", ol), fenetre = ol.parentElement;
  const elScore = $("#lecture-score"), jauge = $("#lecture-jauge"), compte = $("#lecture-compte"), lues = $("#puce-lues");
  const corr = lignes.map((li) => ({ competence: li.firstElementChild.textContent, exigence: li.dataset.n, statut: li.dataset.s }));
  const final = matchScore(corr)?.score ?? Number(elScore.textContent);
  const possible = corr.reduce((t, c) => t + WEIGHTS[c.exigence], 0);
  elScore.textContent = final; jauge.style.setProperty("--v", final / 100);

  if (!calme) {
    let visible = true, affiche = final, image = 0;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(lecture);
    const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
    const attendre = async (ms) => { await pause(ms); while (!visible || document.hidden) await pause(350); };
    const monter = (vers, duree = 750) => {
      cancelAnimationFrame(image);
      const de = affiche, t0 = performance.now();
      const pas = (t) => {
        const k = borne((t - t0) / duree), e = 1 - Math.pow(1 - k, 3);
        affiche = de + (vers - de) * e; elScore.textContent = Math.round(affiche);
        if (k < 1) image = requestAnimationFrame(pas);
      };
      image = requestAnimationFrame(pas);
      jauge.style.setProperty("--v", vers / 100);
    };
    const poser = (n) => {
      compte.textContent = `${n} / ${lignes.length}`; rejouer(compte);
      if (lues) { lues.textContent = n; rejouer(lues); }
      const style = getComputedStyle(fenetre), visibles = Number(style.getPropertyValue("--n")) || 4;
      ol.style.transform = `translateY(calc(${-Math.max(0, n - visibles)} * var(--h)))`;
    };
    const boucle = async () => {
      lecture.classList.add("vive");
      for (;;) {
        lecture.classList.remove("finie");
        lignes.forEach((li) => li.classList.remove("la", "juge"));
        poser(0); monter(0, 350);
        await attendre(900);
        let acquis = 0;
        for (let i = 0; i < lignes.length; i++) {
          lignes[i].classList.add("la"); poser(i + 1);               // la ligne est lue
          await attendre(560);
          lignes[i].classList.add("juge");                            // puis jugée : le score suit
          acquis += WEIGHTS[corr[i].exigence] * CREDIT[corr[i].statut];
          monter(i === lignes.length - 1 ? final : Math.round((acquis / possible) * 100));
          await attendre(820);
        }
        lecture.classList.add("finie");
        await attendre(5600);
      }
    };
    const depart = () => setTimeout(boucle, 1700);
    if (document.body.classList.contains("pret-page")) depart();
    else new MutationObserver((_, o) => { if (document.body.classList.contains("pret-page")) { o.disconnect(); depart(); } }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }
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
  if (label && !calme) new MutationObserver(() => rejouer(label)).observe(label, { childList: true, characterData: true, subtree: true });
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
