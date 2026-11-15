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
const MARQUE = { presente: "vous l'avez", partielle: "en partie", absente: "vous ne l'avez pas" };
const CHOIX = [["presente", "Oui"], ["partielle", "En partie"], ["absente", "Non"]];
const ETAT0 = "Deux façons de vous situer";
const AIDE0 = "Votre CV reste dans votre navigateur. Rien n'est envoyé.";

const calme = matchMedia("(prefers-reduced-motion: reduce)").matches;
// Le niveau d'une exigence, tel qu'il s'affiche dans le profil cible et sous chaque question
// (là, avec un id : la question y renvoie par aria-describedby).
const niveau = (e, id) => `<span class="poids"${id ? ` id="${id}"` : ""} data-niveau="${e.niveau}">${NIVEAU[e.niveau]}${e.eliminatoire ? " · éliminatoire" : ""}</span>`;
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
  // Chaque ligne garde un équivalent texte de sa pastille de statut (span.sr), tenu à jour par marquer().
  $("demo-cible").innerHTML = profil.exigences.map((e) => `<li>${esc(e.texte)}<span class="sr"></span>${niveau(e)}</li>`).join("");
  // Le niveau suit chaque question (hors de la légende, pour garder un nom de groupe court) ; il en est la
  // description : un lecteur d'écran qui entre dans le groupe au clavier lit la légende, puis le niveau.
  $("demo-questions").innerHTML = profil.exigences.map((e, i) => `<fieldset class="question" aria-describedby="q${i}-niv"><legend>${esc(e.texte)}</legend>${niveau(e, `q${i}-niv`)}<div class="reponses">${CHOIX.map(([v, t]) => `<label><input type="radio" name="q${i}" value="${v}"><span>${t}</span></label>`).join("")}</div></fieldset>`).join("");
  // Chaque jalon a la largeur de son poids dans le score (3, 2 ou 1).
  $("demo-jalons").innerHTML = profil.exigences.map((e) => `<i style="flex-grow:${POIDS[e.niveau] ?? 1}"></i>`).join("");
  $("demo-cv").value = ""; effacer();
  fini = false; majRapide(); mode(rapide);
}
// Le profil cible (à gauche) et les jalons reflètent chaque réponse : on voit tout de suite ce qui est couvert.
// Quand les six réponses sont données (plan = true), la liste devient le plan : ce qui est acquis s'efface,
// ce qui reste à travailler ressort, l'un après l'autre.
function marquer(statuts, plan = false) {
  let k = 0;
  [...$("demo-cible").children].forEach((li, i) => {
    if (statuts[i]) li.dataset.statut = statuts[i]; else delete li.dataset.statut;
    const sr = li.querySelector(".sr"); if (sr) sr.textContent = statuts[i] ? ` : ${MARQUE[statuts[i]]}. ` : "";
    li.style.setProperty("--k", statuts[i] && statuts[i] !== "presente" ? k++ : 0);
  });
  [...$("demo-jalons").children].forEach((j, i) => { if (statuts[i]) j.dataset.s = statuts[i]; else delete j.dataset.s; });
  $("demo-cible").classList.toggle("fini", plan);
  // Sur ordinateur, le plan de gauche porte déjà les lignes à travailler : la feuille masque alors leur liste à droite.
  $("demo").toggleAttribute("data-plan", plan);
  $("demo-reste").hidden = !plan;
  if (plan) $("demo-reste").textContent = k ? `Il reste ${k} ligne${k > 1 ? "s" : ""} à travailler` : "Il ne reste aucune ligne à travailler";
}
// Survol ou saisie d'une question : la ligne correspondante du profil cible s'éclaire.
function viser(e) {
  const q = e.target.closest?.(".question"), i = q ? [...$("demo-questions").children].indexOf(q) : -1;
  [...$("demo-cible").children].forEach((li, k) => li.classList.toggle("vise", k === i && e.type !== "pointerleave" && e.type !== "focusout"));
}
["pointerover", "focusin", "pointerleave", "focusout"].forEach((t) => $("demo-questions").addEventListener(t, viser));
// Un changement de domaine remplace tout le profil : on le dit aux lecteurs d'écran.
const annoncer = () => { $("demo-annonce").textContent = `Profil cible : ${actuel.intitule}, ${profil.exigences.length} exigences.`; };
// Changement de domaine : fondu natif entre les deux profils quand le navigateur le permet.
// Des changements rapprochés (flèches enchaînées) interrompent le fondu en cours : son interruption
// (AbortError sur ready) n'est pas une erreur, le profil est remplacé quand même. Une erreur de choisir()
// reste visible (updateCallbackDone n'est pas intercepté).
$("demo-domaines-liste").addEventListener("change", (e) => {
  const id = e.target.value, changer = () => { choisir(id); annoncer(); };
  if (!document.startViewTransition || calme) return changer();
  const t = document.startViewTransition(changer);
  t.ready.catch(() => {}); t.finished.catch(() => {});
});
// Les cartes métiers de la page renvoient ici avec leur domaine déjà choisi.
document.addEventListener("click", (e) => { const a = e.target.closest("[data-domaine]"); if (a) { choisir(a.dataset.domaine); annoncer(); } });

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
// Ce qui couvre le haut de l'écran : l'en-tête flottant, et sur téléphone le bandeau de suivi collé sous lui.
function obstacle() {
  const suivi = $("demo-suivi"), tete = $("tete");
  let bas = tete ? Math.max(0, tete.getBoundingClientRect().bottom) : 0;
  if (getComputedStyle(suivi).position === "sticky") bas = Math.max(bas, suivi.getBoundingClientRect().bottom);
  return bas;
}
// Une question amenée au focus clavier ne reste pas sous l'en-tête ou le bandeau : le navigateur ne fait défiler
// que le bouton radio, qu'il juge visible même caché dessous ; on ramène la question entière (scroll-margin-top).
$("demo-questions").addEventListener("focusin", (e) => {
  if (!e.target.matches?.(":focus-visible")) return;
  requestAnimationFrame(() => {
    const q = e.target.closest(".question"), l = q?.querySelector("legend");
    if (l && document.activeElement === e.target && l.getBoundingClientRect().top < obstacle() + 4) q.scrollIntoView({ block: "start", behavior: calme ? "instant" : "smooth" });
  });
});
// À la sixième réponse, une seule fois : le score et le bouton viennent à l'écran s'ils n'y sont pas
// (bas du bouton à sa scroll-margin-bottom du bas de la fenêtre, au-dessus de la barre mobile sur téléphone,
// comme scrollIntoView « nearest »). Si la réponse vient du clavier, on ne remonte pas la question au focus
// sous l'en-tête ou le bandeau : le défilement s'arrête avant, et la touche Tab mène ensuite au bouton.
function montrer(relance) {
  const a = $("rapide-actions"); if (a.hidden) return;
  let d = a.getBoundingClientRect().bottom - (innerHeight - (parseFloat(getComputedStyle(a).scrollMarginBottom) || 0));
  const f = document.activeElement, l = f?.closest?.(".question")?.querySelector("legend");
  if (l && f.matches(":focus-visible")) d = Math.min(d, l.getBoundingClientRect().top - obstacle() - 8);
  if (d > 1) scrollBy({ top: d, behavior: calme ? "instant" : "smooth" });
  // Sous animations réduites, le bilan peut encore grandir d'une image à l'autre : une seule vérification de plus.
  if (calme && !relance) requestAnimationFrame(() => requestAnimationFrame(() => montrer(true)));
}
$("demo-questions").addEventListener("change", () => {
  const avant = fini; majRapide();
  // On attend que le bilan ait sa hauteur finale (polices chargées, et deux images : sous animations réduites,
  // une transition quasi nulle laisse le bilan à sa hauteur d'avant pendant une image).
  if (fini && !avant) (document.fonts?.ready ?? Promise.resolve()).then(() => requestAnimationFrame(() => requestAnimationFrame(() => montrer())));
});

/* ---------- en collant son CV ---------- */
// Une seule mesure, pour le test comme pour le message : le nombre de mots.
const MOTS_MIN = 20;
const mots = (t) => { const x = t.trim(); return x ? x.split(/\s+/).length : 0; };
// Erreur : message coloré sous le champ (déjà relié par aria-describedby), champ marqué invalide, focus dessus.
// Le lecteur d'écran lit la description en arrivant sur le champ : pas de zone live en plus, pas de double annonce.
function signaler(message) {
  const aide = $("demo-aide"), champ = $("demo-cv");
  aide.textContent = message; aide.classList.add("erreur");
  champ.classList.add("invalide"); champ.setAttribute("aria-invalid", "true");
  champ.focus({ preventScroll: true });
  aide.scrollIntoView({ block: "nearest", behavior: calme ? "instant" : "smooth" });
}
// Dès qu'on reprend la saisie, l'erreur s'efface et l'aide d'origine revient.
function effacer() {
  const aide = $("demo-aide"), champ = $("demo-cv");
  aide.textContent = AIDE0; aide.classList.remove("erreur");
  champ.classList.remove("invalide"); champ.removeAttribute("aria-invalid");
}
$("demo-cv").addEventListener("input", () => { if ($("demo-cv").hasAttribute("aria-invalid")) effacer(); });
function comparer(cv) {
  const n = mots(cv);
  if (!n) return signaler("Collez votre CV, ou cliquez sur « Voir avec un CV d'exemple ».");
  if (n < MOTS_MIN) return signaler(`${n} mot${n > 1 ? "s" : ""} lu${n > 1 ? "s" : ""}, il en faut au moins ${MOTS_MIN} : ajoutez vos expériences et votre formation.`);
  effacer();
  const r = ecart(profil, cv), s = r.score;
  $("demo-score").textContent = "0"; compter($("demo-score"), s ? s.score : NaN);
  $("demo-etat").textContent = s ? `${s.presentes} présente${s.presentes > 1 ? "s" : ""}, ${s.partielles} en partie, ${s.absentes} absente${s.absentes > 1 ? "s" : ""}${s.eliminatoires ? " · plafonné : critère exigé manquant" : ""}` : "Détail par exigence";
  $("demo-lignes").innerHTML = r.correspondances.map((c) => `<li><span>${c.preuve ? esc(c.preuve) : "Rien dans votre CV"}<small>${esc(c.texte)}</small></span><span class="statut ${c.statut}">${STATUT[c.statut]}</span></li>`).join("");
  marquer(r.correspondances.length === profil.exigences.length ? r.correspondances.map((c) => c.statut) : []);
  $("demo-saisie").hidden = true; $("demo-resultat").hidden = false; $("demo-resultat").focus({ preventScroll: true });
}
$("demo-comparer").addEventListener("click", () => comparer($("demo-cv").value));
$("demo-exemple").addEventListener("click", () => { $("demo-cv").value = actuel.cv; comparer(actuel.cv); });
$("demo-retour").addEventListener("click", () => { marquer([]); $("demo-resultat").hidden = true; $("demo-saisie").hidden = false; $("demo-etat").textContent = ETAT0; effacer(); $("demo-cv").focus(); });

/* ---------- vers l'atelier : le CV collé ici n'est pas à recoller ----------
   Seulement si le visiteur a lui-même collé son CV (pas le CV d'exemple) ; sessionStorage seulement :
   rien ne survit à la fermeture de l'onglet. On garde l'offre déjà en brouillon dans l'atelier. */
$("demo").addEventListener("click", (e) => {
  if (!e.target.closest?.('a[href^="atelier.html"]')) return;
  const cv = $("demo-cv").value.trim();
  if (mots(cv) < MOTS_MIN || cv === String(actuel?.cv ?? "").trim()) return;
  try {
    let b = null; try { b = JSON.parse(sessionStorage.getItem("juste.atelier") || "null"); } catch {}
    if (!b || typeof b !== "object") b = {};
    sessionStorage.setItem("juste.atelier", JSON.stringify({ ...b, offre: typeof b.offre === "string" ? b.offre : "", cv: cv.slice(0, 30000), source: "accueil" }));
  } catch {}
});

choisir("soin");
