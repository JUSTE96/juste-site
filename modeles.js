// JusteCV — Modèles de CV : un éditeur de CV sur une vraie feuille A4.
// Le texte d'un CV est rangé par rubrique ; on le corrige sur la feuille, on règle la mise en page et l'espace, on imprime en PDF.
// Tout se passe dans le navigateur. Rien n'est inventé : ce qui manque reste vide, s'affiche « à compléter » et ne s'imprime pas.
import { DOMAINES } from "./moteur/exemples.mjs";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const maj = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const calme = matchMedia("(prefers-reduced-motion: reduce)").matches;
const SAUVE = "juste.modele.v2", PASSE = "juste.atelier";
const A4 = 297 * 96 / 25.4;   // hauteur d'une page A4 en pixels CSS

/* ---------- lecture du texte d'un CV ---------- */
const RUBRIQUES = [
  [/^exp[ée]riences?( professionnelles?)?$|^parcours( professionnel)?$/i, "experiences"],
  [/^formations?$|^dipl[ôo]mes?$|^formations? et dipl[ôo]mes$|^certifications?$|^habilitations?$/i, "formation"],
  [/^comp[ée]tences?( techniques)?$|^savoir-faire$/i, "competences"],
  [/^qualit[ée]s$|^savoir-[êe]tre$|^atouts$/i, "qualites"],
  [/^langues?$/i, "langues"],
  [/^profil$|^[àa] propos$|^r[ée]sum[ée]$/i, "profil"],
  [/^divers$|^informations?( compl[ée]mentaires| utiles)?$|^centres? d'int[ée]r[êe]ts?$|^loisirs$|^permis$/i, "divers"],
];
const DATES = /^((?:\d{1,2}\/)?\d{4})\s*(?:[-–—]|à)\s*((?:\d{1,2}\/)?\d{4}|aujourd['’]hui|auj\.?|pr[ée]sent|en cours)\s*[:,–-]?\s*(.*)$/i;
const vide = () => ({ nom: "", titre: "", contact: "", profil: "", experiences: [], formation: [], competences: [], qualites: [], langues: [], divers: [] });

export function lireCv(texte) {
  const cv = vide();
  const lignes = String(texte || "").split(/\r?\n/).map((l) => l.replace(/^[•·*\-–]\s*/, "").trim()).filter(Boolean);
  let rub = null;
  for (const l of lignes) {
    const r = RUBRIQUES.find(([re]) => re.test(l.replace(/\s*:$/, "")));
    if (r) { rub = r[1]; continue; }
    if (!rub) {
      if (!cv.nom) cv.nom = l;
      else if (/@|\d{2}[ .]?\d{2}[ .]?\d{2}/.test(l)) cv.contact = cv.contact ? cv.contact + " · " + l : l;
      else if (!cv.titre) cv.titre = l;
      else cv.profil = cv.profil ? cv.profil + " " + l : l;
      continue;
    }
    if (rub === "experiences") {
      const m = l.match(DATES);
      if (m || !cv.experiences.length) {
        const reste = m ? m[3] : l, [tete, ...det] = reste.split(/\s:\s/), i = tete.indexOf(", ");
        cv.experiences.push({
          dates: m ? `${m[1]} – ${maj(m[2].replace(/^auj\.?$/i, "aujourd'hui"))}` : "",
          poste: maj(i > 0 ? tete.slice(0, i) : tete), lieu: i > 0 ? tete.slice(i + 2) : "",
          details: det.join(" : ").split(/\s*[;,]\s+(?=[a-zàâéèêîôûç])/i).map((d) => maj(d.trim())).filter(Boolean),
        });
      } else cv.experiences[cv.experiences.length - 1].details.push(maj(l));
      continue;
    }
    if (rub === "profil") { cv.profil = cv.profil ? cv.profil + " " + l : l; continue; }
    if (rub === "qualites" || rub === "competences" || rub === "langues") { cv[rub].push(...l.split(/\s*[,;·]\s*/).map(maj).filter(Boolean)); continue; }
    cv[rub].push(l);
  }
  if (!cv.titre && cv.experiences[0]) cv.titre = cv.experiences[0].poste;   // le titre vient du CV : le poste le plus récent
  return cv;
}

/* ---------- état ---------- */
const SECTIONS = { profil: "Profil", experiences: "Expérience professionnelle", formation: "Formation", competences: "Compétences", qualites: "Qualités", langues: "Langues", divers: "Informations utiles" };
const PUCES = new Set(["competences", "qualites", "langues"]);
const MODELES = {
  classique: { nom: "Classique", police: "lora" }, moderne: { nom: "Moderne", police: "schibsted" }, elegant: { nom: "Élégant", police: "lora" },
  marge: { nom: "Titres en marge", police: "schibsted" }, compact: { nom: "Compact", police: "arial" },
};
const PRESETS = {
  aere: { marge: 20, lh: 1.55, gap: 1.6, gapExp: 1.0, taille: 10.5 },
  equilibre: { marge: 17, lh: 1.45, gap: 1.25, gapExp: .8, taille: 10 },
  serre: { marge: 12, lh: 1.3, gap: .85, gapExp: .5, taille: 9.5 },
};
const REGLAGES = () => ({ modele: "classique", accent: "#1c2040", police: "lora", ...PRESETS.equilibre });
let etat = { cv: vide(), ordre: Object.keys(SECTIONS), caches: [], titres: {}, reglages: REGLAGES(), source: "exemple", exemple: 0 };

const feuille = $("feuille"), cadre = $("feuille-cadre");
let minuteur = 0;
const ecrire = () => { clearTimeout(minuteur); minuteur = 0; try { localStorage.setItem(SAUVE, JSON.stringify(etat)); } catch { /* stockage indisponible */ } };
const garder = () => { clearTimeout(minuteur); minuteur = setTimeout(ecrire, 400); };
addEventListener("pagehide", () => { if (minuteur) ecrire(); });
document.addEventListener("visibilitychange", () => { if (document.hidden && minuteur) ecrire(); });

/* ---------- rendu de la feuille ---------- */
const champ = (k, valeur, ph, balise = "span", cls = "") =>
  `<${balise} class="${cls}" data-k="${k}" data-ph="${esc(ph)}" contenteditable="true" spellcheck="true">${esc(valeur)}</${balise}>`;
const bouton = (act, libelle, texte, extra = "") => `<button type="button" class="ecran outil" data-act="${act}" ${extra} aria-label="${esc(libelle)}" title="${esc(libelle)}">${texte}</button>`;

function liste(cle, items, ph) {
  const lis = (items.length ? items : [""]).map((x, j) => champ(`${cle}.${j}`, x, ph, "li")).join("");
  return `<ul>${lis}</ul>${bouton("ligne", "Ajouter une ligne", "+ ligne", `data-cle="${cle}"`)}`;
}
function rubrique(id) {
  const cv = etat.cv, titre = etat.titres[id] ?? SECTIONS[id];
  let corps = "", rempli = true;
  if (id === "profil") { corps = champ("profil", cv.profil, "Deux lignes : votre métier, vos années d'expérience, ce que vous savez faire.", "p"); rempli = !!cv.profil; }
  else if (id === "experiences") {
    rempli = cv.experiences.length > 0;
    corps = cv.experiences.map((e, i) => `<article class="cv-exp" data-i="${i}">
      <div class="cv-exp-outils ecran">${bouton("monter", "Monter cette expérience", "↑", `data-i="${i}"`)}${bouton("descendre", "Descendre cette expérience", "↓", `data-i="${i}"`)}${bouton("retirer", "Supprimer cette expérience", "×", `data-i="${i}"`)}</div>
      <p class="cv-exp-tete">${champ(`experiences.${i}.poste`, e.poste, "Poste", "strong")}${champ(`experiences.${i}.lieu`, e.lieu, "Employeur, ville", "span", "cv-lieu")}${champ(`experiences.${i}.dates`, e.dates, "Dates", "time")}</p>
      ${liste(`experiences.${i}.details`, e.details, "Ce que vous y faisiez, avec les mots de l'offre quand ils sont vrais.")}
    </article>`).join("") + bouton("experience", "Ajouter une expérience", "+ Ajouter une expérience", "");
  }
  else if (PUCES.has(id)) { corps = champ(id, cv[id].join(" · "), id === "langues" ? "Anglais (B1) · Espagnol (A2)" : "Séparez par des points ou des virgules", "p", "cv-puces"); rempli = cv[id].length > 0; }
  else { corps = liste(id, cv[id], id === "formation" ? "Diplôme, établissement, année" : "Permis B, disponibilité…"); rempli = cv[id].some(Boolean); }
  return `<section class="cv-rub${rempli ? "" : " cv-vide"}" data-rub="${id}"><h2>${champ(`titres.${id}`, titre, SECTIONS[id], "span")}</h2>${corps}</section>`;
}
function rendre(focus) {
  const cv = etat.cv;
  feuille.innerHTML = `<header class="cv-tete">
      ${champ("nom", cv.nom, "Prénom Nom", "h1")}
      ${champ("titre", cv.titre, "Le métier visé, écrit comme dans l'offre", "p", "cv-titre")}
      ${champ("contact", cv.contact, "Ville · téléphone · e-mail", "p", "cv-contact")}
    </header>${etat.ordre.filter((id) => !etat.caches.includes(id)).map(rubrique).join("")}<div class="sauts ecran" aria-hidden="true"></div>`;
  appliquer(); rendreRubriques();
  if (focus) { const el = feuille.querySelector(`[data-k="${focus}"]`); if (el) { el.focus(); placerFin(el); } }
}
function placerFin(el) { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }

/* ---------- réglages : variables CSS de la feuille, mesure et échelle ---------- */
const POLICES = { lora: '"Lora", Georgia, serif', schibsted: '"Schibsted Grotesk", Arial, sans-serif', arial: "Arial, Helvetica, sans-serif", georgia: "Georgia, 'Times New Roman', serif" };
function appliquer() {
  const r = etat.reglages, st = feuille.style;
  feuille.dataset.modele = r.modele;
  st.setProperty("--accent", r.accent); st.setProperty("--fonte", POLICES[r.police] || POLICES.schibsted);
  st.setProperty("--taille", r.taille + "pt"); st.setProperty("--marge", r.marge + "mm");
  st.setProperty("--lh", r.lh); st.setProperty("--gap", r.gap + "em"); st.setProperty("--gap-exp", r.gapExp + "em");
  synchroniserControles(); mesurer();
}
let agrandi = false;
// La hauteur comptée est celle du papier : sans les champs vides ni les outils, qui ne s'impriment pas.
const hauteurPapier = () => { feuille.classList.add("mesure"); const h = feuille.offsetHeight; feuille.classList.remove("mesure"); return h; };
function mesurer() {
  const h = hauteurPapier(), pages = Math.max(1, Math.ceil((h - 2) / A4));
  feuille.querySelector(".sauts").innerHTML = Array.from({ length: pages - 1 }, (_, i) => `<span style="top:${(i + 1) * A4}px">Page ${i + 2}</span>`).join("");
  const p = $("modele-pages");
  p.textContent = pages === 1 ? "Tient sur 1 page" : `${pages} pages`;
  p.dataset.ok = pages === 1 ? "1" : "0";
  $("modele-ajuster").hidden = pages === 1;
  const w = cadre.clientWidth, k = agrandi ? 1 : Math.min(1, w / feuille.offsetWidth);
  feuille.style.transform = `scale(${k})`;
  cadre.style.height = `${Math.ceil(Math.max(feuille.offsetHeight, A4) * k)}px`;
}
new ResizeObserver(() => mesurer()).observe(cadre);
document.fonts?.ready.then(mesurer);

// Ajuster sur une page : on resserre l'espace avant de toucher au texte, par petits pas, sans descendre sous des minimums lisibles.
const PAS = [["gap", .1, .6], ["gapExp", .1, .35], ["lh", .05, 1.2], ["marge", 1, 10], ["taille", .25, 8.5]];
function ajuster() {
  const r = etat.reglages;
  for (let n = 0; n < 200 && hauteurPapier() > A4 + 1; n++) {
    const pas = PAS.find(([k, , min]) => r[k] - 1e-9 > min);
    if (!pas) break;
    r[pas[0]] = Math.round((r[pas[0]] - pas[1]) * 100) / 100; appliquer();
  }
  garder();
  annoncer(hauteurPapier() > A4 + 1 ? "Même resserré, le CV dépasse une page : retirez une ligne ou une rubrique." : "Le CV tient maintenant sur une page.");
}

/* ---------- édition sur la feuille ---------- */
function chemin(k) { const p = k.split("."); return { parent: p.slice(0, -1).reduce((o, c) => o[c], etat), cle: p[p.length - 1], p }; }
feuille.addEventListener("input", (e) => {
  const el = e.target.closest("[data-k]"); if (!el) return;
  const k = el.dataset.k, t = el.textContent.replace(/\u00a0/g, " ");
  if (k.startsWith("titres.")) etat.titres[k.slice(7)] = t.trim();
  else if (PUCES.has(k)) etat.cv[k] = t.split(/\s*[·,;]\s*/).map((x) => x.trim()).filter(Boolean);
  else { const { parent, cle } = chemin(k.startsWith("titres") ? k : "cv." + k); parent[cle] = t; }
  const rub = el.closest(".cv-rub");   // une rubrique sans texte ne s'imprime pas
  if (rub) rub.classList.toggle("cv-vide", ![...rub.querySelectorAll("[data-k]:not([data-k^='titres'])")].some((x) => x.textContent.trim()));
  garder(); mesurer();
});
feuille.addEventListener("keydown", (e) => {
  const el = e.target.closest?.("[data-k]"); if (!el) return;
  const k = el.dataset.k, p = k.split("."), estLigne = el.tagName === "LI";
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (!estLigne) return;                                   // un nom, un titre, une date : une seule ligne
    const j = Number(p.pop()), tab = chemin("cv." + p.join(".") + ".x").parent;
    tab.splice(j + 1, 0, ""); garder(); rendre(`${p.join(".")}.${j + 1}`);
  } else if (e.key === "Backspace" && estLigne && !el.textContent) {
    const j = Number(p.pop()), tab = chemin("cv." + p.join(".") + ".x").parent;
    if (tab.length <= 1) return;
    e.preventDefault(); tab.splice(j, 1); garder(); rendre(`${p.join(".")}.${Math.max(0, j - 1)}`);
  }
});
feuille.addEventListener("paste", (e) => {   // on colle du texte, jamais de mise en forme
  if (!e.target.closest?.("[data-k]")) return;
  e.preventDefault(); document.execCommand("insertText", false, (e.clipboardData?.getData("text/plain") || "").replace(/\s*\n\s*/g, " "));
});
feuille.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-act]"); if (!b) return;
  const xs = etat.cv.experiences, i = Number(b.dataset.i);
  switch (b.dataset.act) {
    case "experience": xs.push({ poste: "", lieu: "", dates: "", details: [""] }); garder(); rendre(`experiences.${xs.length - 1}.poste`); break;
    case "retirer": if (confirm("Supprimer cette expérience ?")) { xs.splice(i, 1); garder(); rendre(); annoncer("Expérience supprimée."); } break;
    case "monter": if (i > 0) { [xs[i - 1], xs[i]] = [xs[i], xs[i - 1]]; garder(); rendre(); feuille.querySelector(`[data-act="monter"][data-i="${i - 1}"]`)?.focus(); } break;
    case "descendre": if (i < xs.length - 1) { [xs[i + 1], xs[i]] = [xs[i], xs[i + 1]]; garder(); rendre(); feuille.querySelector(`[data-act="descendre"][data-i="${i + 1}"]`)?.focus(); } break;
    case "ligne": { const tab = chemin("cv." + b.dataset.cle + ".x").parent; tab.push(""); garder(); rendre(`${b.dataset.cle}.${tab.length - 1}`); break; }
  }
});

/* ---------- panneau de réglages ---------- */
const annonce = $("modele-annonce");
const annoncer = (t) => { annonce.textContent = ""; requestAnimationFrame(() => { annonce.textContent = t; }); };

// Onglets
const onglets = [...document.querySelectorAll('[role="tab"]')];
function ouvrir(o, focus = false) {
  onglets.forEach((x) => { const oui = x === o; x.setAttribute("aria-selected", oui); x.tabIndex = oui ? 0 : -1; $(x.getAttribute("aria-controls")).hidden = !oui; });
  if (focus) o.focus();
}
onglets.forEach((o, i) => {
  o.addEventListener("click", () => ouvrir(o));
  o.addEventListener("keydown", (e) => {
    const d = { ArrowRight: 1, ArrowLeft: -1, Home: -i, End: onglets.length - 1 - i }[e.key];
    if (d !== undefined) { e.preventDefault(); ouvrir(onglets[(i + d + onglets.length) % onglets.length], true); }
  });
});

// Exemples (personnages fictifs)
const choixEx = $("modele-exemples");
choixEx.innerHTML = DOMAINES.map((d, i) => `<button type="button" data-i="${i}" aria-pressed="false">${esc(d.intitule)}</button>`).join("");
function marquerExemple() { choixEx.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", etat.source === "exemple" && Number(x.dataset.i) === etat.exemple)); }
choixEx.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-i]"); if (!b) return;
  if (etat.source === "vous" && !confirm("Remplacer votre CV par cet exemple ? Vos modifications seront perdues.")) return;
  etat.cv = lireCv(DOMAINES[b.dataset.i].cv); etat.source = "exemple"; etat.exemple = Number(b.dataset.i); etat.titres = {};
  marquerExemple(); rendre(); garder(); direEtat();
});

// Votre CV
$("modele-remplir").addEventListener("click", () => {
  const t = $("modele-cv").value.trim(), aide = $("modele-aide");
  if (t.split(/\s+/).length < 15) { aide.textContent = "Collez au moins quelques lignes de votre CV : nom, expériences, formation."; aide.classList.add("erreur"); $("modele-cv").focus(); return; }
  aide.classList.remove("erreur"); aide.textContent = "Une rubrique par titre (Expériences, Formation, Compétences…), une expérience par ligne qui commence par ses dates.";
  if (etat.source === "vous" && !confirm("Remplacer le CV de la feuille par ce texte ? Vos corrections sur la feuille seront perdues.")) return;
  etat.cv = lireCv(t); etat.source = "vous"; etat.titres = {}; marquerExemple(); rendre(); garder(); direEtat();
  $("t-apercu").scrollIntoView({ behavior: calme ? "auto" : "smooth", block: "start" });
});
$("modele-vider").addEventListener("click", () => {
  if (!confirm("Repartir d'une feuille vide ?")) return;
  etat.cv = vide(); etat.cv.experiences.push({ poste: "", lieu: "", dates: "", details: [""] }); etat.source = "vous"; etat.titres = {};
  marquerExemple(); rendre("nom"); garder(); direEtat();
});

// Modèle, couleur, police, taille
const radios = (nom, cle, apres) => document.querySelectorAll(`input[name="${nom}"]`).forEach((r) => r.addEventListener("change", () => { etat.reglages[cle] = r.value; apres?.(r.value); appliquer(); garder(); }));
radios("modele", "modele", (v) => { etat.reglages.police = MODELES[v].police; });
radios("accent", "accent"); radios("police", "police");
const curseurs = { taille: ["modele-taille", (v) => `${String(v).replace(".", ",")} pt`], marge: ["modele-marge", (v) => `${v} mm`], lh: ["modele-lh", (v) => String(v).replace(".", ",")], gap: ["modele-gap", (v) => String(v).replace(".", ",")], gapExp: ["modele-gapexp", (v) => String(v).replace(".", ",")] };
for (const [cle, [id]] of Object.entries(curseurs)) $(id).addEventListener("input", (e) => { etat.reglages[cle] = Number(e.target.value); appliquer(); garder(); });
document.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => { Object.assign(etat.reglages, PRESETS[b.dataset.preset]); appliquer(); garder(); annoncer(`Espacement « ${b.textContent.trim()} » appliqué.`); }));
$("modele-ajuster").addEventListener("click", ajuster);
$("modele-ajuster-2").addEventListener("click", ajuster);
function synchroniserControles() {
  const r = etat.reglages;
  for (const nom of ["modele", "accent", "police"]) { const x = document.querySelector(`input[name="${nom}"][value="${r[nom]}"]`); if (x) x.checked = true; }
  for (const [cle, [id, fmt]] of Object.entries(curseurs)) { $(id).value = r[cle]; $(id + "-v").textContent = fmt(r[cle]); }
}

// Rubriques : afficher, masquer, ordonner
function rendreRubriques() {
  $("modele-rubriques").innerHTML = etat.ordre.map((id, i) => `<li>
    <label><input type="checkbox" data-voir="${id}" ${etat.caches.includes(id) ? "" : "checked"}> ${esc(etat.titres[id] || SECTIONS[id])}</label>
    <span>${bouton("r-monter", `Monter ${etat.titres[id] || SECTIONS[id]}`, "↑", `data-r="${i}" ${i === 0 ? "disabled" : ""}`).replace("ecran ", "")}${bouton("r-descendre", `Descendre ${etat.titres[id] || SECTIONS[id]}`, "↓", `data-r="${i}" ${i === etat.ordre.length - 1 ? "disabled" : ""}`).replace("ecran ", "")}</span>
  </li>`).join("");
}
$("modele-rubriques").addEventListener("change", (e) => {
  const id = e.target.dataset.voir; if (!id) return;
  etat.caches = e.target.checked ? etat.caches.filter((x) => x !== id) : [...etat.caches, id];
  rendre(); garder(); $("modele-rubriques").querySelector(`[data-voir="${id}"]`)?.focus();
});
$("modele-rubriques").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-r]"); if (!b) return;
  const i = Number(b.dataset.r), j = b.dataset.act === "r-monter" ? i - 1 : i + 1, o = etat.ordre;
  if (j < 0 || j >= o.length) return;
  [o[i], o[j]] = [o[j], o[i]]; rendre(); garder();
  $("modele-rubriques").querySelector(`button[data-act="${b.dataset.act}"][data-r="${j}"]`)?.focus();
  annoncer(`${etat.titres[o[j]] || SECTIONS[o[j]]} : position ${j + 1} sur ${o.length}.`);
});

// Barre de l'aperçu
$("modele-pdf").addEventListener("click", () => { document.activeElement?.blur(); window.print(); });
$("modele-zoom").addEventListener("click", (e) => { agrandi = !agrandi; e.currentTarget.setAttribute("aria-pressed", agrandi); cadre.classList.toggle("agrandi", agrandi); mesurer(); });
$("modele-reglages-zero").addEventListener("click", () => { etat.reglages = REGLAGES(); etat.ordre = Object.keys(SECTIONS); etat.caches = []; appliquer(); rendre(); garder(); annoncer("Mise en page d'origine rétablie."); });

function direEtat() {
  const n = feuille.querySelectorAll(".cv-vide").length;
  $("modele-etat").textContent = (etat.source === "exemple" ? `Exemple fictif : ${etat.cv.nom}. ` : "Votre CV, gardé dans ce navigateur seulement. ")
    + "Cliquez sur un texte pour l'écrire ; Entrée ajoute une ligne. " + (n ? `${n} rubrique${n > 1 ? "s" : ""} vide${n > 1 ? "s" : ""} : elle${n > 1 ? "s" : ""} ne s'imprime${n > 1 ? "nt" : ""} pas.` : "");
}

/* ---------- départ : CV venu de l'atelier, sinon brouillon gardé, sinon premier exemple ---------- */
let passe = null, garde = null;
try { passe = JSON.parse(sessionStorage.getItem(PASSE) || "null"); } catch { /* */ }
try { garde = JSON.parse(localStorage.getItem(SAUVE) || "null"); } catch { /* */ }
if (garde?.cv && garde.reglages) etat = { ...etat, ...garde, reglages: { ...REGLAGES(), ...garde.reglages } };
const venu = passe?.cv?.trim();
if (venu && venu.split(/\s+/).length >= 15 && venu !== garde?.texteVenu) {
  const ex = DOMAINES.findIndex((d) => d.cv.trim() === venu);
  etat.cv = lireCv(venu); etat.titres = {}; etat.texteVenu = venu;
  if (ex >= 0) { etat.source = "exemple"; etat.exemple = ex; } else { etat.source = "vous"; $("modele-cv").value = venu; }
} else if (!garde?.cv) { etat.cv = lireCv(DOMAINES[0].cv); }
marquerExemple(); rendre(); direEtat(); garder();
