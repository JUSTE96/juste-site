// Juste — atelier : offre → profil cible → écart → plan. Tout est calculé sur l'appareil.
import { profilCible, ecart } from "./moteur/profil-cible.mjs";
import { offerSignals } from "./moteur/offer-signals.mjs";
import { joinPdfItems } from "./moteur/pdf-text.mjs";
import { repereMetier, reperesDansCv, ficheMetier } from "./moteur/reperes.mjs";
import { DOMAINES, domaine } from "./moteur/exemples.mjs";
import { compter } from "./moteur/compte.mjs";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const NIVEAU = { obligatoire: "Obligatoire", souhaitee: "Souhaitée", atout: "Atout" };
const STATUT = { presente: "Présent", partielle: "En partie", absente: "Absent" };
const calme = matchMedia("(prefers-reduced-motion: reduce)").matches;
const aller = (el) => { el.hidden = false; el.focus({ preventScroll: true }); el.scrollIntoView({ behavior: calme ? "auto" : "smooth", block: "start" }); };

let profil = null, metier = null, dernier = null;

$("exemple").insertAdjacentHTML("beforeend", DOMAINES.map((d) => `<option value="${d.id}">${d.nom} : ${d.intitule}</option>`).join(""));
$("exemple").addEventListener("change", (e) => { if (e.target.value) { $("offre").value = domaine(e.target.value).offre; effacerErreur($("offre")); garder(); majPerime(); $("aide-offre").textContent = "Offre d'exemple chargée. Vous pouvez la modifier."; } });

// Un court temps de lecture avant le résultat : la bande parcourt le texte collé et surligne, mot pour mot,
// les phrases que l'outil retient (exigences de l'offre, lignes du CV qui les prouvent). Le calcul est déjà fait ;
// ce temps (1,2 s au plus) montre d'où vient le résultat, puis la suite arrive.
// Pendant la séquence, le textarea est masqué et un calque de lecture opaque, aria-hidden, reprend sa boîte,
// sa police et son défilement : une seule couche visible, donc aucun décalage possible entre texte et surlignage.
const BALAYAGE = 760, MAINTIEN = 440;
let calque = null;
function retirerCalque() {
  if (!calque) return;
  calque.el.remove(); calque.champ.style.visibility = ""; calque.champ.scrollTop = calque.el.scrollTop; calque = null;
}
// Sur téléphone, la barre d'adresse qui apparaît au défilement déclenche « resize » sans changer la largeur :
// le calque ne part que si la largeur change (les retours à la ligne ne seraient plus les mêmes).
addEventListener("resize", () => { if (calque && innerWidth !== calque.largeur) retirerCalque(); });
["offre", "cv"].forEach((id) => $(id).addEventListener("input", retirerCalque));

function poserCalque(zone, champ, marques, teinte) {
  const v = champ.value, plages = [];
  // Marques posées par indexOf strict : une phrase introuvable telle quelle n'est jamais approchée.
  for (const m of new Set(marques)) { const i = m ? v.indexOf(m) : -1; if (i >= 0) plages.push([i, i + m.length]); }
  plages.sort((a, b) => a[0] - b[0]);
  let html = "", k = 0, n = 0;
  for (const [a, b] of plages) { if (a < k) continue; html += esc(v.slice(k, a)) + `<mark>${esc(v.slice(a, b))}</mark>`; k = b; n++; }
  if (!n) return 0;
  html += esc(v.slice(k)) + "\n";
  const cs = getComputedStyle(champ), el = document.createElement("div");
  el.className = "lecteur-lecture"; el.dataset.teinte = teinte; el.setAttribute("aria-hidden", "true");
  for (const p of ["fontFamily", "fontSize", "fontWeight", "fontStyle", "fontStretch", "lineHeight", "letterSpacing", "wordSpacing", "textIndent", "tabSize",
    "paddingTop", "paddingBottom", "paddingLeft", "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth", "borderStyle", "borderColor",
    "borderTopLeftRadius", "borderTopRightRadius", "borderBottomLeftRadius", "borderBottomRightRadius", "backgroundColor", "color"]) el.style[p] = cs[p];
  // La barre de défilement du textarea mange de la largeur : on la rend en marge pour garder les mêmes retours à la ligne.
  const barre = champ.offsetWidth - champ.clientWidth - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
  el.style.paddingRight = `${parseFloat(cs.paddingRight) + Math.max(0, barre)}px`;
  Object.assign(el.style, { left: `${champ.offsetLeft}px`, top: `${champ.offsetTop}px`, width: `${champ.offsetWidth}px`, height: `${champ.offsetHeight}px` });
  el.innerHTML = html;
  zone.appendChild(el);
  el.scrollTop = champ.scrollTop;
  // Si la première marque est hors de vue, on l'amène au tiers haut de la zone ; si les suivantes débordent
  // en bas, on remonte le texte autant que possible sans faire sortir la première.
  const ms = el.querySelectorAll("mark"), m0 = ms[0], mn = ms[ms.length - 1], lh = parseFloat(cs.lineHeight) || 24;
  if (m0.offsetTop < el.scrollTop || m0.offsetTop + lh > el.scrollTop + el.clientHeight) el.scrollTop = Math.max(0, m0.offsetTop - el.clientHeight / 3);
  const basN = mn.offsetTop + mn.offsetHeight + lh / 2 - el.clientHeight;
  if (basN > el.scrollTop) el.scrollTop = Math.min(basN, Math.max(el.scrollTop, m0.offsetTop - lh));
  champ.style.visibility = "hidden";
  calque = { el, champ, largeur: innerWidth };
  return n;
}

// Chaque marque se surligne quand le bord corail de la bande passe sur elle : on lit la position réelle de la bande.
function suivreBande(zone, el) {
  const marques = [...el.querySelectorAll("mark")], t0 = performance.now();
  const pas = () => {
    if (!el.isConnected) return;
    const ap = getComputedStyle(zone, "::after"), ty = new DOMMatrixReadOnly(ap.transform === "none" ? undefined : ap.transform).m42;
    const bord = zone.getBoundingClientRect().top + ty + parseFloat(ap.height) * .95;
    marques.forEach((m) => { if (!m.classList.contains("vu") && m.getBoundingClientRect().top + 4 <= bord) m.classList.add("vu"); });
    if (performance.now() - t0 < BALAYAGE) requestAnimationFrame(pas); else marques.forEach((m) => m.classList.add("vu"));
  };
  requestAnimationFrame(pas);
}

function lire({ zone, champ, bouton, direct, libelle, marques, fin, teinte }, suite) {
  if (bouton.getAttribute("aria-busy") === "true") return;
  if (calme || direct) { retirerCalque(); suite(); return; }
  const texte = bouton.textContent;
  bouton.setAttribute("aria-busy", "true"); bouton.textContent = libelle; zone.classList.add("lit");
  retirerCalque();
  const n = poserCalque(zone, champ, marques, teinte);
  if (n) suivreBande(zone, calque.el);
  setTimeout(() => {
    zone.classList.remove("lit");
    if (n) bouton.textContent = fin(n);
    setTimeout(() => { retirerCalque(); bouton.removeAttribute("aria-busy"); bouton.textContent = texte; suite(); }, n ? MAINTIEN : 0);
  }, BALAYAGE);
}

/* ---------- erreurs : visibles, annoncées une fois, effacées dès qu'on corrige ---------- */
// Le message est posé avec role="alert" (une seule annonce) ; le curseur revient dans le champ à corriger,
// relié au message par aria-describedby.
function signaler(champ, message) {
  const aide = $(champ.getAttribute("aria-describedby")), cadre = champ.closest(".lecteur");
  aide.textContent = message; aide.classList.add("erreur"); aide.setAttribute("role", "alert");
  champ.setAttribute("aria-invalid", "true"); cadre?.classList.add("invalide");
  champ.focus({ preventScroll: true });
  aide.closest(".barre").scrollIntoView({ behavior: calme ? "auto" : "smooth", block: "center" });
}
function effacerErreur(champ) {
  if (champ.getAttribute("aria-invalid") !== "true") return;
  const aide = $(champ.getAttribute("aria-describedby"));
  aide.textContent = ""; aide.classList.remove("erreur"); aide.removeAttribute("role");
  champ.removeAttribute("aria-invalid"); champ.closest(".lecteur")?.classList.remove("invalide");
}
["offre", "cv"].forEach((id) => $(id).addEventListener("input", () => effacerErreur($(id))));
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? "s" : ""}`;
const nbMots = (t) => (t.trim() ? t.trim().split(/\s+/).length : 0);

// direct : relancé depuis un bandeau « a changé », loin du texte : pas de lecture animée hors de l'écran.
function assembler(bouton, direct = false) {
  const texte = $("offre").value.trim(), n = texte.replace(/\s/g, "").length;
  if (!n) { signaler($("offre"), "Rien à lire pour l'instant. Collez l'annonce, ou choisissez une offre d'exemple."); return; }
  if (n < 80) { signaler($("offre"), `Il manque du texte (${pluriel(n, "caractère")}, il en faut au moins 80). Collez l'annonce entière, rubrique «\u00a0Profil\u00a0» comprise.`); return; }
  effacerErreur($("offre")); $("aide-offre").textContent = "";
  const p = profilCible(texte);
  lire({ zone: $("lecteur-offre"), champ: $("offre"), bouton, direct, libelle: "Lecture de l'offre…", teinte: "offre",
    marques: p.exigences.map((e) => e.texte), fin: (n) => `${n} exigence${n > 1 ? "s" : ""} retenue${n > 1 ? "s" : ""}` }, () => {
    profil = p; offreAssemblee = texte;
    afficherProfil(profil, offerSignals(texte));
    metier = repereMetier(profil.intitule); afficherReperes("");
    // Repères ouverts d'emblée sur grand écran ; repliés au pouce, où ils repoussaient l'étape 3 de quatre écrans.
    $("p-reperes").open = matchMedia("(min-width: 861px)").matches;
    $("etape-cv").hidden = false; $("ecart").hidden = true; dernier = null; cvMesure = null;
    majPerime(); aller($("profil")); majFil();
  });
}
$("assembler").addEventListener("click", (ev) => assembler(ev.currentTarget));

function afficherProfil(p, signaux) {
  $("p-intitule").textContent = p.intitule;
  const specs = [
    ["Contrat", p.contrat || "Non précisé"],
    ["Expérience", p.experienceAns === null ? "Non précisée" : p.experienceAns === 0 ? "Première expérience ou débutant" : `${p.experienceAns} an${p.experienceAns > 1 ? "s" : ""}`],
    // Diplôme hors de la table (DEAS, DEAES…) : il est demandé, la liste dit lequel.
    ["Diplôme", p.diplome ? p.diplome.nom : p.exigences.some((e) => e.categorie === "diplome") ? "Demandé : voir la liste" : "Non précisé"],
    ["Exigences", String(p.exigences.length)],
  ];
  $("p-specs").innerHTML = specs.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("");
  $("p-exigences").innerHTML = p.exigences.length
    ? p.exigences.map((e, i) => `<li style="--i:${i}">${esc(e.texte)}<span class="poids" data-niveau="${e.niveau}">${NIVEAU[e.niveau]}${e.eliminatoire ? " · éliminatoire" : ""}</span>${e.deMission ? "<small>Déduit des missions : l'offre ne détaille presque pas le profil.</small>" : ""}</li>`).join("")
    : `<li>Aucune attente claire n'a été trouvée. Vérifiez que la rubrique « Profil » a bien été copiée.</li>`;
  const groupe = (titre, liste) => liste.length ? `<div><span class="ref">${titre}</span><p>${liste.map((x) => `<span class="pastille">${esc(x)}</span>`).join("")}</p></div>` : "";
  $("p-pastilles").innerHTML = groupe("Outils", p.outils) + groupe("Langues", p.langues) + groupe("Savoir-être", p.savoirEtre);
  const items = (signaux?.items || []).filter((i) => i.tone === "alerte" || i.tone === "attention");
  $("p-signaux").hidden = !items.length;
  $("p-signaux").innerHTML = items.length ? `<span class="ref">À vérifier dans cette offre</span>` + items.map((i) => `<p><b>${esc(i.titre)}.</b> ${esc(i.detail)}</p>`).join("") : "";
}

/* ---------- import du CV ---------- */
// #aide-fichier est une zone role="status" : chaque message y est annoncé, sans déplacer le curseur ;
// les échecs prennent en plus la couleur des erreurs.
function direFichier(m, erreur = false) { $("aide-fichier").textContent = m; $("aide-fichier").classList.toggle("erreur", erreur); }
async function lireFichier(f) {
  if (!f) return;
  if (f.size > 15 * 1024 * 1024) { direFichier("Ce fichier dépasse 15 Mo.", true); return; }
  direFichier("Lecture du fichier…");
  try {
    let texte = "";
    if (/\.pdf$/i.test(f.name) || f.type === "application/pdf") {
      const pdfjs = await import("./vendor/pdf.min.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdf.worker.min.mjs", import.meta.url).href;
      const doc = await pdfjs.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
      const pages = [];
      for (let i = 1; i <= doc.numPages; i++) pages.push(joinPdfItems((await (await doc.getPage(i)).getTextContent()).items));
      texte = pages.join("\n");
    } else if (/\.docx$/i.test(f.name)) {
      if (!window.mammoth) await new Promise((ok, ko) => { const s = document.createElement("script"); s.src = "vendor/mammoth.browser.min.js"; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
      texte = (await window.mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() })).value;
    } else if (/\.txt$/i.test(f.name) || f.type.startsWith("text/")) texte = await f.text();
    else { direFichier("Format non pris en charge. Utilisez un PDF, un fichier Word (.docx) ou du texte.", true); return; }
    if (nbMots(texte) < 20) { direFichier("Presque aucun texte lu : ce CV est sans doute une image. Les logiciels de tri des recruteurs le liront mal aussi. Collez son texte à la main.", true); return; }
    $("cv").value = texte.trim(); effacerErreur($("cv")); garder(); majPerime();
    direFichier(`${f.name} lu (${nbMots(texte)} mots).`);
  } catch { direFichier("Ce fichier n'a pas pu être lu. Collez le texte de votre CV à la main.", true); }
}
$("fichier").addEventListener("change", (ev) => { lireFichier(ev.target.files?.[0]); ev.target.value = ""; });
const zone = $("depot-zone");
["dragenter", "dragover"].forEach((t) => zone.addEventListener(t, (e) => { e.preventDefault(); zone.classList.add("survol"); }));
["dragleave", "drop"].forEach((t) => zone.addEventListener(t, (e) => { e.preventDefault(); zone.classList.remove("survol"); }));
zone.addEventListener("drop", (e) => lireFichier(e.dataTransfer?.files?.[0]));

function mesurer(bouton, direct = false) {
  if (!profil) return;
  const cv = $("cv").value.trim(), n = nbMots(cv);
  if (!n) { signaler($("cv"), "Ajoutez votre CV : importez un fichier ou collez son texte."); return; }
  if (n < 20) { signaler($("cv"), `${n} mot${n > 1 ? "s" : ""} lu${n > 1 ? "s" : ""}, il en faut au moins 20 : ajoutez vos expériences et votre formation.`); return; }
  effacerErreur($("cv")); $("aide-cv").textContent = "";
  const r = ecart(profil, cv);
  lire({ zone: $("depot-zone"), champ: $("cv"), bouton, direct, libelle: "Comparaison…", teinte: "cv",
    marques: r.correspondances.map((c) => (c.preuve || "").replace(/…$/, "")), fin: (n) => `${n} ligne${n > 1 ? "s" : ""} retrouvée${n > 1 ? "s" : ""}` }, () => {
    // Mémoire du module seulement : la mesure précédente sur la même offre, pour dire ce qui a bougé.
    const avant = dernier;
    cvMesure = cv; afficherEcart(r, avant);
    afficherReperes(cv);
    majPerime(); aller($("ecart")); majFil();
  });
}
$("mesurer").addEventListener("click", (ev) => mesurer(ev.currentTarget));

/* ---------- un résultat qui ne correspond plus au texte saisi est signalé ---------- */
let offreAssemblee = null, cvMesure = null;
function bandeau(el, etat) {
  const cle = etat ? etat.join("|") : "";
  if (el.dataset.etat === cle) return; // pas de nouvelle annonce à chaque frappe
  el.dataset.etat = cle;
  el.innerHTML = etat ? `<p><span>${etat[0]}</span> <button type="button" class="bouton-lien lien" data-refaire="${etat[2]}">${etat[1]}</button></p>` : "";
}
function majPerime() {
  const offreChangee = !!profil && $("offre").value.trim() !== offreAssemblee;
  const cvChange = !!dernier && $("cv").value.trim() !== cvMesure;
  const OFFRE = ["L'offre a changé.", "Assembler à nouveau", "assembler"], CV = ["Votre CV a changé depuis cette mesure.", "Mesurer à nouveau", "mesurer"];
  bandeau($("p-perime"), offreChangee ? OFFRE : null);
  bandeau($("e-perime"), !dernier ? null : offreChangee ? OFFRE : cvChange ? CV : null);
  $("profil").classList.toggle("perime", offreChangee);
  $("ecart").classList.toggle("perime", !!dernier && (offreChangee || cvChange));
  majExemple();
}
["offre", "cv"].forEach((id) => $(id).addEventListener("input", majPerime));
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-refaire]"); if (!b) return;
  if (b.dataset.refaire === "assembler") assembler($("assembler"), true); else mesurer($("mesurer"), true);
});
$("corriger").addEventListener("click", versCv);

// Phrase de tête : uniquement des faits comptés, jamais un pronostic. Un éliminatoire absent passe avant tout,
// même quand le score est déjà sous 49 % (la mention « plafonné » n'apparaît alors pas).
const POIDS = { obligatoire: 3, souhaitee: 2, atout: 1 };
const cite = (t) => `« ${t} »`;
function phraseDeTete(r) {
  const cs = r.correspondances, elim = cs.filter((c) => c.eliminatoire && c.statut === "absente");
  const oblig = cs.filter((c) => c.niveau === "obligatoire" && c.statut === "absente").length;
  if (elim.length === 1) return `Un critère éliminatoire manque : ${cite(elim[0].texte)}. C'est le premier point du plan.`;
  if (elim.length > 1) return `${elim.length} critères éliminatoires manquent : ${elim.map((c) => cite(c.texte)).join(", ")}. Ce sont les premiers points du plan.`;
  if (oblig) return `Il manque ${oblig} exigence${oblig > 1 ? "s" : ""} obligatoire${oblig > 1 ? "s" : ""}.`;
  if (!r.plan.length) return "Toutes les exigences sont visibles dans votre CV.";
  const n = r.plan.length;
  // Un éliminatoire seulement « en partie » : rien de rassurant, le seul décompte (il est le premier point du plan).
  if (cs.some((c) => c.eliminatoire && c.statut === "partielle")) return `${n} point${n > 1 ? "s" : ""} à travailler.`;
  const autres = r.plan.every((p) => p.niveau !== "obligatoire");
  return `Aucune exigence obligatoire ne manque. ${n} point${n > 1 ? "s" : ""}${autres ? ` souhaité${n > 1 ? "s" : ""} ou atout${n > 1 ? "s" : ""}` : ""} à travailler.`;
}

function afficherEcart(r, avant = null) {
  const s = r.score;
  dernier = r; $("e-score").textContent = "0"; compter($("e-score"), s ? s.score : NaN, 1200);
  // Mesure précédente sur la même offre : une ligne, et « avant : … » là où le statut a changé. Rien n'est stocké.
  const sAvant = avant?.score;
  $("e-avant").hidden = !(s && sAvant);
  $("e-avant").textContent = s && sAvant ? `Mesure précédente : ${sAvant.score} %` : "";
  const statutAvant = new Map((avant?.correspondances || []).map((c) => [c.id, c.statut]));
  const etat = (c) => {
    const st = `<span class="statut ${c.statut}">${STATUT[c.statut]}</span>`, a = statutAvant.get(c.id);
    return a && a !== c.statut ? `<span class="etat">${st}<small class="avant">avant : ${STATUT[a]}</small></span>` : st;
  };
  $("e-jauge").style.width = s ? `${s.score}%` : "0";
  $("e-detail").innerHTML = `<strong class="detail-tete">${esc(phraseDeTete(r))}</strong> ` + (s
    ? `${s.presentes} présente${s.presentes > 1 ? "s" : ""}, ${s.partielles} en partie, ${s.absentes} absente${s.absentes > 1 ? "s" : ""} sur ${s.total} exigences.${s.eliminatoires ? ` <b>Score plafonné à 49 %</b> : un critère éliminatoire manque.` : ""}`
    : "L'offre contient moins de trois exigences claires : le pourcentage ne serait pas fiable, voici seulement le détail.");
  // Chaque segment pèse ce que pèse l'exigence dans le calcul : 3, 2 ou 1.
  $("e-jalons").innerHTML = r.correspondances.map((c, i) => `<i data-s="${c.statut}" style="--i:${i};flex:${POIDS[c.niveau] || 1}"></i>`).join("");
  $("e-lignes").innerHTML = r.correspondances.map((c, i) => `<li style="--i:${i}"><span>${esc(c.texte)}</span>${etat(c)}${c.preuve ? `<small>Dans votre CV : « ${esc(c.preuve)} »</small>` : ""}${c.note ? `<small>${esc(c.note)}</small>` : ""}</li>`).join("");
  let i = 0;
  $("e-plan").innerHTML = r.plan.length
    ? groupesDuPlan(r.plan).map((g) => `<div class="plan-groupe" data-statut="${g.statut}" style="--i:${i}"><h4 class="plan-groupe-titre">${g.titre}</h4><p class="plan-commun"><b>Déjà fait ?</b> ${esc(g.commune)}</p><ol class="plan">${g.points.map((p) =>
        `<li style="--i:${i++}"><h5>${esc(p.texte)} <span class="poids" data-niveau="${p.niveau}">${NIVEAU[p.niveau]}${p.eliminatoire ? " · éliminatoire" : ""}</span></h5>${p.siDejaFait !== g.commune ? `<p><b>Déjà fait ?</b> ${esc(p.siDejaFait)}</p>` : ""}${p.sinon ? `<p><b>Sinon :</b> ${esc(p.sinon)}</p>` : ""}</li>`).join("")}</ol></div>`).join("")
    : `<ol class="plan"><li><h5>Votre CV couvre tout le profil cible.</h5><p>Vérifiez que chaque ligne est appuyée par un exemple concret, puis postulez.</p></li></ol>`;
}

/* ---------- le plan en deux groupes : à mieux montrer (en partie), à ajouter ou à acquérir (absent) ---------- */
// La phrase « déjà fait ? » commune à un groupe est dite une fois en tête ; un point ne garde la sienne que si elle diffère.
// Le moteur trie déjà le plan (éliminatoire, puis obligatoire, souhaitée, atout) : le groupe qui contient le point
// le plus urgent passe en premier, pour qu'un critère éliminatoire absent reste toujours le point 01.
const RANG = { obligatoire: 0, souhaitee: 1, atout: 2 };
const urgence = (p) => (p.eliminatoire ? (p.statut === "absente" ? 0 : 1) : 10) + RANG[p.niveau];
function groupesDuPlan(plan) {
  const groupes = [["partielle", "À mieux montrer"], ["absente", "À ajouter ou à acquérir"]]
    .map(([statut, titre]) => ({ statut, titre, points: plan.filter((p) => p.statut === statut) }))
    .filter((g) => g.points.length)
    .sort((a, b) => urgence(a.points[0]) - urgence(b.points[0]));
  for (const g of groupes) {
    const n = new Map(); g.points.forEach((p) => n.set(p.siDejaFait, (n.get(p.siDejaFait) || 0) + 1));
    g.commune = [...n.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }
  return groupes;
}

/* ---------- passerelle vers l'analyse complète (serveur, jury, CV adapté) ---------- */
$("complet").addEventListener("click", (e) => {
  const texte = $("offre").value.trim(), cv = $("cv").value.trim();
  try { sessionStorage.setItem("larpeur.cvDraft", JSON.stringify(cv.slice(0, 12000))); } catch {}
  const job = { v: 1, title: profil?.intitule || "", company: "", location: "", url: "", host: "", text: texte.slice(0, 30000) };
  const cible = "app/#job=" + encodeURIComponent(JSON.stringify(job));
  if (window.justePassage) window.justePassage(cible, e, e.currentTarget); else location.href = cible;
});

/* ---------- repères métier (référentiel public, pas de CV d'autres personnes) ---------- */
function afficherReperes(cv) {
  const box = $("p-reperes"); box.hidden = !metier; if (!metier) return;
  $("r-titre").textContent = `Ce que les recruteurs attendent d'un profil « ${metier.nom} »`;
  $("r-fiche").href = "metiers/" + ficheMetier(metier) + ".html";
  const r = reperesDansCv(metier, cv);
  const bloc = (titre, liste) => liste.length ? `<h4>${titre}</h4><ul class="reperes-liste">${liste.map((x) => `<li class="${cv ? (x.vu ? "vu" : "absent") : ""}">${esc(x.texte)}${cv ? `<span>${x.vu ? "Déjà visible dans votre CV" : "Pas visible dans votre CV"}</span>` : ""}</li>`).join("")}</ul>` : "";
  $("r-listes").innerHTML = bloc("Savoir-faire au cœur du métier", r.savoirFaire) + bloc("Savoirs et outils", r.savoirs) + bloc("Savoir-être", r.savoirEtre);
  // Résumé compté sur les termes réellement affichés ; l'état ouvert ou fermé n'est jamais changé ici.
  const n = $("r-listes").querySelectorAll("li").length, vus = $("r-listes").querySelectorAll("li.vu").length;
  $("r-compte").textContent = cv
    ? `${n} terme${n > 1 ? "s" : ""} du référentiel, dont ${vus} déjà visible${vus > 1 ? "s" : ""} dans votre CV`
    : `Voir les ${n} terme${n > 1 ? "s" : ""} du référentiel`;
}
// À l'impression, les repères sont toujours dépliés ; on rend ensuite l'état choisi.
let repliAvantImpression = false;
addEventListener("beforeprint", () => { const d = $("p-reperes"); repliAvantImpression = !d.open; d.open = true; });
addEventListener("afterprint", () => { if (repliAvantImpression) $("p-reperes").open = false; repliAvantImpression = false; });

/* ---------- passer à l'étape suivante sans chercher ---------- */
function versCv() {
  $("etape-cv").scrollIntoView({ behavior: calme ? "auto" : "smooth", block: "start" });
  $("cv").focus({ preventScroll: true });
}
$("vers-cv").addEventListener("click", versCv);

/* ---------- fil d'étapes ---------- */
const boutons = [...document.querySelectorAll("#fil button")];
function majFil() {
  const ouvert = { "etape-offre": true, profil: !!profil, "etape-cv": !!profil, ecart: !!dernier };
  const fait = { "etape-offre": !!profil, profil: !!profil, "etape-cv": !!dernier, ecart: false };
  boutons.forEach((b) => { b.disabled = !ouvert[b.dataset.cible]; b.parentElement.classList.toggle("fait", fait[b.dataset.cible]); });
  if (boutons.some((b) => b.disabled && b.hasAttribute("aria-current"))) boutons.forEach((b, i) => i ? b.removeAttribute("aria-current") : b.setAttribute("aria-current", "step"));
}
boutons.forEach((b) => b.addEventListener("click", () => document.getElementById(b.dataset.cible).scrollIntoView({ behavior: calme ? "auto" : "smooth", block: "start" })));
const vues = new Map();
const guet = new IntersectionObserver((es) => {
  es.forEach((e) => vues.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0));
  const actif = [...vues.entries()].filter(([id]) => !document.getElementById(id).hidden).sort((a, b) => b[1] - a[1])[0];
  if (actif && actif[1] > 0) boutons.forEach((b) => b.dataset.cible === actif[0] ? b.setAttribute("aria-current", "step") : b.removeAttribute("aria-current"));
}, { rootMargin: "-25% 0px -45% 0px", threshold: [0, .1, .3, .6] });
["etape-offre", "profil", "etape-cv", "ecart"].forEach((id) => guet.observe(document.getElementById(id)));

/* ---------- brouillon gardé le temps de l'onglet (sur l'appareil seulement) ---------- */
let minuteur;
function garder() {
  clearTimeout(minuteur);
  minuteur = setTimeout(() => { try { sessionStorage.setItem("juste.atelier", JSON.stringify({ offre: $("offre").value.slice(0, 30000), cv: $("cv").value.slice(0, 30000) })); } catch {} }, 300);
}
["offre", "cv"].forEach((id) => $(id).addEventListener("input", garder));
try {
  const b = JSON.parse(sessionStorage.getItem("juste.atelier") || "null");
  if (b) { if (b.offre) $("offre").value = b.offre; if (b.cv) $("cv").value = b.cv; if (b.offre) $("aide-offre").textContent = "Votre brouillon a été retrouvé."; }
  // CV collé sur l'accueil : on le dit dès l'arrivée, avec de quoi le retirer.
  if (b?.source === "accueil" && b.cv) {
    $("note-accueil-texte").textContent = "Votre CV collé sur l'accueil est déjà en place à l'étape 3." + (b.offre ? "" : " Il ne manque que l'offre.");
    $("note-accueil").hidden = false;
  }
} catch {}
$("retirer-cv").addEventListener("click", () => {
  $("cv").value = ""; try { sessionStorage.removeItem("juste.atelier"); } catch {}
  // Le bouton disparaît : le curseur va à l'offre, ce qui manque encore ; la note (role=status) annonce le retrait.
  $("note-accueil-texte").textContent = "CV retiré."; $("retirer-cv").hidden = true;
  majPerime(); majExemple(); $("offre").focus();
});

/* ---------- CV d'exemple : seulement avec une offre d'exemple non modifiée, toujours dit fictif ---------- */
const offreExemple = () => DOMAINES.find((d) => d.offre === $("offre").value);
const estCvExemple = (t) => DOMAINES.some((d) => d.cv === String(t ?? "").trim());
function majExemple() {
  const d = offreExemple(), ex = estCvExemple($("cv").value);
  // Jamais par-dessus un CV personnel : le bouton ne s'offre que sur un champ vide ou un autre CV d'exemple.
  const cv = $("cv").value.trim();
  $("cv-exemple").hidden = !d || (cv !== "" && !ex) || cv === d.cv;
  $("cv-fictif").hidden = !ex;
  // Le quota de l'analyse complète ne se dépense pas sur une personne fictive.
  $("complet").disabled = ex; $("complet-exemple").hidden = !ex;
  $("e-fictif").hidden = !(dernier && estCvExemple(cvMesure));
}
["offre", "cv"].forEach((id) => $(id).addEventListener("input", majExemple));
$("cv-exemple").addEventListener("click", () => {
  const d = offreExemple(); if (!d) return;
  $("cv").value = d.cv; effacerErreur($("cv")); garder();
  direFichier("CV d'exemple chargé.");
  majPerime(); majExemple();
});
majExemple();

/* ---------- garder le résultat ---------- */
function texteDuPlan() {
  if (!dernier) return "";
  const s = dernier.score, l = [...(estCvExemple(cvMesure) ? ["CV d'exemple : une personne fictive, pour voir le résultat."] : []),
    `JusteCV : ${profil.intitule}`, s ? `Profil cible couvert à ${s.score} %` : "Détail par exigence", ""];
  dernier.correspondances.forEach((c) => l.push(`[${STATUT[c.statut]}] ${c.texte}`));
  if (dernier.plan.length) {
    l.push("", "Le plan"); let i = 0;
    for (const g of groupesDuPlan(dernier.plan)) {
      l.push("", g.titre, `Déjà fait ? ${g.commune}`);
      g.points.forEach((p) => l.push(`${++i}. ${p.texte} (${NIVEAU[p.niveau]}${p.eliminatoire ? ", éliminatoire" : ""})`, ...(p.siDejaFait !== g.commune ? [`   Déjà fait ? ${p.siDejaFait}`] : []), ...(p.sinon ? [`   Sinon : ${p.sinon}`] : [])));
    }
  }
  return l.join("\n");
}
$("copier").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(texteDuPlan()); $("aide-actions").textContent = "Plan copié. Collez-le dans vos notes ou dans un message."; }
  catch { $("aide-actions").textContent = "La copie n'a pas marché. Utilisez « Imprimer ou enregistrer en PDF »."; }
});
$("imprimer").addEventListener("click", () => window.print());
$("recommencer").addEventListener("click", () => {
  profil = null; dernier = null; metier = null; offreAssemblee = null; cvMesure = null;
  $("offre").value = ""; $("exemple").value = ""; effacerErreur($("offre")); effacerErreur($("cv")); garder(); majPerime();
  ["profil", "etape-cv", "ecart"].forEach((id) => { $(id).hidden = true; });
  $("aide-offre").textContent = "Collez une nouvelle offre. Votre CV est gardé."; $("aide-actions").textContent = "";
  majFil(); $("etape-offre").scrollIntoView({ behavior: calme ? "auto" : "smooth", block: "start" }); $("offre").focus({ preventScroll: true });
});
majFil();
