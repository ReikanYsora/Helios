import type { Translations } from "../index";

//Finnish locale.
export const fi: Translations = {
  cardName: "Helios",
  cardDescription:
    "☀️ Reaaliaikainen 2.5D-näkymä kodistasi auringon, sään, aurinkotuotannon, akun ja verkon kanssa, lisäksi heitetyt varjot ja vuorovaikutteinen aikajana",

  period: {
    rangeLabel: "Aikaväli",
    forecast: "P - P+2",
    yesterday: "Eilen",
    today: "Tänään",
    week: "Viikko",
    month: "Kuukausi",
    year: "Vuosi",
  },

  compass: "P,KO,I,KA,E,LO,L,LU",

  cloudCover: {
    cloudLow: "Matala pilvisyys",
    cloudMid: "Keskikorkea pilvisyys",
    cloudHigh: "Korkea pilvisyys",
  },

  mapConfig: {
    section: "Kartan asetukset",
    intro:
      "Pohjakartta piirretään OpenStreetMapin vektorilaatoista. Auto seuraa teemaasi, Dark / Light pakottaa jommankumman, ja Custom antaa asettaa jokaisen värin ja piilottaa minkä tahansa tason.",
    modeAuto: "Auto",
    modeDark: "Tumma",
    modeLight: "Vaalea",
    modeCustom: "Mukautettu",
    land: "Tausta",
    water: "Vesi",
    wood: "Metsä",
    grass: "Viheralueet",
    sand: "Hiekka",
    wetland: "Kosteikko",
    ice: "Jää & lumi",
    landuse: "Rakennettu alue",
    roadMajor: "Pääväylät",
    roadMinor: "Pienemmät tiet",
    roadCasing: "Tien reunaviiva",
    path: "Polut & kevyen liikenteen väylät",
    rail: "Rautatiet",
    building: "Rakennukset",
    boundary: "Rajat",
  },

  editor: {
    weatherEnabled: "Sääefektit",
    weatherEnabledHint:
      "Maalaa todellinen taivas näkymän päälle: auringonpaiste, pilvet, sade, lumi ja ukkosmyrskyt paikallisen sääsi mukaan, seuraten aikajanaa kelatessasi. Pois päältä pitää näkymän kirkkaana.",
    temperatureEntity: "Lämpötila-anturi",
    temperatureEntityHelp:
      "Valinnainen. Käytä paikallista ulkolämpötila-anturia (°C) Open-Meteon arvon sijaan lämpötilamerkissä. Sen reaaliaikaista tilaa ja tallentimen historiaa käytetään nykyhetkeen ja menneeseen; ennustetunnit pysyvät mallissa.",
    humidityEntity: "Ilmankosteusanturi",
    humidityEntityHelp:
      "Valinnainen. Käytä paikallista suhteellisen ilmankosteuden anturia (%) Open-Meteon arvon sijaan nykyhetkeen ja menneeseen.",
    cloudCoverEntity: "Pilvisyysanturi",
    cloudCoverEntityHelp:
      "Valinnainen. Käytä paikallista pilvisyysanturia (%) taivaan asteen (aurinko, harmaantuminen) ohjaamiseen Open-Meteon arvon sijaan nykyhetkeen ja menneeseen.",
    precipitationEntity: "Sademäärä-anturi",
    precipitationEntityHelp:
      "Valinnainen. Käytä paikallista sademäärä-anturia (mm) sadekerroksen ohjaamiseen Open-Meteon arvon sijaan nykyhetkeen ja menneeseen.",
    snowfallEntity: "Lumisadeanturi",
    snowfallEntityHelp:
      "Valinnainen. Käytä paikallista lumisadeanturia (cm) lumikerroksen ohjaamiseen Open-Meteon arvon sijaan nykyhetkeen ja menneeseen.",
    weatherEntity: "Sääentiteetti",
    weatherEntityHelp:
      "Valinnainen. Käytä Home Assistant -sääentiteettiä olosuhteen (sade / lumi / ukkosmyrsky) ohjaamiseen Open-Meteon arvon sijaan nykyhetkeen ja menneeseen. Ennustetunnit pysyvät mallissa.",
    chipTemperature: "Lämpötilan näyttö",
    chipHumidity: "Ilmankosteuden näyttö",
    chipCost: "Kustannusnäyttö",
    locationSection: "Kodin sijainti",
    homeLatitude: "Kodin leveysaste",
    homeLongitude: "Kodin pituusaste",
    locationHint:
      "Ohita kotiosoite, jota käytetään kortin keskipisteenä. Jätä molemmat kentät tyhjiksi käyttääksesi Home Assistantissa määritettyä kotia. Ohitus otetaan käyttöön vain, kun MOLEMMAT kentät on asetettu kelvollisiin koordinaatteihin.",
    uiAndMapSection: "Käyttöliittymä",
    autoRotate: "Kameran automaattinen kierto",
    autoRotateHint:
      "Kun on oltu käyttämättömänä muutaman sekunnin, kamera kiertää hitaasti kodin ympäri (noin 1,5°/s, vastakkaiseen suuntaan kuin auringon näennäinen liike). Yhden sormen veto keskeyttää sen heti, ja se jatkuu, kun päästät irti. Vältä sitä hyvin vanhoilla laitteilla: automaattinen kierto pakottaa renderöinnin joka sekunti.",
    autoRotateOn: "Päällä",
    autoRotateOff: "Pois",
    degradedRender: "Yhteensopivuustila",
    degradedRenderHint:
      "Piirtää kartan yksinkertaisemmalla, yhteensopivammalla tavalla. Ota käyttöön, jos näkymä välkkyy tai repeää, kun sitä kääntää tai vierittää. Se korjaa häiriön joissakin puhelimissa ja tableteissa hieman vähemmän sujuvan liikkeen kustannuksella.",
    dataDisplaySection: "Tietojen näyttö",
    maxExpectedPower: "Suurin odotettu teho",
    maxExpectedPowerHelp:
      "Teho, jolla virtaus liikkuu täydellä nopeudella. Jokaista virtausta tahditetaan tätä yhtä viitearvoa vasten, joten suurempi virtaus näkyy aina nopeampana kuin pienempi, riippumatta siitä mihin suuntaan se kulkee. Nosta sitä suureen asennukseen, laske pieneen. Oletus 5000 W.",
    sunChipMode: "Aurinkosirun lukema",
    sunChipModeHelp:
      "Mitä aurinkosiru näyttää: reaaliaikaisen aurinkoirradianssin (oletus) tai auringon sijainnin (atsimuutti ja korkeus). Sijainti ei tarvitse anturia, se tulee kortin omista aurinkolaskelmista.",
      batteryChipMode: "Akkusirun lukema",
      batteryChipModeHelp: "Mitä akkusiru näyttää: reaaliaikaisen tehon (oletus) tai varaustason (%). Se palaa siihen arvoon, jonka akkusi todella tarjoaa.",
      batteryChipModePower: "Teho",
      batteryChipModeSoc: "Varaustaso",
    sunChipModeIrradiance: "Irradianssi",
    sunChipModePosition: "Auringon sijainti",
    displayUpdateFrequency: "Kaavion tarkkuus",
    displayUpdateFrequencyHelp:
      "Kuinka monta pistettä tunnissa kaaviot piirtävät. Itse data on aina Home Assistantin 5 minuutin tilastoa; tämä ohjaa vain, kuinka tiheästi käyrä piirretään: 1 = yksi piste tunnissa (tasaisin, kevyin renderöidä), 6 = yksi piste 10 minuutin välein (täysi tarkkuus, raskain). Oletus 4 = piste 15 minuutin välein. Laske sitä vanhemmilla tai hitaammilla laitteilla renderöintikustannusten vähentämiseksi. Ennustekäyrä noudattaa samaa tahtia, joten hienompi asetus tuo esiin myös lyhyet varjonotkahdukset (puu, joka varjostaa tuotantoa puoli tuntia), jotka tuntikäyrä ylittää.",
    valueDecimals: "Desimaalit",
    valueDecimalsHelp:
      "Jokaisessa arvolukemassa näytettävien desimaalien määrä, jotta sirut näkyvät yhtenäisinä. Koskee kW-arvoja (kokonaiset watit pysyvät kokonaislukuina) ja kWh-arvoja. 0-3, oletus 1.",
    powerUnit: "Tehon yksikkö",
    powerUnitHelp:
      "Yksikkö jokaiselle kortin teholukemalle (sirut, kaavion työkaluvihjeet). Energia noudattaa sitä myös, joten kortti pysyy yhtenäisenä: kW yhdistyy kWh:hon, W Wh:hon.",
    energyUnit: "Energiayksikkö",
    energyUnitHelp:
      "Yksikkö kaikille energian summille (päiväkäyrä, tietopaneeli, aikajanan päiväsummat). Automaattinen noudattaa yllä olevaa tehon yksikköä; valitse Wh tai kWh asettaaksesi sen erikseen.",
    energyUnitAuto: "Automaattinen",
    irradianceUnit: "Aurinkovakion yksikkö",
    irradianceUnitHelp:
      "Yksikkö auringon yläpuolella olevalle aurinkovakion (irradianssin) lukemalle.",
    batterySign: "Akun merkki",
    batterySignHelp:
      "Akun sirussa näkyvä merkki. Oletuksena miinus ladattaessa ja plus purettaessa. Käänteinen vaihtaa ne. Piilotettu näyttää arvon ilman merkkiä.",
    batterySignDefault: "Oletus",
    batterySignInverted: "Käänteinen",
    batterySignHidden: "Piilotettu",
    noUiMode: "Ilman käyttöliittymää -tila",
    noUiModeHint:
      "Häivyttää aikajanan ja kortin säätimet muutaman toimettoman sekunnin jälkeen. Mikä tahansa kosketus tai liike tuo ne takaisin. Loistava seinänäytölle.",
    noUiDelay: "Toimettomuusviive ennen piilotusta",
    noUiDelayHint:
      "Sekunnit toimettomuutta ennen kuin aikajana ja säätimet häviävät Ilman käyttöliittymää -tilassa. 0 pitää käyttöliittymän pysyvästi piilossa. Käytössä vain, kun Ilman käyttöliittymää -tila on päällä.",
    showTimeline: "Näytä aikajana",
    showTimelineHint:
      "Näytä aikajana ja ajanjakson valitsin näkymän alapuolella. Pois päältä näyttää vain näkymän.",
    showDetailPanel: "Näytä lisätiedot",
    showDetailPanelHint:
      "Salli sirukohtaisen minipaneelin (koosteiset mittarit) avautua oikeassa yläkulmassa, kun siruun napautetaan. Pois päältä sitä ei näytetä koskaan.",
    showSunTimes: "Näytä auringonnousu- ja -laskuajat",
    showSunTimesHint:
      "Näytä auringonnousun ja -laskun kellonajat sekä niiden merkit aurinkokaaren juurella.",
    showHorizonLine: "Näytä maaston horisontti",
    showHorizonLineHint: "Piirtää maaston horisonttiviivan kodin ympärille paikallisesta maastosta laskettuna. Horisontti himmentää auringon aina realistisesti kukkuloiden taakse; tämä vain näyttää tai piilottaa piirretyn viivan.",
    horizonLineColor: "Maaston horisontin väri",
    horizonLineColorHint: "Maaston horisonttiviivan väri.",
    moonDisplay: "Kuun näyttötila",
    moonDisplayHint: "Piirtää kuun omalle kaarelleen vaiheen mukaisena sirppinä, aina auringon edessä. Vain koristeellinen: ei merkkiä, ei arvoa.",
    moonDisplayAlways: "Aina näkyvissä",
    moonDisplayNight: "Vain yöllä",
    moonDisplayHidden: "Piilotettu",
    sceneZoom: "Näkymän zoomaus",
    sceneZoomHint: "Suurentaa karttaa, rakennuksia ja varjoja kotisi ympärillä: 1x on nykyinen näkymä, 1,5x ja 2x näyttävät ne suurempina. Aurinko, kaaret ja merkit säilyttävät kokonsa.",
    lockRotation: "Lukitse kierto",
    lockRotationHint:
      "Vedä esikatselua kääntääksesi ja kallistaaksesi näkymää haluamaasi kulmaan ja ota tämä sitten käyttöön. Lukitus jäädyttää näkymän (vetämällä kääntäminen ja lepotilan automaattinen kierto poistetaan käytöstä) ja tallentaa kulman korttiin, joten täsmälleen sama näkymä näkyy jokaisella laitteella ja selaimella. Poista se käytöstä kääntääksesi taas vapaasti.",
    chipsSection: "Entiteettien näyttö",
    chipsIntro:
      "Näytä tai piilota kukin entiteetti, ja valitse sen kuvake ja väri. Koti seuraa valittua sirua tai oletuksena ensisijaista väriäsi.",
    chipIrradiance: "Irradianssin näyttö",
    chipProduction: "Tuotannon näyttö",
    chipGrid: "Verkon näyttö",
    chipBattery: "Akun näyttö",
    chipHome: "Kodin kulutuksen näyttö",
    groupsConfigTitle: "Ryhmien asetukset",
    optionalSensors: "Valinnaiset anturit",
    solarIrradianceEntity: "Auringon irradianssin entiteetti",
    solarIrradianceEntityHelp:
      "Valitse anturi, joka raportoi globaalin lyhytaaltoisen irradianssin yksikössä W/m² (tyypillisesti Ecowitt / Davis / oma sääasema). Kun se on asetettu, sen nykyinen tila ja tallentimen historia korvaavat Open-Meteon live- ja menneessä irradianssissa kaikkialla, missä se esiintyy (aurinkosirun luku, aurinkosähkökaavion Y-akseli, aurinkokaaren väritys). Ennustetunnit pysyvät Open-Meteossa, koska anturi ei voi kantaa tulevia arvoja.",
    liveDataTitle: "Asetusten tila",
    liveDataIntro:
      "Live-sirut näyttävät vain mitattuja antureita. Jokainen perhe tarvitsee oman energiapaneelin lähteen valinnaisen live-tehoanturin; käyrät ja summat tulevat aina mittareistasi.",
    liveSolarOk: "Aurinko: live-tehoanturi havaittu.",
    liveSolarMissing:
      "Aurinko: live-tehoanturia ei löydy, tuotantosiru pysyy piilossa. Lisää se kohdassa Asetukset > Kojelaudat > Energia > Aurinkopaneelit.",
    liveSolarAbsent:
      "Aurinko: ei määritetty Energia-kojelaudassasi. Lisää sinne aurinkopaneelit saadaksesi tuotantosirun.",
    liveGridOk: "Verkko: live-tehoanturi havaittu.",
    liveGridMissing:
      "Verkko: live-tehoanturia ei löydy, tuonti-/vientisirut pysyvät piilossa. Lisää se kohdassa Asetukset > Kojelaudat > Energia > Sähköverkko.",
    liveGridMiswired:
      "Verkko: live-tehoanturi on ristiriidassa mittareidesi kanssa (se näyttää mittaavan vain yhtä suuntaa). Sirut pysyvät piilossa; määritä etumerkillinen anturi tai Kaksi anturia -tila.",
    liveGridAbsent:
      "Verkko: ei määritetty Energia-kojelaudassasi. Lisää sinne sähköverkko saadaksesi tuonti- ja vientisirut.",
    liveBatteryOk: "Akku: live-tehoanturit kattavat jokaisen akun.",
    liveBatteryMissing:
      "Akku: live-teho puuttuu vähintään yhdestä akusta, tehosiru pysyy piilossa. Lisää tehoanturi(t) kohdassa Asetukset > Kojelaudat > Energia > Akku.",
    liveBatteryAbsent:
      "Akku: ei määritetty Energia-kojelaudassasi. Lisää sinne akku saadaksesi lataus- ja purkusirun.",
    liveHomeOk:
      "Kodin kulutus: näytetään, johdettu yllä olevista live-perheistä.",
    liveHomeNote:
      "Kodin kulutus näkyy, kun jokaisella yllä määritetyllä perheellä on live-anturinsa.",
    openEnergyConfig: "Avaa Energia-asetukset",
    buildingsSection: "Koti & rakennukset",
    buildingsHint:
      'Jotta kortti pysyy sujuvana tiheillä kaupunkialueilla, vain kodin ympärillä määritetyn säteen sisällä olevat rakennukset renderöidään 3D:nä. Koti itse pysyy täysin läpinäkymättömänä; lähellä olevat rakennukset renderöidään määritetyllä läpinäkymättömyydellä, jotta ne tarjoavat kaupunkikontekstia kilpailematta tietopeitteiden kanssa. Klusterisäde ryhmittelee liittyvät ulkorakennukset (kuistit, autotallit, vajat) "koti"-joukkoon.',
    displayRadius: "Näyttösäde",
    displayRadiusHelp:
      "Säde kodin ympärillä, jonka sisällä rakennukset haetaan ja piirretään, aina haalistuneen karttalevyn reunaan asti. Laske sitä keventääksesi renderöintiä hitaalla laitteella; 0 näyttää vain kodin.",
    buildingCount: "Rakennusten määrä",
    buildingCountHelp:
      "Piirrettävien lähirakennusten enimmäismäärä. Laske sitä keventääksesi renderöintiä hitaalla laitteella.",
    buildingRealSize: "Todelliset rakennuskorkeudet",
    buildingRealSizeOn: "Päällä",
    buildingRealSizeOff: "Pois",
    buildingRealSizeHint:
      "Päällä: käytä todellisia OpenStreetMap-korkeuksia (rajoitettu, jotta rajaus pysyy luettavana). Pois: anna jokaiselle rakennukselle sama alla oleva kiinteä korkeus.",
    buildingHeight: "Rakennuksen korkeus",
    hiddenDevicesEmpty:
      "Yhtäkään yksittäistä laitetta ei vielä seurata Energia-kojelaudassasi. Lisää sinne laitekohtainen kulutus hallitaksesi niitä täällä.",
    deviceVisibilityLabel: "Näytä laite",
    group: "Ryhmä",
    noGroup: "Ei ryhmää",
    groupAssignHint:
      "Vedä laitteesi ryhmään. Alle jäävät eivät kuulu mihinkään ryhmään.",
    groupDropHere: "Pudota laite tähän",
    backToLive: "Takaisin reaaliaikaan",
    buildingClusterRadius: "Kodin klusterisäde",
    buildingClusterRadiusHelp:
      "Säde kodin ympärillä, jonka sisällä liittyvät ulkorakennukset (kuistit, autotallit, vajat) käsitellään osana kotia: ne renderöidään kodin täydellä läpinäkymättömyydellä ja värillä sen sijaan, että näkyisivät haalistuneina naapureina. 0 pitää mukana vain päärakennuksen.",
    buildingOpacity: "Ympäristön läpinäkymättömyys",
    buildingColor: "Rakennuksen väri",
    buildingColorHelp:
      "Ympäröiviin rakennuksiin näkymässä sovellettu perussävy.",
    shadowsSection: "Varjot",
    moonSection: "Kuun asetukset",
    shadowsEnabled: "Näytä varjot",
    shadowsEnabledOn: "Näytetään",
    shadowsEnabledOff: "Piilotettu",
    shadowsEnabledHint:
      "Kytkee päälle/pois rakennusten maahan heittämät varjot auringon liikkuessa.",
    shadowOpacity: "Varjon läpinäkymättömyys",
    shadowOpacityHint: "Maahan heitettyjen varjojen läpinäkymättömyys.",
    resetSection: "Nollaus",
    resetSectionHint:
      "Huoltotyökalut: hae kortin välimuistiin tallennetut tiedot uudelleen, tai nollaa kaikki asetukset oletusarvoihinsa.",
    resetCacheButton: "Nollaa tietovälimuisti",
    resetCacheWarning:
      "Varoitus: tämä hakee uudelleen kaiken kortin välimuistiin tallentaman tiedon; Open-Meteon säätiedot, jokaisen muistissa olevan energiasarjan (tuotanto, verkko, akku, laitteet, irradianssi), tarkennetun ennusteen kalibroinnin ja OpenFreeMapin rakennusten ääriviivat, jokaiselle tällä sivulla avoinna olevalle Helios-kortille. Käytä sitä juuttuneen kalibroinnin tai vanhentuneen sää-/karttadatan tyhjentämiseen; täysi uudelleenhaku kestää muutaman minuutin HA-palvelimestasi riippuen. Tietojasi Home Assistantin sisällä ei koskaan kosketa.",
    resetCacheDone: "Välimuisti tyhjennetty ✓",
    resetOptionsButton: "Palauta asetukset oletuksiin",
    resetOptionsConfirm: "Vahvista napsauttamalla uudelleen",
    resetOptionsWarning:
      "Varoitus: tämä palauttaa KAIKKI tämän kortin asetukset oletusarvoihinsa; sirujen näkyvyyden, värit ja kuvakkeet, ryhmien nimet/värit/kuvakkeet, rakennukset, varjot, yksiköt ja kaikki muut asetukset. Home Assistant -tietosi ja Energia-kojelautasi säilyvät koskemattomina, mutta mukautuksesi pyyhkiytyvät eikä toimintoa voi perua.",
    resetOptionsDone: "Asetukset nollattu ✓",
    aboutSection: "Tietoja",
    aboutVersionLabel: "Versio",
    aboutRepoCard: "Helios",
    aboutCoffeeMessage:
      "Rakennan Heliosta yksin, enimmäkseen öisin, jahdaten pieniä yksityiskohtia, kunnes aurinko ja energiasi tuntuvat elävän ruudulla. Jos se on löytänyt paikkansa kojelaudaltasi, se tekee minut jo onnelliseksi; tähti GitHubissa vielä enemmän, ja kahvi pitää kaiken liikkeessä.",
    aboutDeveloperLabel: "Kehittäjä",
    aboutDeveloperLinkedIn: "LinkedIn",
    aboutCoffeeLink: "Osta minulle kahvi",
  },
};
