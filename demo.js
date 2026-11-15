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
const POIDS = { obligatoire: 3, souhaitee: 2, atout: 1 };
const STATUT = { presente: "Présent", partielle: "En partie", absente: "Absent" };
const CHOIX = [["presente", "Oui"], ["partielle", "En partie"], ["absente", "Non"]];
const ETAT0 = "Deux façons de vous situer";
const AIDE0 = "Votre CV reste dans votre navigateur. Rien n'est envoyé.";

const calme = matchMedia("(prefers-reduced-motion: reduce)").matches;
// Le niveau d'une exigence, tel qu'il s'affiche dans le profil cible et sous chaque question.
const niveau = (e) => `<span class="poids" data-niveau="${e.niveau}">${NIVEAU[e.niveau]}${e.eliminatoire ? " · éliminatoire" : ""}</span>`;
// Rejoue une petite animation CSS (classe « tic ») quand un nombre change.
const rejouer = (el) => { if (calme) return; el.classList.remove("tic"); void el.offsetWidth; el.classList.add("tic"); };

let actuel = null, profil = null, rapide = true, fini = false;

/* ---------- domaines ---------- */
$("demo-domaines-liste").innerHTML = DOMAINES.map((d) => `<label><input type="radio" name="domaine" value="${d.id}"><span>${esc(d.nom)}</span></label>`).join("");
$("demo-domaines").hidden = false;

function choisir(id) {
  actuel = domaine(id); profil = profilCible(actuel.offre);
  const radio = document.querySelector(`input[name="domaine"][value="${actuel.id}"]`); if (radio) radio.checked = true;
  $("demo-ref").textContent = `Offre d'exemple · ${actuel.intitule} · ${actuel.ligne}`;
  $("demo-cible").innerHTML = profil.exigences.map((e) => `<li>${esc(e.texte)}${niveau(e)}</li>`).join("");
  // Le niveau suit chaque question (hors de la légende, pour garder un nom de groupe court).
  $("demo-questions").innerHTML = profil.exigences.map((e, i) => `<fieldset class="question"><legend>${esc(e.texte)}</legend>${niveau(e)}<div class="reponses">${CHOIX.map(([v, t]) => `<label><input type="radio" name="q${i}" value="${v}"><span>${t}</span></label>`).join("")}</div></fieldset>`).join("");
  // Chaque jalon a la largeur de son poids dans le score (3, 2 ou 1).
  $("demo-jalons").innerHTML = profil.exigences.map((e) => `<i style="flex-grow:${POIDS[e.niveau] ?? 1}"></i>`).join("");
  $("demo-cv").value = ""; $("demo-aide").textContent = AIDE0;
  fini = false; majRapide(); mode(rapide);
}
// Le profil cible (à gauche) et les jalons reflètent chaque réponse : on voit tout de suite ce qui est couvert.
// Quand les six réponses sont données (plan = true), la liste devient le plan : ce qui est acquis s'efface,
// ce qui reste à travailler ressort, l'un après l'autre.
function marquer(statuts, plan = false) {
  let k = 0;
  [...$("demo-cible").children].forEach((li, i) => {
    if (statuts[i]) li.dataset.statut = statuts[i]; else delete li.dataset.statut;
    li.style.setProperty("--k", statuts[i] && statuts[i] !== "presente" ? k++ : 0);
  });
  [...$("demo-jalons").children].forEach((j, i) => { if (statuts[i]) j.dataset.s = statuts[i]; else delete j.dataset.s; });
  $("demo-cible").classList.toggle("fini", plan);
  $("demo-reste").hidden = !plan;
  if (plan) $("demo-reste").textContent = k ? `Il reste ${k} ligne${k > 1 ? "s" : ""} à travailler` : "Il ne reste aucune ligne à travailler";
}
// Survol ou saisie d'une question : la ligne correspondante du profil cible s'éclaire.
function viser(e) {
  const q = e.target.closest?.(".question"), i = q ? [...$("demo-questions").children].indexOf(q) : -1;
  [...$("demo-cible").children].forEach((li, k) => li.classList.toggle("vise", k === i && e.type !== "pointerleave" && e.type !== "focusout"));
}
["pointerover", "focusin", "pointerleave", "focusout"].forEach((t) => $("demo-questions").addEventListener(t, viser));
// Changement de domaine : fondu natif entre les deux profils quand le navigateur le permet.
$("demo-domaines-liste").addEventListener("change", (e) => {
  const id = e.target.value;
  if (document.startViewTransition && !calme) document.startViewTransition(() => choisir(id)); else choisir(id);
});
// Les cartes métiers de la page renvoient ici avec leur domaine déjà choisi.
document.addEventListener("click", (e) => { const a = e.target.closest("[data-domaine]"); if (a) choisir(a.dataset.domaine); });

/* ---------- deux façons de répondre ---------- */
function mode(r) {
  rapide = r; $("demo").dataset.mode = r ? "rapide" : "cv";
  $("mode-rapide").setAttribute("aria-pressed", r); $("mode-cv").setAttribute("aria-pressed", !r);
  $("demo-rapide").hidden = !r; $("demo-saisie").hidden = r; $("demo-resultat").hidden = true;
  $("demo-etat").textContent = ETAT0;
  if (r) majRapide(); else marquer([]);
}
$("mode-rapide").addEventListener("click", () => mode(true));
$("mode-cv").addEventListener("click", () => { mode(false); $("demo-cv").focus(); });

/* ---------- en 30 secondes ---------- */
function majRapide() {
  const rep = profil.exigences.map((e, i) => ({ e, statut: document.querySelector(`input[name="q${i}"]:checked`)?.value }));
  const faites = rep.filter((r) => r.statut).length, total = rep.length;
  fini = faites === total;
  marquer(rep.map((r) => r.statut), fini);
  $("rapide-score").hidden = !fini; $("rapide-actions").hidden = !fini;
  const s = fini ? matchScore(rep.map((r) => ({ competence: r.e.texte, exigence: r.e.niveau, statut: r.statut, eliminatoire: r.e.eliminatoire }))) : null;
  // Compteur du bandeau de suivi : « 2 / 6 » pendant qu'on répond, puis le score.
  const compte = fini && s ? `${s.score} %` : `${faites} / ${total}`;
  if ($("rapide-compte").textContent !== compte) { $("rapide-compte").textContent = compte; if (faites) rejouer($("rapide-compte")); }
  if (!fini) $("rapide-chiffre").textContent = "0";
  // La phrase d'état (lue par les lecteurs d'écran) : le compte des réponses, puis, à la fin, le score
  // en tête et le nombre de points à travailler. Le compte et le score sont déjà affichés en grand :
  // à l'écran, seule la suite reste visible.
  $("rapide-suite").classList.toggle("sr", !fini);
  $("rapide-manques").hidden = true;
  if (!fini) { $("rapide-suite").textContent = `${faites} réponse${faites > 1 ? "s" : ""} sur ${total}`; return; }
  const manques = rep.filter((r) => r.statut !== "presente");
  compter($("rapide-chiffre"), s ? s.score : NaN);
  const n = manques.length;
  $("rapide-suite").innerHTML = (s ? `<span class="sr">${s.score} % du profil cible. </span>` : "") + (s?.eliminatoires ? "Score plafonné à 49 % : un critère exigé manque. " : "")
    + (n ? `${n} point${n > 1 ? "s" : ""} à travailler.` : "Vous couvrez tout le profil. Montrez-le avec des exemples concrets.");
  $("rapide-manques").innerHTML = manques.map((r, i) => `<li data-statut="${r.statut}" style="--i:${i}">${esc(r.e.texte)}${niveau(r.e)}</li>`).join("");
  $("rapide-manques").hidden = !n;
}
// À la sixième réponse, une seule fois : le score et le bouton viennent à l'écran s'ils n'y sont pas.
$("demo-questions").addEventListener("change", () => {
  const avant = fini; majRapide();
  if (fini && !avant) requestAnimationFrame(() => $("rapide-actions").scrollIntoView({ block: "nearest", behavior: calme ? "instant" : "smooth" }));
});

/* ---------- en collant son CV ---------- */
function comparer(cv) {
  if (cv.trim().split(/\s+/).length < 20) { $("demo-aide").textContent = "Collez un peu plus de texte : il faut au moins vos expériences et votre formation."; $("demo-cv").focus(); return; }
  const r = ecart(profil, cv), s = r.score;
  $("demo-score").textContent = "0"; compter($("demo-score"), s ? s.score : NaN);
  $("demo-etat").textContent = s ? `${s.presentes} présente${s.presentes > 1 ? "s" : ""}, ${s.partielles} en partie, ${s.absentes} absente${s.absentes > 1 ? "s" : ""}${s.eliminatoires ? " · plafonné : critère exigé manquant" : ""}` : "Détail par exigence";
  $("demo-lignes").innerHTML = r.correspondances.map((c) => `<li><span>${c.preuve ? esc(c.preuve) : "Rien dans votre CV"}<small>${esc(c.texte)}</small></span><span class="statut ${c.statut}">${STATUT[c.statut]}</span></li>`).join("");
  marquer(r.correspondances.length === profil.exigences.length ? r.correspondances.map((c) => c.statut) : []);
  $("demo-saisie").hidden = true; $("demo-resultat").hidden = false; $("demo-resultat").focus({ preventScroll: true });
}
$("demo-comparer").addEventListener("click", () => comparer($("demo-cv").value));
$("demo-exemple").addEventListener("click", () => { $("demo-cv").value = actuel.cv; comparer(actuel.cv); });
$("demo-retour").addEventListener("click", () => { marquer([]); $("demo-resultat").hidden = true; $("demo-saisie").hidden = false; $("demo-etat").textContent = ETAT0; $("demo-aide").textContent = AIDE0; $("demo-cv").focus(); });

choisir("soin");
