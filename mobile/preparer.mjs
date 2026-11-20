// Copie le site dans mobile/www pour l'emballer dans l'appli. L'appli s'ouvre sur l'atelier.
import { cpSync, rmSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const ici = dirname(fileURLToPath(import.meta.url)), site = join(ici, ".."), www = join(ici, "www");
const GARDER = ["index.html", "atelier.html", "modeles.html", "suivi.html", "guides.html", "metiers.html", "merci.html", "404.html", "cgv.html", "mentions-legales.html", "confidentialite.html",
  "juste.css", "pages.css", "nuit.css", "nuit.js", "luxe.js", "elan.js", "demo.js", "atelier.js", "modeles.js", "passage.js", "appli.js", "sw.js", "manifest.webmanifest",
  "favicon-32.png", "apple-touch-icon.png", "assets", "fonts", "moteur", "metiers", "vendor", "app"];
rmSync(www, { recursive: true, force: true }); mkdirSync(www, { recursive: true });
let n = 0;
for (const f of GARDER) { const de = join(site, f); if (existsSync(de)) { cpSync(de, join(www, f), { recursive: true }); n++; } else console.warn("absent :", f); }
// L'appli démarre sur l'atelier.
cpSync(join(site, "index.html"), join(www, "accueil.html"));
writeFileSync(join(www, "index.html"), '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=atelier.html"><script>location.replace("atelier.html")</script>');
console.log(n + " éléments copiés dans mobile/www");
