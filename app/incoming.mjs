// Offre reçue du bouton Partager (raccourci iPhone/iPad) ou d'un favori : #job=<JSON encodé>.
// Le fragment (#…) n'est jamais envoyé au serveur par le navigateur.

export function parseIncomingJob(hash) {
  const match = /^#job=(.+)$/s.exec(hash || "");
  if (!match) return null;
  let raw;
  try { raw = JSON.parse(decodeURIComponent(match[1])); } catch { return { error: "L'offre partagée n'a pas pu être lue. Réessayez depuis la page de l'offre." }; }
  if (!raw || typeof raw !== "object") return { error: "L'offre partagée n'a pas pu être lue. Réessayez depuis la page de l'offre." };
  const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const job = { title: str(raw.title, 300), company: str(raw.company, 300), location: str(raw.location, 200), url: str(raw.url, 2000), host: str(raw.host, 200), text: str(raw.text, 30000) };
  if (!/^https?:\/\//.test(job.url)) job.url = "";
  if (job.text.length < 150) return { error: "Le texte de l'offre n'a pas été trouvé sur cette page. Ouvrez l'offre elle-même (pas la liste des résultats), puis réessayez. Vous pouvez aussi coller le texte.", job };
  return { job };
}

/** Script du raccourci (« Exécuter JavaScript sur la page web ») ou du favori, à partir de l'extracteur de l'extension. */
export function buildShareScript(extractJs, appUrl, kind = "shortcut") {
  const extract = String(extractJs).replace(/^\s*\/\/.*\n/, "").trim().replace(/;\s*$/, "");
  const build = `var LARPEUR_APP=${JSON.stringify(appUrl)};
var r=null;try{r=${extract};}catch(e){}
if(!r){var t=(document.querySelector("main")||document.body).innerText||"";r={title:document.title,company:"",location:"",url:location.href,host:location.hostname.replace(/^www\\./,""),text:t.replace(/[ \\t]+/g," ").replace(/\\n{3,}/g,"\\n\\n").trim().slice(0,12000)};}
var u=LARPEUR_APP+"#job="+encodeURIComponent(JSON.stringify({v:1,title:r.title||"",company:r.company||"",location:r.location||"",url:r.url||location.href,host:r.host||"",text:r.text||""}));`;
  if (kind === "bookmarklet") return "javascript:(function(){" + build.replace(/\s*\n\s*/g, " ") + "location.href=u;})()";
  return build + "\ncompletion(u);";
}
