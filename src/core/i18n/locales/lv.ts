import type { Translations } from "../index";

//Latvian locale.
export const lv: Translations = {
  cardName: "Helios",
  cardDescription:
    "☀️ Reāllaika 2.5D skats uz tavu māju ar sauli, laikapstākļiem, saules ražošanu, akumulatoru un tīklu, kā arī mestas ēnas un interaktīva laika josla",

  period: {
    rangeLabel: "Laika diapazons",
    forecast: "Prognoze",
    yesterday: "Vakar",
    today: "Šodien",
    week: "Nedēļa",
    month: "Mēnesis",
    year: "Gads",
  },

  compass: "Z,ZA,A,DA,D,DR,R,ZR",

  cloudCover: {
    cloudLow: "Zems mākoņu segums",
    cloudMid: "Vidējs mākoņu segums",
    cloudHigh: "Augsts mākoņu segums",
  },

  mapConfig: {
    section: "Kartes konfigurācija",
    intro:
      "Kartes fons tiek zīmēts no OpenStreetMap vektoru flīzēm. Automātisks seko tavai tēmai, Tumšs / Gaišs uzspiež vienu no tiem, bet Pielāgots ļauj iestatīt katru krāsu un paslēpt jebkuru slāni.",
    modeAuto: "Automātisks",
    modeDark: "Tumšs",
    modeLight: "Gaišs",
    modeCustom: "Pielāgots",
    land: "Fons",
    water: "Ūdens",
    wood: "Mežs",
    grass: "Zaļās zonas",
    sand: "Smiltis",
    wetland: "Purvi",
    ice: "Ledus un sniegs",
    landuse: "Apbūvētā teritorija",
    roadMajor: "Galvenie ceļi",
    roadMinor: "Mazie ceļi",
    roadCasing: "Ceļa kontūra",
    path: "Takas un celiņi",
    rail: "Dzelzceļi",
    building: "Ēkas",
    boundary: "Robežas",
  },

  editor: {
    weatherEnabled: "Laikapstākļu efekti",
    weatherEnabledHint:
      "Uzzīmē reālas debesis virs ainas: saulains laiks, mākoņi, lietus, sniegs un pērkona negaiss no jūsu vietējiem laikapstākļiem, sekojot laika skalai, kad to pārvietojat. Izslēgts saglabā skaidru ainu.",
    temperatureEntity: "Temperatūras sensors",
    temperatureEntityHelp:
      "Neobligāti. Izmantojiet vietējo āra temperatūras sensoru (°C) temperatūras rādītājam Open-Meteo vērtības vietā. Tā pašreizējais stāvoklis un ierakstītāja vēsture tiek izmantoti tagadnei un pagātnei; prognozes stundas paliek uz modeļa.",
    humidityEntity: "Mitruma sensors",
    humidityEntityHelp:
      "Neobligāti. Izmantojiet vietējo relatīvā mitruma sensoru (%) Open-Meteo vērtības vietā tagadnei un pagātnei.",
    cloudCoverEntity: "Mākoņainības sensors",
    cloudCoverEntityHelp:
      "Neobligāti. Izmantojiet vietējo mākoņainības sensoru (%), lai noteiktu debesu pakāpi (saule, pelēkošana) Open-Meteo vērtības vietā, tagadnei un pagātnei.",
    precipitationEntity: "Nokrišņu sensors",
    precipitationEntityHelp:
      "Neobligāti. Izmantojiet vietējo nokrišņu sensoru (mm), lai noteiktu lietus slāni Open-Meteo vērtības vietā, tagadnei un pagātnei.",
    snowfallEntity: "Snigšanas sensors",
    snowfallEntityHelp:
      "Neobligāti. Izmantojiet vietējo snigšanas sensoru (cm), lai noteiktu sniega slāni Open-Meteo vērtības vietā, tagadnei un pagātnei.",
    weatherEntity: "Laikapstākļu entītija",
    weatherEntityHelp:
      "Neobligāti. Izmantojiet Home Assistant laikapstākļu entītiju, lai noteiktu apstākļus (lietus / sniegs / pērkona negaiss) Open-Meteo vērtības vietā, tagadnei un pagātnei. Prognozes stundas paliek uz modeļa.",
    chipTemperature: "Temperatūras rādījums",
    chipHumidity: "Mitruma rādījums",
    chipCost: "Izmaksu attēlojums",
    locationSection: "Atrašanās vieta",
    homeLatitude: "Mājas platums",
    homeLongitude: "Mājas garums",
    locationHint:
      "Aizstāj mājas adresi, ko izmanto kā kartes centru. Atstāj abus laukus tukšus, lai izmantotu Home Assistant konfigurēto māju. Aizstāšana tiek piemērota tikai tad, kad ABI lauki ir iestatīti uz derīgām koordinātēm.",
    uiAndMapSection: "UI",
    autoRotate: "Kameras automātiskā rotācija",
    autoRotateHint:
      "Kad dažas sekundes esi neaktīvs, kamera lēni riņķo ap māju (apmēram 1.5°/s, pretēji saules šķietamajai kustībai). Vilkšana ar vienu pirkstu to nekavējoties aptur, un tā atsākas, tiklīdz atlaid. Izvairies no tā ļoti vecās ierīcēs: automātiskā rotācija piespiež renderēšanu katru sekundi.",
    autoRotateOn: "Ieslēgts",
    autoRotateOff: "Izslēgts",
    dataDisplaySection: "Datu attēlojums",
    maxExpectedPower: "Maksimālā gaidāmā jauda",
    maxExpectedPowerHelp:
      "Jauda, pie kuras plūsma kustas ar pilnu ātrumu. Katra plūsma tiek pieskaņota šai vienai atsaucei, tāpēc lielāka plūsma vienmēr izskatās ātrāka nekā mazāka, lai kurā virzienā tā plūstu. Palielini to lielai iekārtai, samazini mazai. Noklusējums 5000 W.",
    sunChipMode: "Saules mikroshēmas rādījums",
    sunChipModeHelp:
      "Ko rāda saules mikroshēma: dzīvo saules apstarojumu (noklusējums) vai saules stāvokli (azimutu un augstumu). Stāvoklim nav vajadzīgs sensors, tas nāk no pašas kartītes saules aprēķiniem.",
      batteryChipMode: "Akumulatora mikroshēmas rādījums",
      batteryChipModeHelp: "Ko rāda akumulatora mikroshēma: reāllaika jaudu (noklusējums) vai uzlādes līmeni (%). Tā atgriežas pie vērtības, ko akumulators patiešām sniedz.",
      batteryChipModePower: "Jauda",
      batteryChipModeSoc: "Uzlādes līmenis",
    sunChipModeIrradiance: "Apstarojums",
    sunChipModePosition: "Saules stāvoklis",
    displayUpdateFrequency: "Grafika detalizācija",
    displayUpdateFrequencyHelp:
      "Cik punktu stundā grafiki zīmē. Paši dati vienmēr ir Home Assistant 5 minūšu statistika, tas tikai kontrolē, cik blīvi līkne tiek zīmēta: 1 = viens punkts stundā (gludākais, vieglākais renderēšanai), 6 = viens punkts ik pēc 10 minūtēm (pilna detalizācija, smagākais). Noklusējums 4 = punkts ik pēc 15 minūtēm. Samazini to vecākās vai lēnākās ierīcēs, lai samazinātu renderēšanas izmaksas. Prognozes līkne seko tam pašam tempam, tāpēc smalkāks iestatījums atklāj arī īsus ēnu kritumus (koks, kas pusstundu aizēno ražošanu), kuriem stundas līkne pāriet pāri.",
    valueDecimals: "Decimāldaļas",
    valueDecimalsHelp:
      "Decimāldaļu skaits, kas tiek parādīts katrā vērtības nolasījumā, lai mikroshēmas izskatītos vienveidīgi. Attiecas uz kW vērtībām (veseli vati paliek bez decimāldaļām) un uz kWh. No 0 līdz 3, noklusējums 1.",
    powerUnit: "Jaudas mērvienība",
    powerUnitHelp:
      "Mērvienība katram jaudas rādījumam kartītē (mikroshēmas, grafika rīka padomi). Enerģija tai arī seko, tāpēc kartīte paliek konsekventa: kW veido pāri ar kWh, W ar Wh.",
    irradianceUnit: "Saules konstantes mērvienība",
    irradianceUnitHelp:
      "Mērvienība saules konstantes (apstarojuma) rādījumam virs saules.",
    batterySign: "Akumulatora zīme",
    batterySignHelp:
      "Zīme, kas redzama uz akumulatora mikroshēmas. Pēc noklusējuma tas ir mīnuss lādēšanas laikā un pluss izlādes laikā. Apgriezta tos apmaina. Paslēpta rāda vērtību bez zīmes.",
    batterySignDefault: "Noklusējums",
    batterySignInverted: "Apgriezta",
    batterySignHidden: "Paslēpta",
    noUiMode: "Režīms bez UI",
    noUiModeHint:
      "Pēc dažām neaktivitātes sekundēm laika josla un kartītes vadīklas pakāpeniski izgaist. Jebkurš pieskāriens vai kustība tos atgriež. Lieliski piemērots sienas displejam.",
    noUiDelay: "Neaktivitātes aizkave pirms paslēpšanas",
    noUiDelayHint:
      "Sekundes neaktivitātes, pirms laika josla un vadīklas izgaist Bez UI režīmā. 0 patur saskarni paslēptu pastāvīgi. Izmantots tikai tad, ja Bez UI režīms ir ieslēgts.",
    showTimeline: "Rādīt laika joslu",
    showTimelineHint:
      "Rāda laika joslu un perioda izvēlni zem ainas. Izslēdzot, paliek redzama tikai aina.",
    showDetailPanel: "Rādīt papildu informāciju",
    showDetailPanelHint:
      "Ļauj katras mikroshēmas mini panelim (apkopotie rādītāji) atvērties augšējā labajā stūrī, kad tiek pieskarts mikroshēmai. Izslēdzot, tas nekad netiek rādīts.",
    showSunTimes: "Rādīt saullēkta / saulrieta laikus",
    showSunTimesHint:
      "Rāda saullēkta un saulrieta laikus un to marķierus saules loka pamatnē.",
    showHorizonLine: "Rādīt reljefa horizontu",
    showHorizonLineHint: "Zīmē reljefa horizonta līniju ap māju, aprēķinātu no vietējā reljefa. Horizonts vienmēr reālistiski pieklusina sauli aiz pakalniem; tas tikai parāda vai paslēpj zīmēto līniju.",
    horizonLineColor: "Reljefa horizonta krāsa",
    horizonLineColorHint: "Reljefa horizonta līnijas krāsa.",
    lockRotation: "Fiksēt rotāciju",
    lockRotationHint:
      "Velciet priekšskatījumu, lai pagrieztu un sasvērtu ainu vēlamajā skatā, pēc tam ieslēdziet šo. Bloķēšana iesaldē šo skatu (pagriešana ar vilkšanu un automātiskā griešanās miera stāvoklī tiek atspējota) un saglabā leņķi kartē, tāpēc tieši tas pats skats parādās katrā ierīcē un pārlūkā. Izslēdziet to, lai atkal brīvi grieztu.",
    chipsSection: "Entītiju attēlojums",
    chipsIntro:
      "Rādi vai slēp katru entītiju un izvēlies tās ikonu un krāsu. Māja seko izvēlētajai mikroshēmai vai pēc noklusējuma tavai primārajai krāsai.",
    chipIrradiance: "Apstarojuma attēlojums",
    chipProduction: "Ražošanas attēlojums",
    chipGrid: "Tīkla attēlojums",
    chipBattery: "Akumulatora attēlojums",
    chipHome: "Mājas patēriņa attēlojums",
    groupsConfigTitle: "Grupu konfigurācija",
    optionalSensors: "Papildu sensori",
    solarIrradianceEntity: "Saules starojuma entītija",
    solarIrradianceEntityHelp:
      "Izvēlies sensoru, kas ziņo par globālo īsviļņu starojumu W/m² (parasti Ecowitt / Davis / personīgā meteostacija). Kad tas ir iestatīts, tā pašreizējais stāvoklis un ierakstītāja vēsture aizstāj Open-Meteo dzīvajam un pagātnes starojumam visur, kur tas parādās (saules mikroshēmas skaitlis, PV diagrammas Y ass, saules loka krāsojums). Prognozes stundas paliek uz Open-Meteo, jo sensors nevar nest nākotnes vērtības.",
    liveDataTitle: "Konfigurācijas statuss",
    liveDataIntro:
      "Reāllaika mikroshēmas rāda tikai izmērītus sensorus. Katrai saimei nepieciešams tās enerģijas paneļa avota papildu reāllaika jaudas sensors; līknes un summas vienmēr nāk no taviem skaitītājiem.",
    liveSolarOk: "Saule: reāllaika jaudas sensors atrasts.",
    liveSolarMissing:
      "Saule: nav reāllaika jaudas sensora, ražošanas mikroshēma paliek paslēpta. Pievieno to sadaļā Iestatījumi > Paneļi > Enerģija > Saules paneļi.",
    liveSolarAbsent:
      "Saule: nav iestatīta tavā enerģijas panelī. Pievieno tur saules paneļus, lai iegūtu ražošanas mikroshēmu.",
    liveGridOk: "Tīkls: reāllaika jaudas sensors atrasts.",
    liveGridMissing:
      "Tīkls: nav reāllaika jaudas sensora, importa/eksporta mikroshēmas paliek paslēptas. Pievieno to sadaļā Iestatījumi > Paneļi > Enerģija > Tīkls.",
    liveGridMiswired:
      "Tīkls: reāllaika jaudas sensors ir pretrunā ar taviem skaitītājiem (šķiet, ka tas mēra tikai vienu virzienu). Mikroshēmas paliek paslēptas; konfigurē signētu sensoru vai režīmu Divi sensori.",
    liveGridAbsent:
      "Tīkls: nav iestatīts tavā enerģijas panelī. Pievieno tur tīklu, lai iegūtu importa un eksporta mikroshēmas.",
    liveBatteryOk:
      "Akumulators: reāllaika jaudas sensori aptver katru akumulatoru.",
    liveBatteryMissing:
      "Akumulators: reāllaika jaudai trūkst vismaz vienam akumulatoram, jaudas mikroshēma paliek paslēpta. Pievieno jaudas sensoru(-us) sadaļā Iestatījumi > Paneļi > Enerģija > Akumulators.",
    liveBatteryAbsent:
      "Akumulators: nav iestatīts tavā enerģijas panelī. Pievieno tur akumulatoru, lai iegūtu lādēšanas un izlādes mikroshēmu.",
    liveHomeOk:
      "Mājas patēriņš: rādīts, iegūts no iepriekš minētajām reāllaika saimēm.",
    liveHomeNote:
      "Mājas patēriņš parādās, tiklīdz katrai iepriekš konfigurētajai saimei ir savs reāllaika sensors.",
    openEnergyConfig: "Atvērt enerģijas konfigurāciju",
    buildingsSection: "Māja un ēkas",
    buildingsHint:
      'Lai karte blīvās pilsētu teritorijās paliktu raita, 3D tiek renderētas tikai ēkas konfigurētā rādiusa robežās ap māju. Pati māja paliek pilnīgi necaurspīdīga; tuvumā esošās ēkas tiek renderētas ar konfigurēto necaurspīdību, lai tās sniegtu pilsētas kontekstu, nekonkurējot ar datu pārklājumiem. Klastera rādiuss grupē piesaistītās palīgēkas (verandas, garāžas, šķūņus) "mājas" kopā.',
    displayRadius: "Attēlojuma rādiuss",
    displayRadiusHelp:
      "Rādiuss ap māju, kurā ēkas tiek iegūtas un zīmētas, līdz pat izbalējušā kartes diska malai. Samazini to, lai atvieglotu renderēšanu lēnā ierīcē; 0 rāda tikai māju.",
    buildingCount: "Ēku skaits",
    buildingCountHelp:
      "Maksimālais tuvumā esošo ēku skaits, ko zīmēt. Samazini to, lai atvieglotu renderēšanu lēnā ierīcē.",
    buildingRealSize: "Reālie ēku augstumi",
    buildingRealSizeOn: "Ieslēgts",
    buildingRealSizeOff: "Izslēgts",
    buildingRealSizeHint:
      "Ieslēgts: izmanto reālos OpenStreetMap augstumus (ierobežoti, lai kadrējums paliktu salasāms). Izslēgts: piešķir katrai ēkai to pašu fiksēto augstumu zemāk.",
    buildingHeight: "Ēkas augstums",
    hiddenDevicesEmpty:
      "Tavā enerģijas panelī vēl netiek izsekota neviena atsevišķa ierīce. Pievieno tur ierīču patēriņu, lai tās pārvaldītu šeit.",
    deviceVisibilityLabel: "Rādīt ierīci",
    group: "Grupa",
    noGroup: "Bez grupas",
    groupAssignHint:
      "Velciet savas ierīces grupā. Tas, kas paliek zemāk, nepieder nevienai grupai.",
    groupDropHere: "Nometiet ierīci šeit",
    backToLive: "Atpakaļ uz tiešraidi",
    buildingClusterRadius: "Mājas klastera rādiuss",
    buildingClusterRadiusHelp:
      "Rādiuss ap māju, kura robežās piesaistītās palīgēkas (verandas, garāžas, šķūņi) tiek uzskatītas par mājas daļu: tās tiek renderētas ar mājas pilnu necaurspīdību un krāsu, nevis kā izbalējuši kaimiņi. 0 saglabā tikai galveno ēku.",
    buildingOpacity: "Apkārtnes necaurspīdība",
    buildingColor: "Ēkas krāsa",
    buildingColorHelp: "Pamattonis, kas tiek piemērots apkārtējām ēkām ainā.",
    shadowsSection: "Ēnas",
    shadowsEnabled: "Rādīt ēnas",
    shadowsEnabledOn: "Rādītas",
    shadowsEnabledOff: "Paslēptas",
    shadowsEnabledHint:
      "Ieslēdz/izslēdz zemes ēnas, ko ēkas met, saulei kustoties.",
    shadowOpacity: "Ēnu necaurspīdība",
    shadowOpacityHint: "Mesto zemes ēnu necaurspīdība.",
    resetSection: "Atiestatīt",
    resetSectionHint:
      "Apkopes rīki: no jauna ielādē kartes kešatmiņā saglabātos datus vai atiestata visas opcijas uz to noklusējuma vērtībām.",
    resetCacheButton: "Atiestatīt datu kešatmiņu",
    resetCacheWarning:
      "Brīdinājums: tas no jauna ielādē visu, ko karte ir saglabājusi kešatmiņā, Open-Meteo laikapstākļus, katru atmiņā esošo enerģijas rindu (ražošana, tīkls, akumulators, ierīces, apstarojums), precizētās prognozes kalibrāciju un OpenFreeMap ēku kontūras, visām šajā lapā atvērtajām Helios kartēm. Izmanto to, lai notīrītu iestrēgušu kalibrāciju vai novecojušus laikapstākļu/kartes datus; pilna atkārtota ielāde atkarībā no tava HA servera aizņem dažas minūtes. Tavi dati Home Assistant iekšienē nekad netiek aiztikti.",
    resetCacheDone: "Kešatmiņa notīrīta ✓",
    resetOptionsButton: "Atiestatīt opcijas uz noklusējumu",
    resetOptionsConfirm: "Noklikšķini vēlreiz, lai apstiprinātu",
    resetOptionsWarning:
      "Brīdinājums: tas atiestata VISAS šīs kartes opcijas uz to noklusējuma vērtībām; mikroshēmu redzamību, krāsas un ikonas, grupu nosaukumus/krāsas/ikonas, ēkas, ēnas, mērvienības un visus pārējos iestatījumus. Tavi Home Assistant dati un enerģijas panelis netiek skarti, bet tavi pielāgojumi tiek dzēsti neatgriezeniski.",
    resetOptionsDone: "Opcijas atiestatītas ✓",
    aboutSection: "Par",
    aboutVersionLabel: "Versija",
    aboutRepoCard: "Helios",
    aboutCoffeeMessage:
      "Es veidoju Helios viens pats, galvenokārt naktīs, dzenoties pēc mazām detaļām, līdz saule un tava enerģija ekrānā šķiet dzīvas. Ja tā ir atradusi vietu tavā panelī, tas mani jau iepriecina; zvaigznīte GitHub priecē vēl vairāk, bet kafija palīdz visam virzīties uz priekšu.",
    aboutDeveloperLabel: "Izstrādātājs",
    aboutDeveloperLinkedIn: "LinkedIn",
    aboutCoffeeLink: "Uzcienā mani ar kafiju",
  },
};
