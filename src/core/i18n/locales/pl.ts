import type { Translations } from "../index";

//Polish locale.
export const pl: Translations = {
  cardName: "Helios",
  cardDescription:
    "☀️ Widok 2.5D Twojego domu w czasie rzeczywistym ze słońcem, pogodą, produkcją solarną, baterią i siecią, a do tego rzucane cienie i interaktywna oś czasu",

  period: {
    rangeLabel: "Zakres czasu",
    forecast: "D - D+2",
    yesterday: "Wczoraj",
    today: "Dzisiaj",
    week: "Tydzień",
    month: "Miesiąc",
    year: "Rok",
  },

  compass: "N,NE,E,SE,S,SW,W,NW",

  cloudCover: {
    cloudLow: "Niskie zachmurzenie",
    cloudMid: "Średnie zachmurzenie",
    cloudHigh: "Wysokie zachmurzenie",
  },

  mapConfig: {
    section: "Konfiguracja mapy",
    intro:
      "Mapa bazowa jest rysowana na podstawie kafelków wektorowych OpenStreetMap. Auto podąża za Twoim motywem, Ciemny / Jasny wymusza jeden z nich, a Niestandardowy pozwala ustawić każdy kolor i ukryć dowolną warstwę.",
    modeAuto: "Auto",
    modeDark: "Ciemny",
    modeLight: "Jasny",
    modeCustom: "Niestandardowy",
    land: "Tło",
    water: "Woda",
    wood: "Lasy",
    grass: "Zieleń",
    sand: "Piasek",
    wetland: "Tereny podmokłe",
    ice: "Lód i śnieg",
    landuse: "Tereny zabudowane",
    roadMajor: "Główne drogi",
    roadMinor: "Drogi lokalne",
    roadCasing: "Obrys dróg",
    path: "Ścieżki i szlaki",
    rail: "Koleje",
    building: "Budynki",
    boundary: "Granice",
  },

  editor: {
    weatherEnabled: "Efekty pogodowe",
    weatherEnabledHint:
      "Maluje prawdziwe niebo nad sceną: słońce, chmury, deszcz, śnieg i burze na podstawie lokalnej pogody, podążając za osią czasu podczas przewijania. Wyłączenie utrzymuje czystą scenę.",
    temperatureEntity: "Czujnik temperatury",
    temperatureEntityHelp:
      "Opcjonalne. Użyj lokalnego czujnika temperatury zewnętrznej (°C) zamiast wartości z Open-Meteo dla wskaźnika temperatury. Jego bieżący stan oraz historia z rejestratora są używane dla teraźniejszości i przeszłości; godziny prognozy pozostają oparte na modelu.",
    humidityEntity: "Czujnik wilgotności",
    humidityEntityHelp:
      "Opcjonalne. Użyj lokalnego czujnika wilgotności względnej (%) zamiast wartości z Open-Meteo, dla teraźniejszości i przeszłości.",
    cloudCoverEntity: "Czujnik zachmurzenia",
    cloudCoverEntityHelp:
      "Opcjonalne. Użyj lokalnego czujnika zachmurzenia (%), aby sterować wyglądem nieba (słońce, szarzenie) zamiast wartości z Open-Meteo, dla teraźniejszości i przeszłości.",
    precipitationEntity: "Czujnik opadów",
    precipitationEntityHelp:
      "Opcjonalne. Użyj lokalnego czujnika opadów (mm), aby sterować warstwą deszczu zamiast wartości z Open-Meteo, dla teraźniejszości i przeszłości.",
    snowfallEntity: "Czujnik opadów śniegu",
    snowfallEntityHelp:
      "Opcjonalne. Użyj lokalnego czujnika opadów śniegu (cm), aby sterować warstwą śniegu zamiast wartości z Open-Meteo, dla teraźniejszości i przeszłości.",
    weatherEntity: "Encja pogody",
    weatherEntityHelp:
      "Opcjonalne. Użyj encji pogody Home Assistant, aby sterować warunkami (deszcz / śnieg / burza) zamiast wartości z Open-Meteo, dla teraźniejszości i przeszłości. Godziny prognozy pozostają oparte na modelu.",
    chipTemperature: "Wyświetlanie temperatury",
    chipHumidity: "Wyświetlanie wilgotności",
    chipCost: "Wyświetlanie kosztu",
    locationSection: "Lokalizacja domu",
    homeLatitude: "Szerokość geograficzna domu",
    homeLongitude: "Długość geograficzna domu",
    locationHint:
      "Zastępuje adres domu używany jako środek karty. Zostaw oba pola puste, aby użyć domu skonfigurowanego w Home Assistant. Zastąpienie jest stosowane tylko wtedy, gdy OBA pola mają ustawione prawidłowe współrzędne.",
    uiAndMapSection: "UI",
    autoRotate: "Automatyczny obrót kamery",
    autoRotateHint:
      "Po kilku sekundach bezczynności kamera powoli obraca się wokół domu (około 1,5°/s, w kierunku przeciwnym do pozornego ruchu słońca). Przeciągnięcie jednym palcem natychmiast ją wstrzymuje, a wznawia się, gdy puścisz. Unikaj na bardzo starych urządzeniach: automatyczny obrót wymusza renderowanie co sekundę.",
    autoRotateOn: "Włączony",
    autoRotateOff: "Wyłączony",
    degradedRender: "Renderowanie zgodności",
    degradedRenderHint:
      "Rysuje mapę prostszą, bardziej zgodną metodą. Włącz, jeśli scena miga lub rwie się podczas obracania lub przesuwania. Naprawia usterkę na niektórych telefonach i tabletach, kosztem nieco mniej płynnego ruchu.",
    dataDisplaySection: "Wyświetlanie danych",
    maxExpectedPower: "Maks. oczekiwana moc",
    maxExpectedPowerHelp:
      "Moc, przy której przepływ animuje się z pełną prędkością. Każdy przepływ jest odmierzany względem tego jednego punktu odniesienia, więc większy przepływ zawsze wygląda na szybszy niż mniejszy, niezależnie od kierunku, w którym płynie. Zwiększ ją dla dużej instalacji, zmniejsz dla małej. Domyślnie 5000 W.",
    sunChipMode: "Odczyt chipa słońca",
    sunChipModeHelp:
      "Co pokazuje chip słońca: nasłonecznienie solarne na żywo (domyślnie) lub pozycję słońca (azymut i wysokość). Pozycja nie potrzebuje czujnika, pochodzi z własnych obliczeń słonecznych karty.",
      batteryChipMode: "Odczyt chipa baterii",
      batteryChipModeHelp: "Co pokazuje chip baterii: moc na żywo (domyślnie) lub stan naładowania (%). Wraca do wartości, którą faktycznie udostępnia bateria.",
      batteryChipModePower: "Moc",
      batteryChipModeSoc: "Stan naładowania",
    sunChipModeIrradiance: "Nasłonecznienie",
    sunChipModePosition: "Pozycja słońca",
    displayUpdateFrequency: "Szczegółowość wykresu",
    displayUpdateFrequencyHelp:
      "Ile punktów na godzinę rysują wykresy. Same dane to zawsze 5-minutowe statystyki Home Assistant - to ustawienie kontroluje jedynie, jak gęsto rysowana jest krzywa: 1 = jeden punkt na godzinę (najgładsze, najlżejsze do renderowania), 6 = jeden punkt co 10 minut (pełen szczegół, najcięższe). Domyślnie 4 = punkt co 15 minut. Zmniejsz na starszych lub wolniejszych urządzeniach, aby obniżyć koszt renderowania. Krzywa prognozy podąża za tym samym rytmem, więc drobniejsze ustawienie pozwala też uchwycić krótkie spadki od cienia (drzewo zasłaniające produkcję przez pół godziny), które krzywa godzinowa pomija.",
    valueDecimals: "Miejsca dziesiętne",
    valueDecimalsHelp:
      "Liczba miejsc dziesiętnych pokazywanych przy każdej wartości, aby chipy wyglądały jednolicie. Dotyczy wartości w kW (pełne waty pozostają liczbami całkowitymi) oraz kWh. Od 0 do 3, domyślnie 1.",
    powerUnit: "Jednostka mocy",
    powerUnitHelp:
      "Jednostka dla każdego odczytu mocy na karcie (chipy, dymki wykresu). Energia też za nią podąża, aby karta pozostała spójna: kW łączy się z kWh, W z Wh.",
    energyUnit: "Jednostka energii",
    energyUnitHelp:
      "Jednostka dla wszystkich sum energii (krzywa dnia, panel szczegółów, dzienne sumy na osi czasu). Automatyczna podąża za jednostką mocy powyżej; wybierz Wh lub kWh, aby ustawić ją niezależnie.",
    energyUnitAuto: "Automatyczna",
    irradianceUnit: "Jednostka stałej słonecznej",
    irradianceUnitHelp:
      "Jednostka odczytu stałej słonecznej (nasłonecznienia) nad słońcem.",
    batterySign: "Znak baterii",
    batterySignHelp:
      "Znak pokazywany na chipie baterii. Domyślnie minus podczas ładowania i plus podczas rozładowywania. Odwrócony zamienia je miejscami. Ukryty pokazuje wartość bez znaku.",
    batterySignDefault: "Domyślny",
    batterySignInverted: "Odwrócony",
    batterySignHidden: "Ukryty",
    noUiMode: "Tryb bez interfejsu",
    noUiModeHint:
      "Wygasza oś czasu i elementy sterujące na karcie po kilku sekundach bezczynności. Dowolne dotknięcie lub ruch przywraca je z powrotem. Idealne do ekranu naściennego.",
    noUiDelay: "Opóźnienie ukrycia przy bezczynności",
    noUiDelayHint:
      "Liczba sekund bezczynności, po których oś czasu i elementy sterujące znikają w trybie bez interfejsu. 0 utrzymuje interfejs ukryty na stałe. Używane tylko, gdy tryb bez interfejsu jest włączony.",
    showTimeline: "Pokaż oś czasu",
    showTimelineHint:
      "Pokazuje oś czasu i selektor okresu pod sceną. Wyłączenie pozostawia tylko scenę.",
    showDetailPanel: "Pokaż dodatkowe informacje",
    showDetailPanelHint:
      "Pozwala, aby mini-panel danego chipa (zagregowane metryki) otwierał się w prawym górnym rogu po dotknięciu chipa. Wyłączenie nigdy go nie pokazuje.",
    showSunTimes: "Pokaż godziny wschodu / zachodu słońca",
    showSunTimesHint:
      "Pokazuje godziny wschodu i zachodu słońca oraz ich znaczniki u podstawy łuku słonecznego.",
    showHorizonLine: "Pokaż horyzont terenu",
    showHorizonLineHint: "Rysuje linię horyzontu terenu wokół domu, obliczoną na podstawie lokalnego ukształtowania. Horyzont zawsze realistycznie przygasza słońce za wzniesieniami; to tylko włącza lub wyłącza rysowaną linię.",
    horizonLineColor: "Kolor horyzontu terenu",
    horizonLineColorHint: "Kolor linii horyzontu terenu.",
    moonDisplay: "Tryb wyświetlania księżyca",
    moonDisplayHint: "Rysuje księżyc na własnym łuku z sierpem zgodnym z fazą, zawsze przed słońcem. Wyłącznie ozdobne: bez plakietki, bez wartości.",
    moonDisplayAlways: "Zawsze",
    moonDisplayNight: "Noc",
    moonDisplayHidden: "Wyłączony",
    sceneZoom: "Zoom sceny",
    sceneZoomHint: "Powiększa mapę, budynki i cienie wokół domu: 1x to widok domyślny, 1,5x i 2x pokazują je większe. Słońce, łuki i plakietki zachowują swój rozmiar.",
    lockRotation: "Zablokuj obrót",
    lockRotationHint:
      "Przeciągnij podgląd, aby obrócić i pochylić scenę do żądanego widoku, a następnie włącz tę opcję. Blokada zamraża ten widok (obracanie przeciąganiem i automatyczne obracanie w spoczynku zostają wyłączone) i zapisuje kąt w karcie, dzięki czemu dokładnie ten sam widok pojawia się na każdym urządzeniu i w każdej przeglądarce. Wyłącz ją, aby ponownie swobodnie obracać.",
    chipsSection: "Wyświetlanie encji",
    chipsIntro:
      "Pokaż lub ukryj każdą encję i wybierz jej ikonę oraz kolor. Dom podąża za wybranym chipem lub domyślnie za Twoim kolorem podstawowym.",
    chipIrradiance: "Wyświetlanie nasłonecznienia",
    chipProduction: "Wyświetlanie produkcji",
    chipGrid: "Wyświetlanie sieci",
    chipBattery: "Wyświetlanie baterii",
    chipHome: "Wyświetlanie zużycia domu",
    groupsConfigTitle: "Konfiguracja grup",
    optionalSensors: "Czujniki opcjonalne",
    solarIrradianceEntity: "Encja nasłonecznienia solarnego",
    solarIrradianceEntityHelp:
      "Wybierz czujnik raportujący globalne nasłonecznienie krótkofalowe w W/m² (typowo Ecowitt / Davis / własna stacja pogodowa). Po ustawieniu jego bieżący stan i historia z rejestratora zastępują Open-Meteo dla bieżącego i przeszłego nasłonecznienia wszędzie tam, gdzie się pojawia (liczba na chipie słońca, oś Y wykresu PV, kolorowanie łuku słonecznego). Godziny prognozy pozostają na Open-Meteo, ponieważ czujnik nie może mieć wartości z przyszłości.",
    liveDataTitle: "Status konfiguracji",
    liveDataIntro:
      "Chipy na żywo pokazują wyłącznie zmierzone czujniki. Każda rodzina potrzebuje opcjonalnego czujnika mocy na żywo ze swojego źródła w panelu Energia - krzywe i sumy zawsze pochodzą z Twoich liczników.",
    liveSolarOk: "Solar: wykryto czujnik mocy na żywo.",
    liveSolarMissing:
      "Solar: brak czujnika mocy na żywo, chip produkcji pozostaje ukryty. Dodaj go w Ustawienia > Panele > Energia > Panele słoneczne.",
    liveSolarAbsent:
      "Solar: nie skonfigurowano w panelu Energia. Dodaj tam panele słoneczne, aby uzyskać chip produkcji.",
    liveGridOk: "Sieć: wykryto czujnik mocy na żywo.",
    liveGridMissing:
      "Sieć: brak czujnika mocy na żywo, chipy importu/eksportu pozostają ukryte. Dodaj go w Ustawienia > Panele > Energia > Sieć.",
    liveGridMiswired:
      "Sieć: czujnik mocy na żywo jest sprzeczny z Twoimi licznikami (wygląda na to, że mierzy tylko jeden kierunek). Chipy pozostają ukryte - skonfiguruj czujnik ze znakiem lub tryb Dwóch czujników.",
    liveGridAbsent:
      "Sieć: nie skonfigurowano w panelu Energia. Dodaj tam sieć, aby uzyskać chipy importu i eksportu.",
    liveBatteryOk: "Bateria: czujniki mocy na żywo obejmują każdą baterię.",
    liveBatteryMissing:
      "Bateria: brakuje mocy na żywo dla co najmniej jednej baterii, chip mocy pozostaje ukryty. Dodaj czujnik(i) mocy w Ustawienia > Panele > Energia > Bateria.",
    liveBatteryAbsent:
      "Bateria: nie skonfigurowana w panelu Energia. Dodaj tam baterię, aby uzyskać chip ładowania i rozładowania.",
    liveHomeOk:
      "Zużycie domu: pokazane, wyliczone z powyższych rodzin na żywo.",
    liveHomeNote:
      "Zużycie domu pojawia się, gdy każda skonfigurowana powyżej rodzina ma swój czujnik na żywo.",
    openEnergyConfig: "Otwórz konfigurację Energii",
    buildingsSection: "Dom i budynki",
    buildingsHint:
      'Aby karta działała płynnie w gęsto zabudowanych terenach miejskich, w 3D renderowane są tylko budynki w skonfigurowanym promieniu wokół domu. Sam dom pozostaje w pełnej nieprzezroczystości - pobliskie budynki są renderowane ze skonfigurowaną przezroczystością, aby dawały kontekst miejski bez konkurowania z nakładkami danych. Promień grupowania łączy przylegające zabudowania (werandy, garaże, szopy) w zbiór "domu".',
    displayRadius: "Promień wyświetlania",
    displayRadiusHelp:
      "Promień wokół domu, w którym budynki są pobierane i rysowane, aż do krawędzi przygaszonego dysku mapy. Zmniejsz, aby odciążyć renderowanie na wolnym urządzeniu - 0 pokazuje tylko dom.",
    buildingCount: "Liczba budynków",
    buildingCountHelp:
      "Maksymalna liczba pobliskich budynków do narysowania. Zmniejsz, aby odciążyć renderowanie na wolnym urządzeniu.",
    buildingRealSize: "Rzeczywiste wysokości budynków",
    buildingRealSizeOn: "Włączone",
    buildingRealSizeOff: "Wyłączone",
    buildingRealSizeHint:
      "Włączone: użyj rzeczywistych wysokości OpenStreetMap (ograniczonych, aby kadr pozostał czytelny). Wyłączone: nadaj każdemu budynkowi tę samą stałą wysokość poniżej.",
    buildingHeight: "Wysokość budynku",
    hiddenDevicesEmpty:
      "W panelu Energia nie są jeszcze śledzone żadne pojedyncze urządzenia. Dodaj tam zużycie urządzeń, aby zarządzać nimi tutaj.",
    deviceVisibilityLabel: "Pokaż urządzenie",
    group: "Grupa",
    noGroup: "Brak grupy",
    groupAssignHint:
      "Przeciągnij urządzenia do grupy. To, co zostanie na dole, nie należy do żadnej grupy.",
    groupDropHere: "Upuść tutaj urządzenie",
    backToLive: "Powrót do trybu na żywo",
    buildingClusterRadius: "Promień grupowania domu",
    buildingClusterRadiusHelp:
      "Promień wokół domu, w którym przylegające zabudowania (werandy, garaże, szopy) są traktowane jako część domu: są renderowane z pełną nieprzezroczystością i kolorem domu zamiast jako przygaszeni sąsiedzi. 0 zachowuje tylko budynek główny.",
    buildingOpacity: "Przezroczystość otoczenia",
    buildingColor: "Kolor budynków",
    buildingColorHelp:
      "Bazowy odcień stosowany do okolicznych budynków w scenie.",
    shadowsSection: "Cienie",
    moonSection: "Konfiguracja księżyca",
    shadowsEnabled: "Pokaż cienie",
    shadowsEnabledOn: "Pokazane",
    shadowsEnabledOff: "Ukryte",
    shadowsEnabledHint:
      "Przełącza cienie rzucane na ziemię przez budynki w miarę ruchu słońca.",
    shadowOpacity: "Przezroczystość cieni",
    shadowOpacityHint: "Przezroczystość rzucanych cieni na ziemi.",
    resetSection: "Reset",
    resetSectionHint:
      "Narzędzia konserwacyjne: ponowne pobranie danych zapisanych przez kartę w pamięci podręcznej lub przywrócenie wszystkich opcji do wartości domyślnych.",
    resetCacheButton: "Resetuj pamięć podręczną danych",
    resetCacheWarning:
      "Uwaga: to ponownie pobiera wszystko, co karta zapisała w pamięci podręcznej - pogodę Open-Meteo, każdą serię energii w pamięci (produkcja, sieć, bateria, urządzenia, nasłonecznienie), kalibrację dopracowanej prognozy oraz zarysy budynków OpenFreeMap - dla każdej otwartej na tej stronie karty Helios. Użyj tego, aby usunąć zablokowaną kalibrację lub nieaktualne dane pogody/mapy - pełne ponowne pobranie zajmuje kilka minut, zależnie od Twojego serwera HA. Twoje dane wewnątrz Home Assistant nigdy nie są naruszane.",
    resetCacheDone: "Pamięć podręczna wyczyszczona ✓",
    resetOptionsButton: "Przywróć domyślne opcje",
    resetOptionsConfirm: "Kliknij ponownie, aby potwierdzić",
    resetOptionsWarning:
      "Uwaga: to przywraca WSZYSTKIE opcje tej karty do wartości domyślnych - widoczność, kolory i ikony chipów, nazwy/kolory/ikony grup, budynki, cienie, jednostki i wszystkie inne ustawienia. Twoje dane Home Assistant i panel Energia pozostają nietknięte, ale Twoje dostosowania zostają wyczyszczone i nie da się ich cofnąć.",
    resetOptionsDone: "Opcje przywrócone do domyślnych ✓",
    aboutSection: "O karcie",
    aboutVersionLabel: "Wersja",
    aboutRepoCard: "Helios",
    aboutCoffeeMessage:
      "Tworzę Heliosa samodzielnie, głównie nocami, tropiąc drobne szczegóły, aż słońce i Twoja energia ożyją na ekranie. Jeśli karta znalazła miejsce na Twoim pulpicie, to już mnie cieszy - gwiazdka na GitHubie cieszy jeszcze bardziej, a kawa napędza dalszą pracę.",
    aboutDeveloperLabel: "Deweloper",
    aboutDeveloperLinkedIn: "LinkedIn",
    aboutCoffeeLink: "Postaw mi kawę",
  },
};
