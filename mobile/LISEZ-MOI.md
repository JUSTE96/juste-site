# Application JusteCV (iPhone et Android)

Le site est déjà une application : installé sur l'écran d'accueil, il affiche quatre onglets (Mesurer, Modèles, Suivi, Guides) grâce à `appli.js`.
Ce dossier sert à l'emballer en vraie application pour l'App Store et Google Play, avec Capacitor. Il faut un Mac avec Xcode (iPhone) ou Android Studio (Android).

## Première fois
Depuis ce dossier `mobile/` :

    npm install
    npm run preparer
    npx cap add ios
    npx cap add android

## Lancer dans le simulateur iPhone

    npm run ios

Xcode s'ouvre : choisir un simulateur (iPhone 17 Pro) puis Exécuter.

## À faire avant l'App Store
- Icône : `assets/appli-1024.png` (à poser dans Assets.xcassets > AppIcon).
- Identifiant : `fr.justecv.app` (dans `capacitor.config.json`), à faire correspondre au compte développeur Apple.
- Apple refuse les simples sites emballés : prévoir au moins le partage d'une offre depuis Safari et l'import d'un CV en PDF.

`mobile/www`, `mobile/ios`, `mobile/android` et `mobile/node_modules` sont générés : ils ne sont pas dans le dépôt.
