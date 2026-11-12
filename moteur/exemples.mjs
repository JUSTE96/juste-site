// Offres et CV d'exemple, un par domaine. Rédigés pour la démonstration : ce ne sont pas de vraies annonces
// ni les CV de vraies personnes. Servent à l'accueil (« Situez-vous ») et à l'atelier (offre d'exemple).

const offre = (titre, ligne, missions, profil) =>
  `${titre} (H/F)\n${ligne}\n\nVos missions\n${missions.map((m) => "• " + m).join("\n")}\n\nVotre profil\n${profil.map((p) => "• " + p).join("\n")}\n\nAvantages\n• Mutuelle, prime annuelle`;

export const DOMAINES = [
  {
    id: "soin", nom: "Soin", intitule: "Aide-soignant", ligne: "CDI · Nancy",
    offre: offre("Aide-soignant", "CDI – Nancy",
      ["Accompagner les patients dans les gestes du quotidien", "Réaliser les soins d'hygiène et de confort", "Transmettre les informations à l'équipe soignante"],
      ["Diplôme d'État d'aide-soignant (DEAS) exigé", "Une première expérience à l'hôpital ou en EHPAD est souhaitée", "Soins d'hygiène et de confort", "Transmissions écrites et orales à l'équipe soignante", "Sens de l'écoute, patience et esprit d'équipe", "Permis B serait un plus"]),
    cv: "Karim Benali\nExpériences\n2022 - 2025 Aide-soignant, EHPAD Les Glycines, Metz : soins d'hygiène et de confort, accompagnement des résidents, transmissions à l'équipe soignante\n2020 - 2022 Agent de service hospitalier, CHR Metz\nFormation\nDiplôme d'État d'aide-soignant (DEAS), 2022\nQualités\nPatience, écoute, travail en équipe",
  },
  {
    id: "domicile", nom: "Aide à la personne", intitule: "Auxiliaire de vie", ligne: "CDI · Rennes",
    offre: offre("Auxiliaire de vie", "CDI – Rennes et alentours",
      ["Aider les personnes âgées dans les actes de la vie quotidienne", "Préparer les repas et entretenir le logement", "Maintenir le lien avec la famille et les soignants"],
      ["Permis B et véhicule indispensables", "Diplôme DEAES ou titre ADVF souhaité", "Aide au lever, à la toilette et aux repas", "Expérience auprès de personnes âgées appréciée", "Ponctualité, discrétion et bienveillance", "Formation aux premiers secours (PSC1 ou SST) : un plus"]),
    cv: "Nadia Leroy\nExpériences\n2021 - 2025 Aide à domicile, ADMR Rennes : aide au lever, à la toilette et aux repas de personnes âgées, courses, entretien du logement\n2018 - 2021 Agent d'entretien\nFormation\nTitre professionnel ADVF, 2021\nDivers\nPermis B, véhicule personnel\nPonctuelle, discrète",
  },
  {
    id: "batiment", nom: "Bâtiment", intitule: "Maçon", ligne: "CDI · Toulouse",
    offre: offre("Maçon", "CDI – Toulouse",
      ["Monter des murs en blocs et en briques", "Réaliser des coffrages et couler des dalles", "Lire les plans et implanter les ouvrages"],
      ["CAP ou BEP maçonnerie exigé", "2 ans d'expérience sur chantier indispensable", "Lecture de plans et implantation d'ouvrages", "Coffrage, ferraillage et pose de blocs", "Respect des règles de sécurité et travail en équipe", "CACES ou permis B serait un plus"]),
    cv: "Lucas Moreau\nExpériences\n2020 - 2025 Maçon, Bâti Sud, Toulouse : pose de blocs et de briques, coffrage, ferraillage, dalles béton, lecture de plans\n2018 - 2020 Apprenti maçon\nFormation\nCAP maçonnerie, 2020\nDivers\nPermis B\nTravail en équipe, respect des règles de sécurité",
  },
  {
    id: "restauration", nom: "Restauration", intitule: "Cuisinier", ligne: "CDI · Bordeaux",
    offre: offre("Cuisinier", "CDI – Bordeaux",
      ["Préparer les entrées, plats et desserts de la carte", "Dresser les assiettes pendant le service", "Tenir son poste propre et rangé"],
      ["1 an d'expérience en cuisine indispensable", "CAP cuisine souhaité", "Connaissance des règles d'hygiène HACCP", "Préparations chaudes et froides, dressage des assiettes", "Rapidité, organisation et esprit d'équipe", "Expérience en restauration traditionnelle : un plus"]),
    cv: "Inès Garcia\nExpériences\n2022 - 2025 Commis puis cuisinière, Brasserie du Port, Bordeaux : préparations chaudes et froides, dressage des assiettes, respect des règles d'hygiène HACCP\n2021 - 2022 Commis de cuisine, restauration traditionnelle\nFormation\nCAP cuisine, 2021\nQualités\nRapide, organisée, esprit d'équipe",
  },
  {
    id: "logistique", nom: "Logistique", intitule: "Préparateur de commandes", ligne: "CDI · Lille",
    offre: offre("Préparateur de commandes", "CDI – Lille",
      ["Préparer les commandes à l'aide d'un terminal de scan", "Contrôler les colis avant expédition", "Ranger les produits et tenir les stocks"],
      ["CACES 1 exigé", "Une première expérience en entrepôt est souhaitée", "Préparation de commandes avec un terminal de scan", "Contrôle des colis et tenue des stocks", "Ponctualité, rigueur et esprit d'équipe", "Permis B serait un plus"]),
    cv: "Yanis Petit\nExpériences\n2023 - 2025 Préparateur de commandes, entrepôt LogiNord, Lille : préparation de commandes au terminal de scan, contrôle des colis, tenue des stocks\n2022 - 2023 Manutentionnaire en entrepôt\nFormation\nCACES 1, 3 et 5 (2023)\nBac pro logistique, 2022\nQualités\nPonctuel, rigoureux",
  },
  {
    id: "administratif", nom: "Administratif", intitule: "Assistant administratif", ligne: "CDI · Nantes",
    offre: offre("Assistant administratif", "CDI – Nantes",
      ["Accueillir les visiteurs et répondre au téléphone", "Rédiger les courriers et tenir les agendas", "Classer et suivre les dossiers"],
      ["2 ans d'expérience en secrétariat ou gestion administrative indispensable", "Bac +2 souhaité (BTS gestion, assistant de manager)", "Maîtrise du pack Office (Word, Excel, Outlook)", "Rédaction de courriers et gestion d'agenda", "Organisation, discrétion et sens du relationnel", "Anglais professionnel serait un plus"]),
    cv: "Claire Dubois\nExpériences\n2019 - 2025 Assistante administrative, cabinet Lemaire, Nantes : accueil, rédaction de courriers, gestion d'agenda, classement des dossiers\n2017 - 2019 Secrétaire médicale\nFormation\nBTS assistant de manager, 2017\nCompétences\nWord, Excel, Outlook\nOrganisée, discrète\nAnglais scolaire",
  },
  {
    id: "vente", nom: "Vente", intitule: "Vendeur conseil", ligne: "CDI · Marseille",
    offre: offre("Vendeur conseil", "CDI – Marseille",
      ["Accueillir et conseiller les clients", "Tenir la caisse", "Mettre les produits en rayon"],
      ["Une première expérience en vente ou en relation client est indispensable", "Accueil et conseil des clients en magasin", "Encaissement et tenue de caisse", "Mise en rayon et réassort", "Sourire, dynamisme et esprit d'équipe", "Bac ou CAP vente apprécié"]),
    cv: "Emma Roux\nExpériences\n2022 - 2025 Vendeuse, magasin de sport, Marseille : accueil et conseil des clients, encaissement, mise en rayon et réassort\n2021 - 2022 Hôtesse de caisse, supermarché\nFormation\nBac pro commerce, 2021\nQualités\nSouriante, dynamique, esprit d'équipe",
  },
  {
    id: "banque", nom: "Banque", intitule: "Conseiller clientèle bancaire", ligne: "CDI · Lyon",
    offre: offre("Conseiller clientèle bancaire", "CDI – Lyon 3e",
      ["Accueillir et conseiller une clientèle de particuliers", "Développer un portefeuille de 400 clients", "Proposer des produits d'épargne et de crédit"],
      ["Bac +2 minimum (BTS NDRC, Banque) exigé", "2 ans d'expérience en relation client indispensable", "Maîtrise du pack Office et d'un CRM", "Anglais courant serait un plus", "Sens du relationnel, rigueur et esprit d'équipe", "Certification AMF souhaitée"]),
    cv: "Léa Martin\nExpériences\n2021 - 2024 Vendeuse, Fnac Lyon : conseil client, encaissement, fidélisation de la clientèle\n2019 - 2020 Hôtesse d'accueil, salon du livre\nFormation\nBTS NDRC, 2021\nCompétences\nExcel, Word, Salesforce (CRM)\nAnglais B1",
  },
];

export const domaine = (id) => DOMAINES.find((d) => d.id === id) || DOMAINES[0];
