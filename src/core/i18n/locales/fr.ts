import type { Translations } from "../index";

export const fr: Translations = {
  cardName: "Helios",
  cardDescription:
    "☀️ Une vue 2.5D temps réel de votre maison avec le soleil, la météo, la production solaire, la batterie et le réseau, plus les ombres projetées et une frise temporelle interactive",

  period: {
    rangeLabel: "Période",
    forecast: "Prévision",
    yesterday: "Hier",
    today: "Aujourd'hui",
    week: "Semaine",
    month: "Mois",
    year: "Année",
  },

  compass: "N,NE,E,SE,S,SO,O,NO",

  cloudCover: {
    cloudLow: "Couverture basse",
    cloudMid: "Couverture moyenne",
    cloudHigh: "Couverture haute",
  },

  mapConfig: {
    section: "Configuration de la carte",
    intro:
      "Le fond de carte est dessiné à partir des tuiles vectorielles OpenStreetMap. Auto suit votre thème, Dark / Light en force un, et Custom vous laisse choisir chaque couleur et masquer les couches.",
    modeAuto: "Auto",
    modeDark: "Dark",
    modeLight: "Light",
    modeCustom: "Custom",
    land: "Fond de carte",
    water: "Eau",
    wood: "Forêts et bois",
    grass: "Espaces verts",
    sand: "Sable",
    wetland: "Zones humides",
    ice: "Glace",
    landuse: "Zones bâties",
    roadMajor: "Grandes routes",
    roadMinor: "Petites routes",
    roadCasing: "Contour des routes",
    path: "Chemins",
    rail: "Voies ferrées",
    building: "Bâtiments",
    boundary: "Limites",
  },

  editor: {
    weatherEnabled: "Effets météo",
    weatherEnabledHint:
      "Peint le vrai ciel au-dessus de la scène : soleil, nuages, pluie, neige et orages d'après votre météo locale, en suivant la chronologie à mesure que vous la parcourez. Désactivé, la scène reste dégagée.",
    temperatureEntity: "Capteur de température",
    temperatureEntityHelp:
      "Facultatif. Utilisez un capteur de température extérieure local (°C) à la place de la valeur Open-Meteo pour la puce de température. Son état en direct et son historique d'enregistreur alimentent le direct et le passé ; les heures de prévision restent sur le modèle.",
    humidityEntity: "Capteur d'humidité",
    humidityEntityHelp:
      "Facultatif. Utilisez un capteur d'humidité relative local (%) à la place de la valeur Open-Meteo, pour le direct et le passé.",
    cloudCoverEntity: "Capteur de couverture nuageuse",
    cloudCoverEntityHelp:
      "Facultatif. Utilisez un capteur de couverture nuageuse local (%) pour piloter le rendu du ciel (soleil, grisaille) à la place de la valeur Open-Meteo, pour le direct et le passé.",
    precipitationEntity: "Capteur de précipitations",
    precipitationEntityHelp:
      "Facultatif. Utilisez un capteur de précipitations local (mm) pour piloter la couche de pluie à la place de la valeur Open-Meteo, pour le direct et le passé.",
    snowfallEntity: "Capteur de chutes de neige",
    snowfallEntityHelp:
      "Facultatif. Utilisez un capteur de chutes de neige local (cm) pour piloter la couche de neige à la place de la valeur Open-Meteo, pour le direct et le passé.",
    weatherEntity: "Entité météo",
    weatherEntityHelp:
      "Facultatif. Utilisez une entité météo Home Assistant pour piloter la condition (pluie / neige / orage) à la place de la valeur Open-Meteo, pour le direct et le passé. Les heures de prévision restent sur le modèle.",
    chipTemperature: "Affichage de la température",
    chipHumidity: "Affichage de l'humidité",
    chipCost: "Affichage du coût",
    locationSection: "Emplacement de la maison",
    homeLatitude: "Latitude du domicile",
    homeLongitude: "Longitude du domicile",
    locationHint:
      "Remplace l'adresse du domicile utilisée comme centre de la carte. Laissez les deux champs vides pour utiliser le domicile configuré dans Home Assistant. La substitution n'est appliquée que lorsque LES DEUX champs contiennent des coordonnées valides.",
    uiAndMapSection: "UI",
    autoRotate: "Rotation auto de la caméra",
    autoRotateHint:
      "Après quelques secondes d'inactivité, la caméra tourne lentement autour de la maison (environ 1,5°/s, dans le sens inverse du mouvement apparent du soleil). Un glissement à un doigt met la rotation en pause immédiatement, elle reprend dès que vous lâchez. À éviter sur les appareils très anciens : la rotation auto force un rendu chaque seconde.",
    autoRotateOn: "Activée",
    autoRotateOff: "Désactivée",
    dataDisplaySection: "Affichage des données",
    displayUpdateFrequency: "Détail du graphique",
    displayUpdateFrequencyHelp:
      "Combien de points par heure les graphiques tracent. La donnée elle-même est toujours en 5 minutes (statistiques Home Assistant) - ce réglage ne change que la densité de tracé de la courbe : 1 = un point par heure (le plus lisse, le plus léger), 6 = un point toutes les 10 minutes (détail maximal, le plus lourd). Par défaut 4 = un point toutes les 15 minutes. Baissez-le sur un appareil ancien ou lent pour réduire le coût d'affichage. La courbe de prévision suit la même cadence : un réglage plus fin fait donc ressortir les creux d'ombre courts (un arbre qui coupe la production une demi-heure) qu'une courbe horaire enjambe.",
    valueDecimals: "Décimales",
    valueDecimalsHelp:
      "Nombre de décimales affichées sur chaque valeur, pour que les chips restent uniformes. S'applique aux valeurs en kW (les watts entiers restent sans décimale) et aux kWh. De 0 à 3, par défaut 1.",
    maxExpectedPower: "Puissance max attendue",
    maxExpectedPowerHelp:
      "La puissance à laquelle un flux s'anime à pleine vitesse. Tous les flux sont cadencés sur cette référence unique, donc un flux plus important paraît toujours plus rapide qu'un plus faible, quel que soit son sens. Montez-la pour une grosse installation, baissez-la pour une petite. Par défaut 5000 W.",
    sunChipMode: "Contenu de la puce soleil",
    sunChipModeHelp:
      "Ce qu'affiche la puce soleil : l'irradiance solaire en direct (par défaut) ou la position du soleil (azimut et élévation). La position ne nécessite aucun capteur, elle vient des calculs solaires de la carte.",
      batteryChipMode: "Affichage du chip batterie",
      batteryChipModeHelp: "Ce qu'affiche le chip batterie : la puissance en direct (par défaut) ou l'état de charge (%). Il bascule sur la valeur réellement fournie par votre batterie.",
      batteryChipModePower: "Puissance",
      batteryChipModeSoc: "État de charge",
    sunChipModeIrradiance: "Irradiance",
    sunChipModePosition: "Position du soleil",
    powerUnit: "Unité de puissance",
    powerUnitHelp:
      "Unité de tous les affichages de puissance de la carte (chips, infobulles du graphe). L'énergie suit aussi, pour que la carte reste cohérente : kW va avec kWh, W avec Wh.",
    irradianceUnit: "Unité de constante solaire",
    irradianceUnitHelp:
      "Unité de la constante solaire (irradiance) affichée au-dessus du soleil.",
    batterySign: "Badge batterie : charge affichée en",
    batterySignHelp:
      "Ce réglage change seulement l'affichage du badge (le signe + ou -), pas le flux : le sens charge/décharge est déterminé automatiquement à partir des compteurs de votre dashboard Énergie.",
    batterySignDefault: "- en charge",
    batterySignInverted: "+ en charge",
    batterySignHidden: "Masqué (magnitude seule)",
    noUiMode: "Mode sans interface",
    noUiModeHint:
      "Fait disparaître la timeline et les contrôles de la carte après quelques secondes d'inactivité. Le moindre appui ou mouvement les fait revenir. Idéal pour un affichage mural.",
    noUiDelay: "Délai avant masquage",
    noUiDelayHint:
      "Secondes d'inactivité avant que la frise et les contrôles disparaissent en mode sans interface. 0 garde l'interface masquée en permanence. Utilisé uniquement quand le mode sans interface est activé.",
    showTimeline: "Afficher la timeline",
    showTimelineHint:
      "Affiche la frise temporelle et le sélecteur de période sous la scène. Désactivé, il ne reste que la scène.",
    showDetailPanel: "Afficher les informations supplémentaires",
    showDetailPanelHint:
      "Autorise le mini-panneau par chip (métriques agrégées) à s'ouvrir en haut à droite au tap d'un chip. Désactivé, il ne s'affiche jamais.",
    showSunTimes: "Afficher les heures de lever / coucher du soleil",
    showSunTimesHint:
      "Affiche les heures de lever et de coucher du soleil et leurs marqueurs aux pieds de l'arc solaire.",
    showHorizonLine: "Afficher l'horizon du terrain",
    showHorizonLineHint: "Dessine la ligne d'horizon du relief autour de la maison, calculée à partir du terrain local. L'horizon atténue toujours le soleil de façon réaliste derrière les collines ; ceci ne fait qu'afficher ou masquer la ligne.",
    horizonLineColor: "Couleur de l'horizon du terrain",
    horizonLineColorHint: "Couleur de la ligne d'horizon du terrain.",
    lockRotation: "Verrouiller la rotation",
    lockRotationHint:
      "Faites glisser l'aperçu pour pivoter et incliner la scène jusqu'à la vue souhaitée, puis activez ceci. Le verrou fige cette vue (le glisser-pour-pivoter et l'auto-rotation au repos sont désactivés) et enregistre l'angle dans la carte, pour un rendu identique sur chaque appareil et navigateur. Désactivez-le pour pivoter à nouveau librement.",
    chipsSection: "Affichage des entités",
    chipsIntro:
      "Affichez ou masquez chaque entité, et choisissez son icône et sa couleur. La maison suit le chip sélectionné, ou votre couleur primaire par défaut.",
    chipIrradiance: "Affichage de l'irradiance",
    chipProduction: "Affichage de la production",
    chipGrid: "Affichage du réseau",
    chipBattery: "Affichage de la batterie",
    chipHome: "Affichage de la consommation",
    groupsConfigTitle: "Configuration des groupes",
    optionalSensors: "Capteurs optionnels",
    solarIrradianceEntity: "Entité d'irradiance solaire",
    solarIrradianceEntityHelp:
      "Choisissez un capteur qui remonte l'irradiance solaire globale en W/m² (typiquement une station météo Ecowitt / Davis / perso). Quand il est défini, son état actuel et son historique recorder remplacent Open-Meteo pour les valeurs live + passées partout où elles apparaissent (nombre sur la pastille soleil, axe Y du graphique PV, coloration de l'arc solaire). Les heures de prévision continuent d'utiliser Open-Meteo, un capteur ne peut pas avoir de valeurs dans le futur.",
    liveDataTitle: "État de la configuration",
    liveDataIntro:
      "Les chips live n'affichent que des capteurs mesurés. Chaque famille a besoin du capteur de puissance optionnel de sa source du dashboard énergie - les courbes et totaux viennent toujours de vos compteurs.",
    liveSolarOk: "Solaire : capteur de puissance live détecté.",
    liveSolarMissing:
      "Solaire : pas de capteur de puissance live, le chip de production reste masqué. Ajoutez-le dans Paramètres > Tableaux de bord > Énergie > Panneaux solaires.",
    liveSolarAbsent:
      "Solaire : pas configuré dans votre dashboard énergie. Ajoutez des panneaux solaires pour obtenir le chip de production.",
    liveGridOk: "Réseau : capteur de puissance live détecté.",
    liveGridMissing:
      "Réseau : pas de capteur de puissance live, les chips import/export restent masqués. Ajoutez-le dans Paramètres > Tableaux de bord > Énergie > Réseau.",
    liveGridMiswired:
      "Réseau : le capteur live contredit vos compteurs (il semble ne mesurer qu'un seul sens). Les chips restent masqués - configurez un capteur signé ou le mode Deux capteurs.",
    liveGridAbsent:
      "Réseau : pas configuré dans votre dashboard énergie. Ajoutez le réseau pour obtenir les chips import et export.",
    liveBatteryOk:
      "Batterie : les capteurs de puissance couvrent chaque batterie.",
    liveBatteryMissing:
      "Batterie : puissance live manquante sur au moins une batterie, le chip de puissance reste masqué. Ajoutez le(s) capteur(s) dans Paramètres > Tableaux de bord > Énergie > Batterie.",
    liveBatteryAbsent:
      "Batterie : pas configurée dans votre dashboard énergie. Ajoutez une batterie pour obtenir le chip charge et décharge.",
    liveHomeOk:
      "Consommation de la maison : affichée, dérivée des familles live ci-dessus.",
    liveHomeNote:
      "La consommation de la maison s'affiche dès que chaque famille configurée ci-dessus a son capteur live.",
    openEnergyConfig: "Ouvrir la configuration Énergie",
    buildingsSection: "Maison & bâtiments",
    buildingsHint:
      "Pour ménager les performances en zone urbaine dense, seuls les bâtiments dans le rayon configuré autour de la maison sont rendus en 3D. La maison elle-même reste toujours à pleine opacité, les bâtiments voisins sont rendus en transparence pour donner le contexte sans concurrencer les données. Le rayon de regroupement permet d'inclure les bâtiments attenants (véranda, dépendance, garage) dans le groupe « maison ».",
    displayRadius: "Rayon d'affichage",
    displayRadiusHelp:
      "Rayon autour de la maison dans lequel les bâtiments sont récupérés et affichés, jusqu'au bord du disque de carte estompé. Baissez-le pour alléger le rendu sur un appareil lent - à 0, seule la maison reste.",
    buildingCount: "Nombre de bâtiments",
    buildingCountHelp:
      "Nombre maximum de bâtiments voisins à afficher. Baissez-le pour alléger le rendu sur un appareil lent.",
    buildingRealSize: "Hauteurs réelles des bâtiments",
    buildingRealSizeOn: "Oui",
    buildingRealSizeOff: "Non",
    buildingRealSizeHint:
      "Oui : utilise les hauteurs réelles OpenStreetMap (plafonnées pour garder un cadrage lisible). Non : applique à chaque bâtiment la hauteur fixe ci-dessous.",
    buildingHeight: "Hauteur des bâtiments",
    hiddenDevicesEmpty:
      "Aucun appareil individuel n'est encore suivi dans votre tableau de bord Énergie. Ajoutez-y la consommation par appareil pour les gérer ici.",
    deviceVisibilityLabel: "Afficher l'appareil",
    group: "Groupe",
    noGroup: "Aucun groupe",
    groupAssignHint:
      "Glissez vos appareils dans un groupe. Ce qui reste en bas n'appartient à aucun groupe.",
    groupDropHere: "Déposez un appareil ici",
    backToLive: "Retour au live",
    buildingClusterRadius: "Rayon de regroupement maison",
    buildingClusterRadiusHelp:
      "Rayon autour de la maison dans lequel les dépendances attenantes (vérandas, garages, abris) sont considérées comme faisant partie de la maison : elles sont rendues à la pleine opacité et couleur de la maison, et non en voisines estompées. À 0, seul le bâtiment principal est conservé.",
    buildingOpacity: "Opacité des bâtiments voisins",
    buildingColor: "Couleur des bâtiments",
    buildingColorHelp:
      "Teinte de base appliquée aux bâtiments environnants dans la scène.",
    shadowsSection: "Ombres",
    shadowsEnabled: "Afficher les ombres",
    shadowsEnabledOn: "Affichées",
    shadowsEnabledOff: "Masquées",
    shadowsEnabledHint:
      "Active ou masque les ombres projetées au sol par les bâtiments au fil de la course du soleil.",
    shadowOpacity: "Opacité des ombres",
    shadowOpacityHint: "Opacité des ombres projetées au sol.",
    resetSection: "Réinitialisation",
    resetSectionHint:
      "Outils de maintenance : recharger les données mises en cache, ou remettre toutes les options à leur valeur par défaut.",
    resetCacheButton: "Réinitialiser le cache des données",
    resetCacheWarning:
      "Attention : ce bouton re-télécharge tout ce que la carte a mis en cache - la météo Open-Meteo, toutes les séries d'énergie en mémoire (production, réseau, batterie, appareils, irradiance), la calibration de la prévision affinée et les empreintes de bâtiments OpenFreeMap - pour toutes les cartes Helios ouvertes. Utile pour débloquer une calibration figée ou des données météo/carte périmées - un rechargement complet prend quelques minutes selon votre serveur HA. Vos données dans Home Assistant ne sont jamais touchées.",
    resetCacheDone: "Cache vidé ✓",
    resetOptionsButton: "Réinitialiser les options",
    resetOptionsConfirm: "Cliquez à nouveau pour confirmer",
    resetOptionsWarning:
      "Attention : ceci remet TOUTES les options de cette carte à leurs valeurs par défaut - visibilité, couleurs et icônes des chips, noms/couleurs/icônes des groupes, bâtiments, ombres, unités et tous les autres réglages. Vos données Home Assistant et votre tableau de bord Énergie ne sont pas touchés, mais votre personnalisation est effacée et irrécupérable.",
    resetOptionsDone: "Options réinitialisées ✓",
    aboutSection: "À propos",
    aboutVersionLabel: "Version",
    aboutRepoCard: "Helios",
    aboutCoffeeMessage:
      "Je développe Helios seul, surtout la nuit, à traquer les petits détails jusqu'à ce que le soleil et votre énergie prennent vie à l'écran. S'il a trouvé une place sur votre tableau de bord, ça me rend déjà heureux - une étoile sur GitHub encore plus, et un café garde tout ça en mouvement.",
    aboutDeveloperLabel: "Développeur",
    aboutDeveloperLinkedIn: "LinkedIn",
    aboutCoffeeLink: "Buy me a coffee",
  },
};
