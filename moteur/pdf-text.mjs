// Les fragments PDF ne correspondent pas toujours à des mots : une ligature
// « fi » peut être un fragment séparé. On utilise les positions pour espacer.
export function joinPdfItems(items) {
  const output = [];
  let line = "", lastY = null, endX = null;
  const flush = () => { if (line.trim()) output.push(line.trim()); line = ""; lastY = null; endX = null; };
  for (const item of items) {
    if (typeof item.str !== "string") continue;
    const x = item.transform[4], y = item.transform[5];
    if (lastY !== null && Math.abs(y - lastY) > 3) flush();
    const tolerance = Math.max(0.5, Math.abs(item.transform[0]) * 0.1);
    if (line && endX !== null && x - endX > tolerance && !/\s$/.test(line) && !/^\s/.test(item.str)) line += " ";
    line += item.str;
    lastY = y; endX = x + (Number.isFinite(item.width) ? item.width : 0);
    if (item.hasEOL) flush();
  }
  flush(); return output.join("\n");
}
