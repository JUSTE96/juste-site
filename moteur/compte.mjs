// Fait monter un nombre jusqu'à sa valeur (respecte « réduire les animations »).
const calme = matchMedia("(prefers-reduced-motion: reduce)").matches;
export function compter(el, vers, ms = 900) {
  if (!Number.isFinite(vers)) { el.textContent = "–"; return; }
  if (calme) { el.textContent = vers; return; }
  const de = Number(el.textContent) || 0, t0 = performance.now(), id = (el._compte = (el._compte || 0) + 1);
  const pas = (t) => {
    if (el._compte !== id) return;
    const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(de + (vers - de) * e);
    if (k < 1) requestAnimationFrame(pas);
  };
  requestAnimationFrame(pas);
}
