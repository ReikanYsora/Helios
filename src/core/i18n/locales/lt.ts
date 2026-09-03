import type { Translations } from "../index";

//Lithuanian locale.
export const lt: Translations = {
  cardName: "Helios",
  cardDescription:
    "☀️ Realaus laiko 2.5D tavo namų vaizdas su saule, oru, saulės gamyba, akumuliatoriumi ir tinklu, taip pat metami šešėliai ir interaktyvi laiko juosta",

  period: {
    rangeLabel: "Laiko intervalas",
    forecast: "Prognozė",
    yesterday: "Vakar",
    today: "Šiandien",
    week: "Savaitė",
    month: "Mėnuo",
    year: "Metai",
  },

  compass: "Š,ŠR,R,PR,P,PV,V,ŠV",

  cloudCover: {
    cloudLow: "Žemas debesuotumas",
    cloudMid: "Vidutinis debesuotumas",
    cloudHigh: "Aukštas debesuotumas",
  },

  mapConfig: {
    section: "Žemėlapio konfigūracija",
    intro:
      "Pagrindinis žemėlapis piešiamas iš OpenStreetMap vektorinių sluoksnių. Auto seka tavo temą, Dark / Light priverstinai naudoja vieną iš jų, o Custom leidžia nustatyti kiekvieną spalvą ir paslėpti bet kurį sluoksnį.",
    modeAuto: "Auto",
    modeDark: "Tamsus",
    modeLight: "Šviesus",
    modeCustom: "Pasirinktinis",
    land: "Fonas",
    water: "Vanduo",
    wood: "Miškas",
    grass: "Žaluma",
    sand: "Smėlis",
    wetland: "Pelkė",
    ice: "Ledas ir sniegas",
    landuse: "Užstatyta teritorija",
    roadMajor: "Pagrindiniai keliai",
    roadMinor: "Šalutiniai keliai",
    roadCasing: "Kelio kontūras",
    path: "Takai ir keliukai",
    rail: "Geležinkeliai",
    building: "Pastatai",
    boundary: "Ribos",
  },

  editor: {
    weatherEnabled: "Oro efektai",
    weatherEnabledHint:
      "Piešia tikrą dangų virš scenos: saulę, debesis, lietų, sniegą ir perkūniją pagal jūsų vietinius orus, sekant laiko juostą jai slenkant. Išjungus scena lieka giedra.",
    temperatureEntity: "Temperatūros jutiklis",
    temperatureEntityHelp:
      "Neprivaloma. Temperatūros ženkleliui naudoti vietinį lauko temperatūros jutiklį (°C) vietoje Open-Meteo reikšmės. Jo tiesioginė būsena ir įrašų istorija naudojama dabarčiai ir praeičiai; prognozės valandos lieka pagal modelį.",
    humidityEntity: "Drėgmės jutiklis",
    humidityEntityHelp:
      "Neprivaloma. Naudoti vietinį santykinės drėgmės jutiklį (%) vietoje Open-Meteo reikšmės dabarčiai ir praeičiai.",
    cloudCoverEntity: "Debesuotumo jutiklis",
    cloudCoverEntityHelp:
      "Neprivaloma. Naudoti vietinį debesuotumo jutiklį (%), kuris valdytų dangaus atspalvį (saulę, pilkėjimą) vietoje Open-Meteo reikšmės dabarčiai ir praeičiai.",
    precipitationEntity: "Kritulių jutiklis",
    precipitationEntityHelp:
      "Neprivaloma. Naudoti vietinį kritulių jutiklį (mm), kuris valdytų lietaus sluoksnį vietoje Open-Meteo reikšmės dabarčiai ir praeičiai.",
    snowfallEntity: "Snygio jutiklis",
    snowfallEntityHelp:
      "Neprivaloma. Naudoti vietinį snygio jutiklį (cm), kuris valdytų sniego sluoksnį vietoje Open-Meteo reikšmės dabarčiai ir praeičiai.",
    weatherEntity: "Orų objektas",
    weatherEntityHelp:
      "Neprivaloma. Naudoti Home Assistant orų objektą, kuris valdytų sąlygas (lietus / sniegas / perkūnija) vietoje Open-Meteo reikšmės dabarčiai ir praeičiai. Prognozės valandos lieka pagal modelį.",
    chipTemperature: "Temperatūros rodymas",
    chipHumidity: "Drėgmės rodymas",
    chipCost: "Išlaidų rodymas",
    locationSection: "Namų vieta",
    homeLatitude: "Namų platuma",
    homeLongitude: "Namų ilguma",
    locationHint:
      "Pakeisk namų adresą, naudojamą kaip kortelės centras. Palik abu laukus tuščius, kad būtų naudojami Home Assistant sukonfigūruoti namai. Pakeitimas taikomas tik tada, kai ABU laukai nustatyti į galiojančias koordinates.",
    uiAndMapSection: "UI",
    autoRotate: "Automatinis kameros sukimasis",
    autoRotateHint:
      "Kai kelias sekundes neaktyvi, kamera lėtai sukasi aplink namus (apie 1,5°/s, priešingai matomam saulės judėjimui). Vilkimas vienu pirštu ją iškart pristabdo, ir ji atsinaujina, kai atleidi. Venk to labai senuose įrenginiuose: automatinis sukimasis priverčia atvaizduoti kas sekundę.",
    autoRotateOn: "Įjungta",
    autoRotateOff: "Išjungta",
    degradedRender: "Suderinamumo atvaizdavimas",
    degradedRenderHint:
      "Žemėlapį piešia paprastesniu, labiau suderinamu būdu. Įjunkite, jei sukant ar stumdant sceną ji mirga arba plyšta. Tai pašalina triktį kai kuriuose telefonuose ir planšetėse, šiek tiek mažiau sklandaus judesio sąskaita.",
    dataDisplaySection: "Duomenų rodymas",
    maxExpectedPower: "Didžiausia numatoma galia",
    maxExpectedPowerHelp:
      "Galia, ties kuria srautas juda visu greičiu. Kiekvienas srautas derinamas pagal šią vieną nuorodą, todėl didesnis srautas visada atrodo greitesnis nei mažesnis, kad ir kuria kryptimi jis tekėtų. Padidink ją didelei sistemai, sumažink mažai. Numatytoji 5000 W.",
    sunChipMode: "Saulės lusto rodmuo",
    sunChipModeHelp:
      "Ką rodo saulės lustas: gyvą saulės apšvitą (numatytoji) arba saulės padėtį (azimutą ir aukštį). Padėčiai nereikia jokio jutiklio, ji gaunama iš pačios kortelės saulės skaičiavimų.",
      batteryChipMode: "Baterijos lusto rodmuo",
      batteryChipModeHelp: "Ką rodo baterijos lustas: tikralaikę galią (numatyta) arba įkrovos lygį (%). Grįžta prie tos reikšmės, kurią baterija iš tikrųjų pateikia.",
      batteryChipModePower: "Galia",
      batteryChipModeSoc: "Įkrovos lygis",
    sunChipModeIrradiance: "Apšvita",
    sunChipModePosition: "Saulės padėtis",
    displayUpdateFrequency: "Grafiko detalumas",
    displayUpdateFrequencyHelp:
      "Kiek taškų per valandą piešia grafikai. Patys duomenys visada yra Home Assistant 5 minučių statistika; tai valdo tik tai, kaip tankiai braižoma kreivė: 1 = vienas taškas per valandą (lygiausia, lengviausia atvaizduoti), 6 = vienas taškas kas 10 minučių (visas detalumas, sunkiausia). Numatytasis 4 = taškas kas 15 minučių. Sumažink jį senesniuose ar lėtesniuose įrenginiuose, kad sumažintum atvaizdavimo sąnaudas. Prognozės kreivė laikosi to paties tempo, todėl smulkesnis nustatymas taip pat atskleidžia trumpus šešėlių kritimus (medis, pusvalandį temdantis gamybą), kuriuos valandinė kreivė peršoka.",
    valueDecimals: "Dešimtainės dalys",
    valueDecimalsHelp:
      "Dešimtainių skaitmenų skaičius, rodomas kiekviename vertės rodmenyje, kad lustai atrodytų vienodi. Taikoma kW vertėms (sveiki vatai lieka sveikieji skaičiai) ir kWh. Nuo 0 iki 3, numatytasis 1.",
    powerUnit: "Galios vienetas",
    powerUnitHelp:
      "Vienetas kiekvienam galios rodmeniui kortelėje (lustai, grafiko debesėliai). Energija taip pat jo laikosi, kad kortelė liktų nuosekli: kW poruojasi su kWh, W su Wh.",
    energyUnit: "Energijos vienetas",
    energyUnitHelp:
      "Vienetas visoms energijos sumoms (dienos kreivei, informacijos skydeliui, laiko juostos dienos sumoms). „Automatinis“ seka aukščiau esantį galios vienetą; pasirinkite Wh arba kWh, kad nustatytumėte jį atskirai.",
    energyUnitAuto: "Automatinis",
    irradianceUnit: "Saulės konstantos vienetas",
    irradianceUnitHelp:
      "Vienetas saulės konstantos (apšvitos) rodmeniui virš saulės.",
    batterySign: "Baterijos ženklas",
    batterySignHelp:
      "Ženklas, rodomas baterijos lustelyje. Numatytasis yra minusas įkraunant ir pliusas iškraunant. Apverstas juos sukeičia. Paslėptas rodo reikšmę be ženklo.",
    batterySignDefault: "Numatytasis",
    batterySignInverted: "Apverstas",
    batterySignHidden: "Paslėptas",
    noUiMode: "Režimas be sąsajos",
    noUiModeHint:
      "Po kelių sekundžių neaktyvumo laiko juosta ir kortelės valdikliai išnyksta. Bet koks palietimas ar judesys juos grąžina. Puikiai tinka sieniniam ekranui.",
    noUiDelay: "Neaktyvumo trukmė iki paslėpimo",
    noUiDelayHint:
      "Sekundės neaktyvumo prieš laiko juostai ir valdikliams išnykstant be sąsajos režime. 0 palieka sąsają paslėptą visam laikui. Naudojama tik kai įjungtas režimas be sąsajos.",
    showTimeline: "Rodyti laiko juostą",
    showTimelineHint:
      "Rodo laiko juostą ir laikotarpio parinkiklį po scena. Išjungus lieka tik scena.",
    showDetailPanel: "Rodyti papildomą informaciją",
    showDetailPanelHint:
      "Leidžia atidaryti kiekvieno lusto mini skydelį (apibendrinti rodikliai) viršuje dešinėje, kai paliečiamas lustas. Išjungus jis niekada nerodomas.",
    showSunTimes: "Rodyti saulėtekio / saulėlydžio laikus",
    showSunTimesHint:
      "Rodo saulėtekio ir saulėlydžio laikus bei jų žymeklius prie saulės lanko kojų.",
    showHorizonLine: "Rodyti reljefo horizontą",
    showHorizonLineHint: "Nubrėžia reljefo horizonto liniją aplink namus, apskaičiuotą pagal vietovės reljefą. Horizontas visada realistiškai pritemdo saulę už kalvų; tai tik parodo arba paslepia nubrėžtą liniją.",
    horizonLineColor: "Reljefo horizonto spalva",
    horizonLineColorHint: "Reljefo horizonto linijos spalva.",
    moonDisplay: "Mėnulis",
    moonDisplayHint: "Piešia mėnulį ant jo paties lanko su fazę atitinkančiu pjautuvu, visada priešais saulę. Tik dekoratyvu: be žymos, be vertės.",
    moonDisplayAlways: "Visada matomas",
    moonDisplayNight: "Tik naktį",
    moonDisplayHidden: "Paslėptas",
    lockRotation: "Užrakinti kampą",
    lockRotationHint:
      "Vilkite peržiūrą, kad pasuktumėte ir pakreiptumėte sceną iki norimo vaizdo, tada įjunkite tai. Užraktas užfiksuoja tą vaizdą (sukimas velkant ir automatinis sukimasis ramybės būsenoje išjungiami) ir įrašo kampą į kortelę, todėl tiksliai tas pats vaizdas rodomas kiekviename įrenginyje ir naršyklėje. Išjunkite jį, kad vėl galėtumėte laisvai sukti.",
    chipsSection: "Objektų rodymas",
    chipsIntro:
      "Rodyk arba slėpk kiekvieną objektą, pasirink jo piktogramą ir spalvą. Namai seka pasirinktą lustą arba, numatytai, tavo pagrindinę spalvą.",
    chipIrradiance: "Apšvitos rodymas",
    chipProduction: "Gamybos rodymas",
    chipGrid: "Tinklo rodymas",
    chipBattery: "Baterijos rodymas",
    chipHome: "Namų suvartojimo rodymas",
    groupsConfigTitle: "Grupių konfigūracija",
    optionalSensors: "Nebūtini jutikliai",
    solarIrradianceEntity: "Saulės apšvitos objektas",
    solarIrradianceEntityHelp:
      "Pasirink jutiklį, pranešantį apie globalią trumpabangę apšvitą W/m² (paprastai Ecowitt / Davis / asmeninė orų stotis). Kai nustatyta, jo dabartinė būsena ir įrašymo istorija pakeičia Open-Meteo gyvai ir praeities apšvitai visur, kur ji rodoma (saulės lusto skaičius, PV diagramos Y ašis, saulės lanko spalvinimas). Prognozės valandos lieka su Open-Meteo, nes jutiklis negali turėti ateities verčių.",
    liveDataTitle: "Konfigūracijos būsena",
    liveDataIntro:
      "Gyvi lustai rodo tik matuojamus jutiklius. Kiekvienai šeimai reikia jos energijos skydelio šaltinio nebūtino gyvo galios jutiklio; kreivės ir sumos visada gaunamos iš tavo skaitiklių.",
    liveSolarOk: "Saulė: aptiktas gyvas galios jutiklis.",
    liveSolarMissing:
      "Saulė: nėra gyvo galios jutiklio, gamybos lustas lieka paslėptas. Pridėk jį per Nustatymai > Skydeliai > Energija > Saulės moduliai.",
    liveSolarAbsent:
      "Saulė: nesukonfigūruota tavo Energijos skydelyje. Pridėk ten saulės modulius, kad gautum gamybos lustą.",
    liveGridOk: "Tinklas: aptiktas gyvas galios jutiklis.",
    liveGridMissing:
      "Tinklas: nėra gyvo galios jutiklio, importo/eksporto lustai lieka paslėpti. Pridėk jį per Nustatymai > Skydeliai > Energija > Tinklas.",
    liveGridMiswired:
      "Tinklas: gyvas galios jutiklis prieštarauja tavo skaitikliams (atrodo, kad jis matuoja tik vieną kryptį). Lustai lieka paslėpti; sukonfigūruok ženklinį jutiklį arba Dviejų jutiklių režimą.",
    liveGridAbsent:
      "Tinklas: nesukonfigūruotas tavo Energijos skydelyje. Pridėk ten tinklą, kad gautum importo ir eksporto lustus.",
    liveBatteryOk:
      "Baterija: gyvi galios jutikliai padengia kiekvieną bateriją.",
    liveBatteryMissing:
      "Baterija: bent vienai baterijai trūksta gyvo galios jutiklio, galios lustas lieka paslėptas. Pridėk galios jutiklį(-ius) per Nustatymai > Skydeliai > Energija > Baterija.",
    liveBatteryAbsent:
      "Baterija: nesukonfigūruota tavo Energijos skydelyje. Pridėk ten bateriją, kad gautum įkrovimo ir iškrovimo lustą.",
    liveHomeOk:
      "Namų suvartojimas: rodomas, gaunamas iš aukščiau esančių gyvų šeimų.",
    liveHomeNote:
      "Namų suvartojimas atsiranda, kai kiekviena aukščiau sukonfigūruota šeima turi savo gyvą jutiklį.",
    openEnergyConfig: "Atidaryti Energijos konfigūraciją",
    buildingsSection: "Namai ir pastatai",
    buildingsHint:
      "Kad kortelė tankiose miesto vietovėse išliktų sklandi, 3D atvaizduojami tik pastatai sukonfigūruoto spindulio ribose aplink namus. Patys namai lieka visiškai nepermatomi; netoliese esantys pastatai atvaizduojami su sukonfigūruotu nepermatomumu, kad suteiktų miesto kontekstą nekonkuruodami su duomenų sluoksniais. Sankaupos spindulys sugrupuoja prijungtus pagalbinius pastatus (verandas, garažus, sandėliukus) į „namų“ rinkinį.",
    displayRadius: "Rodymo spindulys",
    displayRadiusHelp:
      "Spindulys aplink namus, kuriame pastatai gaunami ir piešiami, iki pat išblukusio žemėlapio disko krašto. Sumažink jį, kad palengvintum atvaizdavimą lėtame įrenginyje; 0 rodo tik namus.",
    buildingCount: "Pastatų skaičius",
    buildingCountHelp:
      "Maksimalus netoliese esančių pastatų skaičius, kurį piešti. Sumažink jį, kad palengvintum atvaizdavimą lėtame įrenginyje.",
    buildingRealSize: "Tikri pastatų aukščiai",
    buildingRealSizeOn: "Įjungta",
    buildingRealSizeOff: "Išjungta",
    buildingRealSizeHint:
      "Įjungta: naudok tikrus OpenStreetMap aukščius (apriboti, kad kadravimas liktų įskaitomas). Išjungta: suteik kiekvienam pastatui tą patį fiksuotą aukštį žemiau.",
    buildingHeight: "Pastato aukštis",
    hiddenDevicesEmpty:
      "Tavo Energijos skydelyje kol kas nesekamas nė vienas pavienis prietaisas. Pridėk ten prietaiso suvartojimą, kad galėtum jį valdyti čia.",
    deviceVisibilityLabel: "Rodyti prietaisą",
    group: "Grupė",
    noGroup: "Be grupės",
    groupAssignHint:
      "Vilkite savo įrenginius į grupę. Kas lieka apačioje, nepriklauso jokiai grupei.",
    groupDropHere: "Vilkite įrenginį čia",
    backToLive: "Grįžti į tiesioginį",
    buildingClusterRadius: "Namų sankaupos spindulys",
    buildingClusterRadiusHelp:
      "Spindulys aplink namus, kurio ribose prijungti pagalbiniai pastatai (verandos, garažai, sandėliukai) laikomi namų dalimi: jie atvaizduojami su namų nepermatomumu ir spalva, o ne kaip išblukę kaimynai. 0 palieka tik pagrindinį pastatą.",
    buildingOpacity: "Aplinkos nepermatomumas",
    buildingColor: "Pastato spalva",
    buildingColorHelp:
      "Bazinis atspalvis, taikomas aplinkiniams pastatams scenoje.",
    shadowsSection: "Šešėliai",
    shadowsEnabled: "Rodyti šešėlius",
    shadowsEnabledOn: "Rodomi",
    shadowsEnabledOff: "Paslėpti",
    shadowsEnabledHint:
      "Įjungia ar išjungia ant žemės metamus šešėlius, kuriuos pastatai meta saulei judant.",
    shadowOpacity: "Šešėlių nepermatomumas",
    shadowOpacityHint: "Ant žemės metamų šešėlių nepermatomumas.",
    resetSection: "Atstatymas",
    resetSectionHint:
      "Priežiūros įrankiai: iš naujo gauti kortelės talpykloje saugomus duomenis arba atstatyti visas parinktis į numatytąsias.",
    resetCacheButton: "Atstatyti duomenų talpyklą",
    resetCacheWarning:
      "Įspėjimas: tai iš naujo gauna viską, ką kortelė yra saugojusi talpykloje: Open-Meteo orus, kiekvieną atmintyje esančią energijos seriją (gamyba, tinklas, baterija, prietaisai, apšvita), patikslintos prognozės kalibravimą ir OpenFreeMap pastatų kontūrus; kiekvienai šiame puslapyje atidarytai Helios kortelei. Naudok tai, jei kalibravimas įstrigo arba oro/žemėlapio duomenys pasenę; visas gavimas iš naujo užtrunka kelias minutes, priklausomai nuo tavo HA serverio. Tavo duomenys Home Assistant viduje niekada neliečiami.",
    resetCacheDone: "Talpykla išvalyta ✓",
    resetOptionsButton: "Atstatyti parinktis į numatytąsias",
    resetOptionsConfirm: "Spausk dar kartą, kad patvirtintum",
    resetOptionsWarning:
      "Įspėjimas: tai atstato VISAS šios kortelės parinktis į numatytąsias: lustų matomumą, spalvas ir piktogramas, grupių pavadinimus/spalvas/piktogramas, pastatus, šešėlius, vienetus ir visus kitus nustatymus. Tavo Home Assistant duomenys ir Energijos skydelis nekeičiami, bet tavo pritaikymai bus ištrinti ir jų nebus galima atkurti.",
    resetOptionsDone: "Parinktys atstatytos ✓",
    aboutSection: "Apie",
    aboutVersionLabel: "Versija",
    aboutRepoCard: "Helios",
    aboutCoffeeMessage:
      "Helios kuriu vienas, dažniausiai naktimis, vydamasis smulkiausias detales, kol saulė ir tavo energija atgyja ekrane. Jei ji rado vietą tavo skydelyje, tai jau mane pradžiugina; žvaigždutė GitHub dar labiau, o kava padeda viskam judėti į priekį.",
    aboutDeveloperLabel: "Kūrėjas",
    aboutDeveloperLinkedIn: "LinkedIn",
    aboutCoffeeLink: "Vaišink mane kava",
  },
};
