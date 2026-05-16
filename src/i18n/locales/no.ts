import type { Translations } from '../index';

//Norsk Bokmål.
//Translation notes:
//  - "Cloud cover" → "Skydekke"
//  - "Hillshade" → "Skyggelegging av terreng" (no longer used after the
//    terrain layer was removed; placeholder strings retained should the
//    feature return)
//  - "Tap" → "Trykk" on touch contexts
//  - LiDAR survey provider in Norway is Kartverket NHM
//    (Nasjonal Høydemodell), referenced in the LiDAR precision hint.
export const no: Translations = {
    cardName:        'HELIOS',
    cardDescription: 'Sanntidsvisualisering av solenergi og skydekke',

    placeholder:
    {
        subtitle: 'Soleksponering og skydekke'
    },

    detail:
    {
        title:    'Detaljvisning',
        subtitle: 'Detaljert dashbord kommer snart.',
        exitHint: 'Trykk hvor som helst for å gå ut',
    
        todayLabel:         'I dag',
        todayProduced:      'produsert',
        todayForecast:      'estimert',
        todayPeak:          'topp',
        todayNotStartedYet: 'produksjon ikke startet ennå',
        tomorrowLabel:      'I morgen',
        tomorrowPeak:       'topp ventet rundt',
        batteryLabel:       'Batteri',
        batteryCharged:     'ladet',
        batteryDischarged:  'utladet',},

    editor:
    {
        locationSection:    'Sted',
        homeLatitude:       'Hjemmets breddegrad *',
        homeLongitude:      'Hjemmets lengdegrad *',
        locationHint:       'Overstyrer hjemmeadressen som brukes som kortets sentrum. La begge feltene være tomme for å bruke hjemmet som er konfigurert i Home Assistant. Overstyringen brukes kun når BEGGE feltene har gyldige koordinater; ufullstendige eller ugyldige verdier ignoreres stille.',
        mapSection:         'Kart',
        mapStyle:           'Kartstil *',
        mapStyleHint:       'Tre grunnkart: Gater (nøkternt, urbant), Topo (høydekoter og jordfargetoner, bedre i kupert terreng) eller Minimal (laster Gater og fjerner alle ikke-essensielle etiketter, POI-ikoner og veiskilt for raskere rendering). 3D-bygninger og etiketter oppfører seg likt på Gater og Topo. Den mørke varianten av valgt stil brukes automatisk når korttemaet er satt til mørkt.',
        mapStyleStreet:     'Gater',
        cardTheme:          'Korttema *',
        cardThemeHint:      'Bytter kortets utseende (chips, grafer, knapper, verktøytips, scrub-overlegg) og 3D-grunnkartet mellom et lyst tema (standard, på hvit bakgrunn) og et mørkt tema (på nesten svart bakgrunn) slik at kortet passer rent inn i lyse eller mørke Home Assistant-dashbord.',
        cardThemeLight:     'Lyst',
        cardThemeDark:      'Mørkt',
        showLabels:         'Vis etiketter *',
        showLabelsHint:     'Slår av eller på gatenavn, husnumre, interessepunkter og stedsnavn på grunnkartet.',
        labelsOn:           'Vist',
        labelsOff:          'Skjult',
        autoRotate:         'Automatisk kamerarotasjon *',
        autoRotateHint:     'Etter noen sekunder uten aktivitet roterer kameraet sakte rundt huset (omtrent 1,5°/s, motsatt av solens tilsynelatende bevegelse). Et knip, dra eller hjul pauser den øyeblikkelig, og den fortsetter så snart du slipper.',
        autoRotateOn:       'På',
        autoRotateOff:      'Av',
        timeline:           'Tidslinje',
        timelineHint:       'Format på datoetikettene som vises på tidslinjen og i scrub-chipen.',
        dateFormat:         'Datoformat * (standard: mm-dd)',
        dateFormatHelp:     'Tokens: yyyy, yy, mm, dd. Eksempler:',
        timeFormat:         'Klokkeformat *',
        timeFormat12:       '12 t',
        timeFormat24:       '24 t',
        colors:             'Farger',
        colorsHint:         'Én farge per måleverdi, gjenbrukt overalt der den vises. Solfargen maler buen, solskiven og det øvre området på tidslinjen. Skyfargen maler skiven på bakken og det nedre området på tidslinjen.',
        sunColor:           'Solfarge *',
        cloudColor:         'Skyfarge *',
        pvSection:          'Solproduksjon',
        pvHint:             'Valgfri. Når satt vises en chip nær huset med øyeblikkelig produksjon (beregnet over siste minutt), og en dedikert graf legges til over tidslinjen. Aksepterer enten en effektsensor (W/kW) eller en kumulativ energisensor (Wh/kWh).',
        pvEntity:           'Produksjons-entitet',
        pvEntityHelp:       'Velg en sensor for sol-effekt eller -energi (W, kW, Wh, kWh).',
        pvPeakPower:        'Toppeffekt (kWp)',
        pvPeakPowerHelp:    'Installert toppeffekt for anlegget i kilowatt-peak. Driver den prikkete prognoselinjen i PV-grafen og strømningsmetningen for PV → hus-leaderen. La stå tom for å skjule prognosen; observert produksjon og dagens topp tegnes likevel.',
        pvArraysHelp:       'Én oppføring per gruppe paneler med samme orientering. La én oppføring stå med helning 0 for en flat installasjon; legg til flere oppføringer når panelene er fordelt på flere retninger (for eksempel en rad mot øst og en mot vest). Prognosen beregnes per oppføring og vektes etter prosenten av total kWp.',
        pvArrayTitle:       'Gruppe {n}',
        pvArrayTilt:        'Helning (°)',
        pvArrayAzimuth:     'Azimut (°)',
        pvArrayShare:       'Andel (%)',
        pvArrayAdd:         '+ Legg til gruppe',
        pvArrayRemove:      'Fjern',
        pvArrayNormHint:    'Prosentene summerer ikke til 100 %, prognosen normaliserer dem automatisk.',
        pvColor:            'Produksjonsfarge *',
        batterySection:     'Husbatteri',
        batteryHint:        'Valgfri. Hver entitet vises som sin egen chip på sidene av PV-chipen, ladenivå til VENSTRE, fortegnseffekt til HØYRE, koblet til PV med en statisk prikket strek. Begge entiteter er uavhengig valgfrie; chipen på sin side vises så snart entiteten er satt.',
        batterySocEntity:   'Ladenivå-entitet',
        batterySocEntityHelp: 'Velg en sensor for batteriets ladenivå (%, vanligvis med device_class "battery"). Vises som chip til venstre for PV-chipen med live prosent.',
        batteryPowerEntity: 'Effekt-entitet',
        batteryPowerEntityHelp: 'Velg en sensor for batterieffekt (W eller kW). Fortegnskonvensjonen følger entiteten selv; positiv tolkes som lading og vises ordrett på chipen (f.eks. «+3,00 kW» ved lading, «−1,20 kW» ved utlading).',
        batteryPowerInvert:         'Fortegn på batterieffekt',
        batteryPowerInvertStandard: 'Standard',
        batteryPowerInvertInverted: 'Invertert',
        batteryPowerInvertHelp:     'Som standard rapporterer batteri-enheten lading som positivt og utlading som negativt. Velg Invertert hvis enheten din gjør motsatt (noen GivEnergy- / GivTCP-oppsett). Helios snur da verdien én gang ved innlesing, slik at chipen, strømpilen og daglige lade- / utladesummer beholder betydningen sin.',
        batteryColor:       'Batterifarge *',
        buildingsSection:   'Omkringliggende bygninger',
        buildingsHint:      'For å holde kortet flytende i tette urbane områder rendres bare bygninger innenfor konfigurert radius rundt huset i 3D. Selve huset holdes alltid på full opasitet; nabobygninger rendres med konfigurert opasitet for å gi urban kontekst uten å konkurrere med dataovergangene. Klyngeradiusen grupperer tilkoblede uthus (verandaer, garasjer, skur) i «hus»-settet.',
        displayRadius:         'Visningsradius *',
        displayRadiusHint:     'Definerer det synlige området rundt huset. Alt utenfor denne radiusen skjules: grunnkart, nabobygninger, skygger. Styrer også LiDAR-hentingens omfang og klipp av projiserte skygger.',
        buildingClusterRadius: 'Hus-klyngeradius *',
        buildingOpacity:       'Opasitet for nabobygninger *',
        buildingColor:         'Bygningsfarge *',
        pixelRatio:            'Pikselforhold *',
        pixelRatioAuto:        'Auto',
        pixelRatio1x:          '1x',
        pixelRatioHint:        'Auto (standard) bruker skjermens native devicePixelRatio (begrenset til 2 på skrivebord, 1,25 på mobil) for skarp rendering. 1x tvinger verdien til 1,0 for det billigste mulige per-frame fragmentarbeidet, nyttig på lavtytende enheter eller for lange økter der batteritid / varme betyr mer enn skarphet.',
        mapStyleMinimal:       'Minimal',
        shadowsSection:        'Skygger',
        shadowsEnabled:        'Vis skygger *',
        shadowsEnabledOn:      'Vist',
        shadowsEnabledOff:     'Skjult',
        shadowsEnabledHint:    'Hovedbryter for projiserte bakkeskygger. Når skjult beregnes ingen skygger i det hele tatt. Når vist velges kilden automatisk: en LiDAR-leverandør når én dekker området ditt (bygninger + vegetasjon), OpenFreeMap-bygningsfotavtrykk ellers (bare bygninger).',
        lidarPrecision:        'LiDAR-presisjon *',
        lidarPrecisionLow:     'Lav',
        lidarPrecisionMedium:  'Middels',
        lidarPrecisionHigh:    'Høy',
        lidarPrecisionHint:    'Hvis huset ligger innenfor en LiDAR-leverandør integrert med Helios (Kartverket NHM for Norge), får du mer realistiske skygger (bygninger OG vegetasjon). Noe forskyvning kan oppstå mellom de viste bygningene og skyggene deres: LiDAR-undersøkelsen er fanget på en gitt dato og gjenspeiler kanskje ikke nåværende tilstand. Utenfor LiDAR-dekning faller skyggene tilbake til de flate OpenFreeMap-bygningsfotavtrykkene, og denne innstillingen har ingen effekt.',
        shadowOpacity:         'Skyggeopasitet *',
        shadowOpacityHint:     'Opasitet for projiserte bakkeskygger.'
    }
};
