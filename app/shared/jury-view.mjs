// Rendu HTML du jury, des erreurs et des questions. Commun à l'extension et à l'appli mobile.
// Fonctions pures : elles renvoient du HTML échappé, le câblage des événements reste dans chaque interface.
import { JUDGES, PASS_MARK, juryLine, keywordForm } from "./jury-rules.mjs";

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/** Texte échappé avec les emplacements [À COMPLÉTER : …] surlignés. */
export const withTodos = (text) => esc(text).replace(/\[À COMPLÉTER\s*:[^\]]*\]/g, (m) => `<mark class="todo">${m}</mark>`);

const LEVEL = { obligatoire: "Obligatoire", souhaitee: "Souhaitée", atout: "Atout" };
const SEVERITY = { bloquant: "Bloquant", majeur: "Majeur", mineur: "Mineur" };
const FORM = { exact: ["Libellé exact", "ok"], autre: ["Autre formulation", "part"], absent: ["Absent", "gap"] };
/** « Aucun juge ne retient », « 1 juge sur 7 retient », « 3 juges sur 7 retiennent ». */
const keptBy = (n, total = 7) => (n ? `${n} juge${n > 1 ? "s" : ""} sur ${total} ${n > 1 ? "retiennent" : "retient"}` : "Aucun juge ne retient");
// Les notes et les verdicts ne changent pas ; seuls les mots évitent de décourager (« pas encore » plutôt que « rejeté »).
const verdictLabel = (judge, retenu) => (judge === "ats" ? (retenu ? "Passe le filtre" : "Filtre pas encore passé") : retenu ? "Retenu" : "Pas encore convaincu");

function atsDetails(j, correspondances) {
  const parts = [];
  if (Number.isFinite(j.couverture)) parts.push(`<p class="j-ats">Exigences obligatoires couvertes : <b>${j.couverture} %</b> (seuil : 70 %).${j.eliminatoires?.length ? ` Critère${j.eliminatoires.length > 1 ? "s" : ""} éliminatoire${j.eliminatoires.length > 1 ? "s" : ""} absent${j.eliminatoires.length > 1 ? "s" : ""} : <b>${j.eliminatoires.map(esc).join(", ")}</b>` : ""}</p>`);
  const items = (correspondances || []).filter((c) => c?.competence);
  if (items.length) {
    parts.push(`<ul class="kw" aria-label="Mots-clés de l'offre dans votre CV">${items.map((c) => {
      const [label, tone] = FORM[keywordForm(c)];
      return `<li class="kw-row"><span class="kw-key"><b>${esc(c.competence)}</b><small>${LEVEL[c.exigence] || ""}${c.eliminatoire ? ", éliminatoire" : ""}</small></span><i class="kw-state kw-${tone}">${label}</i>${c.preuve_cv ? `<span class="kw-cv">Dans votre CV : « ${esc(c.preuve_cv)} »</span>` : ""}</li>`;
    }).join("")}</ul>`);
  }
  return parts.join("");
}

/** Contenu de l'onglet « Jury ». `second` peut être absent (en cours) ou une erreur. */
export function juryHtml(jury, { second = null, secondState = "", correspondances = null, supposed = false } = {}) {
  if (!jury?.juges) return "";
  const after = new Map((second?.juges || []).map((j) => [j.juge, j]));
  const before = jury.retenus ?? jury.juges.filter((j) => j.note >= PASS_MARK).length;
  const total = jury.juges.length;
  const missing = JUDGES.filter((x) => !jury.juges.some((j) => j.juge === x.id));
  const dots = jury.juges.map((j) => {
    const a = after.get(j.juge); const ok = a ? a.retenu : j.retenu;
    return `<i class="jd ${ok ? "jd-ok" : "jd-out"}" title="${esc(JUDGES.find((x) => x.id === j.juge)?.short)} : ${ok ? "retenu" : "pas encore convaincu"}"></i>`;
  }).join("") + missing.map((x) => `<i class="jd jd-lock" title="${esc(x.short)} : avec Premium"></i>`).join("");
  const line = second?.juges ? `<p class="jury-line">${esc(juryLine(before, second, total))}</p>`
    : secondState === "error" ? `<p class="jury-line muted">Le second passage du jury n'a pas pu aboutir. Le premier verdict reste valable.</p>`
    : `<p class="jury-line pending"><span class="dot-pulse" aria-hidden="true"></span>Le jury relit votre CV corrigé…</p>`;
  const head = `<div class="jury-head">
      <div class="jury-score" aria-hidden="true"><b>${second?.juges ? second.retenus : before}</b><span>/${total}</span></div>
      <div class="jury-title"><h3>${second?.juges ? `${keptBy(second.retenus, total)} votre CV corrigé` : `${keptBy(before, total)} votre CV`}</h3>
      ${second?.juges && second.potentiel > second.retenus ? `<p class="jury-potential">Avec vos réponses aux questions : jusqu'à ${second.potentiel} sur ${total}.</p>` : ""}
      ${jury.poste_vise ? `<p class="jury-sub">${supposed ? "Poste visé supposé" : "Poste visé"} : ${esc(jury.poste_vise)}</p>` : ""}</div>
    </div>
    <p class="jury-intro">Ce jury est volontairement très exigeant : comme lors d'un vrai tri de candidatures, chaque juge cherche une raison de dire non. Une note basse n'est pas un échec : elle montre ce qui manque pour convaincre. Vos réponses aux questions peuvent faire changer plusieurs avis.</p>
    <div class="jury-dots" aria-hidden="true">${dots}</div>${line}`;
  const rows = jury.juges.map((j, i) => {
    const meta = JUDGES.find((x) => x.id === j.juge) || { name: j.juge, question: "" };
    const a = after.get(j.juge);
    const finalOk = a ? a.retenu : j.retenu;
    const notes = a ? `<span class="j-note" aria-label="${j.note} sur 10 avant, ${a.note} sur 10 après"><span class="j-before">${j.note}</span><span class="j-arrow" aria-hidden="true">→</span><b>${a.note}</b><small>/10</small></span>` : `<span class="j-note"><b>${j.note}</b><small>/10</small></span>`;
    const reasons = (j.raisons || []).map((r) => `<li><strong>${esc(r.titre)}</strong>${r.citation ? `<q>${esc(r.citation)}</q>` : ""}<p>${esc(r.explication)}</p></li>`).join("");
    const afterBlock = a ? `<div class="j-after"><span>Après réécriture : <b>${a.note}/10</b>, ${verdictLabel(j.juge, a.retenu).toLowerCase()}${a.potentiel > a.note ? `. Avec vos réponses : <b>${a.potentiel}/10</b> possible` : ""}.</span>${a.reste ? `<p>${esc(a.reste)}</p>` : ""}${a.questions?.length ? `<p class="j-q">Questions qui comptent pour ce juge : ${a.questions.map((q) => `<button type="button" class="q-link" data-question="${q}">${q}</button>`).join(" ")}</p>` : ""}</div>` : "";
    return `<li><details class="judge ${finalOk ? "is-ok" : "is-out"}">
      <summary><span class="j-num">${i + 1}</span><span class="j-name">${esc(meta.name)}</span>${notes}<span class="j-verdict">${verdictLabel(j.juge, finalOk)}</span></summary>
      <div class="j-body"><p class="j-question">${esc(meta.question)}</p>${j.juge === "ats" ? atsDetails(j, correspondances) : ""}<ul class="j-reasons">${reasons || `<li><p>Aucune raison retenue : les citations proposées ne figuraient pas dans votre CV.</p></li>`}</ul>${afterBlock}</div>
    </details></li>`;
  }).join("");
  const locked = missing.length ? `<div class="jury-locked"><p><strong>${missing.length} autres juges avec Premium</strong> : ${missing.map((x) => esc(x.short.toLowerCase())).join(", ")}. L'accès gratuit réunit le logiciel de tri et le recruteur, les deux premiers filtres d'une candidature.</p><button type="button" class="link-btn" data-open-premium>Voir Premium</button></div>` : "";
  return `<div class="jury">${head}<ol class="judges">${rows}</ol>${locked}${errorsHtml(jury.erreurs)}<p class="jury-note">Chaque juge cherche une raison de dire non. Ils peuvent se contredire : c'est voulu. Les verdicts sont calculés : 7/10 ou plus = retenu ; une erreur bloquante plafonne à 4 la note des juges qui l'ont relevée.</p></div>`;
}

export function errorsHtml(errors) {
  if (!errors?.length) return "";
  const groups = ["bloquant", "majeur", "mineur"].map((g) => [g, errors.filter((e) => e.gravite === g)]).filter(([, list]) => list.length);
  let n = 0;
  return `<section class="errors"><h3>Les points à corriger, du plus important au moins important</h3>${groups.map(([g, list]) => `<div class="err-group"><span class="sev sev-${g}">${SEVERITY[g]} (${list.length})</span><ol start="${n + 1}">${list.map((e) => { n++; return `<li class="err err-${g}"><span class="err-n" aria-hidden="true">${String(n).padStart(2, "0")}.</span><strong>${esc(e.titre)}</strong>${e.citation ? `<q>${esc(e.citation)}</q>` : ""}<p class="err-fix"><span>Correction</span>${esc(e.correction)}</p>${e.juges?.length ? `<span class="err-by">Relevé par ${e.juges.length > 1 ? "les juges" : "le juge"} ${e.juges.join(", ")}</span>` : ""}</li>`; }).join("")}</ol></div>`).join("")}</section>`;
}

/** Questions du CV réécrit + exigences de l'offre absentes du CV (sans doublon). */
export function buildQuestions(questions, correspondances) {
  const list = (questions || []).map((q) => ({ question: q.question, emplacement: q.emplacement || "", sujet: q.sujet || "detail" }));
  const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  for (const c of correspondances || []) {
    if (c.statut !== "absente" || list.length >= 14) continue;
    if (list.some((q) => fold(q.question).includes(fold(c.competence)))) continue;
    list.push({ question: `L'offre demande « ${c.competence} »${c.eliminatoire ? " (critère éliminatoire)" : ""}. L'avez-vous déjà fait ou utilisé ? Si oui, où et comment ?`, emplacement: "", sujet: "competence" });
  }
  return list;
}

export function questionsHtml(list, { remaining = 2, busy = false, keyQuestions = [] } = {}) {
  if (!list?.length) return "";
  return `<section class="qa" aria-labelledby="qa-title"><h3 id="qa-title">Questions pour vous</h3>
    <p class="qa-intro">Répondez seulement par ce qui est vrai : vos réponses sont ajoutées au CV, puis le jury le relit. Laissez vide ce qui ne vous concerne pas.</p>
    <ol class="qa-list">${list.map((q, i) => `<li id="question-${i + 1}" class="${keyQuestions.includes(i + 1) ? "qa-key" : ""}"><label><span class="qa-q">${keyQuestions.includes(i + 1) ? `<i class="qa-badge">Rapporte le plus</i>` : ""}${esc(q.question)}</span><textarea rows="2" data-qa="${i}" maxlength="600" ${busy ? "disabled" : ""}></textarea></label></li>`).join("")}</ol>
    <label class="qa-keep"><input type="checkbox" data-qa-keep checked ${busy ? "disabled" : ""}> Ajouter aussi ces précisions à mon CV enregistré</label>
    <button type="button" class="btn btn-primary btn-block" data-qa-submit ${busy || remaining <= 0 ? "disabled" : ""}>${busy ? "Le jury relit votre CV complété…" : "Compléter mon CV"}</button>
    <p class="qa-status" data-qa-status role="status" aria-live="polite">${remaining <= 0 ? "Vous avez complété ce CV deux fois : relancez une analyse pour aller plus loin." : ""}</p></section>`;
}

/** Réponses saisies, prêtes à envoyer (texte brut) — la pseudonymisation est faite par l'appelant. */
export function collectAnswers(root, list) {
  return [...root.querySelectorAll("textarea[data-qa]")].map((t) => ({ question: list[Number(t.dataset.qa)]?.question || "", reponse: t.value.trim() })).filter((a) => a.question && a.reponse);
}

/** Texte à ajouter au CV enregistré quand le candidat garde ses précisions. */
export function answersAsCvText(answers) {
  return answers.length ? `\n\nPRÉCISIONS\n${answers.map((a) => `- ${a.question.replace(/\s+/g, " ").trim()} ${a.reponse}`).join("\n")}` : "";
}

/** Retire les emplacements [À COMPLÉTER : …] sans rien inventer à leur place (pour exporter tel quel). */
export function stripTodos(value) {
  if (typeof value === "string") return value.replace(/\s*\(\s*\[À COMPLÉTER\s*:[^\]]*\]\s*\)/g, "").replace(/\s*\[À COMPLÉTER\s*:[^\]]*\]/g, "").replace(/\s{2,}/g, " ").replace(/\s+([,.;:)])/g, "$1").trim();
  if (Array.isArray(value)) return value.map(stripTodos).filter((v) => v !== "");
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stripTodos(v)]));
  return value;
}
