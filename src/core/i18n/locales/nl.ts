import type { Translations } from "../index";

//Dutch locale.
export const nl: Translations = {
  cardName: "Helios",
  cardDescription:
    "☀️ Een realtime 2.5D-weergave van je huis met de zon, het weer, de zonneproductie, de batterij en het net, plus geprojecteerde schaduwen en een interactieve tijdlijn",

  period: {
    rangeLabel: "Periode",
    forecast: "Voorspelling",
    yesterday: "Gisteren",
    today: "Vandaag",
    week: "Week",
    month: "Maand",
    year: "Jaar",
  },

  compass: "N,NO,O,ZO,Z,ZW,W,NW",

  cloudCover: {
    cloudLow: "Lage bewolking",
    cloudMid: "Middelhoge bewolking",
    cloudHigh: "Hoge bewolking",
  },

  mapConfig: {
    section: "Kaartconfiguratie",
    intro:
      "De basiskaart wordt getekend met OpenStreetMap-vectortegels. Auto volgt je thema, Donker / Licht forceert er één, en Aangepast laat je elke kleur instellen en elke laag verbergen.",
    modeAuto: "Auto",
    modeDark: "Donker",
    modeLight: "Licht",
    modeCustom: "Aangepast",
    land: "Achtergrond",
    water: "Water",
    wood: "Bos",
    grass: "Groen",
    sand: "Zand",
    wetland: "Moeras",
    ice: "IJs & sneeuw",
    landuse: "Bebouwd gebied",
    roadMajor: "Hoofdwegen",
    roadMinor: "Secundaire wegen",
    roadCasing: "Wegomlijning",
    path: "Paden & tracks",
    rail: "Spoorwegen",
    building: "Gebouwen",
    boundary: "Grenzen",
  },

  editor: {
    weatherEnabled: "Weereffecten",
    weatherEnabledHint:
      "Toont de echte lucht boven de scène: zon, wolken, regen, sneeuw en onweer op basis van je lokale weer, die de tijdlijn volgen terwijl je scrubt. Uit houdt de scène helder.",
    temperatureEntity: "Temperatuursensor",
    temperatureEntityHelp:
      "Optioneel. Gebruik een lokale buitentemperatuursensor (°C) in plaats van de Open-Meteo-waarde voor de temperatuurchip. De actuele status en recordergeschiedenis worden gebruikt voor nu + verleden; voorspelde uren blijven van het model.",
    humidityEntity: "Luchtvochtigheidssensor",
    humidityEntityHelp:
      "Optioneel. Gebruik een lokale sensor voor relatieve luchtvochtigheid (%) in plaats van de Open-Meteo-waarde, voor nu + verleden.",
    cloudCoverEntity: "Bewolkingssensor",
    cloudCoverEntityHelp:
      "Optioneel. Gebruik een lokale bewolkingssensor (%) om de luchtgradatie (zon, grijs worden) aan te sturen in plaats van de Open-Meteo-waarde, voor nu + verleden.",
    precipitationEntity: "Neerslagsensor",
    precipitationEntityHelp:
      "Optioneel. Gebruik een lokale neerslagsensor (mm) om de regenlaag aan te sturen in plaats van de Open-Meteo-waarde, voor nu + verleden.",
    snowfallEntity: "Sneeuwvalsensor",
    snowfallEntityHelp:
      "Optioneel. Gebruik een lokale sneeuwvalsensor (cm) om de sneeuwlaag aan te sturen in plaats van de Open-Meteo-waarde, voor nu + verleden.",
    weatherEntity: "Weerentiteit",
    weatherEntityHelp:
      "Optioneel. Gebruik een Home Assistant-weerentiteit om de conditie (regen / sneeuw / onweer) aan te sturen in plaats van de Open-Meteo-waarde, voor nu + verleden. Voorspelde uren blijven van het model.",
    chipTemperature: "Temperatuurweergave",
    chipHumidity: "Luchtvochtigheidsweergave",
    chipCost: "Kostenweergave",
    locationSection: "Locatie",
    homeLatitude: "Breedtegraad van het huis",
    homeLongitude: "Lengtegraad van het huis",
    locationHint:
      "Overschrijft het thuisadres dat als middelpunt van de kaart wordt gebruikt. Laat beide velden leeg om het in Home Assistant geconfigureerde thuis te gebruiken. De overschrijving wordt alleen toegepast wanneer BEIDE velden geldige coördinaten bevatten.",
    uiAndMapSection: "UI",
    autoRotate: "Automatische camerarotatie",
    autoRotateHint:
      "Na een paar seconden inactiviteit draait de camera langzaam om het huis (ongeveer 1.5°/s, tegengesteld aan de schijnbare beweging van de zon). Een sleepbeweging met één vinger pauzeert het meteen en het hervat zodra je loslaat. Vermijd het op heel oude apparaten: de automatische rotatie forceert elke seconde een render.",
    autoRotateOn: "Aan",
    autoRotateOff: "Uit",
    degradedRender: "Compatibiliteitsweergave",
    degradedRenderHint:
      "Tekent de kaart met een eenvoudigere, beter compatibele methode. Schakel dit in als de scène flikkert of scheurt terwijl u draait of sleept. Het lost de storing op sommige telefoons en tablets op, ten koste van iets minder vloeiende beweging.",
    dataDisplaySection: "Entiteiten en gegevensweergave",
    maxExpectedPower: "Max verwacht vermogen",
    maxExpectedPowerHelp:
      "Het vermogen waarbij een stroom op volle snelheid animeert. Elke stroom wordt afgezet tegen deze ene referentie, zodat een grotere stroom altijd sneller oogt dan een kleinere, in welke richting hij ook loopt. Verhoog het voor een grote installatie, verlaag het voor een kleine. Standaard 5000 W.",
    sunChipMode: "Weergave zonchip",
    sunChipModeHelp:
      "Wat de zonchip toont: de live zonne-instraling (standaard) of de positie van de zon (azimut en hoogte). De positie heeft geen sensor nodig, ze komt uit de eigen zonneberekening van de kaart.",
      batteryChipMode: "Batterijchip-weergave",
      batteryChipModeHelp: "Wat de batterijchip toont: het live vermogen (standaard) of de laadtoestand (%). Valt terug op de waarde die je batterij daadwerkelijk levert.",
      batteryChipModePower: "Vermogen",
      batteryChipModeSoc: "Laadtoestand",
    sunChipModeIrradiance: "Instraling",
    sunChipModePosition: "Zonpositie",
    displayUpdateFrequency: "Grafiekdetail",
    displayUpdateFrequencyHelp:
      "Hoeveel punten per uur de grafieken tekenen. De gegevens zelf zijn altijd de 5-minutenstatistieken van Home Assistant; dit bepaalt alleen hoe dicht de curve wordt getekend: 1 = één punt per uur (het vloeiendst, het lichtst om te renderen), 6 = één punt per 10 minuten (volledig detail, het zwaarst). Standaard 4 = één punt per 15 minuten. Verlaag het op oudere of tragere apparaten om de renderkosten te beperken. De voorspellingscurve volgt hetzelfde tempo, dus een fijnere instelling laat ook de korte schaduwdips zien (een boom die de productie een half uur onderbreekt) waar een uurcurve overheen stapt.",
    valueDecimals: "Decimalen",
    valueDecimalsHelp:
      "Aantal decimalen dat bij elke waardeweergave wordt getoond, zodat de chips uniform ogen. Geldt voor kW-waarden (hele watt blijven gehele getallen) en voor kWh. 0 tot 3, standaard 1.",
    powerUnit: "Vermogenseenheid",
    powerUnitHelp:
      "Eenheid voor elke vermogensweergave op de kaart (chips, grafiektooltips). Energie volgt deze ook, zodat de kaart consistent blijft: kW hoort bij kWh, W bij Wh.",
    irradianceUnit: "Eenheid van de zonneconstante",
    irradianceUnitHelp:
      "Eenheid voor de weergave van de zonneconstante (instraling) boven de zon.",
    batterySign: "Batterijteken",
    batterySignHelp:
      "Teken dat op de batterijchip wordt getoond. Standaard is min tijdens opladen en plus tijdens ontladen. Omgekeerd wisselt dit om. Verborgen toont de waarde zonder teken.",
    batterySignDefault: "Standaard",
    batterySignInverted: "Omgekeerd",
    batterySignHidden: "Verborgen",
    noUiMode: "Geen UI-modus",
    noUiModeHint:
      "Laat na een paar seconden inactiviteit de tijdlijn en de bediening op de kaart vervagen. Elke tik of beweging haalt ze terug. Ideaal voor een wall display.",
    noUiDelay: "Wachttijd voor verbergen",
    noUiDelayHint:
      "Aantal seconden inactiviteit voordat de tijdlijn en de bediening vervagen in de Geen UI-modus. 0 houdt de UI permanent verborgen. Wordt alleen gebruikt wanneer de Geen UI-modus aan staat.",
    showTimeline: "Tijdlijn tonen",
    showTimelineHint:
      "Toon de tijdlijn en de periodekiezer onder de scène. Uit toont alleen de scène.",
    showDetailPanel: "Extra informatie tonen",
    showDetailPanelHint:
      "Sta toe dat het minipaneel per chip (samengevoegde gegevens) rechtsboven opent wanneer er op een chip wordt getikt. Uit toont het nooit.",
    showSunTimes: "Zonsopgang- / zonsondergangtijden tonen",
    showSunTimesHint:
      "Toon de zonsopgang- en zonsondergangtijden en hun markeringen aan de voet van de zonneboog.",
    showHorizonLine: "Terreinhorizon tonen",
    showHorizonLineHint: "Tekent de horizonlijn van het reliëf rond het huis, berekend op basis van het lokale terrein. De horizon dempt de zon altijd realistisch achter heuvels; dit toont of verbergt alleen de getekende lijn.",
    horizonLineColor: "Kleur van de terreinhorizon",
    horizonLineColorHint: "Kleur van de terreinhorizonlijn.",
    lockRotation: "Rotatie vergrendelen",
    lockRotationHint:
      "Sleep in het voorbeeld om de scène te draaien en te kantelen naar de gewenste weergave en zet dit vervolgens aan. De vergrendeling zet die weergave vast (draaien via slepen en de automatische rotatie in rust worden uitgeschakeld) en slaat de hoek op in de kaart, zodat exact dezelfde weergave op elk apparaat en in elke browser verschijnt. Zet het uit om weer vrij te draaien.",
    chipsSection: "Entiteitweergave",
    chipsIntro:
      "Toon of verberg elke entiteit en kies het bijbehorende icoon en de kleur. Het huis volgt de geselecteerde chip, of standaard je primaire kleur.",
    chipIrradiance: "Instralingsweergave",
    chipProduction: "Productieweergave",
    chipGrid: "Netweergave",
    chipBattery: "Batterijweergave",
    chipHome: "Weergave huishoudelijk verbruik",
    groupsConfigTitle: "Groepsconfiguratie",
    optionalSensors: "Optionele sensoren",
    solarIrradianceEntity: "Zonne-instralingsentiteit",
    solarIrradianceEntityHelp:
      "Kies een sensor die de globale kortgolvige instraling in W/m² meldt (typisch een Ecowitt- / Davis- / persoonlijk weerstation). Indien ingesteld vervangen de huidige toestand en de recordergeschiedenis Open-Meteo voor de live en historische instraling overal waar die verschijnt (getal op de zonchip, Y-as van de PV-grafiek, kleuring van de zonneboog). Voorspellingsuren blijven op Open-Meteo, want een sensor kan geen toekomstige waarden bevatten.",
    liveDataTitle: "Configuratiestatus",
    liveDataIntro:
      "Live chips tonen alleen gemeten sensoren. Elke familie heeft de optionele live vermogenssensor van zijn energiedashboardbron nodig; curves en totalen komen altijd van je meters.",
    liveSolarOk: "Zon: live vermogenssensor gedetecteerd.",
    liveSolarMissing:
      "Zon: geen live vermogenssensor, de productiechip blijft verborgen. Voeg er een toe bij Instellingen > Dashboards > Energie > Zonnepanelen.",
    liveSolarAbsent:
      "Zon: niet ingesteld in je Energiedashboard. Voeg daar zonnepanelen toe om de productiechip te krijgen.",
    liveGridOk: "Net: live vermogenssensor gedetecteerd.",
    liveGridMissing:
      "Net: geen live vermogenssensor, de import-/exportchips blijven verborgen. Voeg er een toe bij Instellingen > Dashboards > Energie > Net.",
    liveGridMiswired:
      "Net: de live vermogenssensor spreekt je meters tegen (hij lijkt maar één richting te meten). De chips blijven verborgen; configureer een sensor met teken of de modus Twee sensoren.",
    liveGridAbsent:
      "Net: niet ingesteld in je Energiedashboard. Voeg daar het net toe om de import- en exportchip te krijgen.",
    liveBatteryOk: "Batterij: live vermogenssensoren dekken elke batterij.",
    liveBatteryMissing:
      "Batterij: live vermogen ontbreekt op ten minste één batterij, de vermogenschip blijft verborgen. Voeg de vermogenssensor(en) toe bij Instellingen > Dashboards > Energie > Batterij.",
    liveBatteryAbsent:
      "Batterij: niet ingesteld in je Energiedashboard. Voeg daar een batterij toe om de laad- en ontlaadchip te krijgen.",
    liveHomeOk:
      "Huishoudelijk verbruik: getoond, afgeleid van de bovenstaande live families.",
    liveHomeNote:
      "Huishoudelijk verbruik: verschijnt zodra elke hierboven geconfigureerde familie zijn live sensor heeft.",
    openEnergyConfig: "Energieconfiguratie openen",
    buildingsSection: "Huis & gebouwen",
    buildingsHint:
      'Om de kaart soepel te houden in dichtbebouwde stedelijke gebieden worden alleen gebouwen binnen de geconfigureerde straal rond het huis in 3D gerenderd. Het huis zelf blijft volledig dekkend; nabijgelegen gebouwen worden gerenderd met de geconfigureerde dekking zodat ze stedelijke context geven zonder met de gegevensoverlays te concurreren. De clusterstraal groepeert aangebouwde bijgebouwen (veranda\'s, garages, schuren) in de "huis"-groep.',
    displayRadius: "Weergavestraal",
    displayRadiusHelp:
      "Straal rond het huis waarbinnen gebouwen worden opgehaald en getekend, tot aan de rand van de vervaagde kaartschijf. Verlaag het om het renderen op een traag apparaat te verlichten; 0 toont alleen het huis.",
    buildingCount: "Aantal gebouwen",
    buildingCountHelp:
      "Maximumaantal nabijgelegen gebouwen om te tekenen. Verlaag het om het renderen op een traag apparaat te verlichten.",
    buildingRealSize: "Echte gebouwhoogtes",
    buildingRealSizeOn: "Aan",
    buildingRealSizeOff: "Uit",
    buildingRealSizeHint:
      "Aan: gebruik de echte OpenStreetMap-hoogtes (begrensd om de kadrering leesbaar te houden). Uit: geef elk gebouw dezelfde vaste hoogte hieronder.",
    buildingHeight: "Gebouwhoogte",
    hiddenDevicesEmpty:
      "Er worden nog geen individuele apparaten bijgehouden in je Energiedashboard. Voeg daar apparaatverbruik toe om ze hier te beheren.",
    deviceVisibilityLabel: "Apparaat tonen",
    group: "Groep",
    noGroup: "Geen groep",
    groupAssignHint:
      "Sleep je apparaten naar een groep. Wat onderaan overblijft, hoort bij geen enkele groep.",
    groupDropHere: "Sleep hier een apparaat naartoe",
    backToLive: "Terug naar live",
    buildingClusterRadius: "Clusterstraal huis",
    buildingClusterRadiusHelp:
      "Straal rond het huis waarbinnen aangebouwde bijgebouwen (veranda's, garages, schuren) als deel van het huis worden behandeld: ze worden weergegeven met de volledige dekking en kleur van het huis in plaats van als vervaagde buren. 0 houdt alleen het hoofdgebouw over.",
    buildingOpacity: "Dekking van de omgeving",
    buildingColor: "Gebouwkleur",
    buildingColorHelp:
      "Basistint die op de omliggende gebouwen in de scène wordt toegepast.",
    shadowsSection: "Schaduwen",
    shadowsEnabled: "Schaduwen tonen",
    shadowsEnabledOn: "Getoond",
    shadowsEnabledOff: "Verborgen",
    shadowsEnabledHint:
      "Schakelt de grondschaduwen in of uit die de gebouwen werpen terwijl de zon beweegt.",
    shadowOpacity: "Schaduwdekking",
    shadowOpacityHint: "Dekking van de geworpen grondschaduwen.",
    resetSection: "Resetten",
    resetSectionHint:
      "Onderhoudstools: haal de gecachete gegevens van de kaart opnieuw op, of zet alle opties terug naar hun standaardwaarden.",
    resetCacheButton: "Gegevenscache resetten",
    resetCacheWarning:
      "Let op: dit haalt alles opnieuw op wat de kaart heeft gecachet: het Open-Meteo-weer, elke energiereeks in het geheugen (productie, net, batterij, apparaten, instraling), de kalibratie van de verfijnde voorspelling, en de OpenFreeMap-gebouwvoetafdrukken, voor elke Helios-kaart die op deze pagina open staat. Gebruik dit om vastgelopen kalibratie of verouderde weer-/kaartgegevens te wissen; een volledige nieuwe ophaling duurt een paar minuten, afhankelijk van je HA-server. Je gegevens binnen Home Assistant worden nooit aangeraakt.",
    resetCacheDone: "Cache gewist ✓",
    resetOptionsButton: "Opties terugzetten naar standaard",
    resetOptionsConfirm: "Klik nogmaals om te bevestigen",
    resetOptionsWarning:
      "Let op: dit zet ALLE opties van deze kaart terug naar hun standaardwaarden: chipzichtbaarheid, kleuren en iconen, groepsnamen/-kleuren/-iconen, gebouwen, schaduwen, eenheden en elke andere instelling. Je Home Assistant-gegevens en Energiedashboard blijven ongewijzigd, maar je aanpassingen worden gewist en kunnen niet ongedaan worden gemaakt.",
    resetOptionsDone: "Opties teruggezet ✓",
    aboutSection: "Over",
    aboutVersionLabel: "Versie",
    aboutRepoCard: "Helios",
    aboutCoffeeMessage:
      "Ik bouw Helios alleen, meestal 's nachts, op zoek naar de kleine details tot de zon en je energie levend aanvoelen op het scherm. Als het een plekje op je dashboard heeft gevonden, maakt me dat al blij; een ster op GitHub nog meer, en een kopje koffie houdt alles in beweging.",
    aboutDeveloperLabel: "Ontwikkelaar",
    aboutDeveloperLinkedIn: "LinkedIn",
    aboutCoffeeLink: "Buy me a coffee",
  },
};
