// Profil cible : ce que l'offre décrit, pièce par pièce.
// Calculé dans le navigateur, sans IA ni appel réseau.
// Le profil cible sert de référence. Il n'est jamais écrit dans le CV de la personne.

import { matchScore } from "./match-score.mjs";

const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[’'`]/g, " ");

const STOP = new Set(("les des une un le la de du et en au aux pour par sur avec dans vous nous votre vos notre nos est sont ses son sa ce cette ces qui que dont ou plus moins tres bien etre avoir fait faire leur leurs afin chez entre sans sous tout tous toute toutes autre autres comme mais donc car pas ne se il elle ils elles on lui aussi selon vers depuis lors cas type "
  + "poste mission missions profil entreprise societe equipe equipes candidat candidate recherche recherchons recrute rejoindre rejoignez offre emploi travail sein cadre niveau "
  + "experience experiences minimum souhaite souhaitee souhaitees apprecie appreciee requis requise exige exigee indispensable obligatoire imperatif idealement serait atout bonus necessaire "
  + "assurer participer etes serez sera aurez avez devez devrez pouvez savoir capacite qualite qualites bonne bonnes bon bons grande grand nouveau nouvelle "
  + "maitrise maitriser connaissance connaissances connaitre disposez justifiez possedez titulaire idealement egalement notamment ainsi preference "
  + "premiere premier reussie significative similaire equivalent sens esprit bon bonne gout "
  + "the and for with you our").split(/\s+/));

// Même idée sous deux formes : « rigoureux » dans le CV répond à « rigueur » dans l'offre.
const LEMMES = { rigoureux: "rigueur", rigoureuse: "rigueur", rapide: "rapidite", rapides: "rapidite", souriant: "sourire", souriante: "sourire",
  dynamique: "dynamisme", curieux: "curiosite", curieuse: "curiosite", motive: "motivation", motivee: "motivation",
  vendeur: "vente", vendeuse: "vente", vendre: "vente", ventes: "vente" };
const words = (s) => fold(s).split(/[^a-z0-9+#]+/).filter((w) => w.length >= 2 && !STOP.has(w) && !/^\d+$/.test(w)).map((w) => LEMMES[w] || w);
const stem = (w) => { const v = w.replace(/(s|x)$/, ""); return v.length > 6 ? v.slice(0, 6) : v; };

/* ---------- repères ---------- */

const DIPLOMES = [
  { niveau: 3, re: /\b(cap|bep)\b/, nom: "CAP ou BEP" },
  { niveau: 4, re: /\b(bac pro|baccalaureat|bac)\b(?!\s*\+)/, nom: "Bac" },
  { niveau: 5, re: /\b(bac\s*\+\s*2|bts|dut|deust)\b/, nom: "Bac +2 (BTS, DUT)" },
  { niveau: 6, re: /\b(bac\s*\+\s*3|licence|bachelor|but)\b/, nom: "Bac +3 (licence, bachelor, BUT)" },
  { niveau: 7, re: /\b(bac\s*\+\s*5|master|mba|ingenieur|grande ecole|ecole de commerce)\b/, nom: "Bac +5 (master, école)" },
  { niveau: 8, re: /\b(doctorat|phd|these)\b/, nom: "Doctorat" },
];

const LANGUES = ["anglais", "espagnol", "allemand", "italien", "portugais", "arabe", "chinois", "mandarin", "japonais", "neerlandais", "russe", "polonais", "roumain", "turc", "langue des signes"];

const SAVOIR_ETRE = [
  ["rigueur", /\brigour|rigueur|rigoureu/], ["autonomie", /\bautonom/], ["organisation", /\borganis[ea]|\bsens de l organisation/],
  ["esprit d'équipe", /esprit d equipe|travail en equipe|travailler en equipe/], ["sens du relationnel", /relationnel/],
  ["écoute", /\becoute\b/], ["adaptabilité", /adaptab|s adapter/], ["réactivité", /reactiv/], ["curiosité", /curios/],
  ["ponctualité", /ponctu/], ["polyvalence", /polyvalen/], ["dynamisme", /dynami/], ["sens du service", /sens du service|orientation client|sens client/],
  ["discrétion", /discret|confidentialit/], ["force de proposition", /force de proposition/], ["gestion du stress", /stress|sous pression/],
  ["aisance à l'oral", /aisance (a l )?oral|aisance relationnelle|communication orale/], ["esprit d'analyse", /analyse|analytique/],
];

const OUTILS = ["excel", "word", "powerpoint", "pack office", "suite office", "office 365", "google workspace", "outlook", "sap", "salesforce", "hubspot", "sage", "cegid", "quickbooks",
  "python", "java", "javascript", "typescript", "react", "angular", "vue", "node", "php", "sql", "power bi", "tableau", "figma", "photoshop", "illustrator", "indesign", "canva",
  "autocad", "revit", "solidworks", "catia", "jira", "notion", "wordpress", "shopify", "git", "docker", "kubernetes", "aws", "azure", "linux", "crm", "erp", "pao", "dao", "wms"];

const PERMIS = /\bpermis\s*(b|c|ce|d|be|poids lourd|vl)?\b|\bvehicule(e)?\b|\bvehicule personnel\b/;
const HABILITATION = /\b(caces(\s*r?\s*\d+)?|habilitation(s)? electrique(s)?|sst|carte professionnelle|haccp|ssiap\s*\d?|bafa|cqp|fimo|fco|aipr)\b/;

const ATOUT = /\b(un plus|serait un (plus|atout)|est un (plus|atout)|apprecie(e|s)?|bonus|idealement|serait appreciee?|souhaitable)\b/;
const SOUHAITEE = /\b(souhaite(e|s)?|de preference|si possible|une premiere experience)\b/;
const OBLIGATOIRE = /\b(indispensables?|exige(e|s|es)?|obligatoires?|imperati(f|ve|fs|ves)|requis(e|es)?|necessaires?|vous devez|doit|minimum|maitris(e|ez|er)|titulaire|vous possedez|vous justifiez)\b/;

const SECTION_PROFIL = /^(profil(\s+recherche)?|votre profil|qui (etes|sommes)[- ]vous|competences(\s+requises|\s+attendues)?|prerequis|pre-requis|requis|ce que nous attendons|vous avez|vous etes|qualifications?|savoir[- ]faire|savoir[- ]etre|exigences|criteres)\b/;
const SECTION_MISSIONS = /^(missions?|vos missions|descriptif|description du poste|le poste|vos responsabilites|responsabilites|activites|au quotidien|ce que vous ferez|mission principale)\b/;
const SECTION_AUTRE = /^(avantages?|ce que nous offrons|nous offrons|conditions|remuneration|salaire|informations complementaires|a propos|qui sommes[- ]nous|l entreprise|processus|modalites|lieu|contrat|pourquoi nous rejoindre)\b/;

/* ---------- lecture de l'offre ---------- */

function cleanLine(l) {
  return l.replace(/^[\s•·\-–—*▪►✓✔→>]+/, "").replace(/\s+/g, " ").trim();
}

/** Coupe une phrase longue en exigences plus courtes (« ; », « et une ... »). */
function splitReq(line) {
  if (line.length < 110) return [line];
  return line.split(/\s*;\s*|\.\s+(?=[A-ZÉ])/).map((s) => s.trim()).filter((s) => s.length > 3);
}

function niveauDe(t, dansProfil) {
  if (ATOUT.test(t)) return "atout";
  if (OBLIGATOIRE.test(t)) return "obligatoire";
  if (SOUHAITEE.test(t)) return "souhaitee";
  return dansProfil ? "souhaitee" : "atout";
}

function categorie(t) {
  if (DIPLOMES.some((d) => d.re.test(t)) || /\b(diplome|formation (en|de)|ecole)\b/.test(t)) return "diplome";
  if (/\b\d+\s*(a\s*\d+\s*)?ans?\b/.test(t) && /experience/.test(t)) return "experience";
  if (/\bexperience\b/.test(t)) return "experience";
  if (LANGUES.some((l) => t.includes(l))) return "langue";
  if (PERMIS.test(t) || HABILITATION.test(t)) return "habilitation";
  if (OUTILS.some((o) => new RegExp(`\\b${o}\\b`).test(t))) return "outil";
  if (SAVOIR_ETRE.some(([, re]) => re.test(t)) && words(t).length <= 6) return "savoir-etre";
  return "competence";
}

function intitule(lines) {
  for (const l of lines.slice(0, 6)) {
    const t = cleanLine(l);
    if (t.length >= 4 && t.length <= 80 && !/[.:]$/.test(t) && !SECTION_PROFIL.test(fold(t)) && !SECTION_MISSIONS.test(fold(t))) return t.replace(/\s*\((h\/f|f\/h)\)\s*/i, " ").replace(/\s+(h\/f|f\/h)\s*$/i, "").trim();
  }
  return "Poste sans intitulé";
}

/**
 * @param {string} texte texte de l'offre
 * @returns {{intitule, contrat, experienceAns, diplome, exigences: {id, texte, niveau, categorie, eliminatoire}[], missions: string[], savoirEtre: string[], outils: string[], langues: string[]}}
 */
export function profilCible(texte) {
  const raw = String(texte || "").replace(/\r/g, "");
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const t = fold(raw);

  let section = "inconnue";
  const reqLines = [], missions = [], loose = [];
  for (const l of lines) {
    const c = cleanLine(l); const f = fold(c).replace(/[:\s]+$/, "");
    if (c.length < 60 && SECTION_PROFIL.test(f)) { section = "profil"; continue; }
    if (c.length < 60 && SECTION_MISSIONS.test(f)) { section = "missions"; continue; }
    if (c.length < 60 && SECTION_AUTRE.test(f)) { section = "autre"; continue; }
    if (c.length < 4) continue;
    if (section === "profil") reqLines.push(c);
    else if (section === "missions") missions.push(c);
    else if (section === "inconnue") loose.push(c);
  }
  // Sans rubrique « profil », on garde les phrases qui expriment une attente.
  const source = reqLines.length ? reqLines
    : loose.concat(missions).filter((c) => OBLIGATOIRE.test(fold(c)) || ATOUT.test(fold(c)) || SOUHAITEE.test(fold(c)) || /\b(experience|diplome|bac|permis|maitrise|anglais)\b/.test(fold(c)));

  const exigences = []; const vus = new Set();
  for (const line of source) {
    for (const part of splitReq(line)) {
      const f = fold(part);
      const cle = words(part).map(stem).sort().join(" ");
      if (!cle || vus.has(cle) || words(part).length === 0) continue;
      vus.add(cle);
      const niveau = niveauDe(f, true);
      const cat = categorie(f);
      const eliminatoire = niveau === "obligatoire" && (cat === "diplome" || cat === "habilitation");
      exigences.push({ id: `e${exigences.length + 1}`, texte: part.replace(/[.;,]$/, ""), niveau, categorie: cat, eliminatoire });
      if (exigences.length >= 16) break;
    }
    if (exigences.length >= 16) break;
  }

  // Missions : on les garde comme compétences attendues si l'offre n'a presque rien dit du profil.
  if (exigences.length < 3) {
    for (const m of missions.slice(0, 6 - exigences.length)) {
      exigences.push({ id: `e${exigences.length + 1}`, texte: m.replace(/[.;,]$/, ""), niveau: "souhaitee", categorie: "competence", eliminatoire: false, deMission: true });
    }
  }

  const exp = t.match(/(\d{1,2})\s*(?:a|-|à)?\s*(?:\d{1,2}\s*)?ans?\s*(?:minimum\s*)?(?:d\s*)?experience|experience\s*(?:de|d au moins|minimum de|significative de)?\s*(\d{1,2})\s*ans?/);
  const experienceAns = exp ? Number(exp[1] || exp[2]) : (/debutant(e)?s? accepte|premiere experience|sans experience/.test(t) ? 0 : null);
  const dip = DIPLOMES.filter((d) => d.re.test(t)).sort((a, b) => a.niveau - b.niveau)[0] || null;
  const contrat = (t.match(/\b(cdi|cdd|alternance|apprentissage|stage|interim|freelance|contrat de professionnalisation)\b/) || [])[1] || null;

  return {
    intitule: intitule(lines),
    contrat: contrat ? contrat.toUpperCase().replace("INTERIM", "Intérim").replace("ALTERNANCE", "Alternance").replace("APPRENTISSAGE", "Apprentissage").replace("STAGE", "Stage").replace("FREELANCE", "Freelance") : null,
    experienceAns,
    diplome: dip ? { niveau: dip.niveau, nom: dip.nom } : null,
    exigences,
    missions: missions.slice(0, 8),
    savoirEtre: SAVOIR_ETRE.filter(([, re]) => re.test(t)).map(([n]) => n),
    outils: OUTILS.filter((o) => new RegExp(`\\b${o}\\b`).test(t)).map((o) => o.length <= 4 ? o.toUpperCase() : o[0].toUpperCase() + o.slice(1)),
    langues: LANGUES.filter((l) => t.includes(l)).map((l) => l[0].toUpperCase() + l.slice(1)),
  };
}

/* ---------- lecture du CV ---------- */

function niveauDiplomeCV(t) {
  return DIPLOMES.filter((d) => d.re.test(t)).reduce((m, d) => Math.max(m, d.niveau), 0);
}

/** Années d'expérience estimées à partir des périodes datées du CV (« 2019 – 2023 »). */
function anneesCV(cv) {
  const now = new Date().getFullYear();
  const spans = [];
  for (const m of fold(cv).matchAll(/\b((?:19|20)\d{2})\s*(?:-|–|—|a|au)\s*((?:19|20)\d{2}|aujourd hui|present|en cours|maintenant)\b/g)) {
    const a = Number(m[1]); const b = /^\d/.test(m[2]) ? Number(m[2]) : now;
    if (b >= a && b - a <= 45) spans.push([a, b]);
  }
  spans.sort((x, y) => x[0] - y[0]);
  let total = 0, cur = null;
  for (const s of spans) {
    if (!cur || s[0] > cur[1]) { if (cur) total += cur[1] - cur[0]; cur = [...s]; } else cur[1] = Math.max(cur[1], s[1]);
  }
  if (cur) total += cur[1] - cur[0];
  return spans.length ? total : null;
}

/** Morceau du CV où le terme apparaît, pour montrer la preuve. */
function preuve(cv, termes) {
  const lignes = String(cv).split(/\n/).map((l) => l.trim()).filter(Boolean);
  let best = null, bestN = 0;
  for (const l of lignes) {
    const s = new Set(words(l).map(stem));
    const n = termes.filter((x) => s.has(x)).length;
    if (n > bestN) { best = l; bestN = n; }
  }
  return best && best.length > 140 ? best.slice(0, 137) + "…" : best;
}

/**
 * Compare le vrai CV au profil cible. Ne modifie rien, n'ajoute rien.
 * @returns {{correspondances, score, plan}}
 */
export function ecart(profil, cvTexte) {
  const cv = String(cvTexte || "");
  const tcv = fold(cv);
  const sCV = new Set(words(cv).map(stem));
  // Équivalences sûres : on n'ajoute que ce que le CV prouve déjà sous un autre nom.
  if (/\b(excel|word|powerpoint|outlook)\b/.test(tcv)) ["office", "pack", "bureau"].forEach((w) => sCV.add(stem(w)));
  if (/\b(salesforce|hubspot|zoho|pipedrive|dynamics)\b/.test(tcv)) sCV.add("crm");
  const nivCV = niveauDiplomeCV(tcv);
  const ansCV = anneesCV(cv);

  const correspondances = profil.exigences.map((e) => {
    const f = fold(e.texte);
    let statut, note = "", termes = [...new Set(words(e.texte).map(stem))];
    if (e.categorie === "diplome" && profil.diplome && DIPLOMES.some((d) => d.re.test(f))) {
      const req = DIPLOMES.filter((d) => d.re.test(f)).reduce((m, d) => Math.max(m, d.niveau), 0);
      statut = nivCV >= req ? "presente" : nivCV === req - 1 ? "partielle" : "absente";
      note = nivCV ? `Niveau lu dans votre CV : ${DIPLOMES.find((d) => d.niveau === nivCV)?.nom}.` : "Aucun diplôme reconnu dans le CV.";
    } else if (e.categorie === "experience" && /\d/.test(f)) {
      const req = Number((f.match(/(\d{1,2})/) || [])[1]);
      if (ansCV === null) { statut = "partielle"; note = "Le CV n'a pas de périodes datées : impossible de compter les années."; }
      else { statut = ansCV >= req ? "presente" : ansCV >= req / 2 ? "partielle" : "absente"; note = `Environ ${ansCV} an${ansCV > 1 ? "s" : ""} d'après les dates de votre CV.`; }
    } else if (e.categorie === "langue") {
      const l = LANGUES.find((x) => f.includes(x));
      statut = l && tcv.includes(l) ? (/(courant|bilingue|c1|c2|b2|toeic|toefl|ielts|professionnel)/.test(tcv) || !/(courant|bilingue|c1|c2|b2)/.test(f) ? "presente" : "partielle") : "absente";
    } else {
      const juger = (ts) => { const n = ts.filter((x) => sCV.has(x)).length, ratio = ts.length ? n / ts.length : 0;
        return (ts.length <= 2 ? n > 0 && n === ts.length : ratio >= 0.6) ? 2 : (n >= 1 && ratio >= 0.25) ? 1 : 0; };
      let niv = juger(termes);
      if (/\sou\s/.test(f)) for (const alt of f.split(/\s+ou\s+/)) {
        const ts = [...new Set(words(alt).map(stem))]; if (!ts.length) continue;
        const v = juger(ts); if (v > niv) { niv = v; termes = ts; }
      }
      statut = ["absente", "partielle", "presente"][niv];
    }
    return { ...e, competence: e.texte, exigence: e.niveau, statut, note, preuve: statut !== "absente" ? preuve(cv, termes) : null };
  });

  const score = matchScore(correspondances);
  const plan = correspondances.filter((c) => c.statut !== "presente").map((c) => ({
    id: c.id, texte: c.texte, statut: c.statut, niveau: c.niveau, eliminatoire: c.eliminatoire,
    siDejaFait: c.statut === "partielle"
      ? "Si c'est vrai, reprenez les mots de l'offre dans la ligne qui en parle, avec un exemple concret."
      : "Si vous l'avez déjà fait (stage, job, projet, bénévolat), ajoutez-le avec un exemple réel et daté.",
    sinon: piste(c),
  }));
  const poids = { obligatoire: 0, souhaitee: 1, atout: 2 };
  plan.sort((a, b) => (b.eliminatoire - a.eliminatoire) || (poids[a.niveau] - poids[b.niveau]));
  return { correspondances, score, plan, anneesCV: ansCV, niveauCV: nivCV };
}

function piste(c) {
  switch (c.categorie) {
    case "diplome": return "Regardez la VAE (validation des acquis) ou une formation certifiante. Vous pouvez aussi postuler en expliquant l'équivalent de votre parcours.";
    case "experience": return "Mettez en avant les missions qui s'en approchent (stages, jobs, alternance), sans gonfler les durées.";
    case "langue": return "Passez un test reconnu (TOEIC, Linguaskill, DELE…) pour pouvoir écrire un niveau vérifiable.";
    case "habilitation": return "C'est souvent une formation courte (quelques jours). Vérifiez si l'employeur la finance après l'embauche.";
    case "outil": return "Un projet personnel ou un tutoriel certifiant suffit souvent à pouvoir l'écrire honnêtement.";
    case "savoir-etre": return "Ne l'écrivez pas comme un mot-clé : racontez une situation où vous l'avez montré.";
    default: return "Cherchez une mission, un projet ou une formation courte qui vous permettra de l'écrire honnêtement.";
  }
}
