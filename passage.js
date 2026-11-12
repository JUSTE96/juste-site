/* JusteCV — passage du site vers le studio d'analyse : un disque corail part du clic, l'encre suit, puis la page change. */
(() => {
  const css = `.passage{position:fixed;inset:0;z-index:2147483000;pointer-events:none}
.passage i{position:absolute;inset:0;clip-path:circle(0 at var(--x) var(--y));transition:clip-path .9s cubic-bezier(.76,0,.24,1)}
.passage i:first-child{background:#ff6b4a}
.passage i:nth-child(2){background:#fffaf4;transition-delay:.16s}
.passage.go i{clip-path:circle(var(--r) at var(--x) var(--y))}
.passage span{position:absolute;left:50%;top:50%;transform:translate(-50%,-40%);font:500 clamp(30px,4vw,44px)/1 Lora,Georgia,serif;color:#1c2040;opacity:0;transition:opacity .5s .62s,transform .9s .62s cubic-bezier(.16,1,.3,1)}
.passage span b{color:#ff6b4a;font-weight:500}
.passage.go span{opacity:1;transform:translate(-50%,-50%)}`;
  const versStudio = (u) => u.origin === location.origin && /\/app\/(index\.html)?$/.test(u.pathname);
  // Ouvre le studio avec le passage animé, depuis un lien ou un bouton.
  const passer = (href, e, el) => {
    const u = new URL(href, location.href);
    try { sessionStorage.setItem("juste.passage", "1"); } catch {}
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { location.href = u.href; return; }
    if (!document.getElementById("passage-css")) { const s = document.createElement("style"); s.id = "passage-css"; s.textContent = css; document.head.append(s); }
    const r = el ? el.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
    const x = (e && e.clientX) || r.left + r.width / 2, y = (e && e.clientY) || r.top + r.height / 2;
    const rayon = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 20;
    const d = document.createElement("div");
    d.className = "passage"; d.setAttribute("aria-hidden", "true");
    d.style.cssText = `--x:${x}px;--y:${y}px;--r:${rayon}px`;
    d.innerHTML = "<i></i><i></i><span>Juste<b>CV</b></span>";
    if (document.documentElement.hasAttribute("data-nuit")) { d.children[1].style.background = "#141936"; d.children[2].style.color = "#f7f1e8"; }
    document.body.append(d);
    requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add("go")));
    setTimeout(() => { location.href = u.href; }, 1150);
  };
  window.justePassage = passer;
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === "_blank" || a.hasAttribute("download")) return;
    let u; try { u = new URL(a.href, location.href); } catch { return; }
    if (!versStudio(u)) return;
    e.preventDefault();
    passer(u.href, e, a);
  });
  addEventListener("pageshow", (ev) => { if (ev.persisted) document.querySelectorAll(".passage").forEach((n) => n.remove()); });
})();
