import type { Translations } from "../index";

//Croatian locale.
export const hr: Translations = {
  cardName: "Helios",
  cardDescription:
    "☀️ 2.5D prikaz tvog doma u stvarnom vremenu sa suncem, vremenom, solarnom proizvodnjom, baterijom i mrežom, plus bačene sjene i interaktivna vremenska traka",

  period: {
    rangeLabel: "Vremenski raspon",
    forecast: "Prognoza",
    yesterday: "Jučer",
    today: "Danas",
    week: "Tjedan",
    month: "Mjesec",
    year: "Godina",
  },

  compass: "S,SI,I,JI,J,JZ,Z,SZ",

  cloudCover: {
    cloudLow: "Niska naoblaka",
    cloudMid: "Srednja naoblaka",
    cloudHigh: "Visoka naoblaka",
  },

  mapConfig: {
    section: "Konfiguracija karte",
    intro:
      "Osnovna karta izrađena je od vektorskih pločica OpenStreetMap. Auto prati tvoju temu, Dark / Light je prisiljavaju, a Custom ti omogućuje da postaviš svaku boju i sakriješ bilo koji sloj.",
    modeAuto: "Auto",
    modeDark: "Tamna",
    modeLight: "Svijetla",
    modeCustom: "Prilagođeno",
    land: "Pozadina",
    water: "Voda",
    wood: "Šuma",
    grass: "Zelenilo",
    sand: "Pijesak",
    wetland: "Močvara",
    ice: "Led i snijeg",
    landuse: "Izgrađeno zemljište",
    roadMajor: "Glavne ceste",
    roadMinor: "Sporedne ceste",
    roadCasing: "Obrub ceste",
    path: "Staze i putevi",
    rail: "Željeznice",
    building: "Zgrade",
    boundary: "Granice",
  },

  editor: {
    weatherEnabled: "Vremenski efekti",
    weatherEnabledHint:
      "Iscrtava stvarno nebo nad scenom: sunce, oblake, kišu, snijeg i grmljavinu prema vašem lokalnom vremenu, prateći vremensku crtu dok je pomičete. Isključeno zadržava vedru scenu.",
    temperatureEntity: "Senzor temperature",
    temperatureEntityHelp:
      "Neobavezno. Koristite lokalni senzor vanjske temperature (°C) umjesto vrijednosti Open-Meteo za pločicu temperature. Njegovo trenutno stanje i povijest snimača koriste se za sadašnjost i prošlost; sati prognoze ostaju na modelu.",
    humidityEntity: "Senzor vlažnosti",
    humidityEntityHelp:
      "Neobavezno. Koristite lokalni senzor relativne vlažnosti (%) umjesto vrijednosti Open-Meteo, za sadašnjost i prošlost.",
    cloudCoverEntity: "Senzor naoblake",
    cloudCoverEntityHelp:
      "Neobavezno. Koristite lokalni senzor naoblake (%) za upravljanje izgledom neba (sunce, sivilo) umjesto vrijednosti Open-Meteo, za sadašnjost i prošlost.",
    precipitationEntity: "Senzor oborina",
    precipitationEntityHelp:
      "Neobavezno. Koristite lokalni senzor oborina (mm) za upravljanje slojem kiše umjesto vrijednosti Open-Meteo, za sadašnjost i prošlost.",
    snowfallEntity: "Senzor snježnih padalina",
    snowfallEntityHelp:
      "Neobavezno. Koristite lokalni senzor snježnih padalina (cm) za upravljanje slojem snijega umjesto vrijednosti Open-Meteo, za sadašnjost i prošlost.",
    weatherEntity: "Entitet vremena",
    weatherEntityHelp:
      "Neobavezno. Koristite Home Assistant entitet vremena za upravljanje uvjetima (kiša / snijeg / grmljavina) umjesto vrijednosti Open-Meteo, za sadašnjost i prošlost. Sati prognoze ostaju na modelu.",
    chipTemperature: "Prikaz temperature",
    chipHumidity: "Prikaz vlažnosti",
    chipCost: "Prikaz troška",
    locationSection: "Lokacija doma",
    homeLatitude: "Zemljopisna širina doma",
    homeLongitude: "Zemljopisna dužina doma",
    locationHint:
      "Zamjenjuje adresu doma koja se koristi kao središte kartice. Ostavi oba polja prazna da bi se koristio dom postavljen u Home Assistant. Zamjena se primjenjuje samo kada su OBA polja postavljena na valjane koordinate.",
    uiAndMapSection: "UI",
    autoRotate: "Automatska rotacija kamere",
    autoRotateHint:
      "Nakon nekoliko sekundi mirovanja kamera polako kruži oko doma (oko 1,5°/s, suprotno prividnom kretanju sunca). Povlačenje jednim prstom je odmah zaustavlja, a nastavlja se čim pustiš. Izbjegavaj na vrlo starim uređajima: automatska rotacija svaku sekundu prisiljava iscrtavanje.",
    autoRotateOn: "Uključeno",
    autoRotateOff: "Isključeno",
    degradedRender: "Prikaz u načinu kompatibilnosti",
    degradedRenderHint:
      "Kartu iscrtava jednostavnijom i kompatibilnijom metodom. Uključite ako scena treperi ili se kida dok je okrećete ili pomičete. Ispravlja grešku na nekim telefonima i tabletima, uz nešto manje glatko kretanje.",
    dataDisplaySection: "Prikaz podataka",
    maxExpectedPower: "Najveća očekivana snaga",
    maxExpectedPowerHelp:
      "Snaga pri kojoj se tok animira punom brzinom. Svaki tok mjeri se prema toj jednoj referenci, pa se veći tok uvijek doima bržim od manjeg, u kojem god smjeru tekao. Povećaj je za veliku instalaciju, smanji za malu. Zadano 5000 W.",
    sunChipMode: "Očitanje čipa sunca",
    sunChipModeHelp:
      "Što čip sunca prikazuje: solarno ozračenje uživo (zadano) ili položaj sunca (azimut i visina). Položaj ne treba senzor, dolazi iz vlastitih sunčevih izračuna kartice.",
      batteryChipMode: "Prikaz čipa baterije",
      batteryChipModeHelp: "Što prikazuje čip baterije: trenutnu snagu (zadano) ili stanje napunjenosti (%). Vraća se na vrijednost koju baterija stvarno pruža.",
      batteryChipModePower: "Snaga",
      batteryChipModeSoc: "Stanje napunjenosti",
    sunChipModeIrradiance: "Ozračenje",
    sunChipModePosition: "Položaj sunca",
    displayUpdateFrequency: "Detalji grafa",
    displayUpdateFrequencyHelp:
      "Koliko točaka po satu grafovi iscrtavaju. Sami podaci su uvijek 5-minutne statistike Home Assistant; ovo kontrolira samo koliko gusto se crta krivulja: 1 = jedna točka po satu (najglađe, najlakše za iscrtavanje), 6 = jedna točka svakih 10 minuta (puni detalj, najteže). Zadano 4 = točka svakih 15 minuta. Smanji na starijim ili sporijim uređajima da smanjiš trošak iscrtavanja. Krivulja prognoze prati isti ritam, pa finija postavka razlučuje i kratke padove zbog sjene (stablo koje na pola sata zaklanja proizvodnju) koje satna krivulja preskoči.",
    valueDecimals: "Decimalna mjesta",
    valueDecimalsHelp:
      "Broj decimalnih mjesta prikazanih uz svaku vrijednost, da čipovi izgledaju ujednačeno. Odnosi se na vrijednosti u kW (cijeli vati ostaju bez decimala) i na kWh. 0 do 3, zadano 1.",
    powerUnit: "Jedinica snage",
    powerUnitHelp:
      "Jedinica za svako očitanje snage na kartici (čipovi, opisi u grafu). Energija je slijedi, pa kartica ostaje dosljedna: kW ide uz kWh, W uz Wh.",
    irradianceUnit: "Jedinica solarne konstante",
    irradianceUnitHelp:
      "Jedinica za očitanje solarne konstante (ozračenja) iznad sunca.",
    batterySign: "Predznak baterije",
    batterySignHelp:
      "Predznak prikazan na čipu baterije. Zadano je minus tijekom punjenja i plus tijekom pražnjenja. Obrnuto ga preokreće. Skriveno prikazuje vrijednost bez predznaka.",
    batterySignDefault: "Zadano",
    batterySignInverted: "Obrnuto",
    batterySignHidden: "Skriveno",
    noUiMode: "Način bez sučelja",
    noUiModeHint:
      "Zatamnjuje vremensku traku i kontrole na kartici nakon nekoliko sekundi neaktivnosti. Bilo koji dodir ili pomak vraća ih natrag. Sjajno za zidni prikaz.",
    noUiDelay: "Odgoda mirovanja prije skrivanja",
    noUiDelayHint:
      "Sekunde neaktivnosti prije nego što vremenska traka i kontrole nestanu u načinu bez sučelja. 0 trajno skriva sučelje. Koristi se samo kada je uključen način bez sučelja.",
    showTimeline: "Prikaži vremensku traku",
    showTimelineHint:
      "Prikazuje vremensku traku i birač razdoblja ispod scene. Isključeno ostavlja samo scenu.",
    showDetailPanel: "Prikaži dodatne informacije",
    showDetailPanelHint:
      "Omogućuje da se mini-panel za svaki čip (zbirni podaci) otvori gore desno kada se čip dodirne. Isključeno ga nikad ne prikazuje.",
    showSunTimes: "Prikaži vrijeme izlaska / zalaska sunca",
    showSunTimesHint:
      "Prikazuje vrijeme izlaska i zalaska sunca te njihove oznake u podnožju sunčevog luka.",
    showHorizonLine: "Prikaži horizont terena",
    showHorizonLineHint: "Crta liniju horizonta reljefa oko doma, izračunatu iz lokalnog terena. Horizont uvijek realistično prigušuje sunce iza brežuljaka; ovo samo prikazuje ili skriva nacrtanu liniju.",
    horizonLineColor: "Boja horizonta terena",
    horizonLineColorHint: "Boja linije horizonta terena.",
    lockRotation: "Zaključaj rotaciju",
    lockRotationHint:
      "Povucite pregled da biste zakrenuli i nagnuli scenu na željeni prikaz, a zatim uključite ovo. Zaključavanje zamrzava taj prikaz (zakretanje povlačenjem i automatsko okretanje u mirovanju se isključuju) i sprema kut u karticu, tako da se potpuno isti prikaz pojavljuje na svakom uređaju i pregledniku. Isključite ga za ponovno slobodno zakretanje.",
    chipsSection: "Prikaz entiteta",
    chipsIntro:
      "Prikaži ili sakrij svaki entitet te odaberi njegovu ikonu i boju. Dom prati odabrani čip, ili tvoju primarnu boju po zadanome.",
    chipIrradiance: "Prikaz ozračenja",
    chipProduction: "Prikaz proizvodnje",
    chipGrid: "Prikaz mreže",
    chipBattery: "Prikaz baterije",
    chipHome: "Prikaz potrošnje doma",
    groupsConfigTitle: "Konfiguracija skupina",
    optionalSensors: "Neobavezni senzori",
    solarIrradianceEntity: "Entitet sunčevog ozračenja",
    solarIrradianceEntityHelp:
      "Odaberi senzor koji javlja globalno kratkovalno ozračenje u W/m² (tipično Ecowitt / Davis / osobna meteorološka postaja). Kada je postavljen, njegovo trenutno stanje i povijest iz snimača zamjenjuju Open-Meteo za uživo i prošlo ozračenje svugdje gdje se pojavljuje (broj na čipu sunca, os Y grafa PV, bojanje sunčevog luka). Sati prognoze ostaju na Open-Meteo jer senzor ne može nositi buduće vrijednosti.",
    liveDataTitle: "Status konfiguracije",
    liveDataIntro:
      "Čipovi uživo prikazuju samo izmjerene senzore. Svaka obitelj treba neobavezni senzor snage uživo svog izvora u energetskoj nadzornoj ploči; krivulje i zbrojevi uvijek dolaze iz tvojih brojila.",
    liveSolarOk: "Solarno: senzor snage uživo otkriven.",
    liveSolarMissing:
      "Solarno: nema senzora snage uživo, čip proizvodnje ostaje skriven. Dodaj ga pod Postavke > Nadzorne ploče > Energija > Solarni paneli.",
    liveSolarAbsent:
      "Solarno: nije postavljeno u tvojoj energetskoj nadzornoj ploči. Dodaj tamo solarne panele da dobiješ čip proizvodnje.",
    liveGridOk: "Mreža: senzor snage uživo otkriven.",
    liveGridMissing:
      "Mreža: nema senzora snage uživo, čipovi uvoza/izvoza ostaju skriveni. Dodaj ga pod Postavke > Nadzorne ploče > Energija > Mreža.",
    liveGridMiswired:
      "Mreža: senzor snage uživo proturječi tvojim brojilima (čini se da mjeri samo jedan smjer). Čipovi ostaju skriveni; postavi senzor s predznakom ili način Dva senzora.",
    liveGridAbsent:
      "Mreža: nije postavljena u tvojoj energetskoj nadzornoj ploči. Dodaj tamo mrežu da dobiješ čipove uvoza i izvoza.",
    liveBatteryOk: "Baterija: senzori snage uživo pokrivaju svaku bateriju.",
    liveBatteryMissing:
      "Baterija: nedostaje snaga uživo za barem jednu bateriju, čip snage ostaje skriven. Dodaj senzor(e) snage pod Postavke > Nadzorne ploče > Energija > Baterija.",
    liveBatteryAbsent:
      "Baterija: nije postavljena u tvojoj energetskoj nadzornoj ploči. Dodaj tamo bateriju da dobiješ čip punjenja i pražnjenja.",
    liveHomeOk:
      "Potrošnja doma: prikazana, izvedena iz gornjih obitelji uživo.",
    liveHomeNote:
      "Potrošnja doma pojavljuje se čim svaka gore konfigurirana obitelj ima svoj senzor uživo.",
    openEnergyConfig: "Otvori konfiguraciju energije",
    buildingsSection: "Dom i zgrade",
    buildingsHint:
      'Da bi kartica ostala glatka u gusto izgrađenim urbanim područjima, u 3D se iscrtavaju samo zgrade unutar postavljenog radijusa oko doma. Sam dom ostaje u punoj neprozirnosti; obližnje zgrade iscrtavaju se s postavljenom prozirnošću, tako da daju urbani kontekst bez natjecanja s podatkovnim slojevima. Radijus grupiranja okuplja prislonjene pomoćne zgrade (verande, garaže, šupe) u skupinu "doma".',
    displayRadius: "Radijus prikaza",
    displayRadiusHelp:
      "Radijus oko doma u kojem se zgrade dohvaćaju i crtaju, sve do ruba izblijedjelog diska karte. Smanji ga da olakšaš iscrtavanje na sporom uređaju; 0 prikazuje samo dom.",
    buildingCount: "Broj zgrada",
    buildingCountHelp:
      "Najveći broj obližnjih zgrada za iscrtavanje. Smanji ga da olakšaš iscrtavanje na sporom uređaju.",
    buildingRealSize: "Stvarne visine zgrada",
    buildingRealSizeOn: "Uključeno",
    buildingRealSizeOff: "Isključeno",
    buildingRealSizeHint:
      "Uključeno: koristi stvarne visine iz OpenStreetMap (ograničene da kadar ostane čitljiv). Isključeno: daj svakoj zgradi istu fiksnu visinu ispod.",
    buildingHeight: "Visina zgrade",
    hiddenDevicesEmpty:
      "U tvojoj energetskoj nadzornoj ploči još nije praćen nijedan pojedinačni uređaj. Dodaj tamo potrošnju uređaja da bi ih ovdje mogao kontrolirati.",
    deviceVisibilityLabel: "Prikaži uređaj",
    group: "Skupina",
    noGroup: "Bez skupine",
    groupAssignHint:
      "Povucite svoje uređaje u grupu. Ono što ostane ispod ne pripada nijednoj grupi.",
    groupDropHere: "Ovdje ispustite uređaj",
    backToLive: "Natrag na uživo",
    buildingClusterRadius: "Radijus grupiranja doma",
    buildingClusterRadiusHelp:
      "Radijus oko doma unutar kojeg se prislonjene pomoćne zgrade (verande, garaže, šupe) tretiraju kao dio doma: iscrtavaju se s punom neprozirnošću i bojom doma umjesto kao izblijedjeli susjedi. 0 zadržava samo glavnu zgradu.",
    buildingOpacity: "Prozirnost okoline",
    buildingColor: "Boja zgrada",
    buildingColorHelp: "Osnovni ton primijenjen na okolne zgrade u sceni.",
    shadowsSection: "Sjene",
    shadowsEnabled: "Prikaži sjene",
    shadowsEnabledOn: "Prikazano",
    shadowsEnabledOff: "Skriveno",
    shadowsEnabledHint:
      "Uključuje ili isključuje sjene koje zgrade bacaju na tlo dok se sunce kreće.",
    shadowOpacity: "Prozirnost sjena",
    shadowOpacityHint: "Prozirnost bačenih sjena na tlu.",
    resetSection: "Resetiranje",
    resetSectionHint:
      "Alati za održavanje: ponovno dohvati podatke koje je kartica spremila u predmemoriju, ili resetiraj sve opcije na zadano.",
    resetCacheButton: "Resetiraj predmemoriju podataka",
    resetCacheWarning:
      "Upozorenje: ovo ponovno dohvaća sve što je kartica spremila u predmemoriju - vrijeme Open-Meteo, svaki energetski niz podataka u memoriji (proizvodnja, mreža, baterija, uređaji, ozračenje), kalibraciju pročišćene prognoze i tlocrte zgrada OpenFreeMap - za svaku otvorenu karticu Helios na ovoj stranici. Koristi ovo za brisanje zaglavljene kalibracije ili zastarjelih podataka o vremenu/karti; potpuno ponovno dohvaćanje traje nekoliko minuta, ovisno o tvom HA poslužitelju. Tvoji podaci unutar Home Assistant nikada se ne diraju.",
    resetCacheDone: "Predmemorija obrisana ✓",
    resetOptionsButton: "Resetiraj opcije na zadano",
    resetOptionsConfirm: "Klikni ponovno za potvrdu",
    resetOptionsWarning:
      "Upozorenje: ovo resetira SVE opcije ove kartice na zadane vrijednosti: vidljivost čipova, boje i ikone, nazive/boje/ikone skupina, zgrade, sjene, jedinice i sve ostale postavke. Tvoji podaci Home Assistant i energetska nadzorna ploča ostaju netaknuti, ali tvoja prilagodba se briše i ne može se poništiti.",
    resetOptionsDone: "Opcije resetirane ✓",
    aboutSection: "O kartici",
    aboutVersionLabel: "Verzija",
    aboutRepoCard: "Helios",
    aboutCoffeeMessage:
      "Helios gradim sam, uglavnom noću, tragajući za sitnim detaljima dok sunce i tvoja energija ne oživi na ekranu. Ako je pronašao mjesto na tvojoj nadzornoj ploči, to me već čini sretnim; zvjezdica na GitHubu čini me još sretnijim, a kava sve to održava u pokretu.",
    aboutDeveloperLabel: "Razvijatelj",
    aboutDeveloperLinkedIn: "LinkedIn",
    aboutCoffeeLink: "Časti me kavom",
  },
};
