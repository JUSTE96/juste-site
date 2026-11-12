/* JusteCV — arrivée dans le studio. Long rideau quand on vient du site, court sinon. */
(() => {
  const body = document.body, lever = document.getElementById("lever");
  let passage = false;
  try { passage = sessionStorage.getItem("juste.passage") === "1"; sessionStorage.removeItem("juste.passage"); } catch {}
  const fin = () => { lever && lever.remove(); body.classList.add("entre"); };
  if (!lever || !passage || matchMedia("(prefers-reduced-motion: reduce)").matches) return fin();
  body.classList.add(passage ? "arrivee-longue" : "arrivee-courte");
  requestAnimationFrame(() => requestAnimationFrame(() => body.classList.add("joue")));
  const tenue = passage ? 2000 : 520;
  setTimeout(() => body.classList.add("leve"), tenue);
  setTimeout(() => body.classList.add("entre"), tenue + 380);
  setTimeout(() => lever.remove(), tenue + 1100);
})();
