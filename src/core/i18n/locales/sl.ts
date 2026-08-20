import type { Translations } from "../index";

//Slovenian locale.
export const sl: Translations = {
  cardName: "Helios",
  cardDescription:
    "☀️ 2.5D pogled na tvoj dom v realnem času s soncem, vremenom, solarno proizvodnjo, baterijo in omrežjem, poleg tega vržene sence in interaktivna časovnica",

  period: {
    rangeLabel: "Časovni razpon",
    forecast: "Napoved",
    yesterday: "Včeraj",
    today: "Danes",
    week: "Teden",
    month: "Mesec",
    year: "Leto",
  },

  compass: "S,SV,V,JV,J,JZ,Z,SZ",

  cloudCover: {
    cloudLow: "Nizka oblačnost",
    cloudMid: "Srednja oblačnost",
    cloudHigh: "Visoka oblačnost",
  },

  mapConfig: {
    section: "Nastavitve zemljevida",
    intro:
      "Podlaga zemljevida je izrisana iz vektorskih ploščic OpenStreetMap. Samodejno sledi tvoji temi, Temno / Svetlo vsili eno od njiju, Po meri pa ti omogoči nastaviti vsako barvo in skriti poljubno plast.",
    modeAuto: "Samodejno",
    modeDark: "Temno",
    modeLight: "Svetlo",
    modeCustom: "Po meri",
    land: "Ozadje",
    water: "Voda",
    wood: "Gozd",
    grass: "Zelenje",
    sand: "Pesek",
    wetland: "Mokrišče",
    ice: "Led in sneg",
    landuse: "Pozidano zemljišče",
    roadMajor: "Glavne ceste",
    roadMinor: "Stranske ceste",
    roadCasing: "Obris cest",
    path: "Poti in steze",
    rail: "Železnice",
    building: "Stavbe",
    boundary: "Meje",
  },

  editor: {
    weatherEnabled: "Vremenski učinki",
    weatherEnabledHint:
      "Nad prizor nariše resnično nebo: sonce, oblake, dež, sneg in nevihte iz vašega lokalnega vremena, ki sledijo časovnici, ko jo premikate. Ko je izklopljeno, prizor ostane jasen.",
    temperatureEntity: "Senzor temperature",
    temperatureEntityHelp:
      "Neobvezno. Za prikaz temperature uporabite lokalni zunanji senzor temperature (°C) namesto vrednosti Open-Meteo. Njegovo trenutno stanje in zgodovina snemalnika se uporabita za trenutni čas in preteklost; napovedane ure ostanejo na modelu.",
    humidityEntity: "Senzor vlažnosti",
    humidityEntityHelp:
      "Neobvezno. Za trenutni čas in preteklost uporabite lokalni senzor relativne vlažnosti (%) namesto vrednosti Open-Meteo.",
    cloudCoverEntity: "Senzor oblačnosti",
    cloudCoverEntityHelp:
      "Neobvezno. Za trenutni čas in preteklost uporabite lokalni senzor oblačnosti (%), ki namesto vrednosti Open-Meteo določa stopnjo neba (sonce, sivenje).",
    precipitationEntity: "Senzor padavin",
    precipitationEntityHelp:
      "Neobvezno. Za trenutni čas in preteklost uporabite lokalni senzor padavin (mm), ki namesto vrednosti Open-Meteo določa plast dežja.",
    snowfallEntity: "Senzor sneženja",
    snowfallEntityHelp:
      "Neobvezno. Za trenutni čas in preteklost uporabite lokalni senzor sneženja (cm), ki namesto vrednosti Open-Meteo določa plast snega.",
    weatherEntity: "Entiteta vremena",
    weatherEntityHelp:
      "Neobvezno. Za trenutni čas in preteklost uporabite entiteto vremena v Home Assistant, ki namesto vrednosti Open-Meteo določa razmere (dež / sneg / nevihta). Napovedane ure ostanejo na modelu.",
    chipTemperature: "Prikaz temperature",
    chipHumidity: "Prikaz vlažnosti",
    chipCost: "Prikaz stroška",
    locationSection: "Lokacija doma",
    homeLatitude: "Zemljepisna širina doma",
    homeLongitude: "Zemljepisna dolžina doma",
    locationHint:
      "Prepiše naslov doma, ki se uporablja kot središče kartice. Pusti obe polji prazni, da se uporabi dom, nastavljen v Home Assistant. Prepis se uporabi le, kadar sta OBE polji nastavljeni na veljavne koordinate.",
    uiAndMapSection: "UI",
    autoRotate: "Samodejno vrtenje kamere",
    autoRotateHint:
      "Po nekaj sekundah nedejavnosti kamera počasi kroži okoli doma (približno 1,5°/s, nasprotno navideznemu gibanju sonca). Poteg z enim prstom jo takoj zaustavi in se nadaljuje, ko spustiš. Izogibaj se mu na zelo starih napravah: samodejno vrtenje vsako sekundo prisili izris.",
    autoRotateOn: "Vklopljeno",
    autoRotateOff: "Izklopljeno",
    degradedRender: "Izris v načinu združljivosti",
    degradedRenderHint:
      "Zemljevid izriše z enostavnejšo in bolj združljivo metodo. Vklopite, če scena med vrtenjem ali premikanjem utripa ali se trga. To odpravi napako na nekaterih telefonih in tablicah za ceno nekoliko manj gladkega gibanja.",
    dataDisplaySection: "Prikaz podatkov",
    maxExpectedPower: "Največja pričakovana moč",
    maxExpectedPowerHelp:
      "Moč, pri kateri se tok animira s polno hitrostjo. Vsak tok je odmerjen glede na to eno referenco, zato večji tok vedno deluje hitreje kot manjši, ne glede na smer. Zvišaj jo za veliko napeljavo, znižaj za majhno. Privzeto 5000 W.",
    sunChipMode: "Prikaz čipa sonca",
    sunChipModeHelp:
      "Kaj prikazuje čip sonca: živo sončno obsevanje (privzeto) ali položaj sonca (azimut in višino). Položaj ne potrebuje senzorja, izhaja iz lastnih sončnih izračunov kartice.",
      batteryChipMode: "Prikaz čipa baterije",
      batteryChipModeHelp: "Kaj prikazuje čip baterije: trenutno moč (privzeto) ali stanje napolnjenosti (%). Preklopi na vrednost, ki jo baterija dejansko zagotavlja.",
      batteryChipModePower: "Moč",
      batteryChipModeSoc: "Stanje napolnjenosti",
    sunChipModeIrradiance: "Obsevanje",
    sunChipModePosition: "Položaj sonca",
    displayUpdateFrequency: "Podrobnost grafa",
    displayUpdateFrequencyHelp:
      "Koliko točk na uro izrišejo grafi. Sami podatki so vedno 5-minutne statistike Home Assistant; to nadzira le, kako gosto je narisana krivulja: 1 = ena točka na uro (najbolj gladko, najlažje za izris), 6 = ena točka vsakih 10 minut (polna podrobnost, najtežje). Privzeto 4 = točka vsakih 15 minut. Zniži na starejših ali počasnejših napravah, da zmanjšaš stroške izrisa. Krivulja napovedi sledi istemu ritmu, zato finejša nastavitev razloči tudi kratke padce zaradi sence (drevo, ki za pol ure zakrije proizvodnjo), ki jih urna krivulja preskoči.",
    valueDecimals: "Decimalna mesta",
    valueDecimalsHelp:
      "Število decimalnih mest, prikazanih pri vsaki vrednosti, da so čipi videti enotni. Velja za vrednosti v kW (cele vatne vrednosti ostanejo cela števila) in za kWh. 0 do 3, privzeto 1.",
    powerUnit: "Enota moči",
    powerUnitHelp:
      "Enota za vsak prikaz moči na kartici (čipi, namigi grafa). Energija ji tudi sledi, da kartica ostane usklajena: kW se ujema s kWh, W z Wh.",
    irradianceUnit: "Enota sončne konstante",
    irradianceUnitHelp:
      "Enota za prikaz sončne konstante (obsevanja) nad soncem.",
    batterySign: "Predznak baterije",
    batterySignHelp:
      "Predznak, prikazan na čipu baterije. Privzeto je minus med polnjenjem in plus med praznjenjem. Obrnjeno ju zamenja. Skrito prikaže vrednost brez predznaka.",
    batterySignDefault: "Privzeto",
    batterySignInverted: "Obrnjeno",
    batterySignHidden: "Skrito",
    noUiMode: "Način brez vmesnika",
    noUiModeHint:
      "Po nekaj sekundah nedejavnosti zbledi časovnica in kontrolniki na kartici. Vsak dotik ali premik ju prikliče nazaj. Odlično za stenski zaslon.",
    noUiDelay: "Zakasnitev pred skritjem",
    noUiDelayHint:
      "Sekunde nedejavnosti, preden v načinu brez vmesnika zbledita časovnica in kontrolniki. 0 ohrani vmesnik trajno skrit. Uporabljeno le, kadar je način brez vmesnika vklopljen.",
    showTimeline: "Pokaži časovnico",
    showTimelineHint:
      "Pokaže časovnico in izbirnik obdobja pod prizorom. Izklopljeno pusti le prizor.",
    showDetailPanel: "Pokaži dodatne informacije",
    showDetailPanelHint:
      "Dovoli, da se ob dotiku čipa zgoraj desno odpre mini plošča (združeni podatki) za posamezen čip. Izklopljeno je nikoli ne prikaže.",
    showSunTimes: "Pokaži čas sončnega vzhoda / zahoda",
    showSunTimesHint:
      "Pokaže čas sončnega vzhoda in zahoda ter njuni oznaki ob vznožju sončnega loka.",
    showHorizonLine: "Prikaži obzorje terena",
    showHorizonLineHint: "Nariše črto obzorja reliefa okoli doma, izračunano iz lokalnega terena. Obzorje vedno realistično zatemni sonce za griči; to samo prikaže ali skrije narisano črto.",
    horizonLineColor: "Barva obzorja terena",
    horizonLineColorHint: "Barva črte obzorja terena.",
    lockRotation: "Zakleni vrtenje",
    lockRotationHint:
      "Povlecite predogled, da zavrtite in nagnete prizor na želeni pogled, nato pa to vklopite. Zaklep zamrzne ta pogled (vrtenje z vlečenjem in samodejno vrtenje v mirovanju se izklopita) in shrani kot v kartico, tako da se popolnoma enak pogled prikaže na vsaki napravi in brskalniku. Izklopite ga za ponovno prosto vrtenje.",
    chipsSection: "Prikaz entitet",
    chipsIntro:
      "Pokaži ali skrij vsako entiteto ter izberi njeno ikono in barvo. Dom sledi izbranemu čipu ali privzeto tvoji primarni barvi.",
    chipIrradiance: "Prikaz obsevanja",
    chipProduction: "Prikaz proizvodnje",
    chipGrid: "Prikaz omrežja",
    chipBattery: "Prikaz baterije",
    chipHome: "Prikaz porabe doma",
    groupsConfigTitle: "Nastavitve skupin",
    optionalSensors: "Neobvezni senzorji",
    solarIrradianceEntity: "Entiteta sončnega obsevanja",
    solarIrradianceEntityHelp:
      "Izberi senzor, ki poroča globalno kratkovalovno obsevanje v W/m² (običajno Ecowitt / Davis / osebna vremenska postaja). Ko je nastavljen, njegovo trenutno stanje in zgodovina iz snemalnika nadomestita Open-Meteo za živo in pretekto obsevanje povsod, kjer se pojavi (število na čipu sonca, os Y grafa PV, obarvanje sončnega loka). Ure napovedi ostanejo na Open-Meteo, saj senzor ne more nositi prihodnjih vrednosti.",
    liveDataTitle: "Stanje nastavitev",
    liveDataIntro:
      "Živi čipi prikazujejo le izmerjene senzorje. Vsaka družina potrebuje neobvezni senzor žive moči svojega vira v nadzorni plošči Energija; krivulje in vsote vedno prihajajo iz tvojih merilnikov.",
    liveSolarOk: "Sonce: zaznan senzor žive moči.",
    liveSolarMissing:
      "Sonce: brez senzorja žive moči, čip proizvodnje ostane skrit. Dodaj ga pod Nastavitve > Nadzorne plošče > Energija > Sončni paneli.",
    liveSolarAbsent:
      "Sonce: ni nastavljeno v tvoji nadzorni plošči Energija. Tam dodaj sončne panele, da dobiš čip proizvodnje.",
    liveGridOk: "Omrežje: zaznan senzor žive moči.",
    liveGridMissing:
      "Omrežje: brez senzorja žive moči, čipa uvoza/izvoza ostaneta skrita. Dodaj ga pod Nastavitve > Nadzorne plošče > Energija > Omrežje.",
    liveGridMiswired:
      "Omrežje: senzor žive moči nasprotuje tvojim merilnikom (kaže, da meri le eno smer). Čipa ostaneta skrita; nastavi senzor s predznakom ali način Dva senzorja.",
    liveGridAbsent:
      "Omrežje: ni nastavljeno v tvoji nadzorni plošči Energija. Tam dodaj omrežje, da dobiš čipa uvoza in izvoza.",
    liveBatteryOk: "Baterija: senzorji žive moči pokrivajo vsako baterijo.",
    liveBatteryMissing:
      "Baterija: manjka živa moč vsaj pri eni bateriji, čip moči ostane skrit. Dodaj senzor(je) moči pod Nastavitve > Nadzorne plošče > Energija > Baterija.",
    liveBatteryAbsent:
      "Baterija: ni nastavljena v tvoji nadzorni plošči Energija. Tam dodaj baterijo, da dobiš čip polnjenja in praznjenja.",
    liveHomeOk: "Poraba doma: prikazana, izpeljana iz zgornjih živih družin.",
    liveHomeNote:
      "Poraba doma se prikaže, ko ima vsaka zgoraj nastavljena družina svoj živi senzor.",
    openEnergyConfig: "Odpri nastavitve Energije",
    buildingsSection: "Dom in stavbe",
    buildingsHint:
      'Da kartica ostane tekoča v gosto pozidanih mestnih območjih, se v 3D izrišejo le stavbe v nastavljenem polmeru okoli doma. Sam dom ostane pri polni neprosojnosti; bližnje stavbe se izrišejo z nastavljeno prosojnostjo, tako da dajejo mestni kontekst, ne da bi tekmovale s podatkovnimi prekrivami. Polmer združevanja združi prizidane pomožne stavbe (verande, garaže, lope) v skupino "doma".',
    displayRadius: "Polmer prikaza",
    displayRadiusHelp:
      "Polmer okoli doma, v katerem se stavbe pridobijo in narišejo, do roba zatemnjene plošče zemljevida. Zniži ga, da olajšaš izris na počasni napravi; 0 prikaže le dom.",
    buildingCount: "Število stavb",
    buildingCountHelp:
      "Največje število bližnjih stavb za izris. Zniži ga, da olajšaš izris na počasni napravi.",
    buildingRealSize: "Resnične višine stavb",
    buildingRealSizeOn: "Vklopljeno",
    buildingRealSizeOff: "Izklopljeno",
    buildingRealSizeHint:
      "Vklopljeno: uporabi resnične višine iz OpenStreetMap (omejene, da kadriranje ostane berljivo). Izklopljeno: vsaki stavbi daj enako fiksno višino spodaj.",
    buildingHeight: "Višina stavbe",
    hiddenDevicesEmpty:
      "V tvoji nadzorni plošči Energija še ni sledenih posameznih naprav. Tam dodaj porabo naprav, da jih lahko upravljaš tukaj.",
    deviceVisibilityLabel: "Pokaži napravo",
    group: "Skupina",
    noGroup: "Brez skupine",
    groupAssignHint:
      "Povlecite svoje naprave v skupino. Kar ostane spodaj, ne pripada nobeni skupini.",
    groupDropHere: "Sem spustite napravo",
    backToLive: "Nazaj na v živo",
    buildingClusterRadius: "Polmer združevanja doma",
    buildingClusterRadiusHelp:
      "Polmer okoli doma, znotraj katerega se prizidane pomožne stavbe (verande, garaže, lope) obravnavajo kot del doma: izrišejo se s polno neprosojnostjo in barvo doma namesto kot zatemnjeni sosedi. 0 ohrani le glavno stavbo.",
    buildingOpacity: "Prosojnost okolice",
    buildingColor: "Barva stavb",
    buildingColorHelp:
      "Osnovni odtenek, uporabljen za okoliške stavbe v prizoru.",
    shadowsSection: "Sence",
    shadowsEnabled: "Pokaži sence",
    shadowsEnabledOn: "Prikazano",
    shadowsEnabledOff: "Skrito",
    shadowsEnabledHint:
      "Preklaplja talne sence, ki jih stavbe mečejo, ko se sonce premika.",
    shadowOpacity: "Prosojnost senc",
    shadowOpacityHint: "Prosojnost vrženih senc na tleh.",
    resetSection: "Ponastavitev",
    resetSectionHint:
      "Vzdrževalna orodja: ponovno pridobi predpomnjene podatke kartice ali ponastavi vse možnosti na privzete vrednosti.",
    resetCacheButton: "Ponastavi predpomnilnik podatkov",
    resetCacheWarning:
      "Opozorilo: to ponovno pridobi vse, kar je kartica shranila v predpomnilnik - vreme Open-Meteo, vsako energijsko vrsto v pomnilniku (proizvodnja, omrežje, baterija, naprave, obsevanje), umerjanje izboljšane napovedi in obrise stavb OpenFreeMap - za vsako odprto kartico Helios na tej strani. Uporabi to za odpravo zataknjenega umerjanja ali zastarelih podatkov o vremenu/zemljevidu; celotna ponovna pridobitev traja nekaj minut, odvisno od tvojega strežnika HA. Tvojih podatkov v Home Assistant se to nikoli ne dotakne.",
    resetCacheDone: "Predpomnilnik počiščen ✓",
    resetOptionsButton: "Ponastavi možnosti na privzete",
    resetOptionsConfirm: "Za potrditev klikni ponovno",
    resetOptionsWarning:
      "Opozorilo: to ponastavi VSE možnosti te kartice na privzete vrednosti - vidnost, barve in ikone čipov, imena/barve/ikone skupin, stavbe, sence, enote in vse druge nastavitve. Tvojih podatkov Home Assistant in nadzorne plošče Energija se to ne dotakne, tvoje prilagoditve pa bodo izbrisane in jih ni mogoče obnoviti.",
    resetOptionsDone: "Možnosti ponastavljene ✓",
    aboutSection: "O kartici",
    aboutVersionLabel: "Različica",
    aboutRepoCard: "Helios",
    aboutCoffeeMessage:
      "Helios gradim sam, večinoma ponoči, in lovim majhne podrobnosti, dokler sonce in tvoja energija na zaslonu ne zaživita. Če je našel svoje mesto na tvoji nadzorni plošči, me to že osrečuje - zvezdica na GitHub še bolj, kava pa vse skupaj poganja naprej.",
    aboutDeveloperLabel: "Razvijalec",
    aboutDeveloperLinkedIn: "LinkedIn",
    aboutCoffeeLink: "Plačaj mi kavo",
  },
};
