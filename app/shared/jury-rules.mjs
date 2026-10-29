// Règles du jury, communes au serveur, à l'extension et à l'appli mobile.
// Les verdicts sont calculés, jamais laissés à l'appréciation du modèle :
// note de 7 ou plus = retenu ; une erreur bloquante plafonne à 4 la note des juges qui l'ont relevée ;
// le logiciel de tri (ATS) suit la couverture des exigences obligatoires et les critères éliminatoires.

export const JUDGES = [
  { id: "ats", name: "Le logiciel de tri (ATS)", short: "ATS", question: "Le CV est-il lisible par une machine, avec les mots-clés de l'offre ?" },
  { id: "recruteur", name: "Le recruteur", short: "Recruteur", question: "En 30 secondes, est-ce que je l'appelle ?" },
  { id: "manager", name: "Le manager du poste", short: "Manager", question: "Saura-t-il faire le travail dès le premier mois ?" },
  { id: "concurrent", name: "Un autre candidat", short: "Concurrent", question: "Où suis-je meilleur que lui ?" },
  { id: "patron", name: "Le patron", short: "Patron", question: "Qu'est-ce que cette personne va rapporter ?" },
  { id: "expert", name: "L'expert métier", short: "Expert", question: "Maîtrise-t-il vraiment son métier ?" },
  { id: "sceptique", name: "Le sceptique", short: "Sceptique", question: "Qu'est-ce qui sonne faux, flou ou invérifiable ?" }
];
export const JUDGE_IDS = JUDGES.map((j) => j.id);
/** Jury de l'accès gratuit : le tri automatique et le recruteur. Premium réunit les 7 juges. */
export const FREE_JUDGES = ["ats", "recruteur"];
export const PASS_MARK = 7;
export const BLOCKING_CAP = 4;
export const ATS_COVERAGE = 0.7;
export const PLACEHOLDER = /\[À COMPLÉTER\s*:[^\]]*\]/g;

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));

/** Couverture des exigences obligatoires et critères éliminatoires manquants, d'après les correspondances. */
export function atsCheck(correspondances) {
  const items = (correspondances || []).filter((c) => c && c.statut);
  const must = items.filter((c) => c.exigence === "obligatoire");
  if (!must.length) return null;
  const covered = must.filter((c) => c.statut !== "absente").length;
  const eliminatory = items.filter((c) => c.eliminatoire && c.statut === "absente").map((c) => c.competence);
  const coverage = covered / must.length;
  return { coverage, covered, total: must.length, eliminatory, passes: coverage >= ATS_COVERAGE && !eliminatory.length };
}

/** Libellé de l'offre retrouvé tel quel dans l'extrait du CV, ou sous une autre forme. */
export function keywordForm(item) {
  if (!item || item.statut === "absente" || !item.preuve_cv) return "absent";
  const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return fold(item.preuve_cv).includes(fold(item.competence)) ? "exact" : "autre";
}

/**
 * Notes et verdicts cohérents : bloquants, ATS, emplacements à compléter.
 * `jury` = { juges:[{juge,note,...}], erreurs:[{gravite,juges:[1..7]}] } ; modifié et renvoyé.
 */
export function settleJury(jury, { correspondances = null, placeholders = 0 } = {}) {
  if (!jury?.juges) return jury;
  const capped = new Set();
  // Les numéros des juges suivent l'ordre du jury réuni (7 juges, ou 2 en gratuit).
  const order = jury.juges.map((j) => j.juge);
  for (const e of jury.erreurs || []) if (e.gravite === "bloquant") for (const n of e.juges || []) capped.add(order[n - 1]);
  const ats = correspondances ? atsCheck(correspondances) : null;
  for (const j of jury.juges) {
    j.note = clamp(j.note, 0, 10);
    if (capped.has(j.juge)) j.note = Math.min(j.note, BLOCKING_CAP);
    if (j.juge === "ats" && ats) {
      j.note = ats.passes ? Math.max(j.note, PASS_MARK) : Math.min(j.note, ats.eliminatory.length ? BLOCKING_CAP : PASS_MARK - 1);
      j.couverture = Math.round(ats.coverage * 100);
      j.eliminatoires = ats.eliminatory;
    }
    if (placeholders > 0) j.note = Math.min(j.note, 9);
    j.retenu = j.note >= PASS_MARK;
  }
  jury.retenus = jury.juges.filter((j) => j.retenu).length;
  return jury;
}

/** Second passage : notes après, potentiel (jamais inférieur à la note), questions qui rapportent le plus. */
export function settleSecondPass(second, { correspondances = null, placeholders = 0 } = {}) {
  if (!second?.juges) return second;
  const ats = correspondances ? atsCheck(correspondances) : null;
  for (const j of second.juges) {
    j.note = clamp(j.note, 0, 10);
    if (j.juge === "ats" && ats) j.note = ats.passes ? Math.max(j.note, PASS_MARK) : Math.min(j.note, ats.eliminatory.length ? BLOCKING_CAP : PASS_MARK - 1);
    if (placeholders > 0) j.note = Math.min(j.note, 9);
    j.potentiel = clamp(Math.max(j.potentiel, j.note), 0, 10);
    j.retenu = j.note >= PASS_MARK;
  }
  second.retenus = second.juges.filter((j) => j.retenu).length;
  second.potentiel = second.juges.filter((j) => j.potentiel >= PASS_MARK).length;
  // Les questions citées par les juges qui passeraient de « rejeté » à « retenu » rapportent le plus.
  const gain = new Map();
  for (const j of second.juges) {
    if (j.retenu || j.potentiel < PASS_MARK) continue;
    for (const q of j.questions || []) gain.set(q, (gain.get(q) || 0) + 1);
  }
  second.questions_cles = [...gain.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 3).map(([q]) => q);
  return second;
}

/** « X/7 retiennent votre CV avant, Y/7 maintenant, jusqu'à Z/7 si vous répondez aux questions 2, 4 et 5. » */
export function juryLine(before, second, n = JUDGES.length) {
  const qs = second?.questions_cles || [];
  const list = qs.length > 1 ? qs.slice(0, -1).join(", ") + " et " + qs[qs.length - 1] : qs.join("");
  let line = `${before ?? "?"}/${n} retiennent votre CV avant, ${second?.retenus ?? "?"}/${n} maintenant`;
  if (second && second.potentiel > second.retenus) line += `, jusqu'à ${second.potentiel}/${n} si vous répondez ${qs.length > 1 ? "aux questions" : qs.length ? "à la question" : "aux questions"} ${list || "ci-dessous"}`;
  return line + ".";
}

export function countPlaceholders(cvAdapte) {
  return (JSON.stringify(cvAdapte || {}).match(PLACEHOLDER) || []).length;
}
