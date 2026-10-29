// Proximité rapide entre un CV et une offre, calculée sur l'appareil, sans IA ni quota.
// Sert à trier une liste d'offres ; le vrai score reste celui de l'analyse complète.
// Commun à l'extension et à l'appli mobile.

const STOP = new Set(("les des une un le la de du et en au aux pour par sur avec dans vous nous votre vos notre nos est sont ses son sa ce cette ces qui que quoi dont ou où plus moins tres très bien etre être avoir fait faire leur leurs ainsi afin chez entre sans sous tout tous toute toutes autre autres comme mais donc car pas ne se il elle ils elles on lui eux aussi selon vers depuis lors cas type temps jour jours mois ans annee année annees années heure heures "
  + "poste postes mission missions profil profils entreprise entreprises societe société equipe équipe equipes équipes candidat candidate candidats candidature recherche recherchons recrute recrutons rejoindre rejoignez offre offres emploi emplois travail travailler activite activité activites activités sein cadre niveau "
  + "experience expérience experiences expériences minimum souhaite souhaitée souhaitee souhaitees appreciee appréciée apprecie apprécié requis requise exige exigé contrat cdi cdd interim intérim salaire horaires horaire semaine poste lieu date debut début h/f f/h hf "
  + "assurer assurez participer participez etes êtes serez sera seront aurez avez etre devrez pouvez savoir capacite capacité qualite qualité qualites qualités bonne bonnes bon bons grande grand nouveau nouvelle nombreux principales principaux "
  + "utilisation the and for with you our").split(/\s+/));
// Verbes trop génériques dans les compétences France Travail (« Gérer un stock » : c'est « stock » qui compte).
const VERBS = new Set("utiliser realiser effectuer appliquer mettre oeuvre assurer veiller respecter gerer preparer proceder identifier definir realisation utilisation application techniques technique regles regle".split(" "));
// Mots d'intitulé trop vagues pour être une compétence (« Employé de rayon » : c'est « rayon » qui compte).
const VAGUE_TITLE = new Set("employe employee agent agente equipier equipiere collaborateur collaboratrice personnel salarie salariee poste".split(" "));
const GENERIC_TITLE = /^(stage|stagiaire|alternance|alternant|apprenti(ssage)?|cdd|cdi|int[ée]rim|job|emploi|b[ée]n[ée]volat|mission)$/i;
const NOT_TOOLS = new Set(["CDI", "CDD", "SMIC", "RTT", "TTC", "HT", "SARL", "SAS", "SA", "HF", "FH", "EUR", "PME", "TPE", "ETI", "RH", "AND", "THE"]);
const HEADING = /^(exp[ée]riences?(\s+professionnelles?)?|parcours(\s+professionnel)?|emplois?|stages?|formations?|dipl[ôo]mes?|[ée]tudes|comp[ée]tences|savoir-faire|langues?|centres? d'int[ée]r[êe]t|loisirs|int[ée]r[êe]ts|informatique|outils|certifications?|qualit[ée]s|profil|pr[ée]cisions|projets?)\s*:?$/i;
const EXP = /^(exp[ée]riences?(\s+professionnelles?)?|parcours(\s+professionnel)?|emplois?|stages?)\s*:?$/i;
const DATE = /^(\(?\s*)?((janv|f[ée]vr|mars|avr|mai|juin|juil|ao[ûu]t|sept|oct|nov|d[ée]c)[a-zéû]*\.?\s*)?(19|20)\d{2}(\s*[-–—à/]\s*(((janv|f[ée]vr|mars|avr|mai|juin|juil|ao[ûu]t|sept|oct|nov|d[ée]c)[a-zéû]*\.?\s*)?(19|20)\d{2}|aujourd'hui|présent|present|en cours))?\s*\)?$/i;

const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const words = (s) => fold(s).split(/[^a-z0-9+#]+/).filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w));
export const stem = (w) => { const v = w.replace(/(s|x)$/, ""); return v.length > 6 ? v.slice(0, 6) : v; };
const stems = (s) => new Set(words(s).map(stem));

/** Intitulés de poste tirés de la partie « Expériences » du CV (3 au plus), sinon ses compétences. */
export function cvSearchTerms(cvText, max = 3) {
  const lines = String(cvText || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const titles = []; let inExp = false; let skills = [];
  for (const raw of lines) {
    const line = raw.replace(/^[#*\s]+|[*\s]+$/g, "");
    if (HEADING.test(line)) { inExp = EXP.test(line); if (/^comp[ée]tences|outils|informatique/i.test(line)) inExp = "skills"; continue; }
    if (inExp === "skills") { skills.push(...line.replace(/^[-•·*]\s*/, "").split(/[,;·•|]/).map((x) => x.trim()).filter((x) => x.length >= 2 && x.length <= 40)); continue; }
    if (!inExp || /^[-•·*]/.test(line)) continue;
    const parts = line.split(/\s+[—–-]\s+|\s*\|\s*|,\s+|\s+chez\s+|\s+@\s+|\s*:\s+/i).map((p) => p.replace(/\((?:[^)]*\d{4}[^)]*)\)/g, "").trim()).filter(Boolean);
    const title = parts.find((p) => !GENERIC_TITLE.test(p) && !DATE.test(p) && !/\d{4}/.test(p) && p.split(/\s+/).length <= 6 && p.length >= 3 && p.length <= 50);
    if (title && !titles.some((t) => fold(t) === fold(title))) titles.push(title.replace(/\s*\(.*$/, ""));
    if (titles.length >= max) break;
  }
  return (titles.length ? titles : skills).slice(0, max);
}

function offerTerms(offer) {
  const terms = []; const seen = new Set();
  const add = (label, weight, kind) => {
    let st = [...stems(label)];
    const strong = st.filter((s) => !VERBS.has(s) && ![...VERBS].some((v) => stem(v) === s));
    if (strong.length) st = strong;
    const key = st.sort().join(" ");
    if (!key || seen.has(key)) return;
    if (kind !== "competence" && terms.some((t) => st.every((x) => t.stems.includes(x)))) return;
    seen.add(key); terms.push({ label: label.trim(), weight, kind, stems: st });
  };
  for (const s of offer.skills || []) add(s, 3, "competence");
  const raw = `${offer.title || ""} ${offer.text || ""}`;
  for (const m of raw.match(/\b[A-Z][A-Z0-9+#]{1,7}\b/g) || []) if (!NOT_TOOLS.has(m) && !/^\d/.test(m)) add(m, 2, "outil");
  for (const w of (offer.title || "").replace(/\(.*?\)|\bH\s*\/\s*F\b|\bF\s*\/\s*H\b/gi, "").split(/[\s/,–—-]+/)) if (words(w).length && !VAGUE_TITLE.has(fold(w))) add(w, 2, "intitule");
  const counts = new Map(); const firstForm = new Map();
  for (const m of String(offer.text || "").matchAll(/[A-Za-zÀ-ÖØ-öø-ÿ'’-]{4,}/g)) {
    const w = words(m[0])[0]; if (!w || /(ez|ons)$/.test(w)) continue; // « vous réalisez », « nous proposons » : des verbes, pas des compétences
    const st = stem(w); counts.set(st, (counts.get(st) || 0) + 1); if (!firstForm.has(st)) firstForm.set(st, m[0].replace(/^[ld]['’]/i, ""));
  }
  const order = [...counts].sort((a, b) => b[1] - a[1]);
  const frequent = order.filter(([, n]) => n >= 2).slice(0, 10);
  const rare = order.filter(([st, n]) => n === 1 && firstForm.get(st).length >= 8).slice(0, Math.max(0, 6 - frequent.length));
  [...frequent, ...rare].forEach(([st]) => add(firstForm.get(st), 1, "mot"));
  return terms;
}

/** Proximité 0–100, points communs et termes de l'offre absents du CV. */
export function jobFit(cvText, offer) {
  const cv = stems(cvText);
  const terms = offerTerms(offer);
  let got = 0, total = 0; const common = [], missing = [];
  for (const t of terms) {
    const hits = t.stems.filter((s) => cv.has(s)).length;
    const ok = hits / t.stems.length >= 0.6;
    total += t.weight; if (ok) { got += t.weight; common.push(t); } else missing.push(t);
  }
  const score = total ? Math.round((100 * got) / total) : 0;
  const rank = { competence: 0, outil: 1, intitule: 2, mot: 3 };
  const order = (a, b) => rank[a.kind] - rank[b.kind] || b.weight - a.weight;
  return {
    score,
    level: score >= 50 ? "Très proche" : score >= 25 ? "Proche" : "À explorer",
    common: common.sort(order).slice(0, 8).map((t) => t.label),
    missing: missing.sort(order).slice(0, 8).map((t) => t.label),
  };
}

/** Classe les offres de la plus proche à la moins proche du CV. */
export function rankOffers(cvText, offers) {
  return (offers || []).map((o) => ({ ...o, fit: jobFit(cvText, o) })).sort((a, b) => b.fit.score - a.fit.score);
}
