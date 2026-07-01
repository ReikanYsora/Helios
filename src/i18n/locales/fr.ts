import type { Translations } from '../index';

//Notes de traduction (FR) :
//  - "Cloud cover" -> "Couverture nuageuse" (terme météo standard FR)
//  - "Global Horizontal Irradiance" -> "Irradiance horizontale globale"
//    (terme scientifique standard, repris par Météo-France et l'INES)
//  - "Hillshade" -> "Ombrage du relief" (rendu cartographique standard)
//  - On garde le tutoiement informel pour rester cohérent avec le ton
//    de Home Assistant en français.

export const fr: Translations = {
    cardName:        'Helios',
    cardDescription: '☀️ Une vue 3D temps réel de ta maison avec le soleil, la météo, la production solaire, la batterie et le réseau, plus les ombres projetées, une frise temporelle interactive et une horloge énergétique sur 24 h',

    period:
    {
        rangeLabel: 'Période',
        standard: 'Standard',
        today: "Aujourd'hui",
        now:   'Maintenant',
        week:  'Semaine',
        month: 'Mois',
        year:  'Année',
    },

    clock:
    {
        compassN: 'N',
        compassS: 'S',
        compassE: 'E',
        compassW: 'O',
        cloudLow:  'Couverture basse',
        cloudMid:  'Couverture moyenne',
        cloudHigh: 'Couverture haute',
        total:     'Total',
    },

    editor:
    {
        locationSection:    'Localisation',
        homeLatitude:       'Latitude du domicile',
        homeLongitude:      'Longitude du domicile',
        locationHint:       'Remplace l\'adresse du domicile utilisée comme centre de la carte. Laissez les deux champs vides pour utiliser le domicile configuré dans Home Assistant. La substitution n\'est appliquée que lorsque LES DEUX champs contiennent des coordonnées valides.',
        uiAndMapSection:    'UI',
        autoRotate:         'Rotation auto de la caméra',
        autoRotateHint:     'Après quelques secondes d\'inactivité, la caméra tourne lentement autour de la maison (environ 1,5°/s, dans le sens inverse du mouvement apparent du soleil). Un glissement à un doigt met la rotation en pause immédiatement, elle reprend dès que tu lâches. À éviter sur les appareils très anciens : la rotation auto force un rendu chaque seconde.',
        autoRotateOn:       'Activée',
        autoRotateOff:      'Désactivée',
        dataDisplaySection:           'Entités et affichage des données',
        displayUpdateFrequency:       'Détail du graphique',
        displayUpdateFrequencyHelp:   'Combien de points par heure les graphiques tracent. La donnée elle-même est toujours en 5 minutes (statistiques Home Assistant) ; ce réglage ne change que la densité de tracé de la courbe : 1 = un point par heure (le plus lisse, le plus léger), 6 = un point toutes les 10 minutes (détail maximal, le plus lourd). Par défaut 4 = un point toutes les 15 minutes. Baissez-le sur un appareil ancien ou lent pour réduire le coût d\'affichage. La courbe de prévision suit la même cadence : un réglage plus fin fait donc ressortir les creux d\'ombre courts (un arbre qui coupe la production une demi-heure) qu\'une courbe horaire enjambe.',
        valueDecimals:                'Décimales',
        valueDecimalsHelp:            'Nombre de décimales affichées sur chaque valeur, pour que les chips restent uniformes. S\'applique aux valeurs en kW (les watts entiers restent sans décimale) et aux kWh. De 0 à 3, par défaut 1.',
        powerUnit:                    'Unité de puissance',
        powerUnitHelp:                'Unité de tous les affichages de puissance de la carte (chips, infobulles du graphe, cadran). L\'énergie suit aussi, pour que la carte reste cohérente : kW va avec kWh, W avec Wh.',
        irradianceUnit:               'Unité de constante solaire',
        irradianceUnitHelp:           'Unité de la constante solaire (irradiance) affichée au-dessus du soleil.',
        batterySign:                  'Signe batterie',
        batterySignHelp:              'Signe affiché sur le chip batterie. Par défaut : moins en charge, plus en décharge ; Inversé : l\'inverse ; Masqué : la valeur sans signe.',
        batterySignDefault:           'Par défaut',
        batterySignInverted:          'Inversé',
        batterySignHidden:            'Masqué',
        homeConsumptionEntity:        'Remplacer la consommation maison',
        homeConsumptionEntityHelp:    'Affiche la valeur de ce capteur sur l\'indicateur de consommation maison, au lieu de la valeur calculée. Seul cet affichage change : les flux animés et l\'historique restent sur le bilan solaire, réseau et batterie. Un capteur direct s\'écarte souvent de quelques watts (pertes de mesure, capteurs désynchronisés), un écart qui ne se place pas proprement dans les flux.',
        installationSection: 'Installation photovoltaïque',
        installationHint:   'Toutes les entités lues par Helios (production PV, import / export grid, puissance batterie et SoC) sont récupérées depuis le [dashboard Énergie de Home Assistant](/config/energy). Cette section sert uniquement à ajouter des détails sur ton installation pour affiner la prévision : capteur d\'irradiance optionnel.',
        solarIrradianceEntity:     'Entité d\'irradiance solaire',
        solarIrradianceEntityHelp: 'Choisis un capteur qui remonte l\'irradiance solaire globale en W/m² (typiquement une station météo Ecowitt / Davis / perso). Quand il est défini, son état actuel et son historique recorder remplacent Open-Meteo pour les valeurs live + passées partout où elles apparaissent (nombre sur la pastille soleil, axe Y du graphique PV, coloration de l\'arc solaire). Les heures de prévision continuent d\'utiliser Open-Meteo, un capteur ne peut pas avoir de valeurs dans le futur.',
        customEntity:              'Entité personnalisée',
        customEntityHelp:          'Choisis n\'importe quelle entité de puissance (W/kW) ou d\'énergie (Wh/kWh) à afficher dans un chip rouge supplémentaire en haut à gauche.',
        customEntityIcon:          'Icône de l\'entité personnalisée',
        customEntityColor:         'Couleur de l\'entité personnalisée',
        customEntityColorHelp:     'Couleur du chip de l\'entité personnalisée, de sa ligne de liaison et de son anneau d\'horloge.',
        buildingsSection:   'Maison & bâtiments',
        homeColor:          'Couleur de la maison',
        homeColorHelp:      'Couleur de la maison : la pastille maison et tous les affichages de consommation.',
        buildingsHint:      'Pour ménager les performances en zone urbaine dense, seuls les bâtiments dans le rayon configuré autour de la maison sont rendus en 3D. La maison elle-même reste toujours à pleine opacité, les bâtiments voisins sont rendus en transparence pour donner le contexte sans concurrencer les données. Le rayon de regroupement permet d\'inclure les bâtiments attenants (véranda, dépendance, garage) dans le groupe « maison ».',
        displayRadius:         'Rayon d\'affichage',
        displayRadiusHelp:     'Rayon autour de la maison dans lequel les bâtiments sont récupérés et affichés, jusqu\'au bord du disque de carte estompé. Baissez-le pour alléger le rendu sur un appareil lent ; à 0, seule la maison reste.',
        buildingCount:         'Nombre de bâtiments',
        buildingCountHelp:     'Nombre maximum de bâtiments voisins à afficher. Baissez-le pour alléger le rendu sur un appareil lent.',
        buildingRealSize:      'Hauteurs réelles des bâtiments',
        buildingRealSizeOn:    'Oui',
        buildingRealSizeOff:   'Non',
        buildingRealSizeHint:  'Oui : utilise les hauteurs réelles OpenStreetMap (plafonnées pour garder un cadrage lisible). Non : applique à chaque bâtiment la hauteur fixe ci-dessous.',
        buildingHeight:        'Hauteur des bâtiments',
        buildingHeightHelp:    'Hauteur fixe appliquée à chaque bâtiment lorsque les hauteurs réelles sont désactivées.',
        buildingClusterRadius: 'Rayon de regroupement maison',
        buildingOpacity:       'Opacité des bâtiments voisins',
        buildingColor:         'Couleur des bâtiments',
        buildingColorHelp:     'Teinte de base appliquée aux bâtiments environnants dans la scène.',
        shadowsSection:        'Ombres',
        shadowsEnabled:        'Afficher les ombres',
        shadowsEnabledOn:      'Affichées',
        shadowsEnabledOff:     'Masquées',
        shadowsEnabledHint:    'Active ou masque les ombres projetées au sol par les bâtiments au fil de la course du soleil.',
        shadowOpacity:         'Opacité des ombres',
        shadowOpacityHint:     'Opacité des ombres projetées au sol.',
        resetSection:          'Réinitialisation',
        resetSectionHint:      'Outils de maintenance pour purger les données mises en cache par la carte.',
        resetCacheButton:      'Réinitialiser le cache des données',
        resetCacheWarning:     'Attention : ce bouton vide la météo Open-Meteo en cache local et l\'historique PV en mémoire pour TOUTES les cartes Helios ouvertes. La prévision affinée perdra ses 5 derniers jours de calibration le temps qu\'ils soient récupérés à nouveau (quelques minutes selon ton serveur HA). Tes données dans Home Assistant ne sont jamais touchées.',
        resetCacheDone:        'Cache vidé ✓',
        aboutSection:          'À propos',
        aboutVersionLabel:     'Version',
        aboutRepoCard:         'Helios',
        aboutCoffeeMessage:    'Helios est développé par un seul développeur passionné, avec beaucoup d\'énergie et peu de sommeil. Si tu aimes mon travail, une petite étoile sur GitHub m\'aide déjà énormément, et si tu le peux, un petit café garde le projet en vie.',
        aboutDeveloperLabel:    'Développeur',
        aboutDeveloperLinkedIn: 'LinkedIn',
        aboutCoffeeLink:       'Buy me a coffee',
    }
};
