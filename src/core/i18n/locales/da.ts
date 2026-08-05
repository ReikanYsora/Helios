import type { Translations } from "../index";

//Danish locale.
export const da: Translations = {
  cardName: "Helios",
  cardDescription:
    "☀️ En 2.5D-visning i realtid af dit hjem med solen, vejret, solproduktion, batteri og net, plus kastede skygger og en interaktiv tidslinje",

  period: {
    rangeLabel: "Tidsrum",
    forecast: "Prognose",
    yesterday: "I går",
    today: "I dag",
    week: "Uge",
    month: "Måned",
    year: "År",
  },

  compass: "N,NØ,Ø,SØ,S,SV,V,NV",

  cloudCover: {
    cloudLow: "Lav skydække",
    cloudMid: "Mellem skydække",
    cloudHigh: "Høj skydække",
  },

  mapConfig: {
    section: "Kortkonfiguration",
    intro:
      "Baggrundskortet tegnes ud fra OpenStreetMap-vektorfliser. Auto følger dit tema, Dark / Light tvinger et bestemt, og Custom lader dig indstille hver farve og skjule enhver lagdel.",
    modeAuto: "Auto",
    modeDark: "Mørk",
    modeLight: "Lys",
    modeCustom: "Brugerdefineret",
    land: "Baggrund",
    water: "Vand",
    wood: "Skov",
    grass: "Grønne områder",
    sand: "Sand",
    wetland: "Vådområde",
    ice: "Is og sne",
    landuse: "Bebygget areal",
    roadMajor: "Hovedveje",
    roadMinor: "Mindre veje",
    roadCasing: "Vejomrids",
    path: "Stier og spor",
    rail: "Jernbaner",
    building: "Bygninger",
    boundary: "Grænser",
  },

  editor: {
    locationSection: "Hjemmets placering",
    homeLatitude: "Hjemmets breddegrad",
    homeLongitude: "Hjemmets længdegrad",
    locationHint:
      "Tilsidesæt hjemmeadressen, der bruges som kortets centrum. Lad begge felter være tomme for at bruge det hjem, der er konfigureret i Home Assistant. Tilsidesættelsen anvendes kun, når BEGGE felter er sat til gyldige koordinater.",
    uiAndMapSection: "UI",
    autoRotate: "Automatisk kamerarotation",
    autoRotateHint:
      "Når der er inaktivt i et par sekunder, kredser kameraet langsomt om hjemmet (cirka 1,5°/s, modsat solens tilsyneladende bevægelse). Et træk med en finger sætter det straks på pause, og det fortsætter, når du slipper. Undgå det på meget gamle enheder: automatisk rotation tvinger en gengivelse hvert sekund.",
    autoRotateOn: "Til",
    autoRotateOff: "Fra",
    dataDisplaySection: "Datavisning",
    maxExpectedPower: "Maks. forventet effekt",
    maxExpectedPowerHelp:
      "Den effekt, hvor et flow animeres ved fuld hastighed. Hvert flow måles mod denne ene reference, så et større flow altid ser hurtigere ud end et mindre, uanset hvilken retning det løber. Hæv den for et stort anlæg, sænk den for et lille. Standard 5000 W.",
    sunChipMode: "Solchip-aflæsning",
    sunChipModeHelp:
      "Hvad solchippen viser: live solirradians (standard) eller solens position (azimut og højde). Positionen kræver ingen sensor, den kommer fra kortets egne solberegninger.",
    sunChipModeIrradiance: "Irradians",
    sunChipModePosition: "Solens position",
    displayUpdateFrequency: "Grafdetaljer",
    displayUpdateFrequencyHelp:
      "Hvor mange punkter pr. time graferne tegner. Selve dataene er altid Home Assistants 5-minutters statistik; dette styrer kun, hvor tæt kurven plottes: 1 = ét punkt pr. time (mest jævn, lettest at gengive), 6 = ét punkt hvert 10. minut (fuld detalje, tungest). Standard 4 = et punkt hvert 15. minut. Sænk den på ældre eller langsommere enheder for at reducere gengivelsesomkostningen. Prognosekurven følger samme kadence, så en finere indstilling viser også korte skyggedyk (et træ, der skygger for produktionen i en halv time), som en timekurve springer over.",
    valueDecimals: "Decimaler",
    valueDecimalsHelp:
      "Antal decimaler vist på hver værdiaflæsning, så chipsene fremstår ensartede. Gælder kW-værdier (hele watt forbliver heltal) og kWh. 0 til 3, standard 1.",
    powerUnit: "Effektenhed",
    powerUnitHelp:
      "Enhed for hver effektaflæsning på kortet (chips, grafværktøjstips). Energi følger den også, så kortet forbliver konsistent: kW parres med kWh, W med Wh.",
    irradianceUnit: "Enhed for solkonstant",
    irradianceUnitHelp:
      "Enhed for aflæsningen af solkonstanten (irradians) over solen.",
    batterySign: "Batteritegn",
    batterySignHelp:
      "Tegn vist på batterichippen. Standard er minus under opladning og plus under afladning. Omvendt vender det. Skjult viser værdien uden tegn.",
    batterySignDefault: "Standard",
    batterySignInverted: "Omvendt",
    batterySignHidden: "Skjult",
    noUiMode: "Ingen UI-tilstand",
    noUiModeHint:
      "Nedtoner tidslinjen og kontrollerne på kortet efter et par sekunders inaktivitet. Ethvert tryk eller enhver bevægelse bringer dem tilbage. Perfekt til en vægskærm.",
    noUiDelay: "Ventetid før skjulning",
    noUiDelayHint:
      "Sekunders inaktivitet, før tidslinjen og kontrollerne toner væk i Ingen UI-tilstand. 0 holder brugerfladen permanent skjult. Bruges kun, når Ingen UI-tilstand er slået til.",
    showTimeline: "Vis tidslinje",
    showTimelineHint:
      "Vis tidslinjen og periodevælgeren under scenen. Slået fra viser kun scenen.",
    showDetailPanel: "Vis yderligere info",
    showDetailPanelHint:
      "Tillad, at mini-panelet pr. chip (samlede målinger) åbner øverst til højre, når der trykkes på en chip. Slået fra vises det aldrig.",
    showSunTimes: "Vis soltid for solopgang / solnedgang",
    showSunTimesHint:
      "Vis tidspunkterne for solopgang og solnedgang samt deres markører ved foden af solbuen.",
    lockRotation: "Lås rotation",
    lockRotationHint:
      "Indstil visningsvinklen direkte i forhåndsvisningen (træk for at rotere og vippe scenen), og slå så låsen til for at fastfryse den: træk-for-at-rotere og automatisk rotation ved inaktivitet deaktiveres, så den valgte vinkel bevares.",
    chipsSection: "Entitetsvisning",
    chipsIntro:
      "Vis eller skjul hver entitet, og vælg dens ikon og farve. Hjemmet følger den valgte chip, eller din primærfarve som standard.",
    chipIrradiance: "Irradiansvisning",
    chipProduction: "Produktionsvisning",
    chipGrid: "Netvisning",
    chipBattery: "Batterivisning",
    chipHome: "Visning af hjemmets forbrug",
    groupsConfigTitle: "Gruppekonfiguration",
    optionalSensors: "Valgfrie sensorer",
    solarIrradianceEntity: "Entitet for solirradians",
    solarIrradianceEntityHelp:
      "Vælg en sensor, der rapporterer global kortbølget irradians i W/m² (typisk Ecowitt / Davis / personlig vejrstation). Når den er sat, erstatter dens aktuelle tilstand og optagerhistorik Open-Meteo for live- og fortidsirradiansen overalt, hvor den optræder (tal på solchippen, PV-diagrammets Y-akse, farvelægning af solbuen). Prognosetimer forbliver på Open-Meteo, da en sensor ikke kan bære fremtidige værdier.",
    liveDataTitle: "Konfigurationsstatus",
    liveDataIntro:
      "Live-chips viser kun målte sensorer. Hver familie kræver den valgfrie live-effektsensor fra sin energidashboard-kilde; kurver og totaler kommer altid fra dine målere.",
    liveSolarOk: "Sol: live-effektsensor registreret.",
    liveSolarMissing:
      "Sol: ingen live-effektsensor, produktionschippen forbliver skjult. Tilføj en under Indstillinger > Dashboards > Energi > Solcelleanlæg.",
    liveSolarAbsent:
      "Sol: ikke opsat i dit energidashboard. Tilføj solceller der for at få produktionschippen.",
    liveGridOk: "Net: live-effektsensor registreret.",
    liveGridMissing:
      "Net: ingen live-effektsensor, import-/eksportchipsene forbliver skjulte. Tilføj en under Indstillinger > Dashboards > Energi > Elnet.",
    liveGridMiswired:
      "Net: live-effektsensoren modsiger dine målere (den ser ud til kun at måle én retning). Chipsene forbliver skjulte; konfigurer en signeret sensor eller tilstanden To sensorer.",
    liveGridAbsent:
      "Net: ikke opsat i dit energidashboard. Tilføj elnettet der for at få import- og eksportchipsene.",
    liveBatteryOk: "Batteri: live-effektsensorer dækker hvert batteri.",
    liveBatteryMissing:
      "Batteri: live-effekt mangler på mindst ét batteri, effektchippen forbliver skjult. Tilføj effektsensor(er) under Indstillinger > Dashboards > Energi > Batteri.",
    liveBatteryAbsent:
      "Batteri: ikke opsat i dit energidashboard. Tilføj et batteri der for at få opladnings- og afladningschippen.",
    liveHomeOk: "Hjemmets forbrug: vises, udledt af live-familierne ovenfor.",
    liveHomeNote:
      "Hjemmets forbrug vises, når hver konfigureret familie ovenfor har sin live-sensor.",
    openEnergyConfig: "Åbn energikonfiguration",
    buildingsSection: "Hjem & bygninger",
    buildingsHint:
      'For at holde kortet flydende i tætte byområder gengives kun bygninger inden for den konfigurerede radius omkring hjemmet i 3D. Selve hjemmet forbliver fuldt uigennemsigtigt; nærliggende bygninger gengives med den konfigurerede uigennemsigtighed, så de giver bymæssig kontekst uden at konkurrere med dataoverlejringerne. Klyngeradiussen samler tilknyttede udhuse (verandaer, garager, skure) i "hjem"-sættet.',
    displayRadius: "Visningsradius",
    displayRadiusHelp:
      "Radius omkring hjemmet, hvori bygninger hentes og tegnes, helt ud til kanten af den falmede kortskive. Sænk den for at lette gengivelsen på en langsom enhed; 0 viser kun hjemmet.",
    buildingCount: "Antal bygninger",
    buildingCountHelp:
      "Maksimalt antal nærliggende bygninger at tegne. Sænk det for at lette gengivelsen på en langsom enhed.",
    buildingRealSize: "Reelle bygningshøjder",
    buildingRealSizeOn: "Til",
    buildingRealSizeOff: "Fra",
    buildingRealSizeHint:
      "Til: brug reelle OpenStreetMap-højder (begrænset for at holde rammen læselig). Fra: giv hver bygning den samme faste højde nedenfor.",
    buildingHeight: "Bygningshøjde",
    hiddenDevicesEmpty:
      "Ingen individuelle enheder spores endnu i dit energidashboard. Tilføj enhedsforbrug der for at styre dem her.",
    deviceVisibilityLabel: "Vis enhed",
    deviceGroupLabel: "Overvågningsgruppe",
    group: "Gruppe",
    noGroup: "Ingen gruppe",
    groupAssignHint:
      "Træk dine enheder ind i en gruppe. Det, der bliver tilbage nedenfor, tilhører ingen gruppe.",
    groupDropHere: "Slip en enhed her",
    backToLive: "Tilbage til live",
    devicesEnergyNote:
      "Dette er de individuelle enheder, der aktuelt er opsat i dit Home Assistant energidashboard. Øjet viser eller skjuler hver enkelt overalt, og pillen tildeler den til en gruppe.",
    buildingClusterRadius: "Hjemmets klyngeradius",
    buildingClusterRadiusHelp:
      "Radius omkring hjemmet, inden for hvilken tilknyttede udhuse (verandaer, garager, skure) behandles som en del af hjemmet: de gengives med hjemmets fulde uigennemsigtighed og farve i stedet for som falmede naboer. 0 beholder kun hovedbygningen.",
    buildingOpacity: "Uigennemsigtighed for omgivelser",
    buildingColor: "Bygningsfarve",
    buildingColorHelp: "Grundtone anvendt på de omgivende bygninger i scenen.",
    shadowsSection: "Skygger",
    shadowsEnabled: "Vis skygger",
    shadowsEnabledOn: "Vist",
    shadowsEnabledOff: "Skjult",
    shadowsEnabledHint:
      "Slår de jordskygger til/fra, som bygningerne kaster, mens solen bevæger sig.",
    shadowOpacity: "Skyggeuigennemsigtighed",
    shadowOpacityHint: "Uigennemsigtighed for de kastede jordskygger.",
    resetSection: "Nulstil",
    resetSectionHint:
      "Vedligeholdelsesværktøjer: hent kortets cachelagrede data igen, eller nulstil alle indstillinger til standard.",
    resetCacheButton: "Nulstil datacache",
    resetCacheWarning:
      "Advarsel: dette henter alt, kortet har cachelagret, igen - Open-Meteo-vejrdata, alle energiserier i hukommelsen (produktion, net, batteri, enheder, irradians), den forfinede prognoses kalibrering og OpenFreeMap-bygningsomridsene - for hvert Helios-kort, der er åbent på denne side. Brug det til at rydde en fastlåst kalibrering eller forældet vejr-/kortdata; en fuld genhentning tager et par minutter afhængigt af din HA-server. Dine data inde i Home Assistant røres aldrig.",
    resetCacheDone: "Cache ryddet ✓",
    resetOptionsButton: "Nulstil indstillinger til standard",
    resetOptionsConfirm: "Klik igen for at bekræfte",
    resetOptionsWarning:
      "Advarsel: dette nulstiller ALLE dette korts indstillinger til deres standardværdier - chipsynlighed, farver og ikoner, gruppenavne/-farver/-ikoner, bygninger, skygger, enheder og alle andre indstillinger. Dine Home Assistant-data og energidashboard røres ikke, men dine tilpasninger ryddes og kan ikke fortrydes.",
    resetOptionsDone: "Indstillinger nulstillet ✓",
    aboutSection: "Om",
    aboutVersionLabel: "Version",
    aboutRepoCard: "Helios",
    aboutCoffeeMessage:
      "Jeg bygger Helios alene, mest om natten, og jager de små detaljer, indtil solen og din energi føles levende på skærmen. Hvis det har fundet en plads på dit dashboard, gør det mig allerede glad; en stjerne på GitHub gør mig endnu gladere, og en kop kaffe holder det hele kørende.",
    aboutDeveloperLabel: "Udvikler",
    aboutDeveloperLinkedIn: "LinkedIn",
    aboutCoffeeLink: "Køb mig en kaffe",
  },
};
