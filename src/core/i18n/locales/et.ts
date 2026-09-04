import type { Translations } from "../index";

//Estonian locale.
export const et: Translations = {
  cardName: "Helios",
  cardDescription:
    "☀️ Reaalajas 2.5D-vaade sinu kodust koos päikese, ilma, päikesetootmise, aku ja võrguga, lisaks heidetud varjud ja interaktiivne ajatelg",

  period: {
    rangeLabel: "Ajavahemik",
    forecast: "P - P+2",
    yesterday: "Eile",
    today: "Täna",
    week: "Nädal",
    month: "Kuu",
    year: "Aasta",
  },

  compass: "P,KI,I,KA,L,EL,LÄ,LO",

  cloudCover: {
    cloudLow: "Madal pilvkate",
    cloudMid: "Keskmine pilvkate",
    cloudHigh: "Kõrge pilvkate",
  },

  mapConfig: {
    section: "Kaardi seadistus",
    intro:
      "Aluskaart joonistatakse OpenStreetMapi vektorpiltide põhjal. Automaatne järgib sinu teemat, Tume / Hele sunnib ühte neist ja Kohandatud lubab seada iga värvi ning peita iga kihi.",
    modeAuto: "Automaatne",
    modeDark: "Tume",
    modeLight: "Hele",
    modeCustom: "Kohandatud",
    land: "Taust",
    water: "Vesi",
    wood: "Mets",
    grass: "Haljasala",
    sand: "Liiv",
    wetland: "Märgala",
    ice: "Jää ja lumi",
    landuse: "Hoonestatud ala",
    roadMajor: "Peateed",
    roadMinor: "Kõrvalteed",
    roadCasing: "Tee kontuur",
    path: "Rajad ja pinnasteed",
    rail: "Raudteed",
    building: "Hooned",
    boundary: "Piirid",
  },

  editor: {
    weatherEnabled: "Ilmaefektid",
    weatherEnabledHint:
      "Kuvab stseeni kohal päris taeva: päikesepaiste, pilved, vihm, lumi ja äikesetormid sinu kohaliku ilma põhjal, järgides ajajoont selle kerimisel. Väljalülitatuna jääb stseen selgeks.",
    temperatureEntity: "Temperatuuriandur",
    temperatureEntityHelp:
      "Valikuline. Kasuta temperatuurikiibi jaoks Open-Meteo väärtuse asemel kohalikku välistemperatuuri andurit (°C). Selle reaalajas olek ja salvestaja ajalugu on kasutusel reaalaja + mineviku jaoks; prognoositunnid jäävad mudelile.",
    humidityEntity: "Niiskusandur",
    humidityEntityHelp:
      "Valikuline. Kasuta Open-Meteo väärtuse asemel kohalikku suhtelise õhuniiskuse andurit (%) reaalaja + mineviku jaoks.",
    cloudCoverEntity: "Pilvisuse andur",
    cloudCoverEntityHelp:
      "Valikuline. Kasuta Open-Meteo väärtuse asemel kohalikku pilvisuse andurit (%), et juhtida taeva astet (päike, hallistumine) reaalaja + mineviku jaoks.",
    precipitationEntity: "Sademete andur",
    precipitationEntityHelp:
      "Valikuline. Kasuta Open-Meteo väärtuse asemel kohalikku sademete andurit (mm), et juhtida vihmakihti reaalaja + mineviku jaoks.",
    snowfallEntity: "Lumesaju andur",
    snowfallEntityHelp:
      "Valikuline. Kasuta Open-Meteo väärtuse asemel kohalikku lumesaju andurit (cm), et juhtida lumekihti reaalaja + mineviku jaoks.",
    weatherEntity: "Ilmaolem",
    weatherEntityHelp:
      "Valikuline. Kasuta Open-Meteo väärtuse asemel Home Assistanti ilmaolemit, et juhtida ilmastikutingimusi (vihm / lumi / äike) reaalaja + mineviku jaoks. Prognoositunnid jäävad mudelile.",
    chipTemperature: "Temperatuuri kuva",
    chipHumidity: "Niiskuse kuva",
    chipCost: "Kulude kuva",
    locationSection: "Kodu asukoht",
    homeLatitude: "Kodu laiuskraad",
    homeLongitude: "Kodu pikkuskraad",
    locationHint:
      "Alista kodu aadress, mida kasutatakse kaardi keskmena. Jäta mõlemad väljad tühjaks, et kasutada Home Assistantis seadistatud kodu. Alistamine rakendub ainult siis, kui MÕLEMAD väljad on seatud kehtivatele koordinaatidele.",
    uiAndMapSection: "UI",
    autoRotate: "Kaamera automaatne pööramine",
    autoRotateHint:
      "Kui ollakse paar sekundit tegevusetu, tiirleb kaamera aeglaselt kodu ümber (umbes 1,5°/s, vastupidi päikese näivale liikumisele). Ühe sõrmega lohistamine peatab selle koheselt ja see jätkub, kui lahti lased. Väldi seda väga vanadel seadmetel: automaatne pööramine sunnib renderdamise iga sekund.",
    autoRotateOn: "Sees",
    autoRotateOff: "Väljas",
    degradedRender: "Ühilduvusrežiim",
    degradedRenderHint:
      "Joonistab kaardi lihtsama ja ühilduvama meetodiga. Lülitage sisse, kui stseen vilgub või rebeneb pööramisel või lohistamisel. See parandab tõrke mõnes telefonis ja tahvelarvutis veidi vähem sujuva liikumise arvelt.",
    dataDisplaySection: "Andmete kuvamine",
    maxExpectedPower: "Maksimaalne oodatav võimsus",
    maxExpectedPowerHelp:
      "Võimsus, mille juures voog liigub täiskiirusel. Iga voogu võrreldakse selle ühe võrdlusväärtusega, nii et suurem voog näib alati kiirem kui väiksem, olenemata suunast, kuhu see liigub. Tõsta seda suure paigalduse jaoks, langeta väikese jaoks. Vaikimisi 5000 W.",
    sunChipMode: "Päikesekiibi näit",
    sunChipModeHelp:
      "Mida päikesekiip näitab: otsest päikesekiirgust (vaikimisi) või päikese asendit (asimuut ja kõrgus). Asend ei vaja andurit, see tuleb kaardi enda päikesearvutustest.",
      batteryChipMode: "Aku kiibi näit",
      batteryChipModeHelp: "Mida aku kiip näitab: reaalajas võimsust (vaikimisi) või laetuse taset (%). See langeb tagasi väärtusele, mida su aku tegelikult pakub.",
      batteryChipModePower: "Võimsus",
      batteryChipModeSoc: "Laetuse tase",
    sunChipModeIrradiance: "Kiirgustugevus",
    sunChipModePosition: "Päikese asend",
    displayUpdateFrequency: "Graafiku detailsus",
    displayUpdateFrequencyHelp:
      "Mitu punkti tunnis graafikud joonistavad. Andmed ise on alati Home Assistanti 5-minutiline statistika; see juhib ainult, kui tihedalt kõver joonistatakse: 1 = üks punkt tunnis (sujuvaim, kergeim renderdada), 6 = üks punkt iga 10 minuti järel (täisdetailsus, raskeim). Vaikimisi 4 = punkt iga 15 minuti järel. Vähenda seda vanematel või aeglasematel seadmetel renderduskulu vähendamiseks. Prognoosikõver järgib sama tempot, nii et peenem säte toob esile ka lühikesed varjulohud (puu, mis varjab tootmist pool tundi), millest tunnikõver üle astub.",
    valueDecimals: "Kümnendkohad",
    valueDecimalsHelp:
      "Igal väärtuse näidul kuvatavate kümnendkohtade arv, et kiibid näeksid ühtlased välja. Kehtib kW väärtustele (täisvatid jäävad täisarvudeks) ja kWh-le. 0 kuni 3, vaikimisi 1.",
    powerUnit: "Võimsuse ühik",
    powerUnitHelp:
      "Ühik iga võimsuse näidu jaoks kaardil (kiibid, graafiku kohtspikrid). Energia järgib seda samuti, nii et kaart jääb ühtseks: kW sobib kWh-ga, W Wh-ga.",
    energyUnit: "Energia ühik",
    energyUnitHelp:
      "Ühik kõigi energiakogusummade jaoks (päevakõver, üksikasjade paneel, ajajoone päevasummad). Automaatne järgib ülalolevat võimsuse ühikut; valige Wh või kWh, et seada see eraldi.",
    energyUnitAuto: "Automaatne",
    irradianceUnit: "Päikesekonstandi ühik",
    irradianceUnitHelp:
      "Ühik päikesekonstandi (kiirgustugevuse) näidu jaoks päikese kohal.",
    batterySign: "Aku märk",
    batterySignHelp:
      "Aku kiibil kuvatav märk. Vaikimisi on laadimisel miinus ja tühjenemisel pluss. Ümberpööratud vahetab need. Peidetud kuvab väärtuse ilma märgita.",
    batterySignDefault: "Vaikimisi",
    batterySignInverted: "Ümberpööratud",
    batterySignHidden: "Peidetud",
    noUiMode: "Liideseta režiim",
    noUiModeHint:
      "Hägustab ajatelje ja kaardi juhtnupud pärast mõnesekundilist tegevusetust. Iga puudutus või liigutus toob need tagasi. Sobib hästi seinaekraanile.",
    noUiDelay: "Tegevusetuse viivitus enne peitmist",
    noUiDelayHint:
      "Sekundid tegevusetust, enne kui ajatelg ja juhtnupud liideseta režiimis hägustuvad. 0 hoiab liidese jäädavalt peidetuna. Kasutusel ainult siis, kui liideseta režiim on sees.",
    showTimeline: "Näita ajatelge",
    showTimelineHint:
      "Näita ajatelge ja perioodivalikut stseeni all. Väljas jätab ainult stseeni.",
    showDetailPanel: "Näita lisainfot",
    showDetailPanelHint:
      "Luba iga kiibi mini-paneel (koondnäitajad) avaneda paremal üleval, kui kiibil vajutatakse. Väljas ei näita seda kunagi.",
    showSunTimes: "Näita päikesetõusu ja -loojangu aegu",
    showSunTimesHint:
      "Näita päikesetõusu ja -loojangu aegu ning nende markereid päikesekaare jalamil.",
    showHorizonLine: "Näita maastiku horisonti",
    showHorizonLineHint: "Joonistab maastiku horisondijoone kodu ümber, arvutatuna kohalikust reljeefist. Horisont summutab päikest alati realistlikult küngaste taga; see üksnes näitab või peidab joonistatud joone.",
    horizonLineColor: "Maastiku horisondi värv",
    horizonLineColorHint: "Maastiku horisondijoone värv.",
    moonDisplay: "Kuu kuvarežiim",
    moonDisplayHint: "Joonistab kuu omaenda kaarele faasile vastava sirbiga, alati päikese ees. Ainult kaunistus: ilma sildita, ilma väärtuseta.",
    moonDisplayAlways: "Alati",
    moonDisplayNight: "Öö",
    moonDisplayHidden: "Keelatud",
    sceneZoom: "Stseeni suum",
    sceneZoomHint: "Suurendab kaarti, hooneid ja varje teie kodu ümber: 1x on vaikekuva, 1,5x ja 2x näitavad neid suuremana. Päike, kaared ja sildid säilitavad oma suuruse.",
    lockRotation: "Lukusta pööramine",
    lockRotationHint:
      "Lohistage eelvaadet, et pöörata ja kallutada stseeni soovitud vaateni, seejärel lülitage see sisse. Lukk külmutab selle vaate (lohistamisega pööramine ja jõudeoleku automaatne pööramine lülitatakse välja) ja salvestab nurga kaardile, nii et täpselt sama vaade kuvatakse igas seadmes ja brauseris. Lülitage see välja, et taas vabalt pöörata.",
    chipsSection: "Olemite kuvamine",
    chipsIntro:
      "Näita või peida iga olem ning vali selle ikoon ja värv. Kodu järgib valitud kiipi, või vaikimisi sinu põhivärvi.",
    chipIrradiance: "Kiirgustugevuse kuvamine",
    chipProduction: "Tootmise kuvamine",
    chipGrid: "Võrgu kuvamine",
    chipBattery: "Aku kuvamine",
    chipHome: "Kodu tarbimise kuvamine",
    groupsConfigTitle: "Rühmade seadistus",
    optionalSensors: "Valikulised andurid",
    solarIrradianceEntity: "Päikesekiirguse olem",
    solarIrradianceEntityHelp:
      "Vali andur, mis raporteerib globaalse lühilaine kiirgustugevuse ühikus W/m² (tüüpiliselt Ecowitt / Davis / isiklik ilmajaam). Kui see on määratud, asendab selle praegune olek ja salvestaja ajalugu Open-Meteo otse- ja minevikukiirguse jaoks kõikjal, kus see esineb (päikesekiibi number, päikesegraafiku Y-telg, päikesekaare värvimine). Prognoosi tunnid jäävad Open-Meteo peale, kuna andur ei saa kanda tulevasi väärtusi.",
    liveDataTitle: "Seadistuse olek",
    liveDataIntro:
      "Otseandmete kiibid näitavad ainult mõõdetud andureid. Iga perekond vajab oma energiapaneeli allika valikulist otsevõimsuse andurit; kõverad ja kogusummad tulevad alati sinu mõõturitelt.",
    liveSolarOk: "Päike: otsevõimsuse andur tuvastatud.",
    liveSolarMissing:
      "Päike: otsevõimsuse andurit pole, tootmise kiip jääb peidetuks. Lisa see menüüst Seaded > Töölauad > Energia > Päikesepaneelid.",
    liveSolarAbsent:
      "Päike: pole sinu energiapaneelis seadistatud. Lisa sinna päikesepaneelid, et saada tootmise kiip.",
    liveGridOk: "Võrk: otsevõimsuse andur tuvastatud.",
    liveGridMissing:
      "Võrk: otsevõimsuse andurit pole, impordi/ekspordi kiibid jäävad peidetuks. Lisa see menüüst Seaded > Töölauad > Energia > Elektrivõrk.",
    liveGridMiswired:
      "Võrk: otsevõimsuse andur läheb vastuollu sinu mõõturitega (see näib mõõtvat ainult ühte suunda). Kiibid jäävad peidetuks; seadista märgiga andur või kahe anduri režiim.",
    liveGridAbsent:
      "Võrk: pole sinu energiapaneelis seadistatud. Lisa sinna elektrivõrk, et saada impordi ja ekspordi kiibid.",
    liveBatteryOk: "Aku: otsevõimsuse andurid katavad iga akut.",
    liveBatteryMissing:
      "Aku: otsevõimsus puudub vähemalt ühel akul, võimsuse kiip jääb peidetuks. Lisa võimsuse andur(id) menüüst Seaded > Töölauad > Energia > Aku.",
    liveBatteryAbsent:
      "Aku: pole sinu energiapaneelis seadistatud. Lisa sinna aku, et saada laadimise ja tühjenemise kiip.",
    liveHomeOk:
      "Kodu tarbimine: kuvatud, tuletatud ülaltoodud otseandmetega perekondadest.",
    liveHomeNote:
      "Kodu tarbimine: ilmub siis, kui igal ülaltoodud seadistatud perekonnal on oma otseandmete andur.",
    openEnergyConfig: "Ava energia seadistus",
    buildingsSection: "Kodu ja hooned",
    buildingsHint:
      'Et hoida kaart tihedalt asustatud linnapiirkondades sujuvana, renderdatakse 3D-s ainult kodu ümber seadistatud raadiuse sees olevad hooned. Kodu ise jääb täiesti läbipaistmatuks; lähedalasuvad hooned renderdatakse seadistatud läbipaistmatusega, et need annaksid linnakonteksti ilma andmekihtidega võistlemata. Klastri raadius koondab külgnevad kõrvalhooned (verandad, garaažid, kuurid) "kodu" hulka.',
    displayRadius: "Kuvamisraadius",
    displayRadiusHelp:
      "Kodu ümber olev raadius, mille sees hooned tõmmatakse ja joonistatakse, kuni tuhmunud kaardiketta servani. Vähenda seda, et kergendada renderdamist aeglasel seadmel; 0 näitab ainult kodu.",
    buildingCount: "Hoonete arv",
    buildingCountHelp:
      "Joonistatavate lähedalasuvate hoonete maksimaalne arv. Vähenda seda, et kergendada renderdamist aeglasel seadmel.",
    buildingRealSize: "Tegelikud hoonete kõrgused",
    buildingRealSizeOn: "Sees",
    buildingRealSizeOff: "Väljas",
    buildingRealSizeHint:
      "Sees: kasuta tegelikke OpenStreetMap kõrgusi (piiratud, et kadreering jääks loetavaks). Väljas: anna igale hoonele allpool sama fikseeritud kõrgus.",
    buildingHeight: "Hoone kõrgus",
    hiddenDevicesEmpty:
      "Sinu energiapaneelis pole veel jälgitavaid üksikuid seadmeid. Lisa sinna seadme tarbimine, et neid siin juhtida.",
    deviceVisibilityLabel: "Näita seadet",
    group: "Rühm",
    noGroup: "Rühm puudub",
    groupAssignHint:
      "Lohistage oma seadmed rühma. See, mis jääb alla, ei kuulu ühtegi rühma.",
    groupDropHere: "Lohistage seade siia",
    backToLive: "Tagasi reaalaega",
    buildingClusterRadius: "Kodu klastri raadius",
    buildingClusterRadiusHelp:
      "Raadius kodu ümber, mille sees külgnevaid kõrvalhooneid (verandad, garaažid, kuurid) käsitletakse kodu osana: need renderdatakse kodu täieliku läbipaistmatuse ja värviga, mitte tuhmunud naabritena. 0 jätab alles ainult peahoone.",
    buildingOpacity: "Ümbruse läbipaistmatus",
    buildingColor: "Hoone värv",
    buildingColorHelp: "Stseenis ümbritsevatele hoonetele rakendatav põhitoon.",
    shadowsSection: "Varjud",
    moonSection: "Kuu seadistus",
    shadowsEnabled: "Näita varje",
    shadowsEnabledOn: "Näidatud",
    shadowsEnabledOff: "Peidetud",
    shadowsEnabledHint:
      "Lülitab sisse/välja maapinna varjud, mida hooned heidavad päikese liikudes.",
    shadowOpacity: "Varju läbipaistmatus",
    shadowOpacityHint: "Heidetud maapinna varjude läbipaistmatus.",
    resetSection: "Lähtestamine",
    resetSectionHint:
      "Hooldustööriistad: tõmba uuesti kaardi vahemällu salvestatud andmed või lähtesta iga suvand vaikeväärtusele.",
    resetCacheButton: "Lähtesta andmete vahemälu",
    resetCacheWarning:
      "Hoiatus: see tõmbab uuesti kõik, mis kaart on vahemällu salvestanud - Open-Meteo ilmaandmed, iga mälus oleva energiakõvera (tootmine, võrk, aku, seadmed, kiirgustugevus), täpsustatud prognoosi kalibreeringu ja OpenFreeMapi hoonete kontuurid - iga sellel lehel avatud Helios-kaardi jaoks. Kasuta seda, et kustutada kinnijäänud kalibreering või vananenud ilma-/kaardiandmed; täielik uuestitõmbamine võtab paar minutit, sõltuvalt sinu HA serverist. Sinu andmeid Home Assistanti sees ei puudutata kunagi.",
    resetCacheDone: "Vahemälu tühjendatud ✓",
    resetOptionsButton: "Lähtesta suvandid vaikeväärtustele",
    resetOptionsConfirm: "Kinnitamiseks vajuta uuesti",
    resetOptionsWarning:
      "Hoiatus: see lähtestab KÕIK selle kaardi suvandid vaikeväärtustele - kiipide nähtavuse, värvid ja ikoonid, rühmade nimed/värvid/ikoonid, hooned, varjud, ühikud ja iga muu seade. Sinu Home Assistanti andmeid ja energiapaneeli ei puudutata, kuid sinu kohandused kustutatakse ning seda ei saa tagasi võtta.",
    resetOptionsDone: "Suvandid lähtestatud ✓",
    aboutSection: "Teave",
    aboutVersionLabel: "Versioon",
    aboutRepoCard: "Helios",
    aboutCoffeeMessage:
      "Ehitan Heliost üksinda, enamasti öösiti, jahtides väikseid detaile, kuni päike ja sinu energia hakkavad ekraanil elama. Kui see on leidnud koha sinu töölaual, teeb see mind juba õnnelikuks - täht GitHubis rõõmustab veelgi enam ja kohv aitab kõigel edasi liikuda.",
    aboutDeveloperLabel: "Arendaja",
    aboutDeveloperLinkedIn: "LinkedIn",
    aboutCoffeeLink: "Osta mulle kohv",
  },
};
