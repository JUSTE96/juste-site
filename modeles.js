// JusteCV — Modèles de CV : le texte d'un CV, rangé dans une mise en page lisible par les logiciels de tri.
// Tout se passe dans le navigateur. Rien n'est inventé : ce qui manque reste « à compléter » et ne s'imprime pas.
import { DOMAINES } from "./moteur/exemples.mjs";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const maj = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const CLE = "juste.modele";

/* ---------- lecture du texte ---------- */
const RUBRIQUES = [
  [/^exp[ée]riences?( professionnelles?)?$|^parcours( professionnel)?$/i, "experiences"],
  [/^formations?$|^dipl[ôo]mes?$|^formations? et dipl[ôo]mes$/i, "formation"],
  [/^certifications?$|^habilitations?$/i, "certifications"],
  [/^comp[ée]tences?( techniques)?$|^savoir-faire$/i, "competences"],
  [/^qualit[ée]s$|^savoir-[êe]tre$|^atouts$/i, "qualites"],
  [/^langues?$/i, "langues"],
  [/^profil$|^[àa] propos$|^r[ée]sum[ée]$/i, "profil"],
  [/^divers$|^informations?( compl[ée]mentaires)?$|^centres? d'int[ée]r[êe]ts?$|^loisirs$|^permis$/i, "divers"],
];
const DATES = /^((?:\d{1,2}\/)?\d{4})\s*(?:[-–—]|à)\s*((?:\d{1,2}\/)?\d{4}|aujourd['’]hui|auj\.?|pr[ée]sent|en cours)\s*[:,–-]?\s*(.*)$/i;

export function lireCv(texte) {
  const cv = { nom: "", titre: "", contact: "", profil: "", experiences: [], formation: [], certifications: [], competences: [], qualites: [], langues: [], divers: [] };
  const lignes = String(texte || "").split(/\r?\n/).map((l) => l.replace(/^[•·*\-–]\s*/, "").trim()).filter(Boolean);
  let rub = null;
  for (const l of lignes) {
    const tete = l.replace(/\s*:$/, "");
    const r = RUBRIQUES.find(([re]) => re.test(tete));
    if (r) { rub = r[1]; continue; }
    if (!rub) {                                   // avant la première rubrique : nom, puis contact ou titre
      if (!cv.nom) cv.nom = l;
      else if (/@|\d{2}[ .]?\d{2}[ .]?\d{2}/.test(l)) cv.contact = cv.contact ? cv.contact + " · " + l : l;
      else if (!cv.titre) cv.titre = l;
      else cv.profil = cv.profil ? cv.profil + " " + l : l;
      continue;
    }
    if (rub === "experiences") {
      const m = l.match(DATES);
      if (m || !cv.experiences.length) {
        const reste = m ? m[3] : l, [tete2, ...det] = reste.split(/\s:\s/);
        const i = tete2.indexOf(", ");
        cv.experiences.push({
          dates: m ? `${m[1]} – ${maj(m[2].replace(/^auj\.?$/i, "aujourd'hui"))}` : "",
          poste: maj(i > 0 ? tete2.slice(0, i) : tete2), lieu: i > 0 ? tete2.slice(i + 2) : "",
          details: det.join(" : ").split(/\s*[;,]\s+(?=[a-zàâéèêîôûç])/i).map((d) => maj(d.trim())).filter(Boolean),
        });
      } else cv.experiences[cv.experiences.length - 1].details.push(maj(l));
      continue;
    }
    if (rub === "profil") { cv.profil = cv.profil ? cv.profil + " " + l : l; continue; }
    if (rub === "qualites" || rub === "competences" || rub === "langues") {
      cv[rub].push(...l.split(/\s*[,;·]\s*/).map(maj).filter(Boolean)); continue;
    }
    cv[rub].push(l);
  }
  // Le titre vient du CV lui-même : le poste le plus récent, s'il n'est pas écrit sous le nom.
  if (!cv.titre && cv.experiences[0]) cv.titre = cv.experiences[0].poste;
  return cv;
}

/* ---------- mise en page ---------- */
const AFAIRE = (texte, aide) => `<span class="a-completer" contenteditable="true" data-aide="${esc(aide)}">${esc(texte)}</span>`;
const rubrique = (n, titre, corps, vide = false) =>
  `<section class="cv-rub${vide ? " cv-vide" : ""}" data-n="${n}"><h2><span class="cv-num" aria-hidden="true">${n}</span>${titre}</h2>${corps}</section>`;

function rendre(cv) {
  const exp = cv.experiences.map((e) => `<article class="cv-exp">
      <p class="cv-exp-tete"><strong contenteditable="true">${esc(e.poste)}</strong>${e.lieu ? `<span contenteditable="true">${esc(e.lieu)}</span>` : ""}<time contenteditable="true">${esc(e.dates)}</time></p>
      ${e.details.length ? `<ul>${e.details.map((d) => `<li contenteditable="true">${esc(d)}</li>`).join("")}</ul>` : ""}
    </article>`).join("");
  const liste = (xs) => `<ul>${xs.map((x) => `<li contenteditable="true">${esc(x)}</li>`).join("")}</ul>`;
  const puces = (xs) => `<p class="cv-puces" contenteditable="true">${xs.map(esc).join(" · ")}</p>`;
  const blocs = [];
  blocs.push(cv.profil
    ? rubrique(3, "Profil", `<p contenteditable="true">${esc(cv.profil)}</p>`)
    : rubrique(3, "Profil", `<p>${AFAIRE("Votre métier, vos années d'expérience, ce que vous savez faire. Deux lignes, pas plus.", "Profil")}</p>`, true));
  blocs.push(exp ? rubrique(4, "Expérience professionnelle", exp)
    : rubrique(4, "Expérience professionnelle", `<p>${AFAIRE("Dates · poste · employeur, ville, puis ce que vous y faisiez.", "Expérience")}</p>`, true));
  blocs.push(cv.formation.length || cv.certifications.length
    ? rubrique(5, "Formation", liste([...cv.formation, ...cv.certifications]))
    : rubrique(5, "Formation", `<p>${AFAIRE("Diplôme, établissement, année.", "Formation")}</p>`, true));
  const savoir = [...cv.competences];
  blocs.push(savoir.length ? rubrique(6, "Compétences", puces(savoir))
    : rubrique(6, "Compétences", `<p>${AFAIRE("Les savoir-faire de votre métier, avec les mots de l'offre quand ils sont vrais.", "Compétences")}</p>`, true));
  if (cv.qualites.length) blocs.push(rubrique(6, "Qualités", puces(cv.qualites)));
  if (cv.langues.length) blocs.push(rubrique(7, "Langues", puces(cv.langues)));
  if (cv.divers.length) blocs.push(rubrique(7, "Informations utiles", liste(cv.divers)));
  return `<header class="cv-tete" data-n="1">
      <span class="cv-num" aria-hidden="true">1</span>
      <h1 contenteditable="true">${esc(cv.nom) || AFAIRE("Prénom Nom", "Nom")}</h1>
      <p class="cv-titre" data-n="2"><span class="cv-num" aria-hidden="true">2</span>${cv.titre ? `<span contenteditable="true">${esc(cv.titre)}</span>` : AFAIRE("Le métier visé, tel qu'il est écrit dans l'offre", "Titre")}</p>
      <p class="cv-contact">${cv.contact ? `<span contenteditable="true">${esc(cv.contact)}</span>` : AFAIRE("Ville · téléphone · e-mail", "Contact")}</p>
    </header>${blocs.join("")}`;
}

/* ---------- page ---------- */
const feuille = $("feuille"), champ = $("modele-cv"), etat = $("modele-etat");
let source = "exemple";

function remplir(texte, origine) {
  source = origine;
  const cv = lireCv(texte);
  feuille.innerHTML = rendre(cv);
  const vides = feuille.querySelectorAll(".a-completer").length;
  etat.textContent = (origine === "exemple"
    ? `Exemple fictif : ${cv.nom}, ${cv.titre.toLowerCase()}. `
    : "Votre CV est rangé dans le modèle. ")
    + (vides ? `${vides} ${vides > 1 ? "parties sont" : "partie est"} à compléter : cliquez dessus pour écrire. Elles ne s'impriment pas tant qu'elles sont vides.` : "Cliquez sur un texte pour le corriger.");
}

// Les personnages d'exemple (fictifs), un bouton par métier.
const choix = $("modele-exemples");
choix.innerHTML = DOMAINES.map((d, i) => `<button type="button" data-i="${i}" aria-pressed="${i === 0}">${esc(d.intitule)}</button>`).join("");
choix.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-i]"); if (!b) return;
  choix.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b));
  champ.value = ""; remplir(DOMAINES[b.dataset.i].cv, "exemple");
});

// Le style : trois mises en page, toutes sur une colonne.
$("modele-styles").addEventListener("change", (e) => { if (e.target.name === "style") feuille.dataset.style = e.target.value; });

// Votre CV : collé ici, ou repris de l'atelier ou de l'accueil (sessionStorage seulement).
$("modele-remplir").addEventListener("click", () => {
  const t = champ.value.trim();
  if (t.split(/\s+/).length < 15) { $("modele-aide").textContent = "Collez au moins quelques lignes de votre CV : nom, expériences, formation."; $("modele-aide").classList.add("erreur"); champ.focus(); return; }
  $("modele-aide").textContent = "Une rubrique par titre (Expériences, Formation, Compétences…), une expérience par ligne qui commence par ses dates.";
  $("modele-aide").classList.remove("erreur");
  choix.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", "false"));
  remplir(t, "vous");
  feuille.closest(".modele-apercu").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
});

// Imprimer : les parties « à compléter » encore vides ne sortent pas sur le papier.
$("modele-pdf").addEventListener("click", () => window.print());

let repris = null;
try { repris = JSON.parse(sessionStorage.getItem(CLE) || sessionStorage.getItem("juste.atelier") || "null"); } catch { /* stockage indisponible */ }
if (repris?.cv && repris.cv.trim().split(/\s+/).length >= 15) {
  const ex = DOMAINES.findIndex((d) => d.cv.trim() === repris.cv.trim());
  if (ex >= 0) { choix.querySelectorAll("button").forEach((x, i) => x.setAttribute("aria-pressed", i === ex)); remplir(repris.cv, "exemple"); }
  else { champ.value = repris.cv; choix.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", "false")); remplir(repris.cv, "vous"); }
} else remplir(DOMAINES[0].cv, "exemple");
