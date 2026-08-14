import type { Translations } from "../index";

//Hungarian locale.
export const hu: Translations = {
  cardName: "Helios",
  cardDescription:
    "☀️ Otthonod valós idejű 2.5D nézete a nappal, az időjárással, a napelemes termeléssel, az akkumulátorral és a hálózattal, ráadásul vetett árnyékokkal és interaktív idővonallal",

  period: {
    rangeLabel: "Időtartomány",
    forecast: "Előrejelzés",
    yesterday: "Tegnap",
    today: "Ma",
    week: "Hét",
    month: "Hónap",
    year: "Év",
  },

  compass: "É,ÉK,K,DK,D,DNy,Ny,ÉNy",

  cloudCover: {
    cloudLow: "Alacsony felhőzet",
    cloudMid: "Közepes felhőzet",
    cloudHigh: "Magas felhőzet",
  },

  mapConfig: {
    section: "Térkép beállításai",
    intro:
      "Az alaptérkép OpenStreetMap vektorcsempékből épül fel. Az Automatikus a témádat követi, a Sötét / Világos egyet kényszerít, az Egyéni pedig lehetővé teszi minden szín beállítását és bármely réteg elrejtését.",
    modeAuto: "Automatikus",
    modeDark: "Sötét",
    modeLight: "Világos",
    modeCustom: "Egyéni",
    land: "Háttér",
    water: "Víz",
    wood: "Erdő",
    grass: "Zöldterület",
    sand: "Homok",
    wetland: "Vizes élőhely",
    ice: "Jég és hó",
    landuse: "Beépített terület",
    roadMajor: "Főutak",
    roadMinor: "Mellékutak",
    roadCasing: "Útkontúr",
    path: "Ösvények és nyomvonalak",
    rail: "Vasútvonalak",
    building: "Épületek",
    boundary: "Határvonalak",
  },

  editor: {
    weatherEnabled: "Időjárási effektek",
    weatherEnabledHint:
      "A valódi eget vetíti a jelenet fölé: napsütés, felhők, eső, hó és zivatar a helyi időjárás alapján, az idővonalat követve, ahogy azon mozogsz. Kikapcsolva tiszta marad a jelenet.",
    temperatureEntity: "Hőmérséklet-szenzor",
    temperatureEntityHelp:
      "Opcionális. Egy helyi kültéri hőmérséklet-szenzort (°C) használ az Open-Meteo érték helyett a hőmérséklet-chiphez. Az élő állapotát és a recorder-előzményeit használja az élő + múlt adatokhoz; az előrejelzett órák a modellen maradnak.",
    humidityEntity: "Páratartalom-szenzor",
    humidityEntityHelp:
      "Opcionális. Egy helyi relatív páratartalom-szenzort (%) használ az Open-Meteo érték helyett, az élő + múlt adatokhoz.",
    cloudCoverEntity: "Felhőzet-szenzor",
    cloudCoverEntityHelp:
      "Opcionális. Egy helyi felhőzet-szenzort (%) használ az égbolt fokozatának (napsütés, szürkülés) vezérléséhez az Open-Meteo érték helyett, az élő + múlt adatokhoz.",
    precipitationEntity: "Csapadék-szenzor",
    precipitationEntityHelp:
      "Opcionális. Egy helyi csapadék-szenzort (mm) használ az esőréteg vezérléséhez az Open-Meteo érték helyett, az élő + múlt adatokhoz.",
    snowfallEntity: "Hóesés-szenzor",
    snowfallEntityHelp:
      "Opcionális. Egy helyi hóesés-szenzort (cm) használ a hóréteg vezérléséhez az Open-Meteo érték helyett, az élő + múlt adatokhoz.",
    weatherEntity: "Időjárás-entitás",
    weatherEntityHelp:
      "Opcionális. Egy Home Assistant időjárás-entitást használ az időjárási állapot (eső / hó / zivatar) vezérléséhez az Open-Meteo érték helyett, az élő + múlt adatokhoz. Az előrejelzett órák a modellen maradnak.",
    chipTemperature: "Hőmérséklet megjelenítése",
    chipHumidity: "Páratartalom megjelenítése",
    chipCost: "Költség megjelenítése",
    locationSection: "Otthon helye",
    homeLatitude: "Otthon szélességi foka",
    homeLongitude: "Otthon hosszúsági foka",
    locationHint:
      "Felülírja a kártya középpontjaként használt otthoni címet. Hagyd mindkét mezőt üresen, hogy a Home Assistant beállított otthonát használd. A felülírás csak akkor érvényesül, ha MINDKÉT mező érvényes koordinátákra van állítva.",
    uiAndMapSection: "UI",
    autoRotate: "Kamera automatikus forgatása",
    autoRotateHint:
      "Néhány másodperc tétlenség után a kamera lassan az otthon körül kering (körülbelül 1,5°/s, a nap látszólagos mozgásával ellentétesen). Egyujjas húzás azonnal megállítja, és folytatódik, amint elengeded. Kerüld nagyon régi eszközökön: az automatikus forgatás másodpercenként újrarajzolásra kényszerít.",
    autoRotateOn: "Be",
    autoRotateOff: "Ki",
    dataDisplaySection: "Adatmegjelenítés",
    maxExpectedPower: "Maximális várható teljesítmény",
    maxExpectedPowerHelp:
      "Az a teljesítmény, amelynél egy áramlás teljes sebességgel mozog. Minden áramlás ehhez az egyetlen referenciához igazodik, így egy nagyobb áramlás mindig gyorsabbnak látszik, mint egy kisebb, bármelyik irányba is fusson. Növeld nagy rendszerhez, csökkentsd kicsihez. Alapértelmezett 5000 W.",
    sunChipMode: "Nap chip kijelzése",
    sunChipModeHelp:
      "Mit mutat a nap chip: az élő napsugárzást (alapértelmezett) vagy a nap helyzetét (azimut és magasság). A helyzethez nem kell érzékelő, a kártya saját napszámításaiból származik.",
      batteryChipMode: "Akkumulátor chip kijelzése",
      batteryChipModeHelp: "Mit mutat az akkumulátor chip: az élő teljesítményt (alapértelmezett) vagy a töltöttségi szintet (%). Arra az értékre vált, amelyet az akkumulátor ténylegesen biztosít.",
      batteryChipModePower: "Teljesítmény",
      batteryChipModeSoc: "Töltöttségi szint",
    sunChipModeIrradiance: "Besugárzás",
    sunChipModePosition: "Nap helyzete",
    displayUpdateFrequency: "Grafikon részletessége",
    displayUpdateFrequencyHelp:
      "Hány pontot rajzolnak a grafikonok óránként. Maguk az adatok mindig a Home Assistant 5 perces statisztikái; ez csak azt szabályozza, milyen sűrűn van kirajzolva a görbe: 1 = egy pont óránként (a legsimább, a legkönnyebb kirajzolni), 6 = egy pont 10 percenként (teljes részletesség, a legnehezebb). Alapértelmezett 4 = egy pont 15 percenként. Csökkentsd régebbi vagy lassabb eszközökön a kirajzolási költség mérséklésére. Az előrejelzési görbe ugyanazt a ritmust követi, így a finomabb beállítás feloldja a rövid árnyékeséseket is (egy fa, ami fél órára eltakarja a termelést), amelyeket egy óránkénti görbe átlép.",
    valueDecimals: "Tizedesjegyek",
    valueDecimalsHelp:
      "Az egyes értékeknél megjelenített tizedesjegyek száma, hogy a chipek egységesek maradjanak. A kW értékekre vonatkozik (az egész wattok egész számok maradnak) és a kWh-ra is. 0-tól 3-ig, alapértelmezett 1.",
    powerUnit: "Teljesítmény mértékegysége",
    powerUnitHelp:
      "A kártya minden teljesítménykijelzésének mértékegysége (chipek, grafikon buboréksúgók). Az energia is ezt követi, így a kártya következetes marad: a kW a kWh-val, a W a Wh-val párosul.",
    irradianceUnit: "Napállandó mértékegysége",
    irradianceUnitHelp:
      "A nap fölött megjelenő napállandó (besugárzás) kijelzésének mértékegysége.",
    batterySign: "Akkumulátor előjele",
    batterySignHelp:
      "Az akkumulátor chipjén megjelenő előjel. Alapértelmezés szerint mínusz töltés közben és plusz kisütés közben. A Fordított megcseréli. A Rejtett előjel nélkül mutatja az értéket.",
    batterySignDefault: "Alapértelmezett",
    batterySignInverted: "Fordított",
    batterySignHidden: "Rejtett",
    noUiMode: "Felület nélküli mód",
    noUiModeHint:
      "Néhány másodpercnyi tétlenség után elhalványítja az idővonalat és a kártyán lévő vezérlőket. Bármilyen koppintás vagy mozdulat visszahozza őket. Kiváló fali kijelzőhöz.",
    noUiDelay: "Tétlenségi késleltetés elrejtés előtt",
    noUiDelayHint:
      "Hány másodperc tétlenség után halványodik el az idővonal és a vezérlők a felület nélküli módban. A 0 véglegesen elrejtve tartja a felületet. Csak akkor van hatása, ha a felület nélküli mód be van kapcsolva.",
    showTimeline: "Idővonal megjelenítése",
    showTimelineHint:
      "Megjeleníti az idővonalat és az időtartomány-választót a jelenet alatt. Kikapcsolva csak a jelenet marad látható.",
    showDetailPanel: "Kiegészítő információk megjelenítése",
    showDetailPanelHint:
      "Engedélyezi, hogy a chipenkénti mini panel (összesített mutatók) megnyíljon jobbra fent egy chip megérintésekor. Kikapcsolva soha nem jelenik meg.",
    showSunTimes: "Napkelte / napnyugta idejének megjelenítése",
    showSunTimesHint:
      "Megjeleníti a napkelte és napnyugta idejét, valamint ezek jelölőit a napív lábánál.",
    showHorizonLine: "Domborzati horizont megjelenítése",
    showHorizonLineHint: "Kirajzolja a domborzat horizontvonalát az otthon körül, a helyi terep alapján számítva. A horizont mindig valósághűen tompítja a napot a dombok mögött; ez csak megjeleníti vagy elrejti a kirajzolt vonalat.",
    horizonLineColor: "Domborzati horizont színe",
    horizonLineColorHint: "A domborzati horizontvonal színe.",
    lockRotation: "Forgatás zárolása",
    lockRotationHint:
      "Húzza az előnézetet a jelenet elforgatásához és megdöntéséhez a kívánt nézetig, majd kapcsolja be ezt. A zár rögzíti ezt a nézetet (a húzással forgatás és a nyugalmi automatikus forgatás kikapcsol), és elmenti a szöget a kártyába, így pontosan ugyanaz a nézet jelenik meg minden eszközön és böngészőben. Kapcsolja ki, hogy újra szabadon forgathasson.",
    chipsSection: "Entitások megjelenítése",
    chipsIntro:
      "Jelenítsd meg vagy rejtsd el az egyes entitásokat, és válaszd ki az ikonjukat és színüket. Az otthon a kiválasztott chipet követi, alapértelmezésben pedig az elsődleges színedet.",
    chipIrradiance: "Besugárzás megjelenítése",
    chipProduction: "Termelés megjelenítése",
    chipGrid: "Hálózat megjelenítése",
    chipBattery: "Akkumulátor megjelenítése",
    chipHome: "Otthoni fogyasztás megjelenítése",
    groupsConfigTitle: "Csoportok beállítása",
    optionalSensors: "Opcionális érzékelők",
    solarIrradianceEntity: "Napsugárzás entitás",
    solarIrradianceEntityHelp:
      "Válassz egy érzékelőt, amely globális rövidhullámú besugárzást jelent W/m²-ben (jellemzően Ecowitt / Davis / saját időjárás-állomás). Ha be van állítva, az aktuális állapota és a rögzítő előzményei felváltják az Open-Meteo-t az élő és múltbeli besugárzásnál mindenhol, ahol megjelenik (nap chip szám, PV diagram Y tengely, napívszínezés). Az előrejelzési órák az Open-Meteo-n maradnak, mivel egy érzékelő nem hordozhat jövőbeli értékeket.",
    liveDataTitle: "Beállítási állapot",
    liveDataIntro:
      "Az élő chipek csak mért érzékelőket jelenítenek meg. Minden családnak szüksége van az energia irányítópult forrásának opcionális élő teljesítményérzékelőjére; a görbék és összesítések mindig a mérőidből származnak.",
    liveSolarOk: "Napelem: élő teljesítményérzékelő észlelve.",
    liveSolarMissing:
      "Napelem: nincs élő teljesítményérzékelő, a termelés chip rejtve marad. Add hozzá a Beállítások > Irányítópultok > Energia > Napelemek alatt.",
    liveSolarAbsent:
      "Napelem: nincs beállítva az energia irányítópulton. Adj hozzá napelemeket, hogy megkapd a termelés chipet.",
    liveGridOk: "Hálózat: élő teljesítményérzékelő észlelve.",
    liveGridMissing:
      "Hálózat: nincs élő teljesítményérzékelő, az importálás/exportálás chipek rejtve maradnak. Add hozzá a Beállítások > Irányítópultok > Energia > Hálózat alatt.",
    liveGridMiswired:
      "Hálózat: az élő teljesítményérzékelő ellentmond a mérőidnek (úgy tűnik, csak egy irányt mér). A chipek rejtve maradnak; állíts be egy előjeles érzékelőt vagy a Két érzékelő módot.",
    liveGridAbsent:
      "Hálózat: nincs beállítva az energia irányítópulton. Add hozzá a hálózatot, hogy megkapd az importálás és exportálás chipeket.",
    liveBatteryOk:
      "Akkumulátor: az élő teljesítményérzékelők minden akkumulátort lefednek.",
    liveBatteryMissing:
      "Akkumulátor: hiányzik az élő teljesítmény legalább egy akkumulátornál, a teljesítmény chip rejtve marad. Add hozzá az érzékelő(ke)t a Beállítások > Irányítópultok > Energia > Akkumulátor alatt.",
    liveBatteryAbsent:
      "Akkumulátor: nincs beállítva az energia irányítópulton. Adj hozzá egy akkumulátort, hogy megkapd a töltés és kisütés chipet.",
    liveHomeOk:
      "Otthoni fogyasztás: megjelenítve, a fenti élő családokból származtatva.",
    liveHomeNote:
      "Az otthoni fogyasztás akkor jelenik meg, ha a fent felsorolt összes beállított család rendelkezik élő érzékelővel.",
    openEnergyConfig: "Energia beállítások megnyitása",
    buildingsSection: "Otthon és épületek",
    buildingsHint:
      'Hogy a kártya sűrűn beépített városi területeken is sima maradjon, csak az otthon körüli beállított sugáron belüli épületek jelennek meg 3D-ben. Maga az otthon teljes átlátszatlanságban marad; a közeli épületek a beállított átlátszósággal jelennek meg, így városi kontextust adnak anélkül, hogy versenyeznének az adatrétegekkel. A csoportosítási sugár a hozzáépített melléképületeket (verandák, garázsok, fészerek) az "otthon" csoportba vonja.',
    displayRadius: "Megjelenítési sugár",
    displayRadiusHelp:
      "Az otthon körüli sugár, amelyen belül az épületeket lekéri és kirajzolja, egészen az elhalványuló térképkorong széléig. Csökkentsd, hogy lassú eszközön könnyítsd a kirajzolást; a 0 csak az otthont mutatja.",
    buildingCount: "Épületek száma",
    buildingCountHelp:
      "A kirajzolandó közeli épületek maximális száma. Csökkentsd, hogy lassú eszközön könnyítsd a kirajzolást.",
    buildingRealSize: "Valós épületmagasságok",
    buildingRealSizeOn: "Be",
    buildingRealSizeOff: "Ki",
    buildingRealSizeHint:
      "Be: valós OpenStreetMap magasságokat használ (korlátozva, hogy a keretezés olvasható maradjon). Ki: minden épületnek ugyanazt a lenti rögzített magasságot adja.",
    buildingHeight: "Épület magassága",
    hiddenDevicesEmpty:
      "Egyetlen eszköz sincs még nyomon követve az energia irányítópultodon. Adj hozzá ott eszközfogyasztást, hogy itt kezelhesd őket.",
    deviceVisibilityLabel: "Eszköz megjelenítése",
    group: "Csoport",
    noGroup: "Nincs csoport",
    groupAssignHint:
      "Húzza az eszközeit egy csoportba. Ami alul marad, egyik csoporthoz sem tartozik.",
    groupDropHere: "Húzzon ide egy eszközt",
    backToLive: "Vissza az élőhöz",
    buildingClusterRadius: "Otthon csoportosítási sugara",
    buildingClusterRadiusHelp:
      "Az otthon körüli sugár, amelyen belül a hozzáépített melléképületek (verandák, garázsok, fészerek) az otthon részének számítanak: az otthon teljes átlátszatlanságával és színével jelennek meg, nem elhalványult szomszédként. A 0 csak a főépületet tartja meg.",
    buildingOpacity: "Környező átlátszatlanság",
    buildingColor: "Épületek színe",
    buildingColorHelp:
      "A jelenetben a környező épületekre alkalmazott alapszínezet.",
    shadowsSection: "Árnyékok",
    shadowsEnabled: "Árnyékok megjelenítése",
    shadowsEnabledOn: "Megjelenítve",
    shadowsEnabledOff: "Elrejtve",
    shadowsEnabledHint:
      "Be- és kikapcsolja az épületek által a talajra vetett árnyékokat, ahogy a nap mozog.",
    shadowOpacity: "Árnyék átlátszatlansága",
    shadowOpacityHint: "A talajra vetett árnyékok átlátszatlansága.",
    resetSection: "Visszaállítás",
    resetSectionHint:
      "Karbantartási eszközök: a kártya gyorsítótárazott adatainak újratöltése, vagy minden beállítás alapértelmezettre állítása.",
    resetCacheButton: "Adatgyorsítótár visszaállítása",
    resetCacheWarning:
      "Figyelem: ez újratölt mindent, amit a kártya gyorsítótárazott: az Open-Meteo időjárást, minden memóriában lévő energiasorozatot (termelés, hálózat, akkumulátor, eszközök, besugárzás), a finomított előrejelzés kalibrációját és az OpenFreeMap épületalaprajzokat, az ezen az oldalon nyitva lévő összes Helios kártya esetében. Használd elakadt kalibráció vagy elavult időjárás-/térképadatok törlésére; a teljes újratöltés néhány percig tarthat a HA szerveredtől függően. A Home Assistant-en belüli adataidat soha nem érinti.",
    resetCacheDone: "Gyorsítótár törölve ✓",
    resetOptionsButton: "Beállítások visszaállítása alapértelmezettre",
    resetOptionsConfirm: "Kattints újra a megerősítéshez",
    resetOptionsWarning:
      "Figyelem: ez a kártya ÖSSZES beállítását visszaállítja az alapértelmezettre: chip láthatóság, színek és ikonok, csoportnevek/színek/ikonok, épületek, árnyékok, mértékegységek és minden más beállítás. A Home Assistant adataidat és az energia irányítópultodat nem érinti, de a személyre szabásod törlődik, és ez nem vonható vissza.",
    resetOptionsDone: "Beállítások visszaállítva ✓",
    aboutSection: "Névjegy",
    aboutVersionLabel: "Verzió",
    aboutRepoCard: "Helios",
    aboutCoffeeMessage:
      "A Heliost egyedül építem, többnyire éjszaka, a kis részletek után kutatva, amíg a nap és az energiád életre nem kel a képernyőn. Ha helyet talált az irányítópultodon, az már boldoggá tesz; egy csillag a GitHubon még inkább, egy kávé pedig segít, hogy tovább haladhasson a projekt.",
    aboutDeveloperLabel: "Fejlesztő",
    aboutDeveloperLinkedIn: "LinkedIn",
    aboutCoffeeLink: "Hívj meg egy kávéra",
  },
};
