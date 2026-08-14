import type { Translations } from "../index";

//Slovak locale.
export const sk: Translations = {
  cardName: "Helios",
  cardDescription:
    "☀️ 2.5D pohľad na tvoj domov v reálnom čase so slnkom, počasím, solárnou výrobou, batériou a sieťou, plus vrhané tiene a interaktívna časová os",

  period: {
    rangeLabel: "Časový rozsah",
    forecast: "Predpoveď",
    yesterday: "Včera",
    today: "Dnes",
    week: "Týždeň",
    month: "Mesiac",
    year: "Rok",
  },

  compass: "S,SV,V,JV,J,JZ,Z,SZ",

  cloudCover: {
    cloudLow: "Nízka oblačnosť",
    cloudMid: "Stredná oblačnosť",
    cloudHigh: "Vysoká oblačnosť",
  },

  mapConfig: {
    section: "Nastavenie mapy",
    intro:
      "Podkladová mapa je vykreslená z vektorových dlaždíc OpenStreetMap. Auto sleduje tvoju tému, Dark / Light vynúti jednu z nich a Custom ti umožní nastaviť každú farbu a skryť ktorúkoľvek vrstvu.",
    modeAuto: "Auto",
    modeDark: "Tmavá",
    modeLight: "Svetlá",
    modeCustom: "Vlastná",
    land: "Pozadie",
    water: "Voda",
    wood: "Lesy",
    grass: "Zeleň",
    sand: "Piesok",
    wetland: "Mokrade",
    ice: "Ľad a sneh",
    landuse: "Zastavané územie",
    roadMajor: "Hlavné cesty",
    roadMinor: "Vedľajšie cesty",
    roadCasing: "Obrys ciest",
    path: "Chodníky a cestičky",
    rail: "Železnice",
    building: "Budovy",
    boundary: "Hranice",
  },

  editor: {
    weatherEnabled: "Poveternostné efekty",
    weatherEnabledHint:
      "Vykreslí skutočnú oblohu nad scénou: slnko, oblaky, dážď, sneh a búrky podľa vášho miestneho počasia, pričom sleduje časovú os pri jej posúvaní. Vypnuté zachová jasnú scénu.",
    temperatureEntity: "Senzor teploty",
    temperatureEntityHelp:
      "Voliteľné. Použite miestny senzor vonkajšej teploty (°C) namiesto hodnoty z Open-Meteo pre čip teploty. Jeho aktuálny stav a história z rekordéra sa použijú pre aktuálne + minulé; hodiny predpovede zostávajú na modeli.",
    humidityEntity: "Senzor vlhkosti",
    humidityEntityHelp:
      "Voliteľné. Použite miestny senzor relatívnej vlhkosti (%) namiesto hodnoty z Open-Meteo pre aktuálne + minulé.",
    cloudCoverEntity: "Senzor oblačnosti",
    cloudCoverEntityHelp:
      "Voliteľné. Použite miestny senzor oblačnosti (%) na riadenie odtieňa oblohy (slnko, sivnutie) namiesto hodnoty z Open-Meteo pre aktuálne + minulé.",
    precipitationEntity: "Senzor zrážok",
    precipitationEntityHelp:
      "Voliteľné. Použite miestny senzor zrážok (mm) na riadenie vrstvy dažďa namiesto hodnoty z Open-Meteo pre aktuálne + minulé.",
    snowfallEntity: "Senzor sneženia",
    snowfallEntityHelp:
      "Voliteľné. Použite miestny senzor sneženia (cm) na riadenie vrstvy snehu namiesto hodnoty z Open-Meteo pre aktuálne + minulé.",
    weatherEntity: "Entita počasia",
    weatherEntityHelp:
      "Voliteľné. Použite entitu počasia Home Assistant na riadenie podmienok (dážď / sneh / búrka) namiesto hodnoty z Open-Meteo pre aktuálne + minulé. Hodiny predpovede zostávajú na modeli.",
    chipTemperature: "Zobrazenie teploty",
    chipHumidity: "Zobrazenie vlhkosti",
    chipCost: "Zobrazenie nákladov",
    locationSection: "Poloha domova",
    homeLatitude: "Zemepisná šírka domova",
    homeLongitude: "Zemepisná dĺžka domova",
    locationHint:
      "Prepíše adresu domova použitú ako stred karty. Nechaj obe polia prázdne, aby sa použil domov nastavený v Home Assistant. Prepis sa použije len vtedy, keď sú OBE polia nastavené na platné súradnice.",
    uiAndMapSection: "UI",
    autoRotate: "Automatické otáčanie kamery",
    autoRotateHint:
      "Po niekoľkých sekundách nečinnosti kamera pomaly obieha okolo domova (približne 1.5°/s, opačne k zdanlivému pohybu slnka). Ťahanie jedným prstom ju okamžite pozastaví a obnoví sa, len čo prst zdvihneš. Na veľmi starých zariadeniach sa tomu vyhni: automatické otáčanie vynúti vykreslenie každú sekundu.",
    autoRotateOn: "Zapnuté",
    autoRotateOff: "Vypnuté",
    dataDisplaySection: "Zobrazenie údajov",
    maxExpectedPower: "Maximálny očakávaný výkon",
    maxExpectedPowerHelp:
      "Výkon, pri ktorom sa tok animuje plnou rýchlosťou. Každý tok je vztiahnutý k tejto jednej referencii, takže väčší tok vždy pôsobí rýchlejšie než menší, bez ohľadu na smer. Zvýš ho pri veľkej inštalácii, zníž pri malej. Predvolené 5000 W.",
    sunChipMode: "Zobrazenie čipu slnka",
    sunChipModeHelp:
      "Čo zobrazuje čip slnka: živé slnečné ožiarenie (predvolené) alebo polohu slnka (azimut a výšku). Poloha nepotrebuje senzor, pochádza z vlastných slnečných výpočtov karty.",
      batteryChipMode: "Údaj čipu batérie",
      batteryChipModeHelp: "Čo zobrazuje čip batérie: aktuálny výkon (predvolené) alebo stav nabitia (%). Prepne na hodnotu, ktorú batéria skutočne poskytuje.",
      batteryChipModePower: "Výkon",
      batteryChipModeSoc: "Stav nabitia",
    sunChipModeIrradiance: "Ožiarenie",
    sunChipModePosition: "Poloha slnka",
    displayUpdateFrequency: "Detail grafu",
    displayUpdateFrequencyHelp:
      "Koľko bodov za hodinu grafy vykreslia. Samotné údaje sú vždy 5-minútové štatistiky Home Assistant; toto riadi len to, ako husto je krivka vykreslená: 1 = jeden bod za hodinu (najhladšie, najľahšie na vykreslenie), 6 = jeden bod každých 10 minút (plný detail, najnáročnejšie). Predvolené 4 = bod každých 15 minút. Zníž to na starších alebo pomalších zariadeniach, aby si znížil náročnosť vykresľovania. Krivka predpovede sleduje rovnaký rytmus, takže jemnejšie nastavenie rozlíši aj krátke poklesy tieňom (strom zatieňujúci výrobu na pol hodiny), ktoré hodinová krivka preskočí.",
    valueDecimals: "Desatinné miesta",
    valueDecimalsHelp:
      "Počet desatinných miest zobrazených pri každej hodnote, aby čipy pôsobili jednotne. Platí pre hodnoty v kW (celé watty zostávajú celé čísla) a pre kWh. 0 až 3, predvolené 1.",
    powerUnit: "Jednotka výkonu",
    powerUnitHelp:
      "Jednotka pre každé zobrazenie výkonu na karte (čipy, popisy grafu). Energia ju tiež nasleduje, aby karta zostala konzistentná: kW sa páruje s kWh, W s Wh.",
    irradianceUnit: "Jednotka solárnej konštanty",
    irradianceUnitHelp:
      "Jednotka pre zobrazenie solárnej konštanty (ožiarenia) nad slnkom.",
    batterySign: "Znamienko batérie",
    batterySignHelp:
      "Znamienko zobrazené na čipe batérie. Predvolene je mínus pri nabíjaní a plus pri vybíjaní. Obrátené ich prehodí. Skryté zobrazí hodnotu bez znamienka.",
    batterySignDefault: "Predvolené",
    batterySignInverted: "Obrátené",
    batterySignHidden: "Skryté",
    noUiMode: "Režim bez rozhrania",
    noUiModeHint:
      "Po niekoľkých sekundách nečinnosti stlmí timeline a ovládacie prvky na karte. Akékoľvek ťuknutie alebo pohyb ich vráti späť. Skvelé pre nástennú obrazovku.",
    noUiDelay: "Doba nečinnosti pred skrytím",
    noUiDelayHint:
      "Počet sekúnd nečinnosti, po ktorých timeline a ovládacie prvky zmiznú v režime bez rozhrania. 0 udrží rozhranie skryté natrvalo. Použije sa len keď je režim bez rozhrania zapnutý.",
    showTimeline: "Zobraziť časovú os",
    showTimelineHint:
      "Zobrazí časovú os a výber obdobia pod scénou. Vypnuté ponechá len scénu.",
    showDetailPanel: "Zobraziť ďalšie informácie",
    showDetailPanelHint:
      "Povolí otvorenie mini-panela (súhrnné hodnoty) pre daný čip vpravo hore po ťuknutí naň. Vypnuté ho nikdy nezobrazí.",
    showSunTimes: "Zobraziť čas východu / západu slnka",
    showSunTimesHint:
      "Zobrazí časy východu a západu slnka a ich značky pri pätách slnečného oblúka.",
    showHorizonLine: "Zobraziť horizont terénu",
    showHorizonLineHint: "Vykreslí líniu horizontu terénu okolo domu, vypočítanú z miestneho reliéfu. Horizont vždy realisticky stlmí slnko za kopcami; toto iba zobrazí alebo skryje vykreslenú líniu.",
    horizonLineColor: "Farba horizontu terénu",
    horizonLineColorHint: "Farba línie horizontu terénu.",
    lockRotation: "Uzamknúť natočenie",
    lockRotationHint:
      "Potiahnutím v náhľade otočte a nakloňte scénu do požadovaného pohľadu a potom toto zapnite. Zámok tento pohľad zmrazí (otáčanie ťahaním a automatické otáčanie v pokoji sa vypnú) a uloží uhol do karty, takže úplne rovnaký pohľad sa zobrazí na každom zariadení a prehliadači. Vypnite ho pre opätovné voľné otáčanie.",
    chipsSection: "Zobrazenie entít",
    chipsIntro:
      "Zobraz alebo skry každú entitu a vyber jej ikonu a farbu. Domov nasleduje farbu vybraného čipu, prípadne tvoju primárnu farbu ako predvolenú.",
    chipIrradiance: "Zobrazenie ožiarenia",
    chipProduction: "Zobrazenie výroby",
    chipGrid: "Zobrazenie siete",
    chipBattery: "Zobrazenie batérie",
    chipHome: "Zobrazenie spotreby domácnosti",
    groupsConfigTitle: "Nastavenie skupín",
    optionalSensors: "Voliteľné senzory",
    solarIrradianceEntity: "Entita slnečného ožiarenia",
    solarIrradianceEntityHelp:
      "Vyber senzor hlásiaci globálne krátkovlnné ožiarenie vo W/m² (typicky Ecowitt / Davis / vlastná meteostanica). Po nastavení jeho aktuálny stav a história z rekordéra nahradia Open-Meteo pre živé aj minulé ožiarenie všade, kde sa objavuje (číslo na čipe slnka, os Y grafu FV, vyfarbenie slnečného oblúka). Hodiny predpovede zostávajú na Open-Meteo, pretože senzor nemôže niesť budúce hodnoty.",
    liveDataTitle: "Stav nastavenia",
    liveDataIntro:
      "Živé čipy zobrazujú iba namerané senzory. Každá rodina potrebuje voliteľný senzor okamžitého výkonu zo svojho zdroja v Energy dashboard; krivky a súčty vždy pochádzajú z tvojich meračov.",
    liveSolarOk: "Solár: senzor okamžitého výkonu bol nájdený.",
    liveSolarMissing:
      "Solár: chýba senzor okamžitého výkonu, čip výroby zostáva skrytý. Pridaj ho v Nastavenia > Dashboardy > Energia > Solárne panely.",
    liveSolarAbsent:
      "Solár: nie je nastavený v tvojom Energy dashboarde. Pridaj tam solárne panely, aby si získal čip výroby.",
    liveGridOk: "Sieť: senzor okamžitého výkonu bol nájdený.",
    liveGridMissing:
      "Sieť: chýba senzor okamžitého výkonu, čipy importu a exportu zostávajú skryté. Pridaj ho v Nastavenia > Dashboardy > Energia > Sieť.",
    liveGridMiswired:
      "Sieť: senzor okamžitého výkonu odporuje tvojim meračom (zdá sa, že meria len jeden smer). Čipy zostávajú skryté; nastav senzor so znamienkom alebo režim Dva senzory.",
    liveGridAbsent:
      "Sieť: nie je nastavená v tvojom Energy dashboarde. Pridaj tam sieť, aby si získal čipy importu a exportu.",
    liveBatteryOk:
      "Batéria: senzory okamžitého výkonu pokrývajú každú batériu.",
    liveBatteryMissing:
      "Batéria: aspoň jednej batérii chýba senzor okamžitého výkonu, čip výkonu zostáva skrytý. Pridaj senzor(y) výkonu v Nastavenia > Dashboardy > Energia > Batéria.",
    liveBatteryAbsent:
      "Batéria: nie je nastavená v tvojom Energy dashboarde. Pridaj tam batériu, aby si získal čip nabíjania a vybíjania.",
    liveHomeOk:
      "Spotreba domácnosti: zobrazená, odvodená z vyššie uvedených živých rodín.",
    liveHomeNote:
      "Spotreba domácnosti: zobrazí sa, keď každá nastavená rodina vyššie má svoj živý senzor.",
    openEnergyConfig: "Otvoriť nastavenie Energy",
    buildingsSection: "Domov a budovy",
    buildingsHint:
      'Aby karta zostala plynulá v husto zastavaných mestských oblastiach, v 3D sa vykresľujú iba budovy v nastavenom polomere okolo domova. Samotný domov zostáva v plnej nepriehľadnosti; okolité budovy sa vykresľujú s nastavenou priehľadnosťou, takže poskytujú mestský kontext bez toho, aby súperili s dátovými vrstvami. Polomer zoskupovania spája priľahlé prístavby (verandy, garáže, kôlne) do skupiny "domova".',
    displayRadius: "Polomer zobrazenia",
    displayRadiusHelp:
      "Polomer okolo domova, v ktorom sa budovy načítavajú a vykresľujú, až po okraj stlmeného disku mapy. Zníž ho, aby si odľahčil vykresľovanie na pomalom zariadení; 0 zobrazí len domov.",
    buildingCount: "Počet budov",
    buildingCountHelp:
      "Maximálny počet okolitých budov na vykreslenie. Zníž ho, aby si odľahčil vykresľovanie na pomalom zariadení.",
    buildingRealSize: "Skutočné výšky budov",
    buildingRealSizeOn: "Zapnuté",
    buildingRealSizeOff: "Vypnuté",
    buildingRealSizeHint:
      "Zapnuté: použi skutočné výšky z OpenStreetMap (obmedzené, aby kompozícia zostala čitateľná). Vypnuté: daj každej budove rovnakú pevnú výšku nižšie.",
    buildingHeight: "Výška budovy",
    hiddenDevicesEmpty:
      "V tvojom Energy dashboarde zatiaľ nie sú sledované žiadne jednotlivé zariadenia. Pridaj tam spotrebu zariadení, aby si ich mohol ovládať tu.",
    deviceVisibilityLabel: "Zobraziť zariadenie",
    group: "Skupina",
    noGroup: "Bez skupiny",
    groupAssignHint:
      "Presuňte svoje zariadenia do skupiny. Čo zostane dole, nepatrí do žiadnej skupiny.",
    groupDropHere: "Sem presuňte zariadenie",
    backToLive: "Späť na naživo",
    buildingClusterRadius: "Polomer zoskupovania domova",
    buildingClusterRadiusHelp:
      "Polomer okolo domova, v ktorom sa priľahlé prístavby (verandy, garáže, kôlne) považujú za súčasť domova: vykreslia sa v plnej nepriehľadnosti a farbe domova namiesto stlmených susedov. 0 ponechá iba hlavnú budovu.",
    buildingOpacity: "Priehľadnosť okolia",
    buildingColor: "Farba budov",
    buildingColorHelp: "Základný odtieň použitý na okolité budovy v scéne.",
    shadowsSection: "Tiene",
    shadowsEnabled: "Zobraziť tiene",
    shadowsEnabledOn: "Zobrazené",
    shadowsEnabledOff: "Skryté",
    shadowsEnabledHint:
      "Prepína tiene vrhané budovami na zem, ako sa slnko pohybuje.",
    shadowOpacity: "Priehľadnosť tieňov",
    shadowOpacityHint: "Priehľadnosť vrhaných tieňov na zemi.",
    resetSection: "Reset",
    resetSectionHint:
      "Údržbové nástroje: znovu načítaj uložené údaje karty alebo resetuj všetky nastavenia na predvolené hodnoty.",
    resetCacheButton: "Resetovať vyrovnávaciu pamäť údajov",
    resetCacheWarning:
      "Upozornenie: toto znovu načíta všetko, čo má karta uložené vo vyrovnávacej pamäti - počasie Open-Meteo, každú energetickú sériu v pamäti (výroba, sieť, batéria, zariadenia, ožiarenie), kalibráciu spresnenej predpovede a pôdorysy budov z OpenFreeMap - pre každú kartu Helios otvorenú na tejto stránke. Použi to na vymazanie zaseknutej kalibrácie alebo zastaraných údajov o počasí/mape; úplné znovunačítanie trvá pár minút podľa tvojho HA servera. Tvojich údajov vnútri Home Assistant sa to nikdy nedotkne.",
    resetCacheDone: "Vyrovnávacia pamäť vymazaná ✓",
    resetOptionsButton: "Resetovať nastavenia na predvolené",
    resetOptionsConfirm: "Klikni znova pre potvrdenie",
    resetOptionsWarning:
      "Upozornenie: toto resetuje VŠETKY nastavenia tejto karty na predvolené hodnoty - viditeľnosť čipov, farby a ikony, názvy/farby/ikony skupín, budovy, tiene, jednotky a všetky ostatné nastavenia. Tvoje údaje v Home Assistant a Energy dashboarde zostanú nedotknuté, ale tvoje prispôsobenie sa vymaže a nedá sa vrátiť späť.",
    resetOptionsDone: "Nastavenia resetované ✓",
    aboutSection: "O karte",
    aboutVersionLabel: "Verzia",
    aboutRepoCard: "Helios",
    aboutCoffeeMessage:
      "Helios vytvára jeden zanietený vývojár, s veľkou energiou a veľmi málom spánku. Ak sa ti moja práca páči, malá hviezdička na GitHub mi už veľmi pomáha, a ak môžeš, malá káva drží projekt nažive.",
    aboutDeveloperLabel: "Vývojár",
    aboutDeveloperLinkedIn: "LinkedIn",
    aboutCoffeeLink: "Kúp mi kávu",
  },
};
