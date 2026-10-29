// Réglages de l'appli mobile.
//   apiBase     → le serveur local quand l'appli est ouverte depuis ton ordinateur, sinon le serveur en ligne
//   shortcutUrl → le lien iCloud du raccourci « Analyser avec Juste » (facultatif)
window.LARPEUR_APP = Object.freeze({
  apiBase: /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? "http://localhost:3000" : "https://api.justecv.fr",
  shortcutUrl: ""
});
