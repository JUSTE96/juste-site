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
$("exemple").addEventListener("change", (e) => { if (e.target.value) { $("offre").value = domaine(e.target.value).offre; garder(); $("aide-offre").textContent = "Offre d'exemple chargée. Vous pouvez la modifier."; } });

$("assembler").addEventListener("click", () => {
  const texte = $("offre").value.trim();
  if (texte.replace(/\s/g, "").length < 80) { $("aide-offre").textContent = "Le texte est trop court. Collez l'annonce entière."; return; }
  $("aide-offre").textContent = "";
  profil = profilCible(texte);
  afficherProfil(profil, offerSignals(texte));
  metier = repereMetier(profil.intitule); afficherReperes("");
  $("etape-cv").hidden = false; $("ecart").hidden = true; dernier = null;
  aller($("profil")); majFil();
});

function afficherProfil(p, signaux) {
  $("p-intitule").textContent = p.intitule;
  const specs = [
    ["Contrat", p.contrat || "Non précisé"],
    ["Expérience", p.experienceAns === null ? "Non précisée" : p.experienceAns === 0 ? "Première expérience ou débutant" : `${p.experienceAns} an${p.experienceAns > 1 ? "s" : ""}`],
    ["Diplôme", p.diplome ? p.diplome.nom : "Non précisé"],
    ["Exigences", String(p.exigences.length)],
  ];
  $("p-specs").innerHTML = specs.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("");
  $("p-exigences").innerHTML = p.exigences.length
    ? p.exigences.map((e) => `<li>${esc(e.texte)}<span class="poids">${NIVEAU[e.niveau]}${e.eliminatoire ? " · éliminatoire" : ""}</span>${e.deMission ? "<small>Déduit des missions : l'offre ne détaille presque pas le profil.</small>" : ""}</li>`).join("")
    : `<li>Aucune attente claire n'a été trouvée. Vérifiez que la rubrique « Profil » a bien été copiée.</li>`;
  const groupe = (titre, liste) => liste.length ? `<div><span class="ref">${titre}</span><p>${liste.map((x) => `<span class="pastille">${esc(x)}</span>`).join("")}</p></div>` : "";
  $("p-pastilles").innerHTML = groupe("Outils", p.outils) + groupe("Langues", p.langues) + groupe("Savoir-être", p.savoirEtre);
  const items = (signaux?.items || []).filter((i) => i.tone === "alerte" || i.tone === "attention");
  $("p-signaux").hidden = !items.length;
  $("p-signaux").innerHTML = items.length ? `<span class="ref">À vérifier dans cette offre</span>` + items.map((i) => `<p><b>${esc(i.titre)}.</b> ${esc(i.detail)}</p>`).join("") : "";
}

/* ---------- import du CV ---------- */
async function lireFichier(f) {
  const aide = $("aide-fichier");
  if (!f) return;
  if (f.size > 15 * 1024 * 1024) { aide.textContent = "Ce fichier dépasse 15 Mo."; return; }
  aide.textContent = "Lecture du fichier…";
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
    else { aide.textContent = "Format non pris en charge. Utilisez un PDF, un fichier Word (.docx) ou du texte."; return; }
    if (texte.trim().split(/\s+/).length < 20) { aide.textContent = "Presque aucun texte lu : ce CV est sans doute une image. Les logiciels de tri des recruteurs le liront mal aussi. Collez son texte à la main."; return; }
    $("cv").value = texte.trim(); garder();
    aide.textContent = `${f.name} lu (${texte.trim().split(/\s+/).length} mots).`;
  } catch { aide.textContent = "Ce fichier n'a pas pu être lu. Collez le texte de votre CV à la main."; }
}
$("fichier").addEventListener("change", (ev) => { lireFichier(ev.target.files?.[0]); ev.target.value = ""; });
const zone = $("depot-zone");
["dragenter", "dragover"].forEach((t) => zone.addEventListener(t, (e) => { e.preventDefault(); zone.classList.add("survol"); }));
["dragleave", "drop"].forEach((t) => zone.addEventListener(t, (e) => { e.preventDefault(); zone.classList.remove("survol"); }));
zone.addEventListener("drop", (e) => lireFichier(e.dataTransfer?.files?.[0]));

$("mesurer").addEventListener("click", () => {
  if (!profil) return;
  const cv = $("cv").value.trim();
  if (cv.split(/\s+/).length < 20) { $("aide-cv").textContent = "Le CV est trop court pour être comparé."; return; }
  $("aide-cv").textContent = "";
  afficherEcart(ecart(profil, cv));
  afficherReperes(cv);
  aller($("ecart")); majFil();
});

function afficherEcart(r) {
  const s = r.score;
  dernier = r; $("e-score").textContent = "0"; compter($("e-score"), s ? s.score : NaN, 1200);
  $("e-jauge").style.width = s ? `${s.score}%` : "0";
  $("e-detail").innerHTML = s
    ? `${s.presentes} présente${s.presentes > 1 ? "s" : ""}, ${s.partielles} en partie, ${s.absentes} absente${s.absentes > 1 ? "s" : ""} sur ${s.total} exigences.${s.eliminatoires ? ` <b>Score plafonné à 49 %</b> : un critère éliminatoire manque.` : ""}`
    : "L'offre contient moins de trois exigences claires : le pourcentage ne serait pas fiable, voici seulement le détail.";
  $("e-lignes").innerHTML = r.correspondances.map((c) => `<li><span>${esc(c.texte)}</span><span class="statut ${c.statut}">${STATUT[c.statut]}</span>${c.preuve ? `<small>Dans votre CV : « ${esc(c.preuve)} »</small>` : ""}${c.note ? `<small>${esc(c.note)}</small>` : ""}</li>`).join("");
  $("e-plan").innerHTML = r.plan.length
    ? r.plan.map((p) => `<li><h4>${esc(p.texte)} <span class="poids">${NIVEAU[p.niveau]}${p.eliminatoire ? " · éliminatoire" : ""}</span></h4><p><b>Déjà fait ?</b> ${esc(p.siDejaFait)}</p><p><b>Sinon :</b> ${esc(p.sinon)}</p></li>`).join("")
    : `<li><h4>Votre CV couvre tout le profil cible.</h4><p>Vérifiez que chaque ligne est appuyée par un exemple concret, puis postulez.</p></li>`;
}

/* ---------- passerelle vers l'analyse complète (serveur, jury, CV adapté) ---------- */
$("complet").addEventListener("click", () => {
  const texte = $("offre").value.trim(), cv = $("cv").value.trim();
  try { sessionStorage.setItem("larpeur.cvDraft", JSON.stringify(cv.slice(0, 12000))); } catch {}
  const job = { v: 1, title: profil?.intitule || "", company: "", location: "", url: "", host: "", text: texte.slice(0, 30000) };
  location.href = "app/#job=" + encodeURIComponent(JSON.stringify(job));
});

/* ---------- repères métier (référentiel public, pas de CV d'autres personnes) ---------- */
function afficherReperes(cv) {
  const box = $("p-reperes"); box.hidden = !metier; if (!metier) return;
  $("r-titre").textContent = `Ce que les recruteurs attendent d'un profil « ${metier.nom} »`;
  $("r-fiche").href = "metiers/" + ficheMetier(metier) + ".html";
  const r = reperesDansCv(metier, cv);
  const bloc = (titre, liste) => liste.length ? `<h4>${titre}</h4><ul class="reperes-liste">${liste.map((x) => `<li class="${cv ? (x.vu ? "vu" : "absent") : ""}">${esc(x.texte)}${cv ? `<span>${x.vu ? "Déjà visible dans votre CV" : "Pas visible dans votre CV"}</span>` : ""}</li>`).join("")}</ul>` : "";
  $("r-listes").innerHTML = bloc("Savoir-faire au cœur du métier", r.savoirFaire) + bloc("Savoirs et outils", r.savoirs) + bloc("Savoir-être", r.savoirEtre);
}

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
} catch {}

/* ---------- garder le résultat ---------- */
function texteDuPlan() {
  if (!dernier) return "";
  const s = dernier.score, l = [`JusteCV : ${profil.intitule}`, s ? `Profil cible couvert à ${s.score} %` : "Détail par exigence", ""];
  dernier.correspondances.forEach((c) => l.push(`[${STATUT[c.statut]}] ${c.texte}`));
  if (dernier.plan.length) { l.push("", "Le plan"); dernier.plan.forEach((p, i) => l.push(`${i + 1}. ${p.texte}`, `   Déjà fait ? ${p.siDejaFait}`, `   Sinon : ${p.sinon}`)); }
  return l.join("\n");
}
$("copier").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(texteDuPlan()); $("aide-actions").textContent = "Plan copié. Collez-le dans vos notes ou dans un message."; }
  catch { $("aide-actions").textContent = "La copie n'a pas marché. Utilisez « Imprimer ou enregistrer en PDF »."; }
});
$("imprimer").addEventListener("click", () => window.print());
$("recommencer").addEventListener("click", () => {
  profil = null; dernier = null; metier = null;
  $("offre").value = ""; $("exemple").value = ""; garder();
  ["profil", "etape-cv", "ecart"].forEach((id) => { $(id).hidden = true; });
  $("aide-offre").textContent = "Collez une nouvelle offre. Votre CV est gardé."; $("aide-actions").textContent = "";
  majFil(); $("etape-offre").scrollIntoView({ behavior: calme ? "auto" : "smooth", block: "start" }); $("offre").focus({ preventScroll: true });
});
majFil();
