// Affichage des repères officiels d'un métier (ROME, ESCO, RNCP, BMO), renvoyés par le serveur
// avec l'analyse quand l'offre correspond à un persona. Partagé avec l'appli (node scripts/sync-app.mjs).
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const TYPES = { atout: ["pill-mint", "Atout reconnu"], conseil: ["pill-amber", "À préciser"], alerte: ["pill-rose", "À vérifier"] };
const lien = (s) => s?.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.nom)}</a>${s.version ? `, ${esc(s.version)}` : ""}` : "";

export function renderReferentiel(ref) {
  if (!ref) return "";
  const checks = (ref.verifications || []).map((v) => {
    const [pill, label] = TYPES[v.type] || TYPES.conseil;
    return `<div class="ref-check"><p>${esc(v.texte)}</p><span class="pill ${pill}">${label}</span>${v.source ? `<p class="ref-src">Source : ${lien(v.source)}</p>` : ""}</div>`;
  }).join("");
  const liste = (titre, items, chips = false) => items?.length
    ? `<details class="ref-more"><summary>${esc(titre)}</summary>${chips ? `<div class="chips">${items.map((x) => `<span>${esc(x)}</span>`).join("")}</div>` : `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`}</details>`
    : "";
  return `<section class="referentiel" aria-label="Repères officiels du métier">
    <h3>Repères officiels : ${esc(ref.metier)}</h3>
    <p class="muted small">Tirés des référentiels publics (ROME ${esc((ref.codes?.rome || []).join(", "))}, RNCP, enquête BMO), sans IA. Ils complètent l'analyse de l'offre, sans la remplacer.</p>
    ${checks || `<p class="small muted">Rien à signaler sur les certifications de conduite dans votre CV.</p>`}
    ${liste("Compétences clés du métier", ref.competences, true)}
    ${liste("Catégories du CACES R489", ref.certifications)}
    ${liste("Règles de conduite", ref.regles)}
    ${liste("Diplômes et titres reconnus", ref.diplomes)}
    ${ref.marche ? `<p class="small muted">${esc(ref.marche)}.</p>` : ""}
    <p class="ref-src">Sources : ${(ref.sources || []).map(lien).filter(Boolean).join(" · ")}</p>
  </section>`;
}
