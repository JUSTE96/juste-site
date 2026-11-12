// Vidéos d'illustration (générées par IA avec Higgsfield : les personnes montrées n'existent pas).
// Une seule liste fait foi. Une vidéo absente de la liste n'est pas demandée : son cadre garde le décor ou se masque.
//
// Pour héberger les vidéos avec le site : déposer les fichiers dans assets/cine/ sous les noms ci-dessous,
// puis mettre LOCAL à true.
(() => {
  const LOCAL = false;
  const HIGGSFIELD = "https://d8j0ntlcm91z4.cloudfront.net/user_3LuzSFiulO5IqGaI6Cuxp4xMzc4/";
  const clips = {
    "grand-age": "hf_20261112_083147_74ddbf4e-fcc7-4d66-b18a-4c45c54b14be.mp4",
    "batiment": "hf_20261112_084142_40911a7c-fcd9-4d01-abeb-0ebf284e07f0.mp4",
    "bureau": "hf_20261112_085437_3a18f000-4758-4075-b004-5f68e075e11e.mp4",
    "cuisine": "hf_20261112_090839_4270f7be-b2da-4f2a-80af-5f8647f73137.mp4",
    "logistique": "hf_20261112_092136_520c7aec-ba00-4c65-8af1-8f6141ab7e4d.mp4",
    "soin": "hf_20261112_093516_feaaa9f3-0a3a-45cb-a3c0-e6d1a5777ee8.mp4",
  };
  window.JUSTE_CLIPS = Object.fromEntries(Object.entries(clips).map(([nom, fichier]) => [nom, LOCAL ? `assets/cine/${nom}.mp4` : HIGGSFIELD + fichier]));
})();
