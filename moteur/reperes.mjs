// Repères métier : ce que le référentiel public ROME attend pour un intitulé de poste.
// Sert à donner une idée de ce que montrent les bons CV du métier, sans lire le CV de personne.
import { METIERS } from "./metiers.mjs";

const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const VIDE = new Set("de du des la le les d l et en a au aux h f hf fh cdi cdd stage alternance junior senior confirme debutant temps plein partiel".split(" "));
const mots = (s) => fold(s).split(" ").filter((w) => w.length > 2 && !VIDE.has(w)).map((w) => w.replace(/(es|e|s|x)$/, ""));
const GENERIQUE = new Set("responsabl conseiller chef agent assistant charg technicien employ ouvrier operateur directeur gestionnair vendeur aid animateur ingenieur auxiliair employe".split(" "));

/** Nom de fichier de la fiche du métier sur le site : metiers/<nom>.html */
export const ficheMetier = (m) => fold(m.nom).replace(/ /g, "-");

/** Fiche métier la plus proche de l'intitulé, ou null si rien de convaincant. */
export function repereMetier(intitule) {
  const t = " " + fold(intitule) + " ", mt = new Set(mots(intitule));
  if (!mt.size) return null;
  const tete = mots(intitule)[0];
  let best = null, score = 0;
  for (const m of METIERS) {
    for (const nom of [m.nom, ...m.alias]) {
      const f = fold(nom), mn = mots(nom); if (!f || !mn.length) continue;
      const communs = mn.filter((w) => mt.has(w)).length;
      let s = 0;
      if (t.includes(" " + f + " ")) s = 1 + f.length / 100;              // le nom entier est dans l'intitulé
      else if (communs === mn.length) s = 0.9 + mn.length / 100;           // tous ses mots y sont
      else if (nom === m.nom && mn[0] === tete && (communs >= 2 || !GENERIQUE.has(tete))) s = 0.6 + communs / 10; // même métier de base
      if (s > score) { score = s; best = m; }
    }
  }
  return score >= 0.6 ? best : null;
}

/** Pour chaque repère : est-il déjà visible dans le CV ? (racines de mots communes, rien n'est ajouté) */
const CREUX = new Set("selon pendant besoin ses son leur pour avec dans une des les aux sur par ainsi autre lors afin adapter realiser assurer effectuer utiliser mettre respecter faire preuve etre regle regles".split(" "));
const racines = (s) => fold(s).split(" ").filter((w) => w.length > 3 && !CREUX.has(w)).map((w) => w.slice(0, 6));
export function reperesDansCv(metier, cv) {
  const sc = new Set(racines(cv));
  const voir = (texte) => { const m = [...new Set(racines(texte))]; return m.length ? m.filter((w) => sc.has(w)).length / m.length >= 0.5 : false; };
  const liste = (l) => l.map((texte) => ({ texte, vu: voir(texte) }));
  return { savoirFaire: liste(metier.savoirFaire), savoirs: liste(metier.savoirs), savoirEtre: liste(metier.savoirEtre) };
}
