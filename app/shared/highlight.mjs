// Surlignage des extraits cités par l'analyse dans le texte d'origine du CV.
// Recherche insensible aux accents, à la casse, à la ponctuation et aux espaces,
// comme la garde du serveur : un extrait introuvable n'est jamais surligné.

function fold(ch) {
  return ch.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Texte normalisé + correspondance de chaque caractère normalisé vers sa position d'origine. */
export function normalizeWithMap(text) {
  const source = String(text || "");
  let out = "";
  const map = [];
  for (let i = 0; i < source.length; i++) {
    for (const c of fold(source[i])) {
      if (/[a-z0-9]/.test(c)) { out += c; map.push(i); }
      else if (out && out[out.length - 1] !== " ") { out += " "; map.push(i); }
    }
  }
  if (out.endsWith(" ")) { out = out.slice(0, -1); map.pop(); }
  return { text: out, map };
}

export function normalize(text) { return normalizeWithMap(text).text; }

/** Plages [début, fin[ dans le texte d'origine pour chaque extrait trouvé. */
export function findRanges(source, needles) {
  const { text, map } = normalizeWithMap(source);
  const ranges = [];
  needles.forEach((needle, index) => {
    const quote = normalize(needle.text);
    if (quote.length < 3) return;
    let from = 0, at;
    while ((at = text.indexOf(quote, from)) !== -1) {
      const before = at === 0 || text[at - 1] === " ";
      const after = at + quote.length === text.length || text[at + quote.length] === " ";
      if (before && after) ranges.push({ start: map[at], end: map[at + quote.length - 1] + 1, index, tone: needle.tone, label: needle.label });
      from = at + quote.length;
    }
  });
  ranges.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.start < last.end) {
      last.end = Math.max(last.end, range.end);
      if (!last.labels.includes(range.label)) last.labels.push(range.label);
      if (range.tone === "ok") last.tone = "ok";
      last.indexes.push(range.index);
    } else merged.push({ start: range.start, end: range.end, tone: range.tone, labels: [range.label], indexes: [range.index] });
  }
  return merged;
}

const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** HTML du texte d'origine avec des <mark> autour des extraits retrouvés. */
export function highlightHtml(source, needles) {
  const text = String(source || "");
  const ranges = findRanges(text, needles);
  let html = "", cursor = 0;
  for (const r of ranges) {
    html += escape(text.slice(cursor, r.start));
    const label = r.labels.filter(Boolean).join(" · ");
    html += `<mark class="hl hl-${r.tone}" data-match="${r.indexes.join(" ")}"${label ? ` title="${escape(label)}"` : ""}>${escape(text.slice(r.start, r.end))}</mark>`;
    cursor = r.end;
  }
  return { html: html + escape(text.slice(cursor)), found: new Set(ranges.flatMap((r) => r.indexes)) };
}
