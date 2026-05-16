import type { Translations } from '../index';

//Notes de traduction (FR) :
//  - "Cloud cover" → "Couverture nuageuse" (terme météo standard FR)
//  - "Global Horizontal Irradiance" → "Irradiance horizontale globale"
//    (terme scientifique standard, repris par Météo-France et l'INES)
//  - "Hillshade" → "Ombrage du relief" (rendu cartographique standard)
//  - On garde le tutoiement informel pour rester cohérent avec le ton
//    de Home Assistant en français.

export const fr: Translations = {
    cardName:        'HELIOS',
    cardDescription: 'Visualisation en temps réel de l\'énergie solaire et de la couverture nuageuse',

    placeholder:
    {
        subtitle: 'Exposition solaire & couverture nuageuse'
    },

    detail:
    {
        title:    'Vue détaillée',
        subtitle: 'Tableau de bord détaillé à venir.',
        exitHint: 'Cliquez n\'importe où pour quitter',
        todayLabel:         'Aujourd\'hui',
        todayProduced:      'produit',
        todayForecast:      'prévu',
        todayPeak:          'pic',
        todayNotStartedYet: 'production pas encore démarrée',
        tomorrowLabel:      'Demain',
        tomorrowPeak:       'pic prévu vers',
        batteryLabel:       'Batterie',
        batteryCharged:     'chargé',
        batteryDischarged:  'déchargé',
    },

    editor:
    {
        locationSection:    'Localisation',
        homeLatitude:       'Latitude du domicile *',
        homeLongitude:      'Longitude du domicile *',
        locationHint:       'Remplace l\'adresse du domicile utilisée comme centre de la carte. Laissez les deux champs vides pour utiliser le domicile configuré dans Home Assistant. La substitution n\'est appliquée que lorsque LES DEUX champs contiennent des coordonnées valides ; toute valeur partielle ou hors plage est ignorée silencieusement.',
        mapSection:         'Carte',
        mapStyle:           'Style de la carte *',
        mapStyleHint:       'Trois fonds de carte : Rues (sobre, urbain), Topo (lignes de niveau et tons terreux, idéal en zone vallonnée) ou Minimal (charge le fond Rues puis retire tous les libellés, icônes POI et boucliers routiers superflus pour gagner en performance). Les bâtiments 3D et les libellés se comportent à l\'identique sur Rues et Topo. La variante sombre du style choisi est utilisée automatiquement quand le thème de la carte est en mode sombre.',
        mapStyleStreet:     'Rues',
        cardTheme:          'Thème de la carte *',
        cardThemeHint:      'Bascule l\'habillage de la carte (pastilles, graphiques, boutons, infobulles, surlignage du scrub) ainsi que le fond de carte 3D entre un thème clair (par défaut, sur fond blanc) et un thème sombre (sur fond presque noir) pour que la carte s\'intègre proprement dans un tableau de bord Home Assistant clair ou sombre.',
        cardThemeLight:     'Clair',
        cardThemeDark:      'Sombre',
        showLabels:         'Afficher les libellés *',
        showLabelsHint:     'Affiche ou masque les noms de rues, numéros de bâtiments, points d\'intérêt et noms de quartiers du fond de carte.',
        labelsOn:           'Affichés',
        labelsOff:          'Masqués',
        autoRotate:         'Rotation auto de la caméra *',
        autoRotateHint:     'Après quelques secondes d\'inactivité, la caméra tourne lentement autour de la maison (environ 1,5°/s, dans le sens inverse du mouvement apparent du soleil). Tout pincement, glissement ou molette met la rotation en pause immédiatement, elle reprend dès que tu lâches.',
        autoRotateOn:       'Activée',
        autoRotateOff:      'Désactivée',
        timeline:           'Chronologie',
        timelineHint:       'Format des libellés de date affichés sur la chronologie et dans la pastille du scrub.',
        dateFormat:         'Format de date * (par défaut : mm-dd)',
        dateFormatHelp:     'Tokens : yyyy, yy, mm, dd. Exemples :',
        timeFormat:         'Format de l\'heure *',
        timeFormat12:       '12 h',
        timeFormat24:       '24 h',
        colors:             'Couleurs',
        colorsHint:         'Une couleur par grandeur, réutilisée partout où elle apparaît. La couleur du soleil peint l\'arc, le disque solaire et la zone haute de la chronologie. La couleur des nuages peint le disque au sol et la zone basse de la chronologie.',
        sunColor:           'Couleur du soleil *',
        cloudColor:         'Couleur des nuages *',
        pvSection:          'Production photovoltaïque',
        pvHint:             'Optionnel. Si renseigné, une pastille apparaît près de la maison avec la production instantanée (calculée sur la dernière minute) et un graphique dédié s\'ajoute au-dessus de la chronologie pour suivre la production. Capteur de puissance (W/kW) ou d\'énergie cumulée (Wh/kWh) acceptés indifféremment.',
        pvEntity:           'Entité de production',
        pvEntityHelp:       'Sélectionne un capteur de puissance ou d\'énergie photovoltaïque (W, kW, Wh, kWh).',
        pvPeakPower:        'Puissance crête (kWp)',
        pvPeakPowerHelp:    'Puissance crête installée de tes panneaux, en kilowatts-crête. Sert à tracer la courbe de prévision en pointillés sur le graphique PV et à caler la cadence du flux PV → maison sur ton installation. Laisser vide masque la prévision, la production observée et le pic du jour restent affichés.',
        pvArraysHelp:       'Une entrée par groupe de panneaux orientés à l\'identique. Laisse une seule entrée avec une inclinaison à 0 pour une installation à plat ; ajoute des entrées supplémentaires quand tes panneaux sont répartis sur plusieurs orientations (par exemple une rangée à l\'est, une autre à l\'ouest). La prévision est calculée par entrée, puis pondérée par la part de chacune dans le total des kWp.',
        pvArrayTitle:       'Groupe {n}',
        pvArrayTilt:        'Inclinaison (°)',
        pvArrayAzimuth:     'Azimut (°)',
        pvArrayShare:       'Part (%)',
        pvArrayAdd:         '+ Ajouter un groupe',
        pvArrayRemove:      'Supprimer',
        pvArrayNormHint:    'Les parts ne totalisent pas 100 %, la prévision les normalise automatiquement.',
        pvColor:            'Couleur de production *',
        batterySection:     'Batterie domestique',
        batteryHint:        'Optionnel. Chaque entité apparaît sous forme de pastille de part et d\'autre de la pastille PV, état de charge à GAUCHE, puissance signée à DROITE, reliée à PV par un trait pointillé statique. Les deux entités sont indépendamment optionnelles ; la pastille correspondante s\'affiche dès que l\'entité est renseignée.',
        batterySocEntity:   'Entité d\'état de charge',
        batterySocEntityHelp: 'Choisis un capteur d\'état de charge de batterie (%, typiquement avec device_class "battery"). Rendue sous forme de pastille à gauche de la pastille PV affichant le pourcentage en direct.',
        batteryPowerEntity: 'Entité de puissance',
        batteryPowerEntityHelp: 'Choisis un capteur de puissance batterie (W ou kW). La convention de signe suit l\'entité elle-même ; positif = en charge et est affiché tel quel sur la pastille (par ex. « +3.00 kW » en charge, « −1.20 kW » en décharge).',
        batteryPowerInvert:         'Signe de la puissance batterie',
        batteryPowerInvertStandard: 'Standard',
        batteryPowerInvertInverted: 'Inversé',
        batteryPowerInvertHelp:     'Par défaut (Standard) : ton capteur batterie rapporte déjà la charge en positif et la décharge en négatif. Passe sur Inversé si ton capteur fait l\'inverse (certaines installations GivEnergy / GivTCP), Helios inverse alors la valeur une fois à la lecture pour que la pastille, la flèche du leader et les totaux journaliers charge / décharge gardent leur sens.',
        batteryColor:       'Couleur batterie *',
        buildingsSection:   'Bâtiments alentour',
        buildingsHint:      'Pour ménager les performances en zone urbaine dense, seuls les bâtiments dans le rayon configuré autour de la maison sont rendus en 3D. La maison elle-même reste toujours à pleine opacité, les bâtiments voisins sont rendus en transparence pour donner le contexte sans concurrencer les données. Le rayon de regroupement permet d\'inclure les bâtiments attenants (véranda, dépendance, garage) dans le groupe « maison ».',
        displayRadius:         'Rayon d\'affichage *',
        displayRadiusHint:     'Définit la zone visible autour de la maison. Tout ce qui se trouve au-delà de ce rayon est masqué : fond de carte, bâtiments voisins, ombres. Pilote également l\'étendue du fetch LiDAR et le clip des ombres projetées.',
        buildingClusterRadius: 'Rayon de regroupement maison *',
        buildingOpacity:       'Opacité des bâtiments voisins *',
        buildingColor:         'Couleur des bâtiments *',
        pixelRatio:            'Pixel ratio *',
        pixelRatioAuto:        'Auto',
        pixelRatio1x:          '1x',
        pixelRatioHint:        'Auto (par défaut) utilise la densité de pixels native de ton écran (plafonnée à 2 sur desktop, 1.25 sur mobile) pour un rendu net. 1x force la valeur à 1.0, le rendu est moins net mais le coût par frame est divisé d\'autant : à privilégier sur appareils bas/moyen de gamme ou pour les longues sessions où l\'autonomie / la chaleur compte plus que la finesse.',
        mapStyleMinimal:       'Minimal',
        shadowsSection:        'Ombrage',
        shadowsEnabled:        'Afficher les ombres *',
        shadowsEnabledOn:      'Affichées',
        shadowsEnabledOff:     'Masquées',
        shadowsEnabledHint:    'Interrupteur principal des ombres projetées au sol. Si elles sont masquées, aucune ombre n\'est calculée. Si elles sont affichées, la source est choisie automatiquement : provider LiDAR quand ta zone est couverte (bâtiments et végétation), empreintes plates des bâtiments OpenFreeMap sinon (bâtiments uniquement).',
        lidarPrecision:        'Précision LiDAR *',
        lidarPrecisionLow:     'Basse',
        lidarPrecisionMedium:  'Moyenne',
        lidarPrecisionHigh:    'Haute',
        lidarPrecisionHint:    'Si ta zone est couverte par un provider LiDAR intégré à Helios, tu bénéficies d\'ombres plus réalistes (bâtiments ET végétation). Des décalages peuvent apparaître entre les bâtiments affichés et leurs ombres : les données LiDAR sont enregistrées à un instant donné et ne reflètent pas toujours l\'état actuel du terrain. Hors zone LiDAR, les ombres retombent sur les empreintes plates des bâtiments OpenFreeMap et cette option n\'a aucun effet.',
        shadowOpacity:         'Opacité des ombres *',
        shadowOpacityHint:     'Opacité des ombres projetées au sol.'
    }
};
