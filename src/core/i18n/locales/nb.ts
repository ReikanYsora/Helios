import type { Translations } from "../index";

//Norwegian Bokmal locale.
export const nb: Translations = {
  cardName: "Helios",
  cardDescription:
    "☀️ En 2.5D-visning i sanntid av hjemmet ditt med solen, været, solproduksjon, batteri og strømnett, pluss kastede skygger og en interaktiv tidslinje",

  period: {
    rangeLabel: "Tidsrom",
    forecast: "Prognose",
    yesterday: "I går",
    today: "I dag",
    week: "Uke",
    month: "Måned",
    year: "År",
  },

  compass: "N,NØ,Ø,SØ,S,SV,V,NV",

  cloudCover: {
    cloudLow: "Lavt skydekke",
    cloudMid: "Middels skydekke",
    cloudHigh: "Høyt skydekke",
  },

  mapConfig: {
    section: "Kartkonfigurasjon",
    intro:
      "Bakgrunnskartet tegnes fra OpenStreetMap-vektorfliser. Auto følger temaet ditt, Dark / Light tvinger frem ett av dem, og Custom lar deg sette hver farge og skjule lag.",
    modeAuto: "Auto",
    modeDark: "Mørk",
    modeLight: "Lys",
    modeCustom: "Egendefinert",
    land: "Bakgrunn",
    water: "Vann",
    wood: "Skog",
    grass: "Grøntområder",
    sand: "Sand",
    wetland: "Våtmark",
    ice: "Is og snø",
    landuse: "Bebygd areal",
    roadMajor: "Hovedveier",
    roadMinor: "Mindre veier",
    roadCasing: "Veikontur",
    path: "Stier og turveier",
    rail: "Jernbane",
    building: "Bygninger",
    boundary: "Grenser",
  },

  editor: {
    weatherEnabled: "Væreffekter",
    weatherEnabledHint:
      "Mal den ekte himmelen over scenen: solskinn, skyer, regn, snø og tordenvær fra ditt lokale vær, som følger tidslinjen mens du blar. Av beholder en klar scene.",
    temperatureEntity: "Temperatursensor",
    temperatureEntityHelp:
      "Valgfritt. Bruk en lokal utetemperatursensor (°C) i stedet for Open-Meteo-verdien for temperaturbrikken. Sanntidstilstanden og opptakshistorikken brukes for sanntid + fortid; prognosetimer følger modellen.",
    humidityEntity: "Luftfuktighetssensor",
    humidityEntityHelp:
      "Valgfritt. Bruk en lokal sensor for relativ luftfuktighet (%) i stedet for Open-Meteo-verdien, for sanntid + fortid.",
    cloudCoverEntity: "Sensor for skydekke",
    cloudCoverEntityHelp:
      "Valgfritt. Bruk en lokal skydekkesensor (%) til å styre himmelgraderingen (sol, gråning) i stedet for Open-Meteo-verdien, for sanntid + fortid.",
    precipitationEntity: "Nedbørssensor",
    precipitationEntityHelp:
      "Valgfritt. Bruk en lokal nedbørssensor (mm) til å styre regnlaget i stedet for Open-Meteo-verdien, for sanntid + fortid.",
    snowfallEntity: "Snøfallsensor",
    snowfallEntityHelp:
      "Valgfritt. Bruk en lokal snøfallsensor (cm) til å styre snølaget i stedet for Open-Meteo-verdien, for sanntid + fortid.",
    weatherEntity: "Værenhet",
    weatherEntityHelp:
      "Valgfritt. Bruk en Home Assistant-værenhet til å styre forholdet (regn / snø / tordenvær) i stedet for Open-Meteo-verdien, for sanntid + fortid. Prognosetimer følger modellen.",
    chipTemperature: "Temperaturvisning",
    chipHumidity: "Luftfuktighetsvisning",
    chipCost: "Kostnadsvisning",
    locationSection: "Hjemmets plassering",
    homeLatitude: "Hjemmets breddegrad",
    homeLongitude: "Hjemmets lengdegrad",
    locationHint:
      "Overstyr hjemmeadressen som brukes som kartets midtpunkt. La begge feltene være tomme for å bruke hjemmet som er konfigurert i Home Assistant. Overstyringen brukes bare når BEGGE feltene er satt til gyldige koordinater.",
    uiAndMapSection: "UI",
    autoRotate: "Automatisk kamerarotasjon",
    autoRotateHint:
      "Når det er inaktivt i noen sekunder, sirkler kameraet sakte rundt hjemmet (omtrent 1,5°/s, motsatt av solens tilsynelatende bevegelse). Et dra med én finger setter den umiddelbart på pause, og den fortsetter når du slipper. Unngå det på svært gamle enheter: automatisk rotasjon tvinger frem en gjengivelse hvert sekund.",
    autoRotateOn: "På",
    autoRotateOff: "Av",
    degradedRender: "Kompatibilitetsgjengivelse",
    degradedRenderHint:
      "Tegner kartet med en enklere, mer kompatibel metode. Slå på hvis scenen flimrer eller revner når du roterer eller drar den. Det retter feilen på enkelte telefoner og nettbrett, på bekostning av litt mindre jevn bevegelse.",
    dataDisplaySection: "Datavisning",
    maxExpectedPower: "Maks forventet effekt",
    maxExpectedPowerHelp:
      "Effekten der en flyt animeres i full fart. Hver flyt måles mot denne ene referansen, så en større flyt leses alltid som raskere enn en mindre, uansett hvilken retning den går. Øk den for et stort anlegg, senk den for et lite. Standard 5000 W.",
    sunChipMode: "Avlesning på solchipen",
    sunChipModeHelp:
      "Hva solchipen viser: live solinnstråling (standard) eller solens posisjon (asimut og høyde). Posisjonen trenger ingen sensor, den kommer fra kortets egne solberegninger.",
      batteryChipMode: "Batterichip-visning",
      batteryChipModeHelp: "Hva batterichippen viser: sanntidseffekten (standard) eller ladenivået (%). Den faller tilbake til verdien batteriet faktisk leverer.",
      batteryChipModePower: "Effekt",
      batteryChipModeSoc: "Ladenivå",
    sunChipModeIrradiance: "Solinnstråling",
    sunChipModePosition: "Solens posisjon",
    displayUpdateFrequency: "Grafdetalj",
    displayUpdateFrequencyHelp:
      "Hvor mange punkter per time grafene tegner. Selve dataene er alltid Home Assistants 5-minutters statistikk, dette styrer bare hvor tett kurven plottes: 1 = ett punkt per time (jevnest, lettest å gjengi), 6 = ett punkt hvert 10. minutt (full detalj, tyngst). Standard 4 = ett punkt hvert 15. minutt. Senk den på eldre eller tregere enheter for å redusere gjengivelseskostnaden. Prognosekurven følger samme takt, så en finere innstilling viser også korte skyggedupp (et tre som skygger for produksjonen i en halvtime) som en timekurve hopper over.",
    valueDecimals: "Desimaler",
    valueDecimalsHelp:
      "Antall desimaler vist på hver verdiavlesning, slik at chipene ser ensartet ut. Gjelder kW-verdier (hele watt vises som heltall) og kWh. 0 til 3, standard 1.",
    powerUnit: "Effektenhet",
    powerUnitHelp:
      "Enhet for hver effektavlesning på kortet (chips, graftooltips). Energi følger den også, slik at kortet forblir konsistent: kW hører sammen med kWh, W med Wh.",
    energyUnit: "Energienhet",
    energyUnitHelp:
      "Enhet for alle energitotaler (dagskurven, detaljpanelet, dagstotalene på tidslinjen). Auto følger effektenheten over; velg Wh eller kWh for å angi den separat.",
    energyUnitAuto: "Auto",
    irradianceUnit: "Enhet for solkonstanten",
    irradianceUnitHelp:
      "Enhet for avlesningen av solkonstanten (solinnstråling) over solen.",
    batterySign: "Batteritegn",
    batterySignHelp:
      "Tegn som vises på batterichipen. Standard er minus ved lading og pluss ved utlading. Omvendt bytter om på det. Skjult viser verdien uten tegn.",
    batterySignDefault: "Standard",
    batterySignInverted: "Omvendt",
    batterySignHidden: "Skjult",
    noUiMode: "Uten UI-modus",
    noUiModeHint:
      "Toner ut tidslinjen og kontrollene på kortet etter noen sekunders inaktivitet. Ethvert trykk eller enhver bevegelse henter dem tilbake. Perfekt for en veggskjerm.",
    noUiDelay: "Ventetid før skjuling",
    noUiDelayHint:
      "Sekunder med inaktivitet før tidslinjen og kontrollene tones ut i modus uten UI. 0 holder grensesnittet permanent skjult. Brukes bare når modus uten UI er på.",
    showTimeline: "Vis tidslinje",
    showTimelineHint:
      "Vis tidslinjen og periodevelgeren under scenen. Av viser bare scenen.",
    showDetailPanel: "Vis mer informasjon",
    showDetailPanelHint:
      "Tillat at mini-panelet per chip (samlede måleverdier) åpnes øverst til høyre når en chip trykkes på. Av viser det aldri.",
    showSunTimes: "Vis soloppgang / solnedgang",
    showSunTimesHint:
      "Vis tidspunktene for soloppgang og solnedgang med markørene ved foten av solbuen.",
    showHorizonLine: "Vis terrenghorisont",
    showHorizonLineHint: "Tegner terrengets horisontlinje rundt hjemmet, beregnet fra det lokale terrenget. Horisonten demper alltid solen realistisk bak åser; dette viser eller skjuler bare den tegnede linjen.",
    horizonLineColor: "Farge på terrenghorisonten",
    horizonLineColorHint: "Farge på terrenghorisontlinjen.",
    moonDisplay: "Måne",
    moonDisplayHint: "Tegner månen på sin egen bue med en fasekorrekt sigd, alltid foran solen. Kun kosmetisk: ingen brikke, ingen verdi.",
    moonDisplayAlways: "Alltid synlig",
    moonDisplayNight: "Bare om natten",
    moonDisplayHidden: "Skjult",
    sceneZoom: "Scenezoom",
    sceneZoomHint: "Forstørrer kartet, bygningene og skyggene rundt hjemmet ditt: 1x er dagens visning, 1,5x og 2x viser dem større. Solen, buene og brikkene beholder størrelsen.",
    lockRotation: "Lås rotasjon",
    lockRotationHint:
      "Dra i forhåndsvisningen for å rotere og vippe scenen til ønsket visning, og slå så på dette. Låsen fryser den visningen (dra-for-å-rotere og den automatiske rotasjonen i hvile slås av) og lagrer vinkelen i kortet, slik at nøyaktig samme visning vises på alle enheter og nettlesere. Slå det av for å rotere fritt igjen.",
    chipsSection: "Entitetsvisning",
    chipsIntro:
      "Vis eller skjul hver entitet, og velg ikon og farge for den. Hjemmet følger den valgte chipen, eller primærfargen din som standard.",
    chipIrradiance: "Visning av solinnstråling",
    chipProduction: "Visning av produksjon",
    chipGrid: "Visning av strømnett",
    chipBattery: "Visning av batteri",
    chipHome: "Visning av husforbruk",
    groupsConfigTitle: "Gruppekonfigurasjon",
    optionalSensors: "Valgfrie sensorer",
    solarIrradianceEntity: "Entitet for solinnstråling",
    solarIrradianceEntityHelp:
      "Velg en sensor som rapporterer global kortbølget solinnstråling i W/m² (typisk Ecowitt / Davis / personlig værstasjon). Når den er satt, erstatter dens nåværende tilstand og opptakerhistorikk Open-Meteo for live- og fortidsinnstrålingen overalt hvor den vises (tall på solchipen, PV-diagrammets Y-akse, fargelegging av solbuen). Prognosetimer forblir på Open-Meteo siden en sensor ikke kan bære fremtidige verdier.",
    liveDataTitle: "Konfigurasjonsstatus",
    liveDataIntro:
      "Live chips viser kun målte sensorer. Hver familie trenger den valgfrie live effektsensoren fra sin kilde i energidashbordet, kurver og totaler kommer alltid fra dine målere.",
    liveSolarOk: "Sol: live effektsensor oppdaget.",
    liveSolarMissing:
      "Sol: ingen live effektsensor, produksjonschipen forblir skjult. Legg til én under Innstillinger > Dashbord > Energi > Solcellepaneler.",
    liveSolarAbsent:
      "Sol: ikke satt opp i energidashbordet ditt. Legg til solcellepaneler der for å få produksjonschipen.",
    liveGridOk: "Strømnett: live effektsensor oppdaget.",
    liveGridMissing:
      "Strømnett: ingen live effektsensor, chipene for import/eksport forblir skjult. Legg til én under Innstillinger > Dashbord > Energi > Strømnett.",
    liveGridMiswired:
      "Strømnett: live effektsensoren strider mot målerne dine (den ser ut til å måle bare én retning). Chipene forblir skjult, sett opp en signert sensor eller modusen To sensorer.",
    liveGridAbsent:
      "Strømnett: ikke satt opp i energidashbordet ditt. Legg til strømnettet der for å få chipene for import og eksport.",
    liveBatteryOk: "Batteri: live effektsensorer dekker hvert batteri.",
    liveBatteryMissing:
      "Batteri: live effekt mangler på minst ett batteri, effektchipen forblir skjult. Legg til effektsensoren(e) under Innstillinger > Dashbord > Energi > Batteri.",
    liveBatteryAbsent:
      "Batteri: ikke satt opp i energidashbordet ditt. Legg til et batteri der for å få lade- og utladingschipen.",
    liveHomeOk: "Husforbruk: vises, utledet fra live-familiene ovenfor.",
    liveHomeNote:
      "Husforbruk vises så snart hver konfigurerte familie ovenfor har sin live-sensor.",
    openEnergyConfig: "Åpne energikonfigurasjon",
    buildingsSection: "Hjem og bygninger",
    buildingsHint:
      'For å holde kortet flytende i tette byområder gjengis bare bygninger innenfor den konfigurerte radiusen rundt hjemmet i 3D. Hjemmet selv forblir helt ugjennomsiktig, nærliggende bygninger gjengis med den konfigurerte gjennomsiktigheten slik at de gir urban kontekst uten å konkurrere med dataoverleggene. Klyngeradiusen grupperer tilknyttede uthus (verandaer, garasjer, skur) inn i "hjem"-settet.',
    displayRadius: "Visningsradius",
    displayRadiusHelp:
      "Radius rundt hjemmet der bygninger hentes og tegnes, helt ut til kanten av den falmede kartskiven. Senk den for å lette gjengivelsen på en treg enhet, 0 viser bare hjemmet.",
    buildingCount: "Antall bygninger",
    buildingCountHelp:
      "Maksimalt antall nærliggende bygninger å tegne. Senk det for å lette gjengivelsen på en treg enhet.",
    buildingRealSize: "Reelle bygningshøyder",
    buildingRealSizeOn: "På",
    buildingRealSizeOff: "Av",
    buildingRealSizeHint:
      "På: bruk reelle OpenStreetMap-høyder (begrenset for å holde rammen lesbar). Av: gi hver bygning samme faste høyde nedenfor.",
    buildingHeight: "Bygningshøyde",
    hiddenDevicesEmpty:
      "Ingen individuelle enheter spores ennå i energidashbordet ditt. Legg til enhetsforbruk der for å styre dem her.",
    deviceVisibilityLabel: "Vis enhet",
    group: "Gruppe",
    noGroup: "Ingen gruppe",
    groupAssignHint:
      "Dra enhetene dine inn i en gruppe. Det som blir igjen nedenfor, tilhører ingen gruppe.",
    groupDropHere: "Slipp en enhet her",
    backToLive: "Tilbake til live",
    buildingClusterRadius: "Hjemmets klyngeradius",
    buildingClusterRadiusHelp:
      "Radius rundt hjemmet innenfor hvilken tilknyttede uthus (verandaer, garasjer, skur) regnes som en del av hjemmet: de gjengis med hjemmets fulle ugjennomsiktighet og farge i stedet for som falmede naboer. 0 beholder bare hovedbygningen.",
    buildingOpacity: "Ugjennomsiktighet for omgivelser",
    buildingColor: "Bygningsfarge",
    buildingColorHelp:
      "Grunntone brukt på de omkringliggende bygningene i scenen.",
    shadowsSection: "Skygger",
    shadowsEnabled: "Vis skygger",
    shadowsEnabledOn: "Vist",
    shadowsEnabledOff: "Skjult",
    shadowsEnabledHint:
      "Slår av/på bakkeskyggene som bygningene kaster mens solen beveger seg.",
    shadowOpacity: "Skyggeugjennomsiktighet",
    shadowOpacityHint: "Ugjennomsiktighet for de kastede bakkeskyggene.",
    resetSection: "Tilbakestill",
    resetSectionHint:
      "Vedlikeholdsverktøy: hent kortets bufrede data på nytt, eller tilbakestill alle valg til standard.",
    resetCacheButton: "Tilbakestill databuffer",
    resetCacheWarning:
      "Advarsel: dette henter på nytt alt kortet har bufret, Open-Meteo-været, hver energiserie i minnet (produksjon, strømnett, batteri, enheter, solinnstråling), kalibreringen til den forfinede prognosen, og OpenFreeMap-bygningsomrissene, for hvert Helios-kort som er åpent på denne siden. Bruk det til å fjerne fastlåst kalibrering eller utdaterte vær-/kartdata; en full nedlasting tar noen minutter avhengig av HA-serveren din. Dataene dine inne i Home Assistant berøres aldri.",
    resetCacheDone: "Buffer tømt ✓",
    resetOptionsButton: "Tilbakestill valg til standard",
    resetOptionsConfirm: "Klikk igjen for å bekrefte",
    resetOptionsWarning:
      "Advarsel: dette tilbakestiller ALLE valgene for dette kortet til standardverdiene, synlighet, farger og ikoner for chips, navn/farger/ikoner for grupper, bygninger, skygger, enheter og alle andre innstillinger. Home Assistant-dataene dine og energidashbordet berøres ikke, men tilpasningen din slettes og kan ikke gjenopprettes.",
    resetOptionsDone: "Valg tilbakestilt ✓",
    aboutSection: "Om",
    aboutVersionLabel: "Versjon",
    aboutRepoCard: "Helios",
    aboutCoffeeMessage:
      "Jeg bygger Helios alene, mest om natten, på jakt etter de små detaljene helt til solen og energien din føles levende på skjermen. Hvis det har funnet en plass på dashbordet ditt, gjør det meg allerede glad, en stjerne på GitHub gjør meg enda gladere, og en kaffe holder det hele i gang.",
    aboutDeveloperLabel: "Utvikler",
    aboutDeveloperLinkedIn: "LinkedIn",
    aboutCoffeeLink: "Spander en kaffe",
  },
};
