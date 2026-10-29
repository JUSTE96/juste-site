// Retire les données d'identification du CV avant tout envoi au serveur et à l'IA.
// Ordre important : d'abord les formats reconnaissables (email, téléphone, liens…), puis le nom en mots entiers.
const ACCENTS = { a: "aàáâäãå", e: "eéèêë", i: "iìíîï", o: "oòóôöõ", u: "uùúûü", c: "cç", n: "nñ", y: "yÿý" };
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const fold = (s) => s.normalize("NFD").replace(/\p{M}/gu, "");
// Motif insensible aux accents : « Hélène » trouve aussi « Helene » et « HÉLÈNE ».
function accentPattern(value) {
  return [...fold(value)].map((ch) => {
    const set = ACCENTS[ch.toLowerCase()];
    return set ? `[${set}${set.toUpperCase()}]` : escapeRe(ch);
  }).join("");
}
// Mot entier : pas de lettre ni de chiffre collé avant ou après. Le caractère
// précédent est capturé puis remis ($1) : pas de « lookbehind », que Safari
// ne gère qu'à partir d'iOS/iPadOS 16.4.
const whole = (pattern, flags = "giu") => new RegExp(`(^|[^\\p{L}\\p{N}])(?:${pattern})(?![\\p{L}\\p{N}])`, flags);

// Inspiré des détecteurs de Microsoft Presidio (licence MIT) : un IBAN ou un numéro de carte n'est masqué
// que si sa clé de contrôle est valide, pour ne pas effacer des nombres ordinaires (chiffres d'affaires, références…).
function ibanOk(raw) {
  const s = raw.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) return false;
  const r = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let m = 0; for (const d of r) m = (m * 10 + Number(d)) % 97;
  return m === 1;
}
function luhnOk(digits) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) { let n = Number(digits[digits.length - 1 - i]); if (i % 2) { n *= 2; if (n > 9) n -= 9; } sum += n; }
  return sum % 10 === 0;
}

export function pseudonymize(cv, profile = {}) {
  let text = String(cv || "");
  const clean = (v) => (typeof v === "string" ? v.trim() : "");

  // 1. Coordonnées et identifiants reconnaissables
  const email = clean(profile.email), phone = clean(profile.phone);
  if (email) text = text.replace(new RegExp(escapeRe(email), "giu"), "[email]");
  if (phone.replace(/\D/g, "").length >= 6) {
    const digits = phone.replace(/\D/g, "").split("").map(escapeRe).join("[\\s().+-]*");
    text = text.replace(new RegExp(digits, "g"), "[téléphone]");
  }
  text = text
    // IBAN (groupé par 4 ou d'un seul bloc) : on retire les mots en trop à la fin jusqu'à trouver une clé valide.
    .replace(/\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,40}/gi, (m) => {
      const parts = m.split(" ");
      for (let k = parts.length; k > 0; k--) { const c = parts.slice(0, k).join(" "); if (ibanOk(c)) return "[IBAN]" + m.slice(c.length); }
      return m;
    })
    // Carte bancaire et autres longs numéros à clé de Luhn (13 à 19 chiffres, espaces ou tirets possibles).
    .replace(/(^|[^\d])((?:\d[ -]?){12,18}\d)(?!\d)/g, (m, pre, num) => {
      const d = num.replace(/\D/g, "");
      if (!luhnOk(d)) return m;
      return pre + (/^[3-6]/.test(d) && d.length >= 15 && d.length <= 16 ? "[carte bancaire]" : "[numéro masqué]");
    })
    // Emails déguisés : « prenom (at) domaine.fr », « prenom arobase domaine point fr ».
    .replace(/[\p{L}\p{N}._-]+\s*(?:\(at\)|\[at\]|\{at\}|\s+arobase\s+)\s*[\p{L}\p{N}-]+(?:\s*(?:\.|\(dot\)|\[dot\]|\s+point\s+)\s*[\p{L}\p{N}-]+)+/giu, "[email]")
    .replace(/[\p{L}\p{N}.+_-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/giu, "[email]")
    .replace(/(^|\D)(?:\+33|0033|0)\s*(?:\(0\)\s*)?[1-9](?:[\s().-]*\d{2}){4}(?!\d)/g, "$1[téléphone]")
    .replace(/(?:https?:\/\/)?(?:[\w-]+\.)?linkedin\.com\/\S*/gi, "[profil]")
    // Portfolio, GitHub, site personnel… : un lien suffit souvent à retrouver la personne.
    .replace(/(?:https?:\/\/|www\.)[^\s<>()]+/gi, "[lien]")
    .replace(/(^|[^\p{L}\p{N}@.])(?:github\.com|gitlab\.com|behance\.net|dribbble\.com|medium\.com|malt\.fr)\/[^\s<>()]+/giu, "$1[lien]")
    .replace(/(^|\D)[12]\s?\d{2}\s?(?:0[1-9]|1[0-2]|[2-9]\d)\s?(?:\d{2}|2[AB])\s?\d{3}\s?\d{3}(?:\s?\d{2})?(?!\d)/g, "$1[n° de sécurité sociale]")
    .replace(/\b(?:n[ée]{1,2}e?(?:\(e\))?\s+le|date\s+de\s+naissance\s*:?)\s*\d{1,2}(?:er)?[\s/.-]+(?:\d{1,2}|[\p{L}]{3,9}\.?)[\s/.-]+\d{2,4}/giu, "[date de naissance]")
    .replace(/(^|[^\p{L}\p{N}])\d{1,4}\s*(?:bis|ter)?,?\s+(?:rue|avenue|av\.|boulevard|bd|chemin|all[ée]e|impasse|place|route|quai|cours|r[ée]sidence|lotissement)\s+[^\n,;]{2,60}/giu, "$1[adresse]");

  // 2. Le nom : d'abord en entier, puis chaque partie en mot entier
  const name = clean(profile.name);
  if (name) {
    text = text.replace(whole(accentPattern(name).replace(/\s+/g, "\\s+")), "$1[retiré]");
    const parts = name.split(/[\s-]+/).filter(Boolean);
    for (const part of parts) {
      if ([...fold(part)].filter((c) => /\p{L}/u.test(c)).length >= 3) {
        text = text.replace(whole(accentPattern(part)), "$1[retiré]");
      }
    }
    // Les noms très courts (Ng, Vu, Le…) ne sont retirés que dans l'en-tête du CV,
    // pour ne pas effacer les mots ordinaires du texte (« le », « do »…).
    const short = parts.filter((p) => { const n = [...fold(p)].filter((c) => /\p{L}/u.test(c)).length; return n > 0 && n < 3; });
    if (short.length) {
      const lines = text.split("\n");
      let seen = 0;
      for (let i = 0; i < lines.length && seen < 4; i++) {
        if (!lines[i].trim()) continue;
        seen++;
        for (const part of short) lines[i] = lines[i].replace(whole(accentPattern(part), "gu"), "$1[retiré]");
      }
      text = lines.join("\n");
    }
    text = text.replace(/\[retiré\](?:\s*\[retiré\])+/g, "[retiré]");
  }
  return text;
}
