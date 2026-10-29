// Score de correspondance calculé à partir des exigences de l'offre, pour que le
// pourcentage affiché corresponde toujours au détail « Ce que demande l'offre ».
// Commun au serveur, à l'extension et à l'appli mobile.

export const WEIGHTS = { obligatoire: 3, souhaitee: 2, atout: 1 };
export const CREDIT = { presente: 1, partielle: 0.5, absente: 0 };
export const MIN_ITEMS = 3;
/** Un critère éliminatoire absent (diplôme exigé, permis…) empêche de dépasser « écart important ». */
export const ELIMINATORY_CAP = 49;

/** { score, total, presentes, partielles, absentes } ou null si trop peu d'exigences. */
export function matchScore(correspondances) {
  const items = (correspondances || []).filter((c) => c && WEIGHTS[c.exigence] && c.statut in CREDIT);
  if (items.length < MIN_ITEMS) return null;
  let possible = 0, earned = 0;
  for (const c of items) { possible += WEIGHTS[c.exigence]; earned += WEIGHTS[c.exigence] * CREDIT[c.statut]; }
  const count = (statut) => items.filter((c) => c.statut === statut).length;
  const detail = { score: Math.round((earned / possible) * 100), total: items.length, presentes: count("presente"), partielles: count("partielle"), absentes: count("absente") };
  const eliminatoires = items.filter((c) => c.eliminatoire && c.statut === "absente").map((c) => c.competence);
  if (eliminatoires.length && detail.score > ELIMINATORY_CAP) Object.assign(detail, { score: ELIMINATORY_CAP, eliminatoires });
  return detail;
}

/** Aligne `result.score` sur ses correspondances (sans effet si elles sont trop peu nombreuses). */
export function alignScore(result) {
  const detail = matchScore(result?.correspondances);
  if (detail) { result.score = detail.score; result.score_detail = detail; }
  return result;
}
