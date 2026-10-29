// Juste — appli mobile (iPhone, iPad, Android). Même cœur que l'extension :
// le CV reste sur l'appareil, il est pseudonymisé avant envoi, les preuves sont vérifiées.
import { pseudonymize } from "./shared/privacy.mjs";
import { reviewCv, groundSourceSections } from "./shared/cv-review.mjs";
import { highlightHtml } from "./shared/highlight.mjs";
import { joinPdfItems } from "./shared/pdf-text.mjs";
import { parseIncomingJob, buildShareScript } from "./incoming.mjs";
import { alignScore } from "./shared/match-score.mjs";
import { juryHtml, buildQuestions, questionsHtml, collectAnswers, answersAsCvText, withTodos, stripTodos } from "./shared/jury-view.mjs";
import { countPlaceholders } from "./shared/jury-rules.mjs";
import { cvSearchTerms, rankOffers } from "./shared/job-fit.mjs";

const SETTINGS = window.LARPEUR_APP || {};
const API = (SETTINGS.apiBase || "http://localhost:3000").replace(/\/$/, "");
const APP_URL = new URL(".", location.href).href;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- stockage local (peut être indisponible : navigation privée) ---------- */
const store = {
  get(key) { try { return JSON.parse(localStorage.getItem("larpeur." + key)); } catch { return null; } },
  set(key, value) { try { localStorage.setItem("larpeur." + key, JSON.stringify(value)); return true; } catch { return false; } },
  del(key) { try { localStorage.removeItem("larpeur." + key); } catch {} }
};
const session = {
  get(key) { try { return JSON.parse(sessionStorage.getItem("larpeur." + key)); } catch { return null; } },
  set(key, value) { try { sessionStorage.setItem("larpeur." + key, JSON.stringify(value)); } catch {} },
  del(key) { try { sessionStorage.removeItem("larpeur." + key); } catch {} }
};

const state = { profile: store.get("profile"), creds: store.get("creds"), me: null, result: null, job: null, analyzing: false, cvPending: false, matchFound: new Set() };

/* ---------- vues ---------- */
function show(name) {
  document.querySelectorAll(".view").forEach((v) => { v.hidden = v.id !== "v-" + name; });
  document.body.dataset.view = name;
  $("go-profile").hidden = !profileReady() || name === "setup";
  window.scrollTo({ top: 0, behavior: "instant" });
}
document.addEventListener("click", (event) => {
  const go = event.target.closest("[data-go]");
  if (!go) return;
  event.preventDefault();
  const target = go.dataset.go;
  if (target === "home") return profileReady() ? goHome() : openSetup();
  if (target === "guide") { renderGuide(); show("guide"); }
  if (target === "jobs") { if (!profileReady()) return openSetup(); openJobs(go.dataset.mode || jobs.mode); }
});
$("go-profile").addEventListener("click", () => openSetup());

function toast(text) {
  const t = $("toast"); t.textContent = text; t.hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.hidden = true; }, 2200);
}

/* ---------- accès au serveur ---------- */
async function ensureAccess() {
  if (state.creds?.token && state.creds.base === API) return;
  const r = await fetch(API + "/api/device", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || "Inscription impossible"), { status: r.status, data });
  state.creds = { base: API, uid: data.uid, token: data.token };
  store.set("creds", state.creds);
}
async function api(path, body, retried = false) {
  await ensureAccess();
  let r;
  try {
    r = await fetch(API + path, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + state.creds.token },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout ? AbortSignal.timeout(110_000) : undefined
    });
  } catch { throw Object.assign(new Error("Serveur injoignable. Vérifiez votre connexion."), { status: 0 }); }
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && !retried) { state.creds = null; store.del("creds"); return api(path, body, true); }
  if (!r.ok) throw Object.assign(new Error(data.error || "Erreur serveur"), { status: r.status, data });
  return data;
}
async function refreshMe() {
  try { state.me = await api("/api/me"); renderQuota(); } catch {}
}
function quotaText() {
  const m = state.me; if (!m) return "";
  if (m.premium) { const left = m.remaining ?? 0; return `Premium : ${left} analyse${left > 1 ? "s" : ""} restante${left > 1 ? "s" : ""} sur 30 jours`; }
  const n = m.remaining ?? 0;
  return n > 0 ? `${n} analyse${n > 1 ? "s" : ""} gratuite${n > 1 ? "s" : ""} restante${n > 1 ? "s" : ""}` : "Quota gratuit utilisé, il se renouvelle automatiquement";
}
function renderQuota() {
  const text = quotaText();
  $("home-quota").textContent = text; $("result-quota").textContent = text;
  const pill = $("quota-pill");
  if (state.me && !state.me.premium) { pill.hidden = false; pill.textContent = `${state.me.remaining ?? 0} restante${(state.me.remaining ?? 0) > 1 ? "s" : ""}`; }
  else pill.hidden = true;
}

/* ---------- profil ---------- */
function profileReady(profile = state.profile) {
  return !!profile?.cv && profile.cv.trim().length >= 80 && !reviewCv(profile.cv).incomplete;
}
const SECTIONS = {
  exp: /(exp[ée]rience|emploi|poste|stage|alternance|mission|job|vendeu|serveu|employ)/i,
  form: /(formation|dipl[ôo]me|bts|bac|licence|bachelor|master|cap|but|dut|[ée]cole|lyc[ée]e|universit)/i,
  comp: /(comp[ée]tence|skills|outils|logiciel|excel|word|ma[iî]trise|savoir)/i,
  lang: /(langue|anglais|espagnol|allemand|italien|fran[çc]ais|english|b1|b2|c1|toeic)/i
};
function updateQuality() {
  const cv = $("cv").value.trim(), len = cv.length;
  $("chars").textContent = String(len);
  const found = Object.fromEntries(Object.entries(SECTIONS).map(([k, re]) => [k, re.test(cv)]));
  document.querySelectorAll("[data-check]").forEach((el) => el.classList.toggle("ok", found[el.dataset.check]));
  const lenScore = len < 80 ? len / 80 * 15 : len < 400 ? 15 + (len - 80) / 320 * 25 : len <= 6000 ? 40 : len <= 12000 ? 35 : 15;
  const quality = Math.round(Math.min(100, lenScore + Object.values(found).filter(Boolean).length * 15));
  $("meter").style.width = quality + "%";
  $("meter").dataset.level = quality >= 75 ? "good" : quality >= 45 ? "mid" : "low";
  document.querySelector('[data-step="cv"]').classList.toggle("done", len >= 80 && found.exp && found.form);
  document.querySelector('[data-step="contact"]').classList.toggle("done", $("name").value.trim().length >= 3);
}
["cv", "name", "city", "email", "phone"].forEach((id) => $(id).addEventListener("input", updateQuality));

function openSetup() {
  const p = state.profile || {};
  for (const id of ["name", "city", "email", "phone", "cv"]) $(id).value = p[id] || "";
  const pending = session.get("pendingJob");
  $("setup-pending").hidden = !pending;
  if (pending) $("setup-pending").innerHTML = `<b>Offre reçue :</b> ${esc(pending.title || "offre d'emploi")}. Ajoutez votre CV, l'analyse démarre juste après.`;
  $("setup-title").textContent = profileReady() ? "Votre CV" : "Ajoutez votre CV une fois.";
  $("save").textContent = pending ? "Enregistrer et analyser l'offre" : profileReady() ? "Enregistrer les modifications" : "Enregistrer mon CV";
  $("setup-status").textContent = "";
  updateQuality();
  show("setup");
}

let pdfjs = null;
// pdf.js utilise Promise.withResolvers (Safari 17.4) et Promise.try (Safari 18.2).
// Sur un iPhone ou un iPad plus ancien, on les ajoute et on lit le PDF sans
// processus séparé (un CV fait au plus 6 pages : c'est rapide).
export function polyfillPromises() {
  let added = false;
  if (typeof Promise.withResolvers !== "function") {
    added = true;
    Promise.withResolvers = function withResolvers() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
  }
  if (typeof Promise.try !== "function") {
    added = true;
    Promise.try = function tryCall(fn, ...args) { return new Promise((resolve) => resolve(fn(...args))); };
  }
  return added;
}
async function loadPdfjs() {
  const legacy = polyfillPromises();
  const lib = await import("./vendor/pdf.min.mjs");
  lib.GlobalWorkerOptions.workerSrc = new URL("vendor/pdf.worker.min.mjs", location.href).href;
  if (legacy) globalThis.pdfjsWorker = await import("./vendor/pdf.worker.min.mjs");
  return lib;
}
async function readFile(file) {
  if (file.size > 25 * 1024 * 1024) throw new Error("Le fichier dépasse 25 Mo.");
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    if (!pdfjs) pdfjs = await loadPdfjs();
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    try {
      if (doc.numPages > 6) throw new Error(`Ce PDF contient ${doc.numPages} pages. Gardez les 6 premières au maximum.`);
      let out = "";
      for (let i = 1; i <= doc.numPages; i++) {
        $("setup-status").textContent = `Lecture du PDF… page ${i}/${doc.numPages}`;
        const page = await doc.getPage(i);
        out += joinPdfItems((await page.getTextContent()).items) + "\n\n";
      }
      if (out.replace(/\s/g, "").length < 80) throw new Error("Ce PDF semble scanné (image). Collez plutôt le texte de votre CV, ou importez-le depuis un ordinateur avec l'extension.");
      return out;
    } finally { await doc.destroy(); }
  }
  if (name.endsWith(".docx")) {
    if (!window.mammoth) throw new Error("Lecteur Word indisponible. Rechargez la page.");
    return (await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
  }
  if (name.endsWith(".txt") || name.endsWith(".md") || file.type.startsWith("text/")) return await file.text();
  throw new Error("Format non pris en charge. Utilisez un PDF, un fichier Word (.docx) ou du texte.");
}
$("file").addEventListener("change", async () => {
  const file = $("file").files[0];
  if (!file) return;
  $("drop").classList.add("reading"); $("save").disabled = true;
  $("setup-status").textContent = "Lecture du fichier…"; $("setup-status").dataset.tone = "busy";
  try {
    const text = (await readFile(file)).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    if (text.length < 80) throw new Error("Le texte récupéré est trop court. Collez le texte à la main.");
    $("cv").value = text; updateQuality();
    $("setup-status").textContent = "CV lu. Vérifiez le texte, puis enregistrez."; $("setup-status").dataset.tone = "ok";
  } catch (e) {
    $("setup-status").textContent = e.message || "Impossible de lire ce fichier."; $("setup-status").dataset.tone = "error";
  } finally { $("drop").classList.remove("reading"); $("save").disabled = false; $("file").value = ""; }
});

$("save").addEventListener("click", () => {
  const profile = Object.fromEntries(["name", "city", "email", "phone", "cv"].map((id) => [id, $(id).value.trim()]));
  if (profile.cv.length < 80) { $("setup-status").textContent = "Le CV est trop court : ajoutez vos expériences, formations et compétences."; $("setup-status").dataset.tone = "error"; return; }
  if (profile.cv.length > 12000) { $("setup-status").textContent = "Le CV dépasse 12 000 caractères : condensez-le."; $("setup-status").dataset.tone = "error"; return; }
  const review = reviewCv(profile.cv);
  if (review.incomplete) { $("setup-status").textContent = review.message; $("setup-status").dataset.tone = "error"; return; }
  if (!store.set("profile", profile)) { $("setup-status").textContent = "Impossible d'enregistrer sur cet appareil (navigation privée ?)."; $("setup-status").dataset.tone = "error"; return; }
  state.profile = profile;
  const pending = session.get("pendingJob");
  if (pending) { session.del("pendingJob"); runAnalysis(pending); }
  else { goHome(); toast("CV enregistré"); }
});

/* ---------- accueil ---------- */
function goHome() {
  const first = (state.profile?.name || "").split(/\s+/)[0];
  $("home-hello").textContent = first ? `Bonjour ${first}` : "Bonjour";
  $("last-result").hidden = !store.get("last")?.result;
  show("home"); renderQuota(); refreshMe();
}
$("analyze-paste").addEventListener("click", () => {
  const text = $("paste").value.trim();
  if (text.length < 150) { $("paste-status").textContent = "Collez l'offre complète : au moins quelques lignes de description."; $("paste-status").dataset.tone = "error"; return; }
  $("paste-status").textContent = "";
  runAnalysis({ title: text.split("\n")[0].slice(0, 120), company: "", location: "", text: text.slice(0, 30000), host: "texte collé", url: "" });
});
$("last-result").addEventListener("click", () => {
  const last = store.get("last"); if (!last?.result) return;
  state.result = last.result; state.job = last.job;
  renderResult(state.result, state.job); show("result");
  if (!state.result.cv_adapte) setCvPending(false, "Il n'avait pas été terminé. Relancez l'analyse de cette offre.");
  if (!state.result.jury && !state.result.juryState) { state.result.juryState = "missing"; renderJury(state.result); }
});

/* ---------- offres France Travail ---------- */
const jobs = { mode: "cv", offers: [], shown: 0, busy: false };
const JOBS_PAGE = 10;
function setJobsMode(mode) {
  jobs.mode = mode === "cible" ? "cible" : "cv";
  const saved = store.get("jobs") || {};
  for (const b of document.querySelectorAll("[data-jobs-mode]")) { const on = b.dataset.jobsMode === jobs.mode; b.setAttribute("aria-selected", String(on)); b.classList.toggle("active", on); }
  const cv = jobs.mode === "cv";
  $("jobs-terms-label").textContent = cv ? "Métiers tirés de votre CV" : "Les métiers que vous visez";
  $("jobs-terms-help").textContent = cv ? "Séparés par des virgules, trois au plus. Modifiez-les si besoin." : "Par exemple : chef d'équipe logistique. Juste montre ce que votre CV a déjà, et ce qu'il vous manque pour y arriver.";
  $("jobs-terms").placeholder = cv ? "Vendeuse, assistante logistique" : "Chef d'équipe logistique";
  $("jobs-terms").value = cv ? (saved.cvTerms || cvSearchTerms(state.profile?.cv || "").join(", ")) : (saved.cible || "");
  $("jobs-dep").value = saved.dep || "";
  $("jobs-list").innerHTML = ""; $("jobs-status").textContent = ""; $("jobs-more").hidden = true;
}
function openJobs(mode) { setJobsMode(mode); show("jobs"); }
document.querySelector(".seg").addEventListener("click", (event) => { const b = event.target.closest("[data-jobs-mode]"); if (b) setJobsMode(b.dataset.jobsMode); });
const fitClass = (s) => (s >= 50 ? "fit-high" : s >= 25 ? "fit-mid" : "fit-low");
const shortDate = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" }); };
function jobCard(o, i) {
  const f = o.fit; const cible = jobs.mode === "cible";
  const meta = [o.contract, o.duration, o.experience, o.date ? `publiée le ${shortDate(o.date)}` : ""].filter(Boolean).map(esc).join(", ");
  const chips = (list, cls) => list.map((t) => `<span class="${cls}">${esc(t)}</span>`).join("");
  return `<li class="card job-card">
    <div class="jc-head"><div class="jc-title"><h3>${esc(o.title)}</h3><p class="muted small">${[o.company, o.location].filter(Boolean).map(esc).join(", ")}</p></div>
    <span class="jc-fit ${fitClass(f.score)}">${esc(f.level)}</span></div>
    <div class="jc-bar" role="img" aria-label="Proximité avec votre CV : ${f.score} sur 100"><i style="width:${Math.max(4, f.score)}%"></i></div>
    ${meta ? `<p class="jc-meta">${meta}</p>` : ""}${o.salary ? `<p class="jc-meta">${esc(o.salary)}</p>` : ""}
    ${f.common.length ? `<p class="jc-label">Déjà dans votre CV</p><div class="jc-chips">${chips(f.common, "jc-ok")}</div>` : ""}
    ${f.missing.length ? `<p class="jc-label">${cible ? "Pour y arriver" : "À acquérir ou à préciser"}</p><div class="jc-chips">${chips(f.missing.slice(0, cible ? 8 : 5), "jc-gap")}</div>` : ""}
    <div class="jc-actions"><button type="button" class="btn btn-primary btn-sm" data-job="${i}">Analyser</button><a class="btn btn-ghost btn-sm" href="${esc(o.url)}" target="_blank" rel="noopener">Voir l'offre</a></div>
  </li>`;
}
function renderJobs() {
  const next = jobs.offers.slice(jobs.shown, jobs.shown + JOBS_PAGE);
  $("jobs-list").insertAdjacentHTML("beforeend", next.map((o, k) => jobCard(o, jobs.shown + k)).join(""));
  jobs.shown += next.length;
  $("jobs-more").hidden = jobs.shown >= jobs.offers.length;
}
$("jobs-more").addEventListener("click", renderJobs);
$("jobs-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (jobs.busy) return;
  const terms = $("jobs-terms").value.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 3);
  if (!terms.length) { $("jobs-status").textContent = jobs.mode === "cv" ? "Indiquez au moins un métier." : "Indiquez le métier que vous visez."; $("jobs-terms").focus(); return; }
  const dep = $("jobs-dep").value.trim();
  const saved = store.get("jobs") || {};
  store.set("jobs", { ...saved, dep, ...(jobs.mode === "cv" ? { cvTerms: terms.join(", ") } : { cible: terms.join(", ") }) });
  jobs.busy = true; $("jobs-search").disabled = true; $("jobs-search").textContent = "Recherche en cours…";
  $("jobs-status").textContent = ""; $("jobs-list").innerHTML = ""; $("jobs-more").hidden = true;
  try {
    const data = await api(`/api/jobs?q=${encodeURIComponent(terms.join(","))}&dep=${encodeURIComponent(dep)}`);
    jobs.offers = rankOffers(state.profile?.cv || "", data.offers || []); jobs.shown = 0;
    const where = data.departement ? ` dans le ${data.departement}` : " en France";
    $("jobs-status").textContent = jobs.offers.length ? `${jobs.offers.length} offre${jobs.offers.length > 1 ? "s" : ""}${where}, de la plus proche à la moins proche de votre CV. La proximité est une estimation rapide sur les mots : l'analyse donne le vrai score.` : `Aucune offre trouvée${where}. Essayez un autre métier ou un autre département.`;
    renderJobs();
  } catch (e) {
    $("jobs-status").textContent = e.data?.code === "jobs_unconfigured" ? "La recherche d'offres n'est pas encore activée : le serveur a besoin de ses identifiants France Travail." : e.message;
  } finally { jobs.busy = false; $("jobs-search").disabled = false; $("jobs-search").textContent = "Chercher des offres"; }
});
$("jobs-list").addEventListener("click", (event) => {
  const b = event.target.closest("[data-job]"); if (!b) return;
  const o = jobs.offers[Number(b.dataset.job)]; if (!o) return;
  const text = [o.text, o.skills?.length ? `Compétences demandées : ${o.skills.join(", ")}.` : "", o.experience ? `Expérience : ${o.experience}.` : ""].filter(Boolean).join("\n\n");
  runAnalysis({ title: o.title, company: o.company, location: o.location, text, host: o.host || "francetravail.fr", url: o.url });
});

/* ---------- analyse ---------- */
let stepTimer;
function playSteps() {
  const items = [...$("steps").children]; let i = 0;
  items.forEach((li) => (li.className = "")); items[0].className = "doing";
  clearInterval(stepTimer);
  stepTimer = setInterval(() => { if (i < items.length - 1) { items[i].className = "done"; items[++i].className = "doing"; } }, 2200);
}
async function runAnalysis(job) {
  if (state.analyzing) return;
  // Sans offre (job absent) : le jury juge le CV contre les attentes habituelles du métier.
  if (!job) job = { title: "Mon CV, sans offre", company: "", location: "", text: "", host: "", url: "", juryOnly: true };
  if (!profileReady()) { if (!job.juryOnly) session.set("pendingJob", job); return openSetup(); }
  state.analyzing = true; state.job = job;
  $("loading-job").textContent = job.juryOnly ? "Le jury lit votre CV…" : job.title ? job.title : "Lecture de l'offre…";
  show("loading"); playSteps();
  try {
    const p = state.profile;
    const cv = pseudonymize(p.cv, p);
    const data = await api("/api/analyze", job.juryOnly ? { cv, progressive: true, mode: "jury" } : { cv, progressive: true, job: { title: job.title, company: job.company, location: job.location, text: job.text, host: job.host } });
    const pendingCv = data.cvPending; delete data.cvPending;
    if (pendingCv) { data.analysisId = pendingCv; data.analysisAt = Date.now(); }
    state.me = { remaining: data.remaining, premium: data.premium, resetAt: data.resetAt };
    state.result = data;
    store.set("last", { result: data, job, at: Date.now() });
    renderResult(data, job); show("result"); renderQuota();
    if (pendingCv) { loadAdaptedCv(pendingCv, data); if (!data.jury) loadJury(pendingCv, data); loadSecond(pendingCv, data); }
  } catch (e) {
    if (e.status === 429 && e.data?.code === "quota_exhausted") {
      state.me = e.data; renderQuota();
      showError("Votre quota gratuit est utilisé", "Il se renouvelle automatiquement. Vous pouvez revoir votre dernier résultat depuis l'accueil.");
    } else if (e.data?.code === "cv_incomplete") {
      openSetup(); $("setup-status").textContent = e.data.error; $("setup-status").dataset.tone = "error";
    } else showError(e.status ? "L'analyse n'a pas pu aboutir" : "Serveur injoignable", e.message || "Réessayez dans un instant.");
  } finally { state.analyzing = false; clearInterval(stepTimer); }
}
function showError(title, message) { $("err-title").textContent = title; $("err-msg").textContent = message; show("error"); }

function setCvPending(pending, failed = "") {
  state.cvPending = pending;
  $("print-cv").disabled = pending || !!failed; $("copy-cv").disabled = pending || !!failed;
  if (pending) $("cv-paper").innerHTML = `<div class="cv-wait" role="status"><strong><span class="cv-wait-dot" aria-hidden="true"></span>Votre CV adapté se prépare…</strong><span>Quelques secondes. Parcourez vos atouts et vos pistes en attendant.</span><i></i><i></i><i></i></div>`;
  else if (failed) $("cv-paper").innerHTML = `<div class="cv-wait failed" role="alert"><strong>Le CV adapté n'a pas pu être préparé.</strong><span>${esc(failed)}</span></div>`;
}
async function loadAdaptedCv(id, data) {
  setCvPending(true);
  try {
    const part = await api(`/api/analyze/${encodeURIComponent(id)}/cv`);
    if (state.result !== data) return;
    data.cv_adapte = part.cv_adapte; data.questions = part.questions || [];
    const adjusted = (data.guard?.adjusted || 0) + (part.guard?.adjusted || 0);
    data.guard = { removed: part.guard?.removed || 0, ...(adjusted ? { adjusted } : {}) };
    groundSourceSections(data.cv_adapte, state.profile.cv);
    setCvPending(false); renderCv(data.cv_adapte, data.guard); renderQuestions(data);
    store.set("last", { result: data, job: state.job, at: Date.now() });
  } catch (e) {
    if (state.result === data) setCvPending(false, e.data?.error || "Relancez l'analyse pour réessayer.");
  }
}

/* ---------- rendu du résultat ---------- */
const scoreColor = (s) => (s >= 75 ? "var(--ok)" : s >= 50 ? "var(--honey)" : "var(--rose)");
const scoreLabel = (s) => (s >= 85 ? "Très belle correspondance" : s >= 70 ? "Des atouts pour cette offre" : s >= 50 ? "Une candidature à affiner" : s >= 30 ? "Des pistes à explorer" : "Un parcours à mieux relier");
function animateNumber(node, target, duration) {
  if (reduced()) { node.textContent = target; return; }
  const start = performance.now();
  const step = (now) => { const t = Math.min(1, (now - start) / duration); node.textContent = String(Math.round(target * (1 - Math.pow(1 - t, 3)))); if (t < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function renderResult(d, job) {
  const juryOnly = d.mode === "jury";
  $("v-result").classList.toggle("jury-only", juryOnly);
  document.querySelectorAll('.tabs button[data-tab="forts"], .tabs button[data-tab="ecarts"], .tabs button[data-tab="cible"]').forEach((b) => { b.hidden = juryOnly; });
  document.querySelector(".score-card").hidden = juryOnly;
  renderJury(d); renderQuestions(d);
  if (juryOnly) {
    $("match").hidden = true;
    if (d.cv_adapte) { groundSourceSections(d.cv_adapte, state.profile?.cv || ""); setCvPending(false); renderCv(d.cv_adapte, d.guard || {}); } else setCvPending(true);
    activateTab("jury");
    return;
  }
  alignScore(d);
  if (d.cv_adapte) groundSourceSections(d.cv_adapte, state.profile?.cv || "");
  const s = Math.max(0, Math.min(100, Math.round(d.score || 0)));
  const bar = $("ring-bar");
  bar.style.transition = "none"; bar.style.strokeDashoffset = "163.36"; bar.style.stroke = scoreColor(s);
  requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transition = ""; bar.style.strokeDashoffset = String(163.36 * (1 - s / 100)); animateNumber($("score"), s, 1000); }));
  $("score-label").textContent = scoreLabel(s); $("score-label").style.color = scoreColor(s);
  document.querySelector(".score-card").style.setProperty("--score", String(s));
  $("result-job").innerHTML = [job?.title, job?.company].filter(Boolean).map(esc).join(", ") + (job?.url ? `<br><a href="${esc(job.url)}" target="_blank" rel="noopener">Ouvrir l'offre</a>` : "");
  $("resume").textContent = d.resume_match || "";

  const forts = $("tab-forts"); forts.innerHTML = "";
  (d.points_forts || []).forEach((x, i) => forts.insertAdjacentHTML("beforeend", `
    <div class="item fort" style="animation-delay:${0.06 * i}s"><span class="item-k">Atout ${String(i + 1).padStart(2, "0")}</span><p class="item-t">${esc(x.point)}</p>
    ${x.preuve_cv ? `<p class="proof"><span>Dans votre CV</span><mark>${esc(x.preuve_cv)}</mark></p>` : ""}</div>`));
  if (!d.points_forts?.length) forts.innerHTML = `<p class="muted center">Pas encore de correspondance suffisamment étayée. Décrivez vos missions et projets réels dans votre CV.</p>`;
  $("count-forts").textContent = String(d.points_forts?.length || 0);

  const gaps = $("tab-ecarts"); gaps.innerHTML = "";
  (d.ecarts || []).forEach((x, i) => gaps.insertAdjacentHTML("beforeend", `
    <div class="item gap" style="animation-delay:${0.06 * i}s"><span class="item-k">Piste ${String(i + 1).padStart(2, "0")}</span><p class="item-t">${esc(x.ecart)}</p><p class="advice">${esc(x.conseil)}</p>
    ${x.preuve_offre ? `<details class="req"><summary>Voir l'attente dans l'offre</summary><p>${esc(x.preuve_offre)}</p></details>` : ""}
    <span class="pill pill-${x.type === "structurel" ? "rose" : x.type === "information" ? "amber" : "mint"}">${x.type === "structurel" ? "Écart de parcours" : x.type === "information" ? "À préciser dans votre CV" : "À développer"}</span></div>`));
  if (!d.ecarts?.length) gaps.innerHTML = `<p class="muted center">Aucun écart signalé. Relisez les exigences de l'offre avant de candidater.</p>`;
  gaps.insertAdjacentHTML("beforeend", `<p class="muted small">Une information absente du CV n'est pas forcément une compétence absente de votre parcours. Précisez uniquement ce que vous avez réellement fait.</p>`);
  $("count-ecarts").textContent = String(d.ecarts?.length || 0);

  const pc = d.profil_cible || {};
  $("tab-cible").innerHTML = `<div class="card persona"><h3>${esc(pc.titre || "Profil attendu")}</h3><p class="muted">${esc(pc.resume || "")}</p>
    ${pc.competences_cles?.length ? `<div class="chips">${pc.competences_cles.map((c) => `<span>${esc(c)}</span>`).join("")}</div>` : ""}
    ${pc.experiences_types?.length ? `<ul>${pc.experiences_types.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : ""}
    <p class="muted small">Exemple synthétique généré par IA pour comprendre les attentes de l'offre.</p></div>`;

  renderMatch(d);
  if (d.cv_adapte) { setCvPending(false); renderCv(d.cv_adapte, d.guard || {}); } else setCvPending(true);
  activateTab("forts");
}

function renderCv(cv, guard) {
  const p = state.profile || {};
  const parts = [`<header><h3>${esc(p.name || "")}</h3><p>${esc([p.city, p.email, p.phone].filter(Boolean).join(" · "))}</p></header>`];
  if (cv.titre) parts.push(`<p class="cv-title">${withTodos(cv.titre)}</p>`);
  if (cv.accroche) parts.push(`<p class="cv-hook">${withTodos(cv.accroche)}</p>`);
  if (cv.experiences?.length) parts.push(`<h4>Expériences</h4>` + cv.experiences.map((x) => `<div class="cv-entry"><div class="cv-row"><b>${esc(x.poste)}${x.entreprise ? " — " + esc(x.entreprise) : ""}</b><small>${esc(x.periode || "")}</small></div>${x.puces?.length ? `<ul>${x.puces.map((b) => `<li>${withTodos(b)}</li>`).join("")}</ul>` : ""}</div>`).join(""));
  if (cv.formations?.length) parts.push(`<h4>Formation</h4>` + cv.formations.map((x) => `<div class="cv-entry"><div class="cv-row"><b>${esc(x.intitule)}${x.etablissement ? " — " + esc(x.etablissement) : ""}</b><small>${esc(x.periode || "")}</small></div>${x.detail ? `<p>${withTodos(x.detail)}</p>` : ""}</div>`).join(""));
  if (cv.competences?.length) parts.push(`<h4>Compétences</h4><p>${cv.competences.map(esc).join(" · ")}</p>`);
  if (cv.langues?.length) parts.push(`<h4>Langues</h4><p>${cv.langues.map(esc).join(" · ")}</p>`);
  if (cv.autres?.length) parts.push(`<h4>Informations complémentaires</h4><ul>${cv.autres.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>`);
  if (guard?.removed > 0) parts.push(`<p class="cv-note">${guard.removed} élément${guard.removed > 1 ? "s" : ""} retiré${guard.removed > 1 ? "s" : ""} car introuvable${guard.removed > 1 ? "s" : ""} dans votre CV d'origine.</p>`);
  $("cv-paper").innerHTML = parts.join("");
  const todos = countPlaceholders(cv);
  $("cv-todo").hidden = !todos;
  $("cv-todo").innerHTML = todos ? `<span aria-hidden="true">✎</span><span>Il reste <b>${todos} information${todos > 1 ? "s" : ""} à compléter</b>, en orange. Répondez aux questions sous le CV : rien n'a été inventé à votre place.<br><button type="button" class="btn btn-ghost btn-sm" data-strip-todos>Les retirer pour exporter tel quel</button></span>` : "";
}

/* ---------- correspondance CV / offre (même rendu que l'extension) ---------- */
const LEVEL = { obligatoire: "Obligatoire", souhaitee: "Souhaitée", atout: "Atout" };
const LEVEL_RANK = { obligatoire: 0, souhaitee: 1, atout: 2 };
function renderMatch(d) {
  const items = (d.correspondances || []).map((c, i) => ({ ...c, i }));
  $("match").hidden = !items.length; $("match-detail").hidden = true;
  if (!items.length) return;
  const detail = d.score_detail;
  $("match-method").hidden = !detail;
  if (detail) $("match-method").textContent = `Votre score de ${detail.score} % est calculé sur ces ${detail.total} exigences : une exigence obligatoire compte triple, une souhaitée double, un atout simple ; « en partie » compte pour moitié.${detail.eliminatoires ? ` Il est plafonné à ${detail.score} % car un critère éliminatoire de l'offre manque dans votre CV : ${detail.eliminatoires.join(", ")}.` : ""}`;
  const ok = items.filter((c) => c.statut === "presente"), part = items.filter((c) => c.statut === "partielle"), gap = items.filter((c) => c.statut === "absente");
  $("match-count").innerHTML = `<b>${ok.length + part.length}</b> sur ${items.length}`;
  $("match-count").setAttribute("aria-label", `${ok.length + part.length} exigences sur ${items.length} se retrouvent dans votre CV`);
  const segs = [...$("match-bar").children];
  [[segs[0], ok], [segs[1], part], [segs[2], gap]].forEach(([seg, list]) => { seg.hidden = !list.length; seg.style.flexGrow = "0"; });
  requestAnimationFrame(() => requestAnimationFrame(() => { segs[0].style.flexGrow = ok.length; segs[1].style.flexGrow = part.length; segs[2].style.flexGrow = gap.length; }));
  const byLevel = (a, b) => (LEVEL_RANK[a.exigence] ?? 3) - (LEVEL_RANK[b.exigence] ?? 3);
  const chip = (c) => {
    const tone = c.statut === "presente" ? "ok" : c.statut === "partielle" ? "part" : "gap";
    return `<button type="button" class="mchip mchip-${tone}" data-i="${c.i}" aria-pressed="false"><span class="mchip-ico" aria-hidden="true">${tone === "ok" ? "✓" : tone === "gap" ? "+" : ""}</span>${esc(c.competence)}${c.exigence === "obligatoire" ? `<small>${LEVEL.obligatoire}</small>` : ""}</button>`;
  };
  $("match-common").innerHTML = [...ok.sort(byLevel), ...part.sort(byLevel)].map(chip).join("");
  $("match-missing").innerHTML = gap.sort(byLevel).map(chip).join("");
  $("match-common-group").hidden = !(ok.length + part.length);
  $("match-missing-group").hidden = !gap.length;
  const needles = [];
  items.forEach((c) => { if (c.statut !== "absente" && c.preuve_cv) needles[c.i] = { text: c.preuve_cv, tone: c.statut === "presente" ? "ok" : "part", label: c.competence }; });
  (d.points_forts || []).forEach((f, k) => { if (f.preuve_cv) needles[100 + k] = { text: f.preuve_cv, tone: "ok", label: f.point }; });
  const { html, found } = highlightHtml(state.profile?.cv || "", Array.from(needles, (n) => n || { text: "" }));
  $("match-cv-text").innerHTML = html;
  const marks = $("match-cv-text").querySelectorAll("mark").length;
  $("match-cv-count").textContent = marks ? `${marks} passage${marks > 1 ? "s" : ""}` : "";
  $("match-cv").hidden = !marks; $("match-cv").open = false;
  state.matchFound = found;
}
function showMatchDetail(index) {
  const c = (state.result?.correspondances || [])[index];
  const box = $("match-detail");
  if (!c) { box.hidden = true; return; }
  const tone = c.statut === "presente" ? "ok" : c.statut === "partielle" ? "part" : "gap";
  const status = tone === "ok" ? "Dans votre CV" : tone === "part" ? "En partie dans votre CV" : "Pas encore dans votre CV";
  const canLocate = tone !== "gap" && state.matchFound.has(index);
  box.className = `match-detail tone-${tone}`;
  box.innerHTML = `<div class="md-head"><strong>${esc(c.competence)}</strong><span class="md-level md-${esc(c.exigence)}">${LEVEL[c.exigence] || ""}</span></div>
    <p class="md-status">${status}</p>
    ${c.preuve_offre ? `<div class="md-quote md-offer"><span>Dans l'offre</span><p>« ${esc(c.preuve_offre)} »</p></div>` : ""}
    ${c.preuve_cv ? `<div class="md-quote md-cv"><span>Dans votre CV</span><p>« ${esc(c.preuve_cv)} »</p></div>` : ""}
    ${tone === "gap" ? `<p class="md-tip">Si vous l'avez déjà fait, ajoutez-le à votre CV avec un exemple concret. Sinon, c'est une compétence à acquérir avant de la mentionner.</p>` : tone === "part" ? `<p class="md-tip">Le lien existe : précisez dans votre CV ce que vous avez réellement fait pour le rendre évident.</p>` : ""}
    <div class="md-actions">${canLocate ? `<button type="button" class="link-btn" data-locate="${index}">Voir dans mon CV</button>` : ""}${tone === "gap" ? `<button type="button" class="link-btn" data-improve>Compléter mon CV</button>` : ""}</div>`;
  box.hidden = false; box.classList.remove("pop"); void box.offsetWidth; box.classList.add("pop");
}
$("match").addEventListener("click", (event) => {
  const chipButton = event.target.closest(".mchip");
  if (chipButton) {
    const index = Number(chipButton.dataset.i), same = chipButton.getAttribute("aria-pressed") === "true";
    document.querySelectorAll(".mchip").forEach((b) => b.setAttribute("aria-pressed", "false"));
    if (same) { $("match-detail").hidden = true; return; }
    showMatchDetail(index); chipButton.setAttribute("aria-pressed", "true");
    return;
  }
  const locate = event.target.closest("[data-locate]");
  if (locate) {
    $("match-cv").open = true;
    const mark = [...$("match-cv-text").querySelectorAll("mark")].find((m) => m.dataset.match.split(" ").map(Number).includes(Number(locate.dataset.locate)));
    if (mark) { mark.scrollIntoView({ block: "center", behavior: reduced() ? "instant" : "smooth" }); mark.classList.remove("flash"); void mark.offsetWidth; mark.classList.add("flash"); }
    return;
  }
  if (event.target.closest("[data-improve]")) openSetup();
});

/* ---------- jury : 7 évaluateurs, second passage, questions ---------- */
const JURY_WAIT = `<div class="jury-wait" role="status"><strong><span class="dot-pulse" aria-hidden="true"></span>Le jury délibère…</strong><span>Le jury lit votre CV : logiciel de tri et recruteur, puis, avec Premium, manager, concurrent, patron, expert métier et sceptique. Chacun cherche ce qui pourrait le faire rejeter.</span><div class="jury-dots" aria-hidden="true"><i class="jd"></i><i class="jd"></i><i class="jd"></i><i class="jd"></i><i class="jd"></i><i class="jd"></i><i class="jd"></i></div></div>`;
function renderJury(d) {
  const box = $("tab-jury");
  if (d.jury) {
    box.innerHTML = juryHtml(d.jury, { second: d.second, secondState: d.secondState, correspondances: d.correspondances, supposed: d.mode === "jury" });
    $("count-jury").textContent = `${d.second?.retenus ?? d.jury.retenus}/${d.jury.juges.length}`;
  } else if (d.juryState) {
    box.innerHTML = `<div class="jury-wait failed" role="alert"><strong>Le jury n'a pas pu délibérer.</strong><span>${d.juryState === "missing" ? "Il n'était pas terminé pour cette analyse." : "Le service était indisponible."} Relancez l'analyse pour l'obtenir.</span></div>`;
    $("count-jury").textContent = "–";
  } else { box.innerHTML = JURY_WAIT; $("count-jury").textContent = "…"; }
}
const questionList = (d) => (d.questions ? buildQuestions(d.questions, d.correspondances) : []);
function renderQuestions(d) {
  const expired = !d.analysisId || Date.now() - (d.analysisAt || 0) > 29 * 60 * 1000;
  const list = expired ? [] : questionList(d);
  $("qa-box").innerHTML = list.length ? questionsHtml(list, { remaining: d.completionsLeft ?? 2, busy: !!state.completing, keyQuestions: d.second?.questions_cles || [] }) : "";
}
const saveLast = (d) => { if (state.result === d) store.set("last", { result: d, job: state.job, at: Date.now() }); };
async function loadJury(id, data) {
  try { const jury = await api(`/api/analyze/${encodeURIComponent(id)}/jury`); if (state.result !== data) return; data.jury = jury; renderJury(data); saveLast(data); }
  catch { if (state.result === data) { data.juryState = "error"; renderJury(data); } }
}
async function loadSecond(id, data) {
  try { const second = await api(`/api/analyze/${encodeURIComponent(id)}/second`); if (state.result !== data) return; data.second = second; delete data.secondState; renderJury(data); renderQuestions(data); saveLast(data); }
  catch { if (state.result === data) { data.secondState = "error"; renderJury(data); } }
}
$("tab-jury").addEventListener("click", (event) => {
  if (event.target.closest("[data-open-premium]")) { location.href = "../#tarifs"; return; }
  const link = event.target.closest(".q-link"); if (!link) return;
  activateTab("cv");
  const item = document.getElementById("question-" + link.dataset.question); if (!item) return;
  item.scrollIntoView({ block: "center", behavior: reduced() ? "instant" : "smooth" });
  item.classList.remove("flash"); void item.offsetWidth; item.classList.add("flash");
  item.querySelector("textarea")?.focus({ preventScroll: true });
});
$("tab-cv").addEventListener("click", async (event) => {
  const data = state.result; if (!data) return;
  if (event.target.closest("[data-strip-todos]")) {
    data.cv_adapte = stripTodos(data.cv_adapte); renderCv(data.cv_adapte, data.guard); saveLast(data); toast("Emplacements retirés"); return;
  }
  if (!event.target.closest("[data-qa-submit]") || !data.analysisId || state.completing) return;
  const list = questionList(data);
  const answers = collectAnswers($("qa-box"), list);
  const status = $("qa-box").querySelector("[data-qa-status]");
  if (!answers.length) { status.textContent = "Répondez à au moins une question."; return; }
  const keep = $("qa-box").querySelector("[data-qa-keep]")?.checked;
  const p = state.profile;
  const sent = answers.map((a) => ({ question: a.question, reponse: pseudonymize(a.reponse, p) }));
  state.completing = true; renderQuestions(data);
  try {
    const res = await api(`/api/analyze/${encodeURIComponent(data.analysisId)}/complete`, { answers: sent });
    data.cv_adapte = res.cv.cv_adapte; data.questions = res.cv.questions; data.second = res.second; data.completionsLeft = res.remaining;
    data.guard = { ...(data.guard || {}), removed: res.cv.guard?.removed || 0 };
    groundSourceSections(data.cv_adapte, p.cv);
    if (keep) { p.cv = (p.cv + answersAsCvText(answers)).slice(0, 12000); store.set("profile", p); }
    state.completing = false;
    renderCv(data.cv_adapte, data.guard); renderJury(data); renderQuestions(data); saveLast(data);
    const done = $("qa-box").querySelector("[data-qa-status]");
    if (done) done.textContent = `CV complété. Le jury l'a relu : ${res.second.retenus}/${res.second.juges.length} le retiennent.`;
    toast(`CV complété : ${res.second.retenus}/${res.second.juges.length} juges le retiennent`);
    $("cv-paper").scrollIntoView({ block: "start", behavior: reduced() ? "instant" : "smooth" });
  } catch (e) {
    state.completing = false; renderQuestions(data);
    for (const a of answers) { const t = [...$("qa-box").querySelectorAll("textarea[data-qa]")].find((x) => list[Number(x.dataset.qa)]?.question === a.question); if (t) t.value = a.reponse; }
    const s2 = $("qa-box").querySelector("[data-qa-status]"); if (s2) s2.textContent = e.data?.error || "Le CV n'a pas pu être complété. Réessayez.";
  }
});
$("jury-only").addEventListener("click", () => runAnalysis(null));

/* ---------- onglets ---------- */
function activateTab(name) {
  document.querySelectorAll(".tabs button").forEach((b) => { const on = b.dataset.tab === name; b.classList.toggle("active", on); b.setAttribute("aria-selected", String(on)); });
  ["jury", "forts", "ecarts", "cible", "cv"].forEach((t) => { $("tab-" + t).hidden = t !== name; });
}
document.querySelector(".tabs").addEventListener("click", (event) => {
  const b = event.target.closest("button[data-tab]"); if (!b) return;
  activateTab(b.dataset.tab);
  const nav = document.querySelector(".tabs");
  if (nav.getBoundingClientRect().top < 60) nav.scrollIntoView({ block: "start", behavior: reduced() ? "instant" : "smooth" });
});

/* ---------- CV : PDF et copie ---------- */
$("print-cv").addEventListener("click", () => {
  if (state.cvPending) return;
  // Un emplacement « [À COMPLÉTER : …] » ne doit jamais partir dans un PDF.
  const todos = countPlaceholders(state.result?.cv_adapte);
  if (todos) { toast(`Complétez ou retirez d'abord ${todos} information${todos > 1 ? "s" : ""}`); $("cv-todo").scrollIntoView({ block: "center", behavior: reduced() ? "instant" : "smooth" }); return; }
  window.print();
});
async function copy(text, button, label) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const area = document.createElement("textarea"); area.value = text; area.setAttribute("readonly", ""); area.style.position = "fixed"; area.style.opacity = "0";
    document.body.appendChild(area); area.select(); const ok = document.execCommand("copy"); area.remove();
    if (!ok) { toast("Copie impossible"); return; }
  }
  if (button) { const old = button.textContent; button.textContent = "Copié ✓"; setTimeout(() => { button.textContent = old; }, 1600); }
  toast(label || "Copié");
}
$("copy-cv").addEventListener("click", () => copy($("cv-paper").innerText, $("copy-cv"), "CV copié"));

/* ---------- bouton Partager : script du raccourci et favori ---------- */
let extractSource = null;
async function shareScript(kind) {
  if (!extractSource) extractSource = await (await fetch("shared/extract.js")).text();
  return buildShareScript(extractSource, APP_URL, kind);
}
async function renderGuide() {
  const script = await shareScript("shortcut");
  $("script-preview").textContent = script.length > 420 ? script.slice(0, 420) + "\n…" : script;
  if (SETTINGS.shortcutUrl) { $("shortcut-link").href = SETTINGS.shortcutUrl; $("shortcut-link").hidden = false; }
}
$("copy-script").addEventListener("click", async () => copy(await shareScript("shortcut"), $("copy-script"), "Script copié"));
$("copy-bookmarklet").addEventListener("click", async () => copy(await shareScript("bookmarklet"), $("copy-bookmarklet"), "Code du favori copié"));

/* ---------- démarrage ---------- */
function boot() {
  const incoming = parseIncomingJob(location.hash);
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  if (incoming?.job && !incoming.error) {
    if (profileReady()) return runAnalysis(incoming.job);
    session.set("pendingJob", incoming.job); return openSetup();
  }
  if (!profileReady()) return openSetup();
  goHome();
  if (incoming?.error) {
    $("paste").value = incoming.job?.text || "";
    $("paste-status").textContent = incoming.error; $("paste-status").dataset.tone = "error";
  }
}
window.addEventListener("hashchange", () => { if (location.hash.startsWith("#job=")) boot(); });
boot();
