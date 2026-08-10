import type { Translations } from "../index";

//Swedish locale.
export const sv: Translations = {
  cardName: "Helios",
  cardDescription:
    "☀️ En 2.5D-vy i realtid av ditt hem med solen, vädret, solproduktion, batteri och elnät, plus kastade skuggor och en interaktiv tidslinje",

  period: {
    rangeLabel: "Tidsintervall",
    forecast: "Prognos",
    yesterday: "Igår",
    today: "Idag",
    week: "Vecka",
    month: "Månad",
    year: "År",
  },

  compass: "N,NO,O,SO,S,SV,V,NV",

  cloudCover: {
    cloudLow: "Låg molnighet",
    cloudMid: "Medelhög molnighet",
    cloudHigh: "Hög molnighet",
  },

  mapConfig: {
    section: "Kartkonfiguration",
    intro:
      "Bakgrundskartan ritas från OpenStreetMaps vektorkartor. Auto följer ditt tema, Dark / Light tvingar fram ett, och Custom låter dig ställa in varje färg och dölja valfritt lager.",
    modeAuto: "Auto",
    modeDark: "Mörkt",
    modeLight: "Ljust",
    modeCustom: "Anpassat",
    land: "Bakgrund",
    water: "Vatten",
    wood: "Skogsmark",
    grass: "Grönska",
    sand: "Sand",
    wetland: "Våtmark",
    ice: "Is & snö",
    landuse: "Bebyggd mark",
    roadMajor: "Större vägar",
    roadMinor: "Mindre vägar",
    roadCasing: "Vägkontur",
    path: "Stigar & spår",
    rail: "Järnvägar",
    building: "Byggnader",
    boundary: "Gränser",
  },

  editor: {
    weatherEnabled: "Vädereffekter",
    weatherEnabledHint:
      "Måla den verkliga himlen över scenen: solsken, moln, regn, snö och åskväder från ditt lokala väder, som följer tidslinjen när du drar i den. Avstängt håller scenen klar.",
    temperatureEntity: "Temperatursensor",
    temperatureEntityHelp:
      "Valfritt. Använd en lokal utomhustemperatursensor (°C) i stället för Open-Meteo-värdet för temperaturchippet. Dess aktuella tillstånd och recorder-historik används för live + dåtid; prognostimmar följer modellen.",
    humidityEntity: "Luftfuktighetssensor",
    humidityEntityHelp:
      "Valfritt. Använd en lokal sensor för relativ luftfuktighet (%) i stället för Open-Meteo-värdet, för live + dåtid.",
    cloudCoverEntity: "Molntäckessensor",
    cloudCoverEntityHelp:
      "Valfritt. Använd en lokal molntäckessensor (%) för att styra himlens gradering (sol, gråmulet) i stället för Open-Meteo-värdet, för live + dåtid.",
    precipitationEntity: "Nederbördssensor",
    precipitationEntityHelp:
      "Valfritt. Använd en lokal nederbördssensor (mm) för att styra regnlagret i stället för Open-Meteo-värdet, för live + dåtid.",
    snowfallEntity: "Snöfallssensor",
    snowfallEntityHelp:
      "Valfritt. Använd en lokal snöfallssensor (cm) för att styra snölagret i stället för Open-Meteo-värdet, för live + dåtid.",
    weatherEntity: "Väderentitet",
    weatherEntityHelp:
      "Valfritt. Använd en Home Assistant-väderentitet för att styra förhållandet (regn / snö / åskväder) i stället för Open-Meteo-värdet, för live + dåtid. Prognostimmar följer modellen.",
    chipTemperature: "Temperaturvisning",
    chipHumidity: "Luftfuktighetsvisning",
    chipCost: "Kostnadsvisning",
    locationSection: "Hemmets plats",
    homeLatitude: "Hemmets latitud",
    homeLongitude: "Hemmets longitud",
    locationHint:
      "Ersätt hemadressen som används som kortets centrum. Lämna båda fälten tomma för att använda hemmet som är konfigurerat i Home Assistant. Ersättningen tillämpas endast när BÅDA fälten är inställda på giltiga koordinater.",
    uiAndMapSection: "UI",
    autoRotate: "Automatisk kamerarotation",
    autoRotateHint:
      "När det är inaktivt i några sekunder kretsar kameran långsamt runt hemmet (cirka 1,5°/s, motsatt solens skenbara rörelse). En dragning med ett finger pausar den omedelbart och den återupptas när du släpper. Undvik det på mycket gamla enheter: automatisk rotation tvingar fram en rendering varje sekund.",
    autoRotateOn: "På",
    autoRotateOff: "Av",
    dataDisplaySection: "Datavisning",
    maxExpectedPower: "Max förväntad effekt",
    maxExpectedPowerHelp:
      "Effekten vid vilken ett flöde animeras med full hastighet. Varje flöde avvägs mot denna enda referens, så ett större flöde läses alltid som snabbare än ett mindre, oavsett vilken riktning det går. Höj den för en stor anläggning, sänk den för en liten. Standard 5000 W.",
    sunChipMode: "Solchippets utläsning",
    sunChipModeHelp:
      "Vad solchippet visar: solirradians i realtid (standard) eller solens position (azimut och höjd). Positionen behöver ingen sensor, den kommer från kortets egen solberäkning.",
      batteryChipMode: "Batterichip-avläsning",
      batteryChipModeHelp: "Vad batterichippet visar: den aktuella effekten (standard) eller laddningsnivån (%). Det faller tillbaka på det värde som ditt batteri faktiskt tillhandahåller.",
      batteryChipModePower: "Effekt",
      batteryChipModeSoc: "Laddningsnivå",
    sunChipModeIrradiance: "Irradians",
    sunChipModePosition: "Solposition",
    displayUpdateFrequency: "Grafdetaljer",
    displayUpdateFrequencyHelp:
      "Hur många punkter per timme graferna ritar. Själva datan är alltid Home Assistants 5-minuters statistik; detta styr bara hur tätt kurvan plottas: 1 = en punkt per timme (mjukast, lättast att rendera), 6 = en punkt var 10:e minut (full detalj, tyngst). Standard 4 = en punkt var 15:e minut. Sänk det på äldre eller långsammare enheter för att minska renderingskostnaden. Prognoskurvan följer samma takt, så en finare inställning visar även korta skuggdippar (ett träd som skuggar produktionen i en halvtimme) som en timkurva hoppar över.",
    valueDecimals: "Decimaler",
    valueDecimalsHelp:
      "Antal decimaler som visas på varje värdeutläsning, så att chipsen ser enhetliga ut. Gäller kW-värden (hela watt förblir heltal) och kWh. 0 till 3, standard 1.",
    powerUnit: "Effektenhet",
    powerUnitHelp:
      "Enhet för varje effektutläsning på kortet (chips, grafverktygstips). Energin följer den också, så kortet förblir konsekvent: kW hör ihop med kWh, W med Wh.",
    irradianceUnit: "Enhet för solkonstant",
    irradianceUnitHelp:
      "Enhet för utläsningen av solkonstanten (irradians) ovanför solen.",
    batterySign: "Batteritecken",
    batterySignHelp:
      "Tecken som visas på batterichippet. Standard är minus vid laddning och plus vid urladdning. Inverterat vänder på det. Dolt visar värdet utan tecken.",
    batterySignDefault: "Standard",
    batterySignInverted: "Inverterat",
    batterySignHidden: "Dolt",
    noUiMode: "Läge utan gränssnitt",
    noUiModeHint:
      "Tona ned tidslinjen och kontrollerna på kortet efter några sekunders inaktivitet. Vilken tryckning eller rörelse som helst tar tillbaka dem. Perfekt för en väggskärm.",
    noUiDelay: "Fördröjning innan gömning",
    noUiDelayHint:
      "Sekunder av inaktivitet innan tidslinjen och kontrollerna tonas bort i läget utan gränssnitt. 0 håller gränssnittet dolt permanent. Används bara när läget utan gränssnitt är på.",
    showTimeline: "Visa tidslinje",
    showTimelineHint:
      "Visa tidslinjen och periodväljaren under scenen. Av behåller bara scenen.",
    showDetailPanel: "Visa mer information",
    showDetailPanelHint:
      "Tillåt att mini-panelen per chip (aggregerade mätvärden) öppnas uppe till höger när ett chip trycks. Av visar den aldrig.",
    showSunTimes: "Visa soluppgång / solnedgång",
    showSunTimesHint:
      "Visa tiderna för soluppgång och solnedgång och deras markörer vid solbågens fötter.",
    showHorizonLine: "Visa terränghorisont",
    showHorizonLineHint: "Ritar terrängens horisontlinje runt hemmet, beräknad från den lokala terrängen. Horisonten dämpar alltid solen realistiskt bakom kullar; detta visar eller döljer bara den ritade linjen.",
    horizonLineColor: "Färg på terränghorisonten",
    horizonLineColorHint: "Färg på terränghorisontlinjen.",
    lockRotation: "Lås rotation",
    lockRotationHint:
      "Dra i förhandsvisningen för att rotera och luta scenen till önskad vy och slå sedan på detta. Låset fryser den vyn (dra-för-att-rotera och den automatiska rotationen i viloläge stängs av) och sparar vinkeln i kortet, så att exakt samma vy visas på varje enhet och webbläsare. Stäng av det för att rotera fritt igen.",
    chipsSection: "Entitetsvisning",
    chipsIntro:
      "Visa eller dölj varje entitet, och välj dess ikon och färg. Hemmet följer det valda chippet, eller din primärfärg som standard.",
    chipIrradiance: "Visning av irradians",
    chipProduction: "Visning av produktion",
    chipGrid: "Visning av elnät",
    chipBattery: "Visning av batteri",
    chipHome: "Visning av hemförbrukning",
    groupsConfigTitle: "Gruppkonfiguration",
    optionalSensors: "Valfria sensorer",
    solarIrradianceEntity: "Entitet för solirradians",
    solarIrradianceEntityHelp:
      "Välj en sensor som rapporterar global kortvågig irradians i W/m² (vanligtvis Ecowitt / Davis / personlig väderstation). När den är inställd ersätter dess aktuella tillstånd och inspelarhistorik Open-Meteo för live- och tidigare irradians överallt där den visas (siffra på solchippet, PV-diagrammets Y-axel, färgläggning av solbågen). Prognostimmar stannar på Open-Meteo eftersom en sensor inte kan bära framtida värden.",
    liveDataTitle: "Konfigurationsstatus",
    liveDataIntro:
      "Live-chips visar bara uppmätta sensorer. Varje familj behöver den valfria live-effektsensorn från sin energidashboard-källa; kurvor och totaler kommer alltid från dina mätare.",
    liveSolarOk: "Solceller: live-effektsensor upptäckt.",
    liveSolarMissing:
      "Solceller: ingen live-effektsensor, produktionschippet förblir dolt. Lägg till en under Inställningar > Paneler > Energi > Solpaneler.",
    liveSolarAbsent:
      "Solceller: inte konfigurerat i din energidashboard. Lägg till solpaneler där för att få produktionschippet.",
    liveGridOk: "Elnät: live-effektsensor upptäckt.",
    liveGridMissing:
      "Elnät: ingen live-effektsensor, import-/exportchipsen förblir dolda. Lägg till en under Inställningar > Paneler > Energi > Elnät.",
    liveGridMiswired:
      "Elnät: live-effektsensorn motsäger dina mätare (den verkar bara mäta en riktning). Chipsen förblir dolda; konfigurera en signerad sensor eller läget Två sensorer.",
    liveGridAbsent:
      "Elnät: inte konfigurerat i din energidashboard. Lägg till elnätet där för att få import- och exportchipsen.",
    liveBatteryOk: "Batteri: live-effektsensorer täcker varje batteri.",
    liveBatteryMissing:
      "Batteri: live-effekt saknas på minst ett batteri, effektchippet förblir dolt. Lägg till effektsensorn/sensorerna under Inställningar > Paneler > Energi > Batteri.",
    liveBatteryAbsent:
      "Batteri: inte konfigurerat i din energidashboard. Lägg till ett batteri där för att få laddnings- och urladdningschippet.",
    liveHomeOk: "Hemförbrukning: visas, härledd från live-familjerna ovan.",
    liveHomeNote:
      "Hemförbrukning visas så snart varje konfigurerad familj ovan har sin live-sensor.",
    openEnergyConfig: "Öppna energikonfiguration",
    buildingsSection: "Hem & byggnader",
    buildingsHint:
      'För att hålla kortet flytande i tätbebyggda stadsområden renderas endast byggnader inom den konfigurerade radien runt hemmet i 3D. Hemmet självt förblir helt ogenomskinligt; närliggande byggnader renderas med den konfigurerade ogenomskinligheten så att de ger urban kontext utan att konkurrera med dataöverläggen. Klusterradien grupperar tillhörande uthus (verandor, garage, skjul) i "hem"-uppsättningen.',
    displayRadius: "Visningsradie",
    displayRadiusHelp:
      "Radie runt hemmet inom vilken byggnader hämtas och ritas, ända ut till kanten av den blekta kortskivan. Sänk den för att lätta renderingen på en långsam enhet; 0 visar bara hemmet.",
    buildingCount: "Antal byggnader",
    buildingCountHelp:
      "Maximalt antal närliggande byggnader att rita. Sänk det för att lätta renderingen på en långsam enhet.",
    buildingRealSize: "Verkliga byggnadshöjder",
    buildingRealSizeOn: "På",
    buildingRealSizeOff: "Av",
    buildingRealSizeHint:
      "På: använd verkliga OpenStreetMap-höjder (begränsade för att hålla bildramen läsbar). Av: ge varje byggnad samma fasta höjd nedan.",
    buildingHeight: "Byggnadshöjd",
    hiddenDevicesEmpty:
      "Inga enskilda enheter spåras ännu i din energidashboard. Lägg till enhetsförbrukning där för att styra dem här.",
    deviceVisibilityLabel: "Visa enhet",
    deviceGroupLabel: "Övervakningsgrupp",
    group: "Grupp",
    noGroup: "Ingen grupp",
    groupAssignHint:
      "Dra dina enheter till en grupp. Det som blir kvar nedanför tillhör ingen grupp.",
    groupDropHere: "Släpp en enhet här",
    backToLive: "Tillbaka till live",
    devicesEnergyNote:
      "Detta är de enskilda enheter som för närvarande är konfigurerade i din Home Assistant-energidashboard. Ögat visar eller döljer varje enhet överallt, och pillen tilldelar den till en grupp.",
    buildingClusterRadius: "Hemmets klusterradie",
    buildingClusterRadiusHelp:
      "Radie runt hemmet inom vilken tillhörande uthus (verandor, garage, skjul) behandlas som en del av hemmet: de renderas med hemmets fulla ogenomskinlighet och färg istället för som blekta grannar. 0 behåller bara huvudbyggnaden.",
    buildingOpacity: "Ogenomskinlighet för omgivning",
    buildingColor: "Byggnadsfärg",
    buildingColorHelp:
      "Grundton som tillämpas på de omgivande byggnaderna i scenen.",
    shadowsSection: "Skuggor",
    shadowsEnabled: "Visa skuggor",
    shadowsEnabledOn: "Visas",
    shadowsEnabledOff: "Dold",
    shadowsEnabledHint:
      "Slår på/av de markskuggor som byggnaderna kastar när solen rör sig.",
    shadowOpacity: "Skuggogenomskinlighet",
    shadowOpacityHint: "Ogenomskinlighet för de kastade markskuggorna.",
    resetSection: "Återställ",
    resetSectionHint:
      "Underhållsverktyg: hämta om kortets cachade data, eller återställ alla alternativ till standardvärden.",
    resetCacheButton: "Återställ datacache",
    resetCacheWarning:
      "Varning: detta hämtar om allt kortet har cachat; Open-Meteo-vädret, alla energiserier i minnet (produktion, elnät, batteri, enheter, irradians), den förfinade prognosens kalibrering, och OpenFreeMaps byggnadsfotavtryck, för varje Helios-kort öppet på denna sida. Använd det för att rensa en fastlåst kalibrering eller inaktuell väder-/kartdata; en fullständig omhämtning tar några minuter beroende på din HA-server. Dina data inuti Home Assistant rörs aldrig.",
    resetCacheDone: "Cache rensad ✓",
    resetOptionsButton: "Återställ alternativ till standard",
    resetOptionsConfirm: "Klicka igen för att bekräfta",
    resetOptionsWarning:
      "Varning: detta återställer ALLA alternativ för detta kort till sina standardvärden; chippens synlighet, färger och ikoner, gruppers namn/färger/ikoner, byggnader, skuggor, enheter och alla andra inställningar. Dina Home Assistant-data och energidashboard rörs inte, men din anpassning raderas och kan inte återställas.",
    resetOptionsDone: "Alternativ återställda ✓",
    aboutSection: "Om",
    aboutVersionLabel: "Version",
    aboutRepoCard: "Helios",
    aboutCoffeeMessage:
      "Jag bygger Helios ensam, mest på nätterna, och jagar de små detaljerna tills solen och din energi känns levande på skärmen. Om det har hittat en plats på din dashboard gör det mig redan glad; en stjärna på GitHub gör det ännu mer, och en kopp kaffe håller allt i rörelse.",
    aboutDeveloperLabel: "Utvecklare",
    aboutDeveloperLinkedIn: "LinkedIn",
    aboutCoffeeLink: "Bjud mig på en kaffe",
  },
};
