// Commun au navigateur et au serveur : aucun appel réseau, aucune déduction
// de diplôme ou d'expérience à partir des compétences.
const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\bc\+\+/g, "cplusplus").replace(/\bc#/g, "csharp").replace(/\.net\b/g, "dotnet").replace(/[^a-z0-9]+/g, " ").trim();
const skillKey = (value) => normalize(value).split(" ").filter((word) => !["des", "de", "du", "d", "le", "la", "les", "en", "un", "une", "et"].includes(word)).map((word) => word.length > 4 ? word.replace(/s$/, "") : word).join(" ");
const clean = (line) => line.replace(/^\s*[-–—•·*▪◦]+\s*/, "").trim();
const instruction = /\b(?:decrivez|precisez ici|indiquez ici|lorem ipsum|vos diplomes|les options de la formation|titre du poste recherche|nom entreprise|nom de l entreprise|a completer|a remplir)\b/;
const heading = /^(?:profil|contact|coordonnees|competences(?: techniques|cles| professionnelles)?|outils|qualites|langues|languages|skills|experience(?:s)?(?: professionnelle(?:s)?)?|formation(?:s)?|education|centres d interet|loisirs|projets|certifications)$/;
const language = /^(?:francais|anglais|allemand|espagnol|italien|portugais|arabe|chinois|mandarin|japonais|neerlandais|russe|vietnamien|english|french|german|spanish)\b/;
const tool = /\b(?:google analytics|photoshop|microsoft office|excel|powerpoint|word|canva|figma|wordpress|salesforce|python|javascript|sql|gestion de projet|management)\b/;
const negative = /\b(?:pas|aucun|jamais|non acquis|souhaite|a apprendre|apprendre|recherche)\b/;

export function reviewCv(text) {
  const lines = String(text || "").split(/\r?\n/).map(clean).filter(Boolean).flatMap((line) => line.split(/\s*[·•]\s*/)).flatMap((line) => {
    const inline = line.match(/^((?:comp[eé]tences(?: techniques| cl[eé]s| professionnelles)?|outils|skills|langues|languages))\s*[:：]\s*(.+)$/i);
    return inline ? [inline[1], ...inline[2].split(/\s*[;,|]\s*/)] : [line];
  });
  const placeholders = lines.filter((line) => instruction.test(normalize(line)));
  const generic = lines.some((line) => /^(?:poste nom entreprise|formation 2000|titre du poste recherche)/.test(normalize(line)));
  const incomplete = placeholders.length >= 2 || (generic && placeholders.length > 0);
  const competences = [], langues = [];
  let section = "";
  const add = (list, value) => {
    if (value && !list.some((item) => normalize(item) === normalize(value))) list.push(value);
  };
  for (const line of lines) {
    const key = normalize(line);
    if (heading.test(key)) {
      section = /^(competences|outils|skills)/.test(key) ? "skills" : /^(langues|languages)$/.test(key) ? "languages" : "";
      continue;
    }
    if (instruction.test(key) || line.length > 140 || /@|https?:\/\/|\b(?:19|20)\d{2}\b/.test(line) || key === "formation") continue;
    if (language.test(key) && line.length <= 90) {
      for (const item of line.split(/\s*[;,|]\s*/)) if (language.test(normalize(item))) add(langues, item);
      continue;
    }
    if (negative.test(key)) continue;
    // Ne récupère pas une phrase d'expérience comme une compétence déclarée.
    if (section === "skills" && line.length <= 90 && !/[.!?]$/.test(line) && !/\b(?:decrivez|poste|entreprise|profil|formation|tel|mail|adr)\b/.test(key)) {
      for (const item of line.split(/\s*[;|]\s*/)) add(competences, item);
    } else if (tool.test(key) && line.length <= 65 && !/[.!?]$/.test(line) && !/\b(?:pas|aucun|sans|souhaite|apprendre|debuter|recherche)\b/.test(key)) add(competences, line);
  }
  return {
    incomplete,
    placeholders: placeholders.slice(0, 5),
    competences: competences.slice(0, 30),
    langues: langues.slice(0, 12),
    message: incomplete
      ? "Ce CV contient encore des textes d'exemple. Remplacez-les par votre parcours réel ou supprimez les rubriques inutiles avant l'analyse."
      : "Relisez le texte extrait : noms, dates, compétences et niveaux de langues doivent correspondre à votre CV."
  };
}

export function preserveDeclaredFacts(cv, source) {
  const facts = reviewCv(source);
  for (const field of ["competences", "langues"]) {
    const proposed = Array.isArray(cv[field]) ? cv[field] : [];
    // Un niveau ou un outil reformulé est conservé seulement si sa formulation
    // est présente dans le texte. Les mentions récupérées restent verbatim.
    const key = field === "competences" ? skillKey : normalize;
    const positiveSource = String(source).split(/\r?\n|[.!?]\s+/).filter((line) => !negative.test(normalize(line))).join("\n");
    const sourceKey = " " + key(positiveSource) + " ";
    const supported = proposed.filter((item) => typeof item === "string" && key(item) && sourceKey.includes(" " + key(item) + " "));
    const declared = facts[field];
    const merged = [];
    for (const item of [...declared, ...supported]) {
      if (field === "langues" && declared.some((line) => normalize(line).startsWith(normalize(item) + " "))) continue;
      if (!merged.some((line) => key(line) === key(item))) merged.push(item);
    }
    cv[field] = merged;
  }
  return cv;
}

export function groundSourceSections(cv, source) {
  const lines = String(source || "").split(/\r?\n/).map(clean);
  const profile = [];
  let active = false;
  for (const line of lines) {
    const key = normalize(line);
    const inline = line.match(/^(?:profil|profile|r[eé]sum[eé]|summary|[aà] propos|objectif professionnel)\s*:\s*(.+)$/i);
    if (/^(profil|profile|resume|summary|a propos|objectif professionnel)$/.test(key) || inline) { active = true; if (inline) profile.push(inline[1]); continue; }
    if (!active) continue;
    if (heading.test(key) || (!key && profile.length)) break;
    if (line && !instruction.test(key)) profile.push(line);
    if (profile.length >= 5 || profile.join(" ").length > 600) break;
  }
  // Le résumé de CV est repris du candidat : aucun diplôme, niveau de maîtrise
  // ou fréquence d'utilisation n'est déduit par le générateur dans ce paragraphe.
  cv.accroche = profile.join(" ");
  for (const formation of cv.formations || []) {
    const title = normalize(formation.intitule.replace(/^formation en\s+/i, ""));
    const index = lines.findIndex((line) => title && normalize(line).includes(title));
    const details = [];
    if (index >= 0) for (const line of lines.slice(index + 1, index + 4)) {
      if (!line || heading.test(normalize(line)) || /\b(?:19|20)\d{2}\b/.test(line)) break;
      if (!instruction.test(normalize(line))) details.push(line);
    }
    formation.detail = details.join(" ");
  }
  return cv;
}
