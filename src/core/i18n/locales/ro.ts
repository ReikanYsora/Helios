import type { Translations } from "../index";

//Romanian locale.
export const ro: Translations = {
  cardName: "Helios",
  cardDescription:
    "☀️ O vedere 2.5D in timp real a casei tale cu soarele, vremea, productia solara, bateria si reteaua, plus umbre proiectate si o cronologie interactiva",

  period: {
    rangeLabel: "Interval de timp",
    forecast: "Prognoza",
    yesterday: "Ieri",
    today: "Astazi",
    week: "Saptamana",
    month: "Luna",
    year: "An",
  },

  cloudCover: {
    cloudLow: "Nori josi",
    cloudMid: "Nori medii",
    cloudHigh: "Nori inalti",
  },

  mapConfig: {
    section: "Configurare harta",
    intro:
      "Harta de fundal este desenata din tile-uri vectoriale OpenStreetMap. Auto urmeaza tema ta, Intunecat / Luminos forteaza una anume, iar Personalizat iti permite sa setezi fiecare culoare si sa ascunzi orice strat.",
    modeAuto: "Auto",
    modeDark: "Intunecat",
    modeLight: "Luminos",
    modeCustom: "Personalizat",
    land: "Fundal",
    water: "Apa",
    wood: "Padure",
    grass: "Vegetatie",
    sand: "Nisip",
    wetland: "Zona umeda",
    ice: "Gheata si zapada",
    landuse: "Zona construita",
    roadMajor: "Drumuri principale",
    roadMinor: "Drumuri secundare",
    roadCasing: "Contur drum",
    path: "Poteci si drumuri de tara",
    rail: "Cai ferate",
    building: "Cladiri",
    boundary: "Granite",
  },

  editor: {
    locationSection: "Locatie",
    homeLatitude: "Latitudinea casei",
    homeLongitude: "Longitudinea casei",
    locationHint:
      "Inlocuieste adresa casei folosita drept centru al cardului. Lasa ambele campuri goale pentru a folosi casa configurata in Home Assistant. Inlocuirea se aplica doar atunci cand AMBELE campuri sunt setate la coordonate valide.",
    uiAndMapSection: "UI",
    autoRotate: "Rotire automata a camerei",
    autoRotateHint:
      "Dupa cateva secunde de inactivitate, camera se roteste lent in jurul casei (aproximativ 1.5°/s, in sens opus miscarii aparente a soarelui). O glisare cu un deget o opreste instantaneu, iar rotirea reia indata ce ridici degetul. Evit-o pe dispozitive foarte vechi: rotirea automata forteaza o redare in fiecare secunda.",
    autoRotateOn: "Pornit",
    autoRotateOff: "Oprit",
    dataDisplaySection: "Afisarea datelor",
    displayUpdateFrequency: "Detaliul graficului",
    displayUpdateFrequencyHelp:
      "Cate puncte pe ora deseneaza graficele. Datele in sine sunt intotdeauna statisticile de 5 minute ale Home Assistant; aceasta controleaza doar cat de dens este trasata curba: 1 = un punct pe ora (cel mai neted, cel mai usor de redat), 6 = un punct la fiecare 10 minute (detaliu complet, cel mai greu). Implicit 4 = un punct la fiecare 15 minute. Coboara-l pe dispozitive mai vechi sau mai lente pentru a reduce costul redarii. Curba de prognoza urmeaza aceeasi cadenta, asa ca o setare mai fina rezolva si scaderile scurte de umbra (un copac care taie productia o jumatate de ora) pe care o curba orara le sare.",
    valueDecimals: "Zecimale",
    valueDecimalsHelp:
      "Numarul de zecimale afisate la fiecare valoare, astfel incat cipurile sa arate uniform. Se aplica valorilor in kW (watii intregi raman intregi) si celor in kWh. De la 0 la 3, implicit 1.",
    powerUnit: "Unitate de putere",
    powerUnitHelp:
      "Unitatea pentru fiecare citire a puterii de pe card (cipuri, indicii graficului). Energia o urmeaza si ea, astfel incat cardul ramane consecvent: kW se imperecheaza cu kWh, W cu Wh.",
    irradianceUnit: "Unitatea constantei solare",
    irradianceUnitHelp:
      "Unitatea pentru citirea constantei solare (iradiere) de deasupra soarelui.",
    batterySign: "Semnul bateriei",
    batterySignHelp:
      "Semnul afisat pe cipul bateriei. Implicit este minus la incarcare si plus la descarcare. Inversat le schimba intre ele. Ascuns afiseaza valoarea fara semn.",
    batterySignDefault: "Implicit",
    batterySignInverted: "Inversat",
    batterySignHidden: "Ascuns",
    noUiMode: "Mod fara interfata",
    noUiModeHint:
      "Estompeaza timeline-ul si controalele de pe card dupa cateva secunde de inactivitate. Orice atingere sau miscare le readuce. Ideal pentru un afisaj de perete.",
    noUiDelay: "Intarziere de inactivitate inainte de ascundere",
    noUiDelayHint:
      "Secunde de inactivitate inainte ca timeline-ul si controalele sa se estompeze in modul fara interfata. 0 pastreaza interfata ascunsa permanent. Folosit doar cand modul fara interfata este pornit.",
    showTimeline: "Arata cronologia",
    showTimelineHint:
      "Arata cronologia si selectorul de perioada sub scena. Oprit pastreaza doar scena.",
    showDetailPanel: "Arata informatii suplimentare",
    showDetailPanelHint:
      "Permite deschiderea mini-panoului per cip (metrici agregate) in coltul din dreapta sus atunci cand este atins un cip. Oprit nu il arata niciodata.",
    showSunTimes: "Arata orele de rasarit / apus",
    showSunTimesHint:
      "Arata orele de rasarit si apus si marcajele lor la baza arcului solar.",
    lockRotation: "Blocheaza rotirea",
    lockRotationHint:
      "Seteaza unghiul de vizualizare direct in previzualizare (glisati pentru a roti si inclina scena), apoi porniti blocarea pentru a-l fixa: rotirea prin glisare si auto-orbitarea la inactivitate sunt dezactivate, pastrand unghiul setat.",
    chipsSection: "Afisarea entitatilor",
    chipsIntro:
      "Arata sau ascunde fiecare entitate si alege-i pictograma si culoarea. Casa urmeaza cipul selectat sau, implicit, culoarea ta principala.",
    chipIrradiance: "Afisare iradianta",
    chipProduction: "Afisare productie",
    chipGrid: "Afisare retea",
    chipBattery: "Afisare baterie",
    chipHome: "Afisare consum casa",
    groupsConfigTitle: "Configurare grupuri",
    optionalSensors: "Senzori optionali",
    solarIrradianceEntity: "Entitatea de iradianta solara",
    solarIrradianceEntityHelp:
      "Alege un senzor care raporteaza iradianta globala in unde scurte in W/m² (de regula o statie meteo Ecowitt / Davis / personala). Cand este setat, starea sa actuala si istoricul din recorder inlocuiesc Open-Meteo pentru iradianta live si trecuta peste tot unde apare (numarul de pe cipul soarelui, axa Y a graficului PV, colorarea arcului solar). Orele de prognoza raman pe Open-Meteo, deoarece un senzor nu poate purta valori viitoare.",
    liveDataTitle: "Stare configuratie",
    liveDataIntro:
      "Cipurile live arata doar senzori masurati. Fiecare familie are nevoie de senzorul optional de putere live al sursei sale din tabloul de bord Energie; curbele si totalurile provin intotdeauna din contoarele tale.",
    liveSolarOk: "Solar: senzor de putere live detectat.",
    liveSolarMissing:
      "Solar: niciun senzor de putere live, cipul de productie ramane ascuns. Adauga unul in Setari > Tablouri de bord > Energie > Panouri solare.",
    liveSolarAbsent:
      "Solar: nu este configurat in tabloul tau de bord Energie. Adauga acolo panouri solare pentru a obtine cipul de productie.",
    liveGridOk: "Retea: senzor de putere live detectat.",
    liveGridMissing:
      "Retea: niciun senzor de putere live, cipurile de import/export raman ascunse. Adauga unul in Setari > Tablouri de bord > Energie > Retea.",
    liveGridMiswired:
      "Retea: senzorul de putere live contrazice contoarele tale (pare sa masoare o singura directie). Cipurile raman ascunse; configureaza un senzor cu semn sau modul Doi senzori.",
    liveGridAbsent:
      "Retea: nu este configurata in tabloul tau de bord Energie. Adauga acolo reteaua pentru a obtine cipurile de import si export.",
    liveBatteryOk: "Baterie: senzorii de putere live acopera fiecare baterie.",
    liveBatteryMissing:
      "Baterie: lipseste puterea live pentru cel putin o baterie, cipul de putere ramane ascuns. Adauga senzorul (senzorii) de putere in Setari > Tablouri de bord > Energie > Baterie.",
    liveBatteryAbsent:
      "Baterie: nu este configurata in tabloul tau de bord Energie. Adauga acolo o baterie pentru a obtine cipul de incarcare si descarcare.",
    liveHomeOk: "Consum casa: afisat, derivat din familiile live de mai sus.",
    liveHomeNote:
      "Consum casa: apare de indata ce fiecare familie configurata mai sus are senzorul sau live.",
    openEnergyConfig: "Deschide configuratia Energie",
    buildingsSection: "Casa si cladiri",
    buildingsHint:
      'Pentru a pastra cardul fluid in zone urbane dense, doar cladirile aflate in raza configurata in jurul casei sunt redate in 3D. Casa in sine ramane la opacitate completa; cladirile din apropiere sunt redate cu opacitatea configurata, astfel incat ofera context urban fara a concura cu suprapunerile de date. Raza de grupare aduna anexele atasate (verande, garaje, soproane) in setul "casei".',
    displayRadius: "Raza de afisare",
    displayRadiusHelp:
      "Raza din jurul casei in care cladirile sunt preluate si desenate, pana la marginea discului hartii estompat. Coboara-o pentru a usura redarea pe un dispozitiv lent; 0 arata doar casa.",
    buildingCount: "Numarul de cladiri",
    buildingCountHelp:
      "Numarul maxim de cladiri din apropiere de desenat. Coboara-l pentru a usura redarea pe un dispozitiv lent.",
    buildingRealSize: "Inaltimi reale ale cladirilor",
    buildingRealSizeOn: "Pornit",
    buildingRealSizeOff: "Oprit",
    buildingRealSizeHint:
      "Pornit: foloseste inaltimile reale OpenStreetMap (plafonate pentru a pastra incadrarea lizibila). Oprit: da fiecarei cladiri aceeasi inaltime fixa de mai jos.",
    buildingHeight: "Inaltimea cladirii",
    hiddenDevicesEmpty:
      "Niciun dispozitiv individual nu este inca urmarit in tabloul tau de bord Energie. Adauga acolo consumul dispozitivelor pentru a le controla aici.",
    deviceVisibilityLabel: "Arata dispozitivul",
    deviceGroupLabel: "Grup de monitorizare",
    group: "Grup",
    noGroup: "Fara grup",
    groupAssignHint:
      "Trageți dispozitivele într-un grup. Ce rămâne mai jos nu aparține niciunui grup.",
    groupDropHere: "Trageți un dispozitiv aici",
    backToLive: "Înapoi la live",
    devicesEnergyNote:
      "Acestea sunt dispozitivele individuale configurate momentan in tabloul tau de bord Energie din Home Assistant. Ochiul arata sau ascunde fiecare dispozitiv peste tot, iar eticheta il atribuie unui grup.",
    buildingClusterRadius: "Raza de grupare a casei",
    buildingClusterRadiusHelp:
      "Raza din jurul casei in care anexele atasate (verande, garaje, soproane) sunt tratate ca parte a casei: sunt redate la opacitatea si culoarea completa a casei, in loc de vecini estompati. 0 pastreaza doar cladirea principala.",
    buildingOpacity: "Opacitatea cladirilor din jur",
    buildingColor: "Culoarea cladirilor",
    buildingColorHelp: "Nuanta de baza aplicata cladirilor din jur in scena.",
    shadowsSection: "Umbre",
    shadowsEnabled: "Arata umbrele",
    shadowsEnabledOn: "Afisate",
    shadowsEnabledOff: "Ascunse",
    shadowsEnabledHint:
      "Comuta umbrele proiectate pe sol de cladiri pe masura ce soarele se misca.",
    shadowOpacity: "Opacitatea umbrelor",
    shadowOpacityHint: "Opacitatea umbrelor proiectate pe sol.",
    resetSection: "Resetare",
    resetSectionHint:
      "Instrumente de intretinere: repreia datele stocate in cache ale cardului sau reseteaza toate optiunile la valorile implicite.",
    resetCacheButton: "Reseteaza cache-ul de date",
    resetCacheWarning:
      "Atentie: aceasta repreia tot ce a stocat cardul in cache: vremea Open-Meteo, fiecare serie de energie din memorie (productie, retea, baterie, dispozitive, iradianta), calibrarea prognozei rafinate si amprentele cladirilor OpenFreeMap, pentru fiecare card Helios deschis pe aceasta pagina. Foloseste-o pentru a curata o calibrare blocata sau date de vreme/harta invechite; o repreluare completa dureaza cateva minute, in functie de serverul tau HA. Datele tale din interiorul Home Assistant nu sunt niciodata atinse.",
    resetCacheDone: "Cache golit ✓",
    resetOptionsButton: "Reseteaza optiunile la valorile implicite",
    resetOptionsConfirm: "Apasa din nou pentru a confirma",
    resetOptionsWarning:
      "Atentie: aceasta reseteaza TOATE optiunile acestui card la valorile implicite: vizibilitatea cipurilor, culorile si pictogramele, numele/culorile/pictogramele grupurilor, cladirile, umbrele, unitatile si orice alta setare. Datele tale din Home Assistant si tabloul de bord Energie raman neatinse, dar personalizarea ta este stearsa si nu poate fi anulata.",
    resetOptionsDone: "Optiuni resetate ✓",
    aboutSection: "Despre",
    aboutVersionLabel: "Versiune",
    aboutRepoCard: "Helios",
    aboutCoffeeMessage:
      "Helios este construit de un singur dezvoltator pasionat, cu multa energie si foarte putin somn. Daca iti place munca mea, o mica stea pe GitHub ma ajuta deja enorm, iar daca poti, o mica cafea tine proiectul in viata.",
    aboutDeveloperLabel: "Dezvoltator",
    aboutDeveloperLinkedIn: "LinkedIn",
    aboutCoffeeLink: "Cumpara-mi o cafea",
  },
};
