import type { Translations } from "../index";

//Czech locale.
export const cs: Translations = {
  cardName: "Helios",
  cardDescription:
    "☀️ 2.5D pohled na tvůj domov v reálném čase se sluncem, počasím, solární výrobou, baterií a sítí, plus vržené stíny a interaktivní časová osa",

  period: {
    rangeLabel: "Časový rozsah",
    forecast: "Předpověď",
    yesterday: "Včera",
    today: "Dnes",
    week: "Týden",
    month: "Měsíc",
    year: "Rok",
  },

  cloudCover: {
    cloudLow: "Nízká oblačnost",
    cloudMid: "Střední oblačnost",
    cloudHigh: "Vysoká oblačnost",
  },

  mapConfig: {
    section: "Nastavení mapy",
    intro:
      "Podkladová mapa se vykresluje z vektorových dlaždic OpenStreetMap. Auto sleduje tvůj motiv, Tmavý / Světlý vynutí jeden z nich a Vlastní ti umožní nastavit každou barvu a skrýt libovolnou vrstvu.",
    modeAuto: "Auto",
    modeDark: "Tmavý",
    modeLight: "Světlý",
    modeCustom: "Vlastní",
    land: "Pozadí",
    water: "Voda",
    wood: "Les",
    grass: "Zeleň",
    sand: "Písek",
    wetland: "Mokřad",
    ice: "Led a sníh",
    landuse: "Zastavěné území",
    roadMajor: "Hlavní silnice",
    roadMinor: "Vedlejší silnice",
    roadCasing: "Obrys silnic",
    path: "Stezky a cesty",
    rail: "Železnice",
    building: "Budovy",
    boundary: "Hranice",
  },

  editor: {
    locationSection: "Poloha domova",
    homeLatitude: "Zeměpisná šířka domova",
    homeLongitude: "Zeměpisná délka domova",
    locationHint:
      "Přepíše adresu domova použitou jako střed karty. Nech obě pole prázdná, aby se použil domov nastavený v Home Assistant. Přepis se použije pouze tehdy, když jsou OBĚ pole nastavena na platné souřadnice.",
    uiAndMapSection: "UI",
    autoRotate: "Automatické otáčení kamery",
    autoRotateHint:
      "Po několika sekundách nečinnosti kamera pomalu obíhá kolem domova (přibližně 1.5°/s, opačně k zdánlivému pohybu slunce). Tažení jedním prstem ji okamžitě pozastaví a obnoví se, jakmile prst zvedneš. Na velmi starých zařízeních se tomu vyhni: automatické otáčení vynutí vykreslení každou sekundu.",
    autoRotateOn: "Zapnuto",
    autoRotateOff: "Vypnuto",
    dataDisplaySection: "Zobrazení dat",
    displayUpdateFrequency: "Detail grafu",
    displayUpdateFrequencyHelp:
      "Kolik bodů za hodinu grafy vykreslí. Samotná data jsou vždy 5minutové statistiky Home Assistant; tohle řídí jen to, jak hustě je křivka vykreslena: 1 = jeden bod za hodinu (nejhladší, nejlehčí na vykreslení), 6 = jeden bod každých 10 minut (plný detail, nejnáročnější). Výchozí 4 = bod každých 15 minut. Sniž to na starších nebo pomalejších zařízeních, abys snížil náročnost vykreslování. Křivka předpovědi sleduje stejný rytmus, takže jemnější nastavení rozliší i krátké poklesy stínem (strom zastiňující výrobu na půl hodiny), které hodinová křivka přeskočí.",
    valueDecimals: "Desetinná místa",
    valueDecimalsHelp:
      "Počet desetinných míst zobrazených u každé hodnoty, aby čipy vypadaly jednotně. Platí pro hodnoty v kW (celé watty zůstávají celočíselné) a pro kWh. 0 až 3, výchozí 1.",
    powerUnit: "Jednotka výkonu",
    powerUnitHelp:
      "Jednotka pro každý údaj výkonu na kartě (čipy, popisky grafu). Energie ji také následuje, takže karta zůstává konzistentní: kW se pojí s kWh, W s Wh.",
    irradianceUnit: "Jednotka sluneční konstanty",
    irradianceUnitHelp:
      "Jednotka pro údaj sluneční konstanty (ozáření) nad sluncem.",
    batterySign: "Znaménko baterie",
    batterySignHelp:
      "Znaménko zobrazené na čipu baterie. Výchozí je mínus při nabíjení a plus při vybíjení. Obrácené jej převrátí. Skryté zobrazí hodnotu bez znaménka.",
    batterySignDefault: "Výchozí",
    batterySignInverted: "Obrácené",
    batterySignHidden: "Skryté",
    noUiMode: "Režim bez rozhraní",
    noUiModeHint:
      "Ztlumí časovou osu a ovládací prvky na kartě po několika sekundách nečinnosti. Jakékoli klepnutí nebo pohyb je vrátí zpět. Skvělé pro nástěnný displej.",
    noUiDelay: "Prodleva nečinnosti před skrytím",
    noUiDelayHint:
      "Počet sekund nečinnosti, po kterých se v režimu bez rozhraní ztlumí časová osa a ovládací prvky. 0 udrží rozhraní skryté trvale. Používá se pouze, když je režim bez rozhraní zapnutý.",
    showTimeline: "Zobrazit časovou osu",
    showTimelineHint:
      "Zobrazí časovou osu a výběr období pod scénou. Vypnuto ponechá pouze scénu.",
    showDetailPanel: "Zobrazit doplňující informace",
    showDetailPanelHint:
      "Povolí otevření mini-panelu s podrobnostmi (souhrnné hodnoty) vpravo nahoře po klepnutí na čip. Vypnuto jej nikdy nezobrazí.",
    showSunTimes: "Zobrazit časy východu a západu slunce",
    showSunTimesHint:
      "Zobrazí časy východu a západu slunce a jejich značky u paty slunečního oblouku.",
    lockRotation: "Zamknout otočení",
    lockRotationHint:
      "Nastav úhel pohledu přímo v náhledu (tažením otočíš a nakloníš scénu) a poté zamkni, abys ho zafixoval: tažení pro otočení i automatické otáčení při nečinnosti se vypnou a zůstane nastavený úhel.",
    chipsSection: "Zobrazení entit",
    chipsIntro:
      "Zobraz nebo skryj každou entitu a vyber jí ikonu a barvu. Domov přebírá barvu vybraného čipu, jinak se použije tvá primární barva.",
    chipIrradiance: "Zobrazení ozáření",
    chipProduction: "Zobrazení výroby",
    chipGrid: "Zobrazení sítě",
    chipBattery: "Zobrazení baterie",
    chipHome: "Zobrazení spotřeby domácnosti",
    groupsConfigTitle: "Nastavení skupin",
    optionalSensors: "Volitelné senzory",
    solarIrradianceEntity: "Entita slunečního ozáření",
    solarIrradianceEntityHelp:
      "Vyber senzor hlásící globální krátkovlnné ozáření ve W/m² (typicky Ecowitt / Davis / vlastní meteostanice). Po nastavení jeho aktuální stav a historie z rekordéru nahradí Open-Meteo pro živé i minulé ozáření všude, kde se objevuje (číslo na čipu slunce, osa Y grafu FV, vybarvení slunečního oblouku). Hodiny předpovědi zůstávají na Open-Meteo, protože senzor nemůže nést budoucí hodnoty.",
    liveDataTitle: "Stav nastavení",
    liveDataIntro:
      "Živé čipy zobrazují pouze naměřené senzory. Každá rodina potřebuje volitelný senzor okamžitého výkonu ze svého zdroje v energetickém přehledu; křivky a součty vždy vycházejí z tvých měřičů.",
    liveSolarOk: "Solár: senzor okamžitého výkonu nalezen.",
    liveSolarMissing:
      "Solár: chybí senzor okamžitého výkonu, čip výroby zůstává skrytý. Přidej ho v Nastavení > Přehledy > Energie > Solární panely.",
    liveSolarAbsent:
      "Solár: v tvém energetickém přehledu není nastaven. Přidej tam solární panely, abys získal čip výroby.",
    liveGridOk: "Síť: senzor okamžitého výkonu nalezen.",
    liveGridMissing:
      "Síť: chybí senzor okamžitého výkonu, čipy dovozu a vývozu zůstávají skryté. Přidej ho v Nastavení > Přehledy > Energie > Síť.",
    liveGridMiswired:
      "Síť: senzor okamžitého výkonu si odporuje s tvými měřiči (zdá se, že měří jen jeden směr). Čipy zůstávají skryté; nastav senzor se znaménkem nebo režim Dva senzory.",
    liveGridAbsent:
      "Síť: v tvém energetickém přehledu není nastavena. Přidej tam síť, abys získal čipy dovozu a vývozu.",
    liveBatteryOk:
      "Baterie: senzory okamžitého výkonu pokrývají každou baterii.",
    liveBatteryMissing:
      "Baterie: alespoň jedné baterii chybí senzor okamžitého výkonu, čip výkonu zůstává skrytý. Přidej senzor(y) výkonu v Nastavení > Přehledy > Energie > Baterie.",
    liveBatteryAbsent:
      "Baterie: v tvém energetickém přehledu není nastavena. Přidej tam baterii, abys získal čip nabíjení a vybíjení.",
    liveHomeOk:
      "Spotřeba domácnosti: zobrazena, odvozena z výše uvedených živých rodin.",
    liveHomeNote:
      "Spotřeba domácnosti: objeví se, jakmile má každá výše nastavená rodina svůj živý senzor.",
    openEnergyConfig: "Otevřít nastavení energie",
    buildingsSection: "Domov a budovy",
    buildingsHint:
      'Aby karta zůstala plynulá v hustě zastavěných městských oblastech, ve 3D se vykreslují pouze budovy v nastaveném poloměru kolem domova. Samotný domov zůstává v plné neprůhlednosti; okolní budovy se vykreslují s nastavenou průhledností, takže poskytují městský kontext, aniž by soupeřily s datovými vrstvami. Poloměr shlukování seskupuje přilehlé přístavby (verandy, garáže, kůlny) do skupiny "domova".',
    displayRadius: "Poloměr zobrazení",
    displayRadiusHelp:
      "Poloměr kolem domova, ve kterém se budovy načítají a vykreslují, až k okraji ztlumeného disku mapy. Sniž ho, abys odlehčil vykreslování na pomalém zařízení; 0 zobrazí jen domov.",
    buildingCount: "Počet budov",
    buildingCountHelp:
      "Maximální počet okolních budov k vykreslení. Sniž ho, abys odlehčil vykreslování na pomalém zařízení.",
    buildingRealSize: "Skutečné výšky budov",
    buildingRealSizeOn: "Zapnuto",
    buildingRealSizeOff: "Vypnuto",
    buildingRealSizeHint:
      "Zapnuto: použij skutečné výšky z OpenStreetMap (omezené, aby kompozice zůstala čitelná). Vypnuto: dej každé budově stejnou pevnou výšku níže.",
    buildingHeight: "Výška budovy",
    hiddenDevicesEmpty:
      "V tvém energetickém přehledu zatím nejsou sledovány žádná jednotlivá zařízení. Přidej tam spotřebu zařízení, abys je mohl ovládat zde.",
    deviceVisibilityLabel: "Zobrazit zařízení",
    deviceGroupLabel: "Sledovací skupina",
    group: "Skupina",
    noGroup: "Bez skupiny",
    groupAssignHint:
      "Přetáhněte svá zařízení do skupiny. Co zůstane dole, nepatří do žádné skupiny.",
    groupDropHere: "Sem přetáhněte zařízení",
    backToLive: "Zpět na živě",
    devicesEnergyNote:
      "Toto jsou jednotlivá zařízení aktuálně nastavená v tvém energetickém přehledu Home Assistant. Oko zobrazí nebo skryje každé z nich všude a pilulka jej zařadí do skupiny.",
    buildingClusterRadius: "Poloměr shlukování domova",
    buildingClusterRadiusHelp:
      "Poloměr kolem domova, ve kterém jsou přilehlé přístavby (verandy, garáže, kůlny) považovány za součást domova: vykreslí se v plné neprůhlednosti a barvě domova místo jako ztlumení sousedé. 0 ponechá pouze hlavní budovu.",
    buildingOpacity: "Průhlednost okolí",
    buildingColor: "Barva budov",
    buildingColorHelp: "Základní odstín použitý na okolní budovy ve scéně.",
    shadowsSection: "Stíny",
    shadowsEnabled: "Zobrazit stíny",
    shadowsEnabledOn: "Zobrazeno",
    shadowsEnabledOff: "Skryto",
    shadowsEnabledHint:
      "Přepíná stíny vržené budovami na zem, jak se slunce pohybuje.",
    shadowOpacity: "Průhlednost stínů",
    shadowOpacityHint: "Průhlednost vržených stínů na zemi.",
    resetSection: "Reset",
    resetSectionHint:
      "Údržbové nástroje: znovu načíst data uložená kartou v mezipaměti nebo resetovat všechny volby na výchozí hodnoty.",
    resetCacheButton: "Resetovat mezipaměť dat",
    resetCacheWarning:
      "Upozornění: tohle znovu načte vše, co karta ukládá do mezipaměti; počasí z Open-Meteo, každou energetickou řadu v paměti (výroba, síť, baterie, zařízení, ozáření), kalibraci zpřesněné předpovědi a půdorysy budov z OpenFreeMap, a to pro každou kartu Helios otevřenou na této stránce. Použij to k vymazání zaseknuté kalibrace nebo zastaralých dat počasí či mapy; úplné znovunačtení trvá pár minut podle tvého HA serveru. Tvých dat uvnitř Home Assistant se to nikdy nedotkne.",
    resetCacheDone: "Mezipaměť vymazána ✓",
    resetOptionsButton: "Obnovit výchozí nastavení voleb",
    resetOptionsConfirm: "Klikni znovu pro potvrzení",
    resetOptionsWarning:
      "Upozornění: tohle resetuje VŠECHNY volby této karty na výchozí hodnoty; viditelnost čipů, barvy a ikony, názvy/barvy/ikony skupin, budovy, stíny, jednotky a všechna ostatní nastavení. Tvá data v Home Assistant a energetický přehled zůstanou nedotčené, ale tvé přizpůsobení bude vymazáno a nelze jej vrátit zpět.",
    resetOptionsDone: "Volby obnoveny ✓",
    aboutSection: "O kartě",
    aboutVersionLabel: "Verze",
    aboutRepoCard: "Helios",
    aboutCoffeeMessage:
      "Helios vytváří jeden zapálený vývojář, s velkou energií a velmi malým spánkem. Pokud se ti moje práce líbí, malá hvězdička na GitHub mi už hodně pomáhá, a pokud můžeš, malá káva drží projekt naživu.",
    aboutDeveloperLabel: "Vývojář",
    aboutDeveloperLinkedIn: "LinkedIn",
    aboutCoffeeLink: "Kup mi kávu",
  },
};
