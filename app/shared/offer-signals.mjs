// « L'offre en clair » : repères sur le sérieux et la clarté d'une offre d'emploi,
// calculés sur l'appareil à partir de son texte. Aucun appel réseau, aucune IA, aucun quota.
// Des points à vérifier, jamais des accusations : chaque signal a parfois une explication légitime.
// Idée reprise du « bloc G » (posting legitimacy) de career-ops (licence MIT),
// règles réécrites pour le droit du travail français.

const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[’'`]/g, " ").replace(/\s+/g, " ");

const ALTERNANCE = /\b(apprenti(e|s|ssage)?|alternance|alternant|contrat de professionnalisation|contrat pro)\b/;
const STAGE = /\b(stage|stagiaire|internship)\b/;

/** Plus grande durée en mois citée près d'un mot (« stage de 6 mois », « 4 à 6 mois »). */
function maxMonths(t, around) {
  let best = 0;
  for (const m of t.matchAll(/(\d{1,2})\s*mois\b/g)) {
    const ctx = t.slice(Math.max(0, m.index - 80), m.index + 20);
    if (!around || around.test(ctx)) best = Math.max(best, Number(m[1]));
  }
  return best;
}

/** Part de mots anglais courants parmi les mots courants anglais + français. */
function englishShare(t) {
  const en = (t.match(/\b(the|and|you|your|with|we|our|will|for|are|of|to|skills|team)\b/g) || []).length;
  const fr = (t.match(/\b(le|la|les|et|vous|votre|avec|nous|notre|pour|des|une|est|sont|competences|equipe)\b/g) || []).length;
  return en + fr ? en / (en + fr) : 0;
}

/**
 * @param {string} text texte de l'offre
 * @param {{company?:string, location?:string}} meta
 * @returns {{level:"clair"|"verifier"|"prudence", items:{tone:"alerte"|"attention"|"info"|"ok", titre:string, detail:string}[]}}
 */
export function offerSignals(text, meta = {}) {
  const t = fold(text);
  const items = [];
  const add = (tone, titre, detail) => items.push({ tone, titre, detail });
  if (t.replace(/\s/g, "").length < 60) return { level: "clair", items: [] };
  const alternance = ALTERNANCE.test(t);

  /* ---------- argent demandé au candidat, coordonnées bancaires ---------- */
  if (/\b(frais|droits) (d inscription|de dossier|d adhesion|de candidature)\b/.test(t)
    || /\b(formation|kit|materiel|tenue|badge)\b[^.!?\n]{0,50}\b(a votre charge|a vos frais|a payer|a regler|payante?)\b/.test(t)
    || /\b(verser|payer|regler|avancer)\b[^.!?\n]{0,40}\b(caution|acompte|frais|somme)\b/.test(t)) {
    add("alerte", "On vous demande de payer",
      "Aucune somme ne peut être exigée d'un candidat pour obtenir un emploi ou un service de placement (Code du travail, art. L5321-3). C'est aussi le signe le plus courant d'une arnaque. Ne payez rien.");
  }
  if (/\b(envoy|transmet|communiqu|fourni)\w*[^.!?\n]{0,50}\b(rib|coordonnees bancaires|numero de carte|carte bancaire)\b/.test(t)
    || /\b(cheques? a encaisser|encaisser (un|des) cheques?|mandat cash|western union|reexpedi\w*|recevoir des colis|colis a (recevoir|renvoyer)|crypto ?monnaie|bitcoin|usdt)\b/.test(t)) {
    add("alerte", "Argent ou colis qui transitent par vous",
      "Encaisser des chèques, faire des virements pour un tiers ou réexpédier des colis : c'est le schéma des « mules » d'escroquerie, et vous en porteriez la responsabilité. Ne donnez vos coordonnées bancaires qu'après signature d'un contrat de travail.");
  }
  if (/\b(whatsapp|telegram)\b/.test(t)) {
    add("attention", "Contact par messagerie privée",
      "Une entreprise qui recrute passe d'habitude par un e-mail à son nom, un site carrières ou une plateforme d'emploi. Vérifiez l'adresse et le site de l'entreprise avant d'envoyer vos papiers.");
  }
  if (/\b(argent facile|revenus? (tres )?(eleves?|important)|gagne[rz]? jusqu a|complement de revenus? garanti)\b/.test(t)
    || /\b(\d[\d\s.]{2,})\s?(€|euros?)\s?(par|\/)\s?(jour|semaine)\b[^.!?\n]{0,80}\b(sans experience|depuis chez vous|a domicile)\b/.test(t)) {
    add("attention", "Gains très élevés promis",
      "De gros revenus « sans expérience » ou « depuis chez vous » sont un appât fréquent. Demandez le contrat, le nom de l'employeur et son numéro SIRET, puis vérifiez-le sur annuaire-entreprises.data.gouv.fr.");
  }

  /* ---------- critères qui posent question ---------- */
  const age = t.match(/\b(age (maximum|limite|maxi)|moins de \d{2} ans|pas plus de \d{2} ans|ne pas depasser \d{2} ans|entre \d{2} et \d{2} ans|\d{2} ans maximum|\d{2} ans max)\b/);
  if (age && !/\b(experience|anciennete|de pratique|permis|existence|entreprise|creee|fondee)\b/.test(t.slice(Math.max(0, age.index - 30), age.index + age[0].length + 25))) {
    if (alternance) add("info", "Condition d'âge",
      "Pour l'alternance, la loi fixe des âges (16 à 29 ans révolus pour l'apprentissage, avec des exceptions, par exemple en situation de handicap). Ce n'est pas une discrimination ici.");
    else add("attention", "Limite d'âge dans l'offre",
      "Une offre d'emploi ne peut pas fixer d'âge maximum (Code du travail, art. L5331-2), sauf cas prévus par la loi. Vous pouvez candidater quand même.");
  }
  if (/\b(jeunes? (homme|femme|fille|garcon)s?|(hommes?|femmes?) (uniquement|seulement|exclusivement)|reserve aux (hommes|femmes)|sans enfants?|celibataire)\b/.test(t)) {
    add("attention", "Critère de sexe ou de situation familiale",
      "Une offre ne doit mentionner ni le sexe ni la situation de famille du candidat (Code du travail, art. L1142-1), sauf rares exceptions (mannequin, comédien…).");
  }
  if (/\bnationalite francaise (exigee|obligatoire|requise|imperative)\b/.test(t)) {
    add("info", "Nationalité exigée",
      "Légal pour certains emplois publics ou de défense ; ailleurs, c'est une discrimination (art. L1132-1). Une autorisation de travail en France suffit pour la plupart des postes.");
  }

  /* ---------- stage, période d'essai, statut ---------- */
  if (STAGE.test(t) && /\b(non remunere|non gratifie|sans (gratification|remuneration)|pas de (gratification|remuneration)|benevole|non paye)\b/.test(t)) {
    const mois = maxMonths(t, /stage|duree|periode/);
    if (mois > 2) add("alerte", "Stage long sans gratification",
      `Un stage de plus de 2 mois doit être gratifié (Code de l'éducation, art. L124-6). Ici, ${mois} mois sont annoncés sans gratification.`);
    else add("info", "Stage non gratifié",
      "C'est légal jusqu'à 2 mois de stage. Au-delà, la gratification est obligatoire (Code de l'éducation, art. L124-6).");
  }
  const essai = t.match(/periode d essai[^.!?\n]{0,40}?(\d{1,2})\s*mois/);
  if (essai) {
    const n = Number(essai[1]);
    if (n > 8) add("alerte", `Période d'essai de ${n} mois`,
      "C'est au-delà du maximum légal, même renouvellement compris : 4 mois pour un ouvrier ou un employé, 6 pour un technicien ou un agent de maîtrise, 8 pour un cadre (Code du travail, art. L1221-19 et L1221-21).");
    else if (n > 4) add("attention", `Période d'essai de ${n} mois`,
      "Une période d'essai dure au plus 2 mois (ouvriers, employés), 3 mois (techniciens, agents de maîtrise) ou 4 mois (cadres). Elle peut être renouvelée une fois seulement si un accord de branche le prévoit. Faites-vous préciser la durée initiale.");
  }
  if (/\b(auto ?-?entrepreneur|micro ?-?entrepreneur|micro ?-?entreprise|statut (d )?independant|siret (exige|obligatoire|requis|indispensable)|n(°|o|umero) siret)\b/.test(t)) {
    add("attention", "Statut d'indépendant demandé",
      "Si l'entreprise vous impose horaires, lieu et consignes comme à un salarié, il s'agit en réalité d'un emploi salarié (on parle de salariat déguisé). Demandez un contrat de travail, ou faites-vous conseiller avant d'accepter.");
  }
  if (/\b(100 ?%|uniquement|exclusivement|seulement) (a la |sur |a )?commissions?\b|\bremuner\w* (uniquement |exclusivement )?(a la |sur )commission\b/.test(t)) {
    add("attention", "Payé uniquement à la commission",
      "Sans fixe, vous ne gagnez rien les mois sans vente. Un salarié doit toucher au moins le SMIC : demandez si un fixe est garanti.");
  }

  /* ---------- clarté ---------- */
  const salaire = /(\d[\d\s.,]*\s?(k ?)?(€|euros?\b|eur\b)|\bsmic\b|\bsalaire\s*:?\s*\d|\b\d{2}\s?k\b)/.test(t);
  const nonPaye = items.some((i) => i.titre.startsWith("Stage"));
  if (alternance && /\b(grille|du smic|% du smic|remuneration legale|selon l age)\b/.test(t)) add("ok", "Rémunération de l'alternance", "Elle suit un pourcentage du SMIC fixé par la loi, selon votre âge et votre année de contrat.");
  else if (salaire) add("ok", "Salaire indiqué", "Vous savez à quoi vous attendre avant l'entretien.");
  else if (!nonPaye) add("info", "Salaire non indiqué",
    /\b(selon (profil|experience)|a negocier|a definir|attractif|motivant)\b/.test(t)
      ? "« Selon profil » ou « attractif » ne dit rien du montant. Demandez la fourchette brute annuelle dès le premier échange."
      : "Demandez la fourchette brute annuelle dès le premier échange : c'est une question normale.");

  const contrat = t.match(/\b(cdi|cdd|interim|interimaire|mission d interim|stage|alternance|apprentissage|contrat de professionnalisation|freelance|vacation|saisonnier|temps partiel|temps plein|permanent|full ?-?time|part ?-?time|fixed ?-?term)\b/);
  if (!contrat) add("info", "Type de contrat non précisé", "CDI, CDD, intérim ? Demandez-le avant d'aller plus loin.");
  else if (/\bcdd\b/.test(t) && !maxMonths(t, /cdd|duree|mission|contrat/) && !/\b(\d+ (semaines?|jours))\b/.test(t))
    add("info", "Durée du CDD non indiquée", "Demandez la durée et la date de fin prévue.");

  const company = String(meta.company || "").trim();
  if (!company && /\b(notre client|nos clients|pour le compte (de|d un)|pour l un de nos clients|entreprise confidentielle|client final)\b/.test(t)) {
    add("info", "Employeur non nommé",
      "Normal pour un cabinet de recrutement ou une agence d'intérim. Demandez le nom de l'entreprise avant l'entretien, et vérifiez que l'agence existe.");
  }

  const mots = t.split(/\s+/).length;
  if (mots < 80) add("info", "Offre très courte", "Peu d'éléments sur les missions. Préparez vos questions : journée type, équipe, horaires.");
  if (englishShare(t) > 0.6) add("info", "Offre rédigée en anglais",
    "En France, une offre doit en principe être rédigée en français (Code du travail, art. L5331-4), sauf exceptions. Vérifiez la langue de travail réellement attendue.");

  const n = (tone) => items.filter((i) => i.tone === tone).length;
  const level = n("alerte") || n("attention") >= 3 ? "prudence" : n("attention") ? "verifier" : "clair";
  // Un « bon point » n'a pas sa place à côté d'une alerte.
  if (level === "prudence") for (let i = items.length - 1; i >= 0; i--) if (items[i].tone === "ok") items.splice(i, 1);
  const order = { alerte: 0, attention: 1, info: 2, ok: 3 };
  items.sort((a, b) => order[a.tone] - order[b.tone]);
  return { level, items };
}

export const LEVEL_TEXT = {
  clair: "Rien d'inquiétant repéré",
  verifier: "Des points à vérifier",
  prudence: "Prudence avec cette offre"
};

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ICON = { alerte: "!", attention: "?", info: "i", ok: "✓" };

/** Carte HTML, affichée en tête de l'onglet « Poste ». */
export function offerSignalsHtml(result) {
  if (!result?.items?.length) return "";
  const n = result.items.filter((i) => i.tone !== "ok").length;
  return `<section class="card offer-check" data-level="${result.level}" aria-labelledby="offer-check-title">
    <div class="offer-check-head"><h3 id="offer-check-title">L'offre en clair</h3><span class="offer-level">${esc(LEVEL_TEXT[result.level])}</span></div>
    <p class="muted small">${n ? `${n} repère${n > 1 ? "s" : ""} tiré${n > 1 ? "s" : ""} du texte de l'offre, calculé${n > 1 ? "s" : ""} sur votre appareil.` : "Repères tirés du texte de l'offre, calculés sur votre appareil."} Ce sont des points à vérifier, pas des accusations.</p>
    <ul class="offer-signals">${result.items.map((i) => `<li class="sig sig-${i.tone}"><span class="sig-ico" aria-hidden="true">${ICON[i.tone]}</span><div><b>${esc(i.titre)}</b><p>${esc(i.detail)}</p></div></li>`).join("")}</ul>
    <p class="muted small">Un doute sur une offre France Travail ? Signalez-la depuis la page de l'offre. Arnaque avérée : <a href="https://www.internet-signalement.gouv.fr" target="_blank" rel="noopener">internet-signalement.gouv.fr</a>.</p>
  </section>`;
}
