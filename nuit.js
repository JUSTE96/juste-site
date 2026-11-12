/* JusteCV — mode nuit. De 20 h à 6 h (heure du visiteur) le site passe sous un ciel étoilé.
   Le bouton lune/soleil force l'un ou l'autre pendant 12 h. Chargé dans <head> pour éviter l'éclair blanc. */
(() => {
  const html = document.documentElement, CLE = "juste.ciel", DUREE = 12 * 3600 * 1000;
  const calme = matchMedia("(prefers-reduced-motion: reduce)");
  const lire = () => { try { const c = JSON.parse(localStorage.getItem(CLE)); return c && Date.now() - c.t < DUREE ? c.v : null; } catch { return null; } };
  const noter = (v) => { try { localStorage.setItem(CLE, JSON.stringify({ v, t: Date.now() })); } catch {} };
  const q = new URLSearchParams(location.search).get("ciel");
  if (q === "nuit" || q === "jour") noter(q);
  const heureDeNuit = () => { const h = new Date().getHours(); return h >= 20 || h < 6; };
  const veutNuit = () => { const c = lire(); return c ? c === "nuit" : heureDeNuit(); };
  let nuit = veutNuit();
  html.toggleAttribute("data-nuit", nuit);

  /* ---------- le ciel ---------- */
  let toile, ctx, etoiles = [], filante = null, prochaine = 0, image = 0, L = 0, H = 0, dernier = 0;
  const TEINTES = ["247,241,232", "247,241,232", "247,241,232", "247,241,232", "190,208,255", "190,208,255", "255,196,178", "255,233,168"];
  const semer = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    L = innerWidth; H = innerHeight;
    toile.width = L * dpr; toile.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.min(340, Math.round(L * H / 5200));
    etoiles = Array.from({ length: n }, () => {
      const g = Math.random();
      return { x: Math.random() * L, y: Math.random() * H, r: g > .97 ? 1.5 + Math.random() * .6 : g > .8 ? .9 + Math.random() * .4 : .35 + Math.random() * .45,
        a: .35 + Math.random() * .6, v: .4 + Math.random() * 1.6, p: Math.random() * 6.283, c: TEINTES[Math.floor(Math.random() * TEINTES.length)], halo: g > .97 };
    });
  };
  const lancer = (t) => {
    const versDroite = Math.random() > .5, angle = (18 + Math.random() * 16) * Math.PI / 180;
    filante = { x: L * (.1 + Math.random() * .8), y: H * (.04 + Math.random() * .32), dx: Math.cos(angle) * (versDroite ? 1 : -1), dy: Math.sin(angle),
      long: 130 + Math.random() * 110, course: 260 + Math.random() * 240, t0: t, duree: 750 + Math.random() * 450 };
  };
  const peindre = (t) => {
    ctx.clearRect(0, 0, L, H);
    const s = t / 1000;
    for (const e of etoiles) {
      const a = calme.matches ? e.a : e.a * (.55 + .45 * Math.sin(s * e.v + e.p));
      ctx.fillStyle = `rgba(${e.c},${a.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 6.283); ctx.fill();
      if (e.halo) { ctx.fillStyle = `rgba(${e.c},${(a * .12).toFixed(3)})`; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 4.2, 0, 6.283); ctx.fill(); }
    }
    if (filante) {
      const k = (t - filante.t0) / filante.duree;
      if (k >= 1) { filante = null; prochaine = t + 8000 + Math.random() * 7000; }
      else {
        const d = filante.course * (1 - Math.pow(1 - k, 2)), x = filante.x + filante.dx * d, y = filante.y + filante.dy * d;
        const force = Math.sin(Math.PI * k), long = filante.long * Math.min(1, k * 3);
        const g = ctx.createLinearGradient(x, y, x - filante.dx * long, y - filante.dy * long);
        g.addColorStop(0, `rgba(255,250,240,${(.95 * force).toFixed(3)})`); g.addColorStop(.25, `rgba(255,196,178,${(.5 * force).toFixed(3)})`); g.addColorStop(1, "rgba(255,196,178,0)");
        ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - filante.dx * long, y - filante.dy * long); ctx.stroke();
        ctx.fillStyle = `rgba(255,250,240,${force.toFixed(3)})`; ctx.beginPath(); ctx.arc(x, y, 1.5, 0, 6.283); ctx.fill();
      }
    } else if (!calme.matches && t > prochaine) lancer(t);
  };
  const boucle = (t) => {
    image = 0;
    if (!nuit || document.hidden) return;
    if (t - dernier > 32) { dernier = t; peindre(t); }
    if (!calme.matches) image = requestAnimationFrame(boucle);
  };
  const allumer = () => {
    if (!document.body) return;
    if (!toile) {
      toile = document.createElement("canvas"); toile.id = "ciel"; toile.setAttribute("aria-hidden", "true");
      ctx = toile.getContext("2d"); document.body.prepend(toile);
      let attente; addEventListener("resize", () => { clearTimeout(attente); attente = setTimeout(() => { if (nuit) { semer(); peindre(performance.now()); } }, 180); });
      document.addEventListener("visibilitychange", () => { if (!document.hidden && nuit && !image) image = requestAnimationFrame(boucle); });
    }
    semer(); prochaine = performance.now() + 2600; peindre(performance.now());
    if (!image && !calme.matches) image = requestAnimationFrame(boucle);
  };
  const appliquer = (v, douce) => {
    if (v === nuit && (!v || toile)) return;
    nuit = v;
    if (douce) { html.classList.add("bascule"); setTimeout(() => html.classList.remove("bascule"), 900); }
    html.toggleAttribute("data-nuit", nuit);
    const b = document.querySelector(".ciel-btn");
    if (b) { b.setAttribute("aria-pressed", String(nuit)); b.setAttribute("aria-label", nuit ? "Revenir au mode jour" : "Passer au mode nuit"); b.title = b.getAttribute("aria-label"); }
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => { m.dataset.jour ??= m.content; m.content = nuit ? "#141936" : m.dataset.jour; });
    if (nuit) allumer();
  };

  /* ---------- bouton ---------- */
  const pret = () => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "ciel-btn";
    b.innerHTML = '<svg class="lune" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.500 10.500Z"/></svg><svg class="soleil" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.500v2M12 19.500v2M2.500 12h2M19.500 12h2M5.300 5.300l1.400 1.400M17.300 17.300l1.400 1.400M5.300 18.700l1.400-1.400M17.300 6.700l1.400-1.400"/></svg>';
    b.addEventListener("click", () => { const v = !nuit; noter(v ? "nuit" : "jour"); appliquer(v, true); });
    const barre = document.querySelector(".top-actions");
    if (barre) { b.classList.add("dans-barre"); barre.prepend(b); } else document.body.append(b);
    const etat = nuit; nuit = !etat; appliquer(etat, false);
    setInterval(() => appliquer(veutNuit(), true), 60000);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", pret); else pret();
})();
