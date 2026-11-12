// Accueil — « Situez-vous » : le visiteur choisit son domaine, voit le profil cible d'une offre d'exemple,
// puis se situe en 30 secondes (Oui / En partie / Non) ou en collant son CV.
// Calcul local : rien n'est envoyé ni conservé.
import { profilCible, ecart } from "./moteur/profil-cible.mjs";
import { matchScore } from "./moteur/match-score.mjs";
import { DOMAINES, domaine } from "./moteur/exemples.mjs";
import { compter } from "./moteur/compte.mjs";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const NIVEAU = { obligatoire: "Obligatoire", souhaitee: "Souhaitée", atout: "Atout" };
const STATUT = { presente: "Présent", partielle: "En partie", absente: "Absent" };
const CHOIX = [["presente", "Oui"], ["partielle", "En partie"], ["absente", "Non"]];
const ETAT0 = "Deux façons de vous situer";
const AIDE0 = "Votre CV reste dans votre navigateur. Rien n'est envoyé.";

let actuel = null, profil = null, rapide = true;

/* ---------- domaines ---------- */
$("demo-domaines-liste").innerHTML = DOMAINES.map((d) => `<label><input type="radio" name="domaine" value="${d.id}"><span>${esc(d.nom)}</span></label>`).join("");
$("demo-domaines").hidden = false;

function choisir(id) {
  actuel = domaine(id); profil = profilCible(actuel.offre);
  const radio = document.querySelector(`input[name="domaine"][value="${actuel.id}"]`); if (radio) radio.checked = true;
  $("demo-ref").textContent = `Offre d'exemple · ${actuel.intitule} · ${actuel.ligne}`;
  $("demo-cible").innerHTML = profil.exigences.map((e) => `<li>${esc(e.texte)}<span class="poids">${NIVEAU[e.niveau]}${e.eliminatoire ? " · éliminatoire" : ""}</span></li>`).join("");
  $("demo-questions").innerHTML = profil.exigences.map((e, i) => `<fieldset class="question"><legend>${esc(e.texte)}</legend><div class="reponses">${CHOIX.map(([v, t]) => `<label><input type="radio" name="q${i}" value="${v}"><span>${t}</span></label>`).join("")}</div></fieldset>`).join("");
  $("demo-cv").value = ""; $("demo-aide").textContent = AIDE0;
  majRapide(); mode(rapide);
}
// Changement de domaine : fondu natif entre les deux profils quand le navigateur le permet.
const calme = matchMedia("(prefers-reduced-motion: reduce)").matches;
$("demo-domaines-liste").addEventListener("change", (e) => {
  const id = e.target.value;
  if (document.startViewTransition && !calme) document.startViewTransition(() => choisir(id)); else choisir(id);
});
// Les cartes métiers de la page renvoient ici avec leur domaine déjà choisi.
document.addEventListener("click", (e) => { const a = e.target.closest("[data-domaine]"); if (a) choisir(a.dataset.domaine); });

/* ---------- deux façons de répondre ---------- */
function mode(r) {
  rapide = r;
  $("mode-rapide").setAttribute("aria-pressed", r); $("mode-cv").setAttribute("aria-pressed", !r);
  $("demo-rapide").hidden = !r; $("demo-saisie").hidden = r; $("demo-resultat").hidden = true;
  $("demo-etat").textContent = ETAT0;
}
$("mode-rapide").addEventListener("click", () => mode(true));
$("mode-cv").addEventListener("click", () => { mode(false); $("demo-cv").focus(); });

/* ---------- en 30 secondes ---------- */
function majRapide() {
  const rep = profil.exigences.map((e, i) => ({ e, statut: document.querySelector(`input[name="q${i}"]:checked`)?.value }));
  const faites = rep.filter((r) => r.statut).length, total = rep.length;
  const fini = faites === total;
  $("rapide-score").hidden = !fini; $("rapide-actions").hidden = !fini;
  if (!fini) $("rapide-chiffre").textContent = "0";
  if (!fini) { $("rapide-suite").textContent = `${faites} réponse${faites > 1 ? "s" : ""} sur ${total}`; return; }
  const s = matchScore(rep.map((r) => ({ competence: r.e.texte, exigence: r.e.niveau, statut: r.statut, eliminatoire: r.e.eliminatoire })));
  const manques = rep.filter((r) => r.statut !== "presente").map((r) => r.e.texte);
  compter($("rapide-chiffre"), s ? s.score : NaN);
  $("rapide-suite").textContent = (s?.eliminatoires ? "Score plafonné à 49 % : un critère exigé manque. " : "") + (manques.length ? `À travailler : ${manques.join(" ; ")}.` : "Vous couvrez tout le profil. Montrez-le avec des exemples concrets.");
}
$("demo-questions").addEventListener("change", majRapide);

/* ---------- en collant son CV ---------- */
function comparer(cv) {
  if (cv.trim().split(/\s+/).length < 20) { $("demo-aide").textContent = "Collez un peu plus de texte : il faut au moins vos expériences et votre formation."; $("demo-cv").focus(); return; }
  const r = ecart(profil, cv), s = r.score;
  $("demo-score").textContent = "0"; compter($("demo-score"), s ? s.score : NaN);
  $("demo-etat").textContent = s ? `${s.presentes} présente${s.presentes > 1 ? "s" : ""}, ${s.partielles} en partie, ${s.absentes} absente${s.absentes > 1 ? "s" : ""}${s.eliminatoires ? " · plafonné : critère exigé manquant" : ""}` : "Détail par exigence";
  $("demo-lignes").innerHTML = r.correspondances.map((c) => `<li><span>${c.preuve ? esc(c.preuve) : "Rien dans votre CV"}<small>${esc(c.texte)}</small></span><span class="statut ${c.statut}">${STATUT[c.statut]}</span></li>`).join("");
  $("demo-saisie").hidden = true; $("demo-resultat").hidden = false; $("demo-resultat").focus({ preventScroll: true });
}
$("demo-comparer").addEventListener("click", () => comparer($("demo-cv").value));
$("demo-exemple").addEventListener("click", () => { $("demo-cv").value = actuel.cv; comparer(actuel.cv); });
$("demo-retour").addEventListener("click", () => { $("demo-resultat").hidden = true; $("demo-saisie").hidden = false; $("demo-etat").textContent = ETAT0; $("demo-aide").textContent = AIDE0; $("demo-cv").focus(); });

choisir("soin");
