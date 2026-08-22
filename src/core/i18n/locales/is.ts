import type { Translations } from "../index";

//Icelandic locale.
export const isLocale: Translations = {
  cardName: "Helios",
  cardDescription:
    "☀️ Rauntíma 2.5D-sýn af heimilinu þínu með sólinni, veðrinu, sólarframleiðslu, rafhlöðu og raforkukerfi, auk varpaðra skugga og gagnvirks tímaáss",

  period: {
    rangeLabel: "Tímabil",
    forecast: "Spá",
    yesterday: "Í gær",
    today: "Í dag",
    week: "Vika",
    month: "Mánuður",
    year: "Ár",
  },

  compass: "N,NA,A,SA,S,SV,V,NV",

  cloudCover: {
    cloudLow: "Lág skýjahula",
    cloudMid: "Miðlungs skýjahula",
    cloudHigh: "Há skýjahula",
  },

  mapConfig: {
    section: "Kortastillingar",
    intro:
      "Grunnkortið er teiknað úr vektorreitum frá OpenStreetMap. Sjálfvirkt fylgir þemanu þínu, Dökkt / Ljóst þvinga eitt af þeim, og Sérsniðið gerir þér kleift að stilla alla liti og fela hvaða lag sem er.",
    modeAuto: "Sjálfvirkt",
    modeDark: "Dökkt",
    modeLight: "Ljóst",
    modeCustom: "Sérsniðið",
    land: "Bakgrunnur",
    water: "Vatn",
    wood: "Skógur",
    grass: "Gróður",
    sand: "Sandur",
    wetland: "Votlendi",
    ice: "Ís og snjór",
    landuse: "Byggt land",
    roadMajor: "Aðalvegir",
    roadMinor: "Minni vegir",
    roadCasing: "Útlína vega",
    path: "Stígar og slóðar",
    rail: "Járnbrautir",
    building: "Byggingar",
    boundary: "Landamæri",
  },

  editor: {
    weatherEnabled: "Veðuráhrif",
    weatherEnabledHint:
      "Málar raunverulegan himininn yfir senuna: sólskin, ský, rigningu, snjó og þrumuveður frá veðrinu hjá þér, í takt við tímalínuna þegar þú flettir. Slökkt heldur senunni heiðskírri.",
    temperatureEntity: "Hitaskynjari",
    temperatureEntityHelp:
      "Valfrjálst. Notaðu staðbundinn útihitaskynjara (°C) í stað Open-Meteo gildisins fyrir hitastigsmerkið. Rauntímastaða hans og upptökusaga eru notuð fyrir rauntíma + fortíð; spátímar halda sig við líkanið.",
    humidityEntity: "Rakaskynjari",
    humidityEntityHelp:
      "Valfrjálst. Notaðu staðbundinn rakastigsskynjara (%) í stað Open-Meteo gildisins, fyrir rauntíma + fortíð.",
    cloudCoverEntity: "Skýjahuluskynjari",
    cloudCoverEntityHelp:
      "Valfrjálst. Notaðu staðbundinn skýjahuluskynjara (%) til að stýra himinstiginu (sól, grámi) í stað Open-Meteo gildisins, fyrir rauntíma + fortíð.",
    precipitationEntity: "Úrkomuskynjari",
    precipitationEntityHelp:
      "Valfrjálst. Notaðu staðbundinn úrkomuskynjara (mm) til að stýra rigningarlaginu í stað Open-Meteo gildisins, fyrir rauntíma + fortíð.",
    snowfallEntity: "Snjókomuskynjari",
    snowfallEntityHelp:
      "Valfrjálst. Notaðu staðbundinn snjókomuskynjara (cm) til að stýra snjólaginu í stað Open-Meteo gildisins, fyrir rauntíma + fortíð.",
    weatherEntity: "Veðureining",
    weatherEntityHelp:
      "Valfrjálst. Notaðu Home Assistant veðureiningu til að stýra veðurskilyrðum (rigning / snjór / þrumuveður) í stað Open-Meteo gildisins, fyrir rauntíma + fortíð. Spátímar halda sig við líkanið.",
    chipTemperature: "Hitastigsbirting",
    chipHumidity: "Rakastigsbirting",
    chipCost: "Kostnaðarbirting",
    locationSection: "Staðsetning",
    homeLatitude: "Breiddargráða heimilis",
    homeLongitude: "Lengdargráða heimilis",
    locationHint:
      "Hnekkja heimilisfanginu sem notað er sem miðja kortsins. Skildu bæði reitina eftir auða til að nota heimilið sem stillt er í Home Assistant. Hnekkingin er aðeins beitt þegar BÁÐIR reitir eru stilltir á gild hnit.",
    uiAndMapSection: "UI",
    autoRotate: "Sjálfvirkur snúningur myndavélar",
    autoRotateHint:
      "Þegar ekkert hefur gerst í nokkrar sekúndur, snýst myndavélin hægt um heimilið (um það bil 1.5°/s, andstætt sýnilegri hreyfingu sólarinnar). Að draga með einum fingri stöðvar hann samstundis og hann heldur áfram þegar þú sleppir. Forðastu hann á mjög gömlum tækjum: sjálfvirkur snúningur þvingar fram myndgerð á hverri sekúndu.",
    autoRotateOn: "Kveikt",
    autoRotateOff: "Slökkt",
    degradedRender: "Samhæfnisútlit",
    degradedRenderHint:
      "Teiknar kortið með einfaldari og samhæfðari aðferð. Kveiktu á þessu ef sviðið flöktir eða rifnar þegar þú snýrð eða dregur það. Það lagar gallann í sumum símum og spjaldtölvum á kostnað örlítið minna mjúkrar hreyfingar.",
    dataDisplaySection: "Birting gagna",
    maxExpectedPower: "Hámarksafl sem búist er við",
    maxExpectedPowerHelp:
      "Aflið sem streymi hreyfist á fullum hraða við. Sérhvert streymi er stillt gagnvart þessari einu viðmiðun, svo stærra streymi les alltaf sem hraðara en minna, í hvora átt sem það rennur. Hækkaðu það fyrir stóra uppsetningu, lækkaðu það fyrir litla. Sjálfgefið 5000 W.",
    sunChipMode: "Lestur sólarflögu",
    sunChipModeHelp:
      "Hvað sólarflagan sýnir: lifandi sólgeislun (sjálfgefið) eða stöðu sólarinnar (áttarhorn og hæð). Staðan þarf engan skynjara, hún kemur frá sólarreikningum kortsins sjálfs.",
      batteryChipMode: "Aflestur rafhlöðukubbs",
      batteryChipModeHelp: "Hvað rafhlöðukubburinn sýnir: rauntímaafl (sjálfgefið) eða hleðslustöðu (%). Hann fellur til baka á það gildi sem rafhlaðan þín gefur í raun.",
      batteryChipModePower: "Afl",
      batteryChipModeSoc: "Hleðslustaða",
    sunChipModeIrradiance: "Sólgeislun",
    sunChipModePosition: "Staða sólar",
    displayUpdateFrequency: "Nákvæmni grafs",
    displayUpdateFrequencyHelp:
      "Hversu marga punkta á klukkustund gröfin teikna. Gögnin sjálf eru alltaf 5 mínútna tölfræði Home Assistant; þetta stýrir aðeins hversu þétt ferillinn er teiknaður: 1 = einn punktur á klukkustund (sléttast, léttast að myndgera), 6 = einn punktur á 10 mínútna fresti (full nákvæmni, þyngst). Sjálfgefið 4 = punktur á 15 mínútna fresti. Lækkaðu hann á eldri eða hægari tækjum til að minnka myndgerðarkostnað. Spáferillinn fylgir sama takti, svo fínni stilling sýnir einnig stuttar skuggadýfur (tré sem skyggir á framleiðsluna í hálftíma) sem klukkustundarferill stígur yfir.",
    valueDecimals: "Aukastafir",
    valueDecimalsHelp:
      "Fjöldi aukastafa sem birtir eru á hverjum gildislestri, svo flögurnar lesist samræmt. Á við um kW-gildi (heil vött haldast heiltölur) og kWh. 0 til 3, sjálfgefið 1.",
    powerUnit: "Afleining",
    powerUnitHelp:
      "Eining fyrir hverja aflmælingu á kortinu (flögur, ábendingar á grafi). Orkan fylgir henni líka, svo kortið haldist samræmt: kW parast við kWh, W við Wh.",
    energyUnit: "Orkueining",
    energyUnitHelp:
      "Eining fyrir allar orkusamtölur (dagferilinn, nánari upplýsingar spjaldið, dagsamtölur tímalínunnar). Sjálfvirkt fylgir aflseiningunni hér að ofan; veldu Wh eða kWh til að stilla hana sérstaklega.",
    energyUnitAuto: "Sjálfvirkt",
    irradianceUnit: "Eining sólfastans",
    irradianceUnitHelp:
      "Eining fyrir mælingu sólfastans (sólgeislunar) fyrir ofan sólina.",
    batterySign: "Formerki rafhlöðu",
    batterySignHelp:
      "Formerki sem birt er á rafhlöðuflögunni. Sjálfgefið er mínus við hleðslu og plús við afhleðslu. Snúið víxlar því. Falið sýnir gildið án formerkis.",
    batterySignDefault: "Sjálfgefið",
    batterySignInverted: "Snúið",
    batterySignHidden: "Falið",
    noUiMode: "Án viðmóts",
    noUiModeHint:
      "Deyfir tímaásinn og stýringarnar á spjaldinu eftir nokkrar sekúndur af aðgerðaleysi. Hvaða snerting eða hreyfing sem er kallar þau fram aftur. Frábært fyrir vegg-skjá.",
    noUiDelay: "Bið áður en falið er",
    noUiDelayHint:
      'Sekúndur af aðgerðaleysi áður en tímaásinn og stýringarnar dofna í "Án viðmóts" ham. 0 heldur viðmótinu alltaf földu. Aðeins notað þegar kveikt er á "Án viðmóts" ham.',
    showTimeline: "Sýna tímaás",
    showTimelineHint:
      "Sýna tímaásinn og tímabilsveljarann fyrir neðan senuna. Slökkt sýnir aðeins senuna.",
    showDetailPanel: "Sýna ítarupplýsingar",
    showDetailPanelHint:
      "Leyfa smáspjaldi fyrir hverja flögu (samandregnar mælingar) að opnast efst til hægri þegar ýtt er á flögu. Slökkt sýnir það aldrei.",
    showSunTimes: "Sýna sólarupprás / sólsetur",
    showSunTimesHint:
      "Sýna tímasetningar sólarupprásar og sólseturs, ásamt merkjum þeirra við fætur sólarbogans.",
    showHorizonLine: "Sýna sjóndeildarhring lands",
    showHorizonLineHint: "Teiknar sjóndeildarlínu landslagsins í kringum heimilið, reiknaða út frá staðbundnu landslagi. Sjóndeildarhringurinn deyfir alltaf sólina raunsætt á bak við hæðir; þetta sýnir eða felur aðeins teiknuðu línuna.",
    horizonLineColor: "Litur sjóndeildarhrings lands",
    horizonLineColorHint: "Litur sjóndeildarlínu landslagsins.",
    lockRotation: "Læsa snúningi",
    lockRotationHint:
      "Dragðu forskoðunina til að snúa og halla senunni að þeirri sýn sem þú vilt og kveiktu svo á þessu. Læsingin frystir þá sýn (snúningur með drætti og sjálfvirkur snúningur í hvíld eru gerð óvirk) og vistar hornið á spjaldið, þannig að nákvæmlega sama sýn birtist á öllum tækjum og vöfrum. Slökktu á henni til að snúa frjálst aftur.",
    chipsSection: "Birting einda",
    chipsIntro:
      "Sýndu eða feldu hverja eind, og veldu tákn og lit hennar. Heimilið fylgir valinni flögu, eða aðallitnum þínum sjálfgefið.",
    chipIrradiance: "Birting sólgeislunar",
    chipProduction: "Birting framleiðslu",
    chipGrid: "Birting raforkukerfis",
    chipBattery: "Birting rafhlöðu",
    chipHome: "Birting heimilisnotkunar",
    groupsConfigTitle: "Stillingar hópa",
    optionalSensors: "Valfrjálsir skynjarar",
    solarIrradianceEntity: "Eind fyrir sólargeislun",
    solarIrradianceEntityHelp:
      "Veldu skynjara sem skráir hnattræna stuttbylgjugeislun í W/m² (venjulega Ecowitt / Davis / persónuleg veðurstöð). Þegar hann er stilltur koma núverandi staða hans og upptökuferill í stað Open-Meteo fyrir rauntíma- og fortíðarsólgeislunina alls staðar þar sem hún birtist (tala á sólarflögunni, Y-ás PV-grafsins, litun sólarbogans). Spástundir haldast á Open-Meteo þar sem skynjari getur ekki borið framtíðargildi.",
    liveDataTitle: "Staða stillinga",
    liveDataIntro:
      "Lifandi flögur sýna eingöngu mælda skynjara. Hver fjölskylda þarf valfrjálsa lifandi aflskynjarann úr sinni orkumælaborðsuppsprettu - ferlar og samtölur koma alltaf frá mælunum þínum.",
    liveSolarOk: "Sól: lifandi aflskynjari fannst.",
    liveSolarMissing:
      "Sól: enginn lifandi aflskynjari, framleiðsluflagan helst falin. Bættu einum við undir Stillingar > Mælaborð > Orka > Sólarrafhlöður.",
    liveSolarAbsent:
      "Sól: ekki uppsett í orkumælaborðinu þínu. Bættu sólarrafhlöðum þar við til að fá framleiðsluflöguna.",
    liveGridOk: "Raforkukerfi: lifandi aflskynjari fannst.",
    liveGridMissing:
      "Raforkukerfi: enginn lifandi aflskynjari, inn-/útflutningsflögurnar haldast faldar. Bættu einum við undir Stillingar > Mælaborð > Orka > Raforkukerfi.",
    liveGridMiswired:
      "Raforkukerfi: lifandi aflskynjarinn stangast á við mælana þína (hann virðist aðeins mæla eina átt). Flögurnar haldast faldar - stilltu formerktan skynjara eða ham með tveimur skynjurum.",
    liveGridAbsent:
      "Raforkukerfi: ekki uppsett í orkumælaborðinu þínu. Bættu raforkukerfinu þar við til að fá inn- og útflutningsflögurnar.",
    liveBatteryOk: "Rafhlaða: lifandi aflskynjarar ná yfir allar rafhlöður.",
    liveBatteryMissing:
      "Rafhlaða: lifandi afl vantar á að minnsta kosti eina rafhlöðu, aflflagan helst falin. Bættu aflskynjara/skynjurum við undir Stillingar > Mælaborð > Orka > Rafhlaða.",
    liveBatteryAbsent:
      "Rafhlaða: ekki uppsett í orkumælaborðinu þínu. Bættu rafhlöðu þar við til að fá hleðslu- og afhleðsluflöguna.",
    liveHomeOk:
      "Heimilisnotkun: sýnd, reiknuð út frá lifandi fjölskyldunum hér fyrir ofan.",
    liveHomeNote:
      "Heimilisnotkun: birtist um leið og hver stillt fjölskylda hér fyrir ofan hefur sinn lifandi skynjara.",
    openEnergyConfig: "Opna orkustillingar",
    buildingsSection: "Heimili & byggingar",
    buildingsHint:
      'Til að halda kortinu lipru á þéttbýlum svæðum eru aðeins byggingar innan stillta radíusins umhverfis heimilið myndgerðar í 3D. Heimilið sjálft helst í fullri ógagnsæi; nálægar byggingar eru myndgerðar með stilltu ógagnsæi svo þær veiti borgarsamhengi án þess að keppa við gagnayfirlögin. Klasaradíusinn flokkar áfastar útibyggingar (verandir, bílskúra, skúra) í "heimilis"-mengið.',
    displayRadius: "Birtingarradíus",
    displayRadiusHelp:
      "Radíus umhverfis heimilið þar sem byggingar eru sóttar og teiknaðar, allt að jaðri dofnaða kortskífunnar. Lækkaðu hann til að létta myndgerð á hægu tæki - 0 sýnir aðeins heimilið.",
    buildingCount: "Fjöldi bygginga",
    buildingCountHelp:
      "Hámarksfjöldi nálægra bygginga sem teikna á. Lækkaðu hann til að létta myndgerð á hægu tæki.",
    buildingRealSize: "Raunverulegar hæðir bygginga",
    buildingRealSizeOn: "Kveikt",
    buildingRealSizeOff: "Slökkt",
    buildingRealSizeHint:
      "Kveikt: notaðu raunverulegar OpenStreetMap hæðir (takmarkaðar til að halda römmun læsilegri). Slökkt: gefðu hverri byggingu sömu föstu hæð hér að neðan.",
    buildingHeight: "Hæð byggingar",
    hiddenDevicesEmpty:
      "Engin einstök tæki eru skráð í orkumælaborðinu þínu ennþá. Bættu notkun tækja þar við til að stjórna þeim hér.",
    deviceVisibilityLabel: "Sýna tæki",
    group: "Hópur",
    noGroup: "Enginn hópur",
    groupAssignHint:
      "Dragðu tækin þín í hóp. Það sem eftir verður neðar tilheyrir engum hópi.",
    groupDropHere: "Slepptu tæki hér",
    backToLive: "Til baka í beina útsendingu",
    buildingClusterRadius: "Klasaradíus heimilis",
    buildingClusterRadiusHelp:
      "Radíus umhverfis heimilið þar sem áfastar útibyggingar (verandir, bílskúrar, skúrar) eru meðhöndlaðar sem hluti af heimilinu: þær eru myndgerðar með fullri ógagnsæi og lit heimilisins í stað þess að birtast sem dofnir nágrannar. 0 heldur aðeins aðalbyggingunni.",
    buildingOpacity: "Ógagnsæi umhverfis",
    buildingColor: "Litur byggingar",
    buildingColorHelp:
      "Grunntónn sem beitt er á byggingarnar í kring í senunni.",
    shadowsSection: "Skuggar",
    shadowsEnabled: "Sýna skugga",
    shadowsEnabledOn: "Sýndir",
    shadowsEnabledOff: "Faldir",
    shadowsEnabledHint:
      "Kveikir/slekkur á jarðskuggunum sem byggingarnar varpa eftir því sem sólin færist.",
    shadowOpacity: "Ógagnsæi skugga",
    shadowOpacityHint: "Ógagnsæi varpaðra jarðskugga.",
    resetSection: "Endurstilla",
    resetSectionHint:
      "Viðhaldsverkfæri: sæktu vistuð gögn kortsins aftur, eða endurstilltu allar stillingar í sjálfgefin gildi.",
    resetCacheButton: "Endurstilla gagnaskyndiminni",
    resetCacheWarning:
      "Aðvörun: þetta sækir aftur allt sem kortið hefur vistað í skyndiminni - Open-Meteo veðrið, allar orkuraðir í minni (framleiðslu, raforkukerfi, rafhlöðu, tæki, sólgeislun), kvörðun fínstilltu spárinnar, og OpenFreeMap byggingargrunnana - fyrir hvert Helios-kort sem er opið á þessari síðu. Notaðu þetta til að hreinsa fasta kvörðun eða úrelt veður-/kortgögn - full endursókn tekur nokkrar mínútur eftir HA-þjóninum þínum. Gögnin þín inni í Home Assistant eru aldrei snert.",
    resetCacheDone: "Skyndiminni hreinsað ✓",
    resetOptionsButton: "Endurstilla valkosti í sjálfgefið",
    resetOptionsConfirm: "Ýttu aftur til að staðfesta",
    resetOptionsWarning:
      "Aðvörun: þetta endurstillir ALLA valkosti þessa korts í sjálfgefin gildi - sýnileika, liti og tákn flaga, nöfn/liti/tákn hópa, byggingar, skugga, einingar og allar aðrar stillingar. Gögnin þín í Home Assistant og orkumælaborðið eru ósnert, en sérsníðingin þín hverfur og verður ekki afturkölluð.",
    resetOptionsDone: "Valkostir endurstilltir ✓",
    aboutSection: "Um",
    aboutVersionLabel: "Útgáfa",
    aboutRepoCard: "Helios",
    aboutCoffeeMessage:
      "Ég smíða Helios einn, mest á næturnar, elti smáatriðin þangað til sólin og orkan þín verða lifandi á skjánum. Ef kortið hefur fundið sér stað á mælaborðinu þínu gerir það mig þegar glaðan - stjarna á GitHub gleður enn meira, og kaffibolli heldur öllu gangandi.",
    aboutDeveloperLabel: "Forritari",
    aboutDeveloperLinkedIn: "LinkedIn",
    aboutCoffeeLink: "Bjóddu mér upp á kaffi",
  },
};
