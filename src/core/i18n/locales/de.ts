import type { Translations } from "../index";

//German locale.
export const de: Translations = {
  cardName: "Helios",
  cardDescription:
    "☀️ Eine 2.5D-Echtzeitansicht deines Zuhauses mit Sonne, Wetter, Solarproduktion, Batterie und Netz, dazu Schlagschatten und eine interaktive Zeitleiste",

  period: {
    rangeLabel: "Zeitraum",
    forecast: "Prognose",
    yesterday: "Gestern",
    today: "Heute",
    week: "Woche",
    month: "Monat",
    year: "Jahr",
  },

  compass: "N,NO,O,SO,S,SW,W,NW",

  cloudCover: {
    cloudLow: "Tiefe Bewölkung",
    cloudMid: "Mittlere Bewölkung",
    cloudHigh: "Hohe Bewölkung",
  },

  mapConfig: {
    section: "Kartenkonfiguration",
    intro:
      "Die Basiskarte wird aus OpenStreetMap-Vektorkacheln gezeichnet. Auto folgt deinem Theme, Dark / Light erzwingt eines, und Custom lässt dich jede Farbe einstellen und jede Ebene ausblenden.",
    modeAuto: "Auto",
    modeDark: "Dunkel",
    modeLight: "Hell",
    modeCustom: "Benutzerdefiniert",
    land: "Hintergrund",
    water: "Wasser",
    wood: "Wald",
    grass: "Grünflächen",
    sand: "Sand",
    wetland: "Feuchtgebiet",
    ice: "Eis & Schnee",
    landuse: "Bebautes Land",
    roadMajor: "Hauptstraßen",
    roadMinor: "Nebenstraßen",
    roadCasing: "Straßenumriss",
    path: "Wege & Pfade",
    rail: "Bahnlinien",
    building: "Gebäude",
    boundary: "Grenzen",
  },

  editor: {
    weatherEnabled: "Wettereffekte",
    weatherEnabledHint:
      "Zeichnet den echten Himmel über die Szene: Sonnenschein, Wolken, Regen, Schnee und Gewitter aus deinem lokalen Wetter, entlang der Zeitleiste, während du sie durchziehst. Ausgeschaltet bleibt die Szene klar.",
    temperatureEntity: "Temperatursensor",
    temperatureEntityHelp:
      "Optional. Verwendet einen lokalen Außentemperatursensor (°C) anstelle des Open-Meteo-Werts für den Temperatur-Chip. Sein aktueller Zustand und der Recorder-Verlauf werden für Live und Vergangenheit genutzt; Vorhersagestunden bleiben beim Modell.",
    humidityEntity: "Luftfeuchtigkeitssensor",
    humidityEntityHelp:
      "Optional. Verwendet einen lokalen Sensor für relative Luftfeuchtigkeit (%) anstelle des Open-Meteo-Werts, für Live und Vergangenheit.",
    cloudCoverEntity: "Bewölkungssensor",
    cloudCoverEntityHelp:
      "Optional. Verwendet einen lokalen Bewölkungssensor (%), um die Himmelsabstufung (Sonne, Eintrübung) zu steuern, anstelle des Open-Meteo-Werts, für Live und Vergangenheit.",
    precipitationEntity: "Niederschlagssensor",
    precipitationEntityHelp:
      "Optional. Verwendet einen lokalen Niederschlagssensor (mm), um die Regenebene zu steuern, anstelle des Open-Meteo-Werts, für Live und Vergangenheit.",
    snowfallEntity: "Schneefallsensor",
    snowfallEntityHelp:
      "Optional. Verwendet einen lokalen Schneefallsensor (cm), um die Schneeebene zu steuern, anstelle des Open-Meteo-Werts, für Live und Vergangenheit.",
    weatherEntity: "Wetterentität",
    weatherEntityHelp:
      "Optional. Verwendet eine Home Assistant Wetterentität, um die Bedingung (Regen / Schnee / Gewitter) zu steuern, anstelle des Open-Meteo-Werts, für Live und Vergangenheit. Vorhersagestunden bleiben beim Modell.",
    chipTemperature: "Temperaturanzeige",
    chipHumidity: "Luftfeuchtigkeitsanzeige",
    chipCost: "Kostenanzeige",
    locationSection: "Standort",
    homeLatitude: "Breitengrad des Zuhauses",
    homeLongitude: "Längengrad des Zuhauses",
    locationHint:
      "Überschreibt die Adresse des Zuhauses, die als Mittelpunkt der Karte dient. Lass beide Felder leer, um das in Home Assistant konfigurierte Zuhause zu verwenden. Die Überschreibung wird nur angewendet, wenn BEIDE Felder gültige Koordinaten enthalten.",
    uiAndMapSection: "UI",
    autoRotate: "Automatische Kameradrehung",
    autoRotateHint:
      "Nach ein paar Sekunden Inaktivität dreht sich die Kamera langsam um das Zuhause (etwa 1.5°/s, entgegen der scheinbaren Sonnenbewegung). Ein Wischen mit einem Finger pausiert sie sofort und sie läuft weiter, sobald du loslässt. Auf sehr alten Geräten besser vermeiden: die Autodrehung erzwingt jede Sekunde ein Rendern.",
    autoRotateOn: "An",
    autoRotateOff: "Aus",
    degradedRender: "Kompatibilitätsmodus",
    degradedRenderHint:
      "Zeichnet die Karte mit einer einfacheren, kompatibleren Methode. Aktivieren Sie dies, wenn die Szene beim Drehen oder Verschieben flackert oder reißt. Es behebt den Fehler auf einigen Smartphones und Tablets, allerdings zulasten einer etwas weniger flüssigen Bewegung.",
    dataDisplaySection: "Datenanzeige",
    maxExpectedPower: "Maximal erwartete Leistung",
    maxExpectedPowerHelp:
      "Die Leistung, bei der ein Fluss mit voller Geschwindigkeit animiert wird. Jeder Fluss wird an dieser einen Referenz gemessen, sodass ein größerer Fluss immer schneller wirkt als ein kleinerer, in welche Richtung er auch läuft. Erhöhe sie für eine große Anlage, senke sie für eine kleine. Standard 5000 W.",
    sunChipMode: "Sonnen-Chip-Anzeige",
    sunChipModeHelp:
      "Was der Sonnen-Chip zeigt: die Live-Bestrahlungsstärke (Standard) oder die Position der Sonne (Azimut und Höhe). Die Position braucht keinen Sensor, sie stammt aus den eigenen Sonnenberechnungen der Karte.",
      batteryChipMode: "Batterie-Chip-Anzeige",
      batteryChipModeHelp: "Was der Batterie-Chip zeigt: die Live-Leistung (Standard) oder den Ladezustand (%). Er weicht auf den Wert aus, den deine Batterie tatsächlich liefert.",
      batteryChipModePower: "Leistung",
      batteryChipModeSoc: "Ladezustand",
    sunChipModeIrradiance: "Bestrahlungsstärke",
    sunChipModePosition: "Sonnenposition",
    displayUpdateFrequency: "Diagrammdetail",
    displayUpdateFrequencyHelp:
      "Wie viele Punkte pro Stunde die Diagramme zeichnen. Die Daten selbst sind immer die 5-Minuten-Statistiken von Home Assistant; dies steuert nur, wie dicht die Kurve gezeichnet wird: 1 = ein Punkt pro Stunde (am glattesten, am leichtesten zu rendern), 6 = ein Punkt alle 10 Minuten (volles Detail, am schwersten). Standard 4 = ein Punkt alle 15 Minuten. Senke ihn auf älteren oder langsameren Geräten, um den Renderaufwand zu verringern. Die Prognosekurve folgt derselben Taktung, eine feinere Einstellung zeigt also auch kurze Schatteneinbrüche (ein Baum, der die Produktion eine halbe Stunde lang verdeckt), über die eine stündliche Kurve hinweggeht.",
    valueDecimals: "Dezimalstellen",
    valueDecimalsHelp:
      "Anzahl der Dezimalstellen, die bei jeder Wertanzeige gezeigt werden, damit die Chips einheitlich wirken. Gilt für kW-Werte (ganze Watt bleiben ganzzahlig) und für kWh. 0 bis 3, Standard 1.",
    powerUnit: "Leistungseinheit",
    powerUnitHelp:
      "Einheit für jede Leistungsanzeige auf der Karte (Chips, Diagramm-Tooltips). Energie folgt ihr ebenfalls, damit die Karte konsistent bleibt: kW passt zu kWh, W zu Wh.",
    irradianceUnit: "Einheit der Solarkonstante",
    irradianceUnitHelp:
      "Einheit für die Anzeige der Solarkonstante (Bestrahlungsstärke) über der Sonne.",
    batterySign: "Batterievorzeichen",
    batterySignHelp:
      "Vorzeichen, das auf dem Batterie-Chip angezeigt wird. Standard ist Minus beim Laden und Plus beim Entladen. Invertiert dreht es um. Ausgeblendet zeigt den Wert ohne Vorzeichen.",
    batterySignDefault: "Standard",
    batterySignInverted: "Invertiert",
    batterySignHidden: "Ausgeblendet",
    noUiMode: "Kein-UI-Modus",
    noUiModeHint:
      "Blendet die Zeitleiste und die Bedienelemente auf der Karte nach einigen Sekunden Inaktivität aus. Jedes Tippen oder Bewegen holt sie zurück. Ideal für ein Wandbild-Display.",
    noUiDelay: "Verzögerung bis zum Ausblenden",
    noUiDelayHint:
      "Sekunden der Inaktivität, bevor die Zeitleiste und die Bedienelemente im Kein-UI-Modus ausblenden. 0 hält die UI dauerhaft ausgeblendet. Wird nur verwendet, wenn der Kein-UI-Modus aktiv ist.",
    showTimeline: "Zeitleiste anzeigen",
    showTimelineHint:
      "Zeigt die Zeitleiste und die Zeitraumauswahl unter der Szene an. Aus lässt nur die Szene übrig.",
    showDetailPanel: "Zusätzliche Informationen anzeigen",
    showDetailPanelHint:
      "Erlaubt, dass das Mini-Panel pro Chip (aggregierte Kennzahlen) oben rechts erscheint, wenn ein Chip angetippt wird. Aus zeigt es nie an.",
    showSunTimes: "Sonnenauf- / -untergangszeiten anzeigen",
    showSunTimesHint:
      "Zeigt die Zeiten für Sonnenauf- und -untergang sowie deren Markierungen an den Füßen des Sonnenbogens an.",
    showHorizonLine: "Geländehorizont anzeigen",
    showHorizonLineHint: "Zeichnet die Horizontlinie des Geländes rund um das Zuhause, aus dem lokalen Relief berechnet. Der Horizont dämpft die Sonne immer realistisch hinter Hügeln; dies blendet nur die gezeichnete Linie ein oder aus.",
    horizonLineColor: "Farbe des Geländehorizonts",
    horizonLineColorHint: "Farbe der Geländehorizontlinie.",
    lockRotation: "Drehung sperren",
    lockRotationHint:
      "Ziehen Sie in der Vorschau, um die Szene zu drehen und zu neigen, bis Sie die gewünschte Ansicht haben, und schalten Sie dies dann ein. Die Sperre friert diese Ansicht ein (Drehen per Ziehen und die automatische Rotation im Leerlauf werden deaktiviert) und speichert den Winkel in der Karte, sodass genau dieselbe Ansicht auf jedem Gerät und in jedem Browser erscheint. Schalten Sie sie aus, um wieder frei zu drehen.",
    chipsSection: "Entitätenanzeige",
    chipsIntro:
      "Blende jede Entität ein oder aus und wähle ihr Symbol und ihre Farbe. Das Zuhause folgt dem ausgewählten Chip oder standardmäßig deiner Primärfarbe.",
    chipIrradiance: "Anzeige der Bestrahlungsstärke",
    chipProduction: "Anzeige der Produktion",
    chipGrid: "Anzeige des Netzes",
    chipBattery: "Anzeige der Batterie",
    chipHome: "Anzeige des Hausverbrauchs",
    groupsConfigTitle: "Gruppenkonfiguration",
    optionalSensors: "Optionale Sensoren",
    solarIrradianceEntity: "Sonneneinstrahlungs-Entität",
    solarIrradianceEntityHelp:
      "Wähle einen Sensor, der die globale kurzwellige Bestrahlungsstärke in W/m² meldet (typischerweise eine Ecowitt- / Davis- / private Wetterstation). Wenn gesetzt, ersetzen sein aktueller Zustand und sein Recorder-Verlauf Open-Meteo für die Live- und Vergangenheitsbestrahlung überall, wo sie erscheint (Zahl auf dem Sonnen-Chip, Y-Achse des PV-Diagramms, Färbung des Sonnenbogens). Prognosestunden bleiben bei Open-Meteo, da ein Sensor keine Zukunftswerte liefern kann.",
    liveDataTitle: "Konfigurationsstatus",
    liveDataIntro:
      "Live-Chips zeigen ausschließlich gemessene Sensoren an. Jede Familie benötigt den optionalen Live-Leistungssensor ihrer Energie-Dashboard-Quelle; Kurven und Summen stammen immer von deinen Zählern.",
    liveSolarOk: "Solar: Live-Leistungssensor erkannt.",
    liveSolarMissing:
      "Solar: kein Live-Leistungssensor, der Produktions-Chip bleibt ausgeblendet. Füge einen unter Einstellungen > Dashboards > Energie > Solarmodule hinzu.",
    liveSolarAbsent:
      "Solar: in deinem Energie-Dashboard nicht eingerichtet. Füge dort Solarmodule hinzu, um den Produktions-Chip zu erhalten.",
    liveGridOk: "Netz: Live-Leistungssensor erkannt.",
    liveGridMissing:
      "Netz: kein Live-Leistungssensor, die Bezug/Einspeisung-Chips bleiben ausgeblendet. Füge einen unter Einstellungen > Dashboards > Energie > Netz hinzu.",
    liveGridMiswired:
      "Netz: der Live-Leistungssensor widerspricht deinen Zählern (er scheint nur eine Richtung zu messen). Die Chips bleiben ausgeblendet; konfiguriere einen vorzeichenbehafteten Sensor oder den Zwei-Sensoren-Modus.",
    liveGridAbsent:
      "Netz: in deinem Energie-Dashboard nicht eingerichtet. Füge dort das Netz hinzu, um die Bezugs- und Einspeisungs-Chips zu erhalten.",
    liveBatteryOk: "Batterie: Live-Leistungssensoren decken jede Batterie ab.",
    liveBatteryMissing:
      "Batterie: bei mindestens einer Batterie fehlt die Live-Leistung, der Leistungs-Chip bleibt ausgeblendet. Füge den/die Leistungssensor(en) unter Einstellungen > Dashboards > Energie > Batterie hinzu.",
    liveBatteryAbsent:
      "Batterie: in deinem Energie-Dashboard nicht eingerichtet. Füge dort eine Batterie hinzu, um den Lade- und Entlade-Chip zu erhalten.",
    liveHomeOk:
      "Hausverbrauch: wird angezeigt, abgeleitet aus den obigen Live-Familien.",
    liveHomeNote:
      "Hausverbrauch: erscheint, sobald jede oben konfigurierte Familie ihren Live-Sensor hat.",
    openEnergyConfig: "Energie-Konfiguration öffnen",
    buildingsSection: "Zuhause & Gebäude",
    buildingsHint:
      'Damit die Karte in dicht bebauten Stadtgebieten flüssig bleibt, werden nur Gebäude innerhalb des konfigurierten Radius um das Zuhause in 3D gerendert. Das Zuhause selbst bleibt voll deckend; nahe Gebäude werden mit der konfigurierten Deckkraft gerendert, sodass sie städtischen Kontext liefern, ohne mit den Datenoverlays zu konkurrieren. Der Cluster-Radius gruppiert angebaute Nebengebäude (Wintergärten, Garagen, Schuppen) in die "Zuhause"-Gruppe.',
    displayRadius: "Anzeigeradius",
    displayRadiusHelp:
      "Radius um das Zuhause, in dem Gebäude geladen und gezeichnet werden, bis zum Rand der ausgeblendeten Kartenscheibe. Senke ihn, um das Rendern auf einem langsamen Gerät zu erleichtern; 0 zeigt nur das Zuhause.",
    buildingCount: "Anzahl Gebäude",
    buildingCountHelp:
      "Maximale Anzahl naher Gebäude, die gezeichnet werden. Senke sie, um das Rendern auf einem langsamen Gerät zu erleichtern.",
    buildingRealSize: "Reale Gebäudehöhen",
    buildingRealSizeOn: "An",
    buildingRealSizeOff: "Aus",
    buildingRealSizeHint:
      "An: reale OpenStreetMap-Höhen verwenden (begrenzt, damit der Bildausschnitt lesbar bleibt). Aus: jedem Gebäude die gleiche feste Höhe unten geben.",
    buildingHeight: "Gebäudehöhe",
    hiddenDevicesEmpty:
      "In deinem Energie-Dashboard werden noch keine einzelnen Geräte erfasst. Füge dort den Geräteverbrauch hinzu, um sie hier zu steuern.",
    deviceVisibilityLabel: "Gerät anzeigen",
    group: "Gruppe",
    noGroup: "Keine Gruppe",
    groupAssignHint:
      "Zieh deine Geräte in eine Gruppe. Was unten übrig bleibt, gehört zu keiner Gruppe.",
    groupDropHere: "Gerät hier ablegen",
    backToLive: "Zurück zu Live",
    buildingClusterRadius: "Cluster-Radius Zuhause",
    buildingClusterRadiusHelp:
      "Radius um das Zuhause, innerhalb dessen angebaute Nebengebäude (Wintergärten, Garagen, Schuppen) als Teil des Zuhauses behandelt werden: sie werden mit der vollen Deckkraft und Farbe des Zuhauses statt als ausgeblendete Nachbarn gerendert. 0 behält nur das Hauptgebäude.",
    buildingOpacity: "Deckkraft der Umgebung",
    buildingColor: "Gebäudefarbe",
    buildingColorHelp:
      "Grundton, der auf die umliegenden Gebäude in der Szene angewendet wird.",
    shadowsSection: "Schatten",
    shadowsEnabled: "Schatten anzeigen",
    shadowsEnabledOn: "Angezeigt",
    shadowsEnabledOff: "Ausgeblendet",
    shadowsEnabledHint:
      "Schaltet die Bodenschatten ein oder aus, die die Gebäude werfen, während die Sonne wandert.",
    shadowOpacity: "Schattendeckkraft",
    shadowOpacityHint: "Deckkraft der geworfenen Bodenschatten.",
    resetSection: "Zurücksetzen",
    resetSectionHint:
      "Wartungswerkzeuge: die zwischengespeicherten Daten der Karte erneut abrufen, oder alle Optionen auf ihre Standardwerte zurücksetzen.",
    resetCacheButton: "Datencache zurücksetzen",
    resetCacheWarning:
      "Achtung: dies ruft alles, was die Karte zwischengespeichert hat, erneut ab - das Open-Meteo-Wetter, jede Energiereihe im Speicher (Produktion, Netz, Batterie, Geräte, Bestrahlungsstärke), die Kalibrierung der verfeinerten Prognose und die OpenFreeMap-Gebäudeumrisse - für jede auf dieser Seite geöffnete Helios-Karte. Nutze es, um eine feststeckende Kalibrierung oder veraltete Wetter-/Kartendaten zu löschen; ein vollständiger Neuabruf dauert je nach deinem HA-Server einige Minuten. Deine Daten in Home Assistant werden nie angetastet.",
    resetCacheDone: "Cache gelöscht ✓",
    resetOptionsButton: "Optionen auf Standard zurücksetzen",
    resetOptionsConfirm: "Zum Bestätigen erneut klicken",
    resetOptionsWarning:
      "Achtung: dies setzt ALLE Optionen dieser Karte auf ihre Standardwerte zurück - Chip-Sichtbarkeit, Farben und Symbole, Gruppennamen/-farben/-symbole, Gebäude, Schatten, Einheiten und jede andere Einstellung. Deine Home Assistant-Daten und dein Energie-Dashboard bleiben unangetastet, aber deine Anpassungen werden gelöscht und können nicht wiederhergestellt werden.",
    resetOptionsDone: "Optionen zurückgesetzt ✓",
    aboutSection: "Über",
    aboutVersionLabel: "Version",
    aboutRepoCard: "Helios",
    aboutCoffeeMessage:
      "Ich baue Helios allein, meistens nachts, und jage kleinen Details hinterher, bis die Sonne und deine Energie auf dem Bildschirm lebendig wirken. Wenn sie einen Platz auf deinem Dashboard gefunden hat, macht mich das schon glücklich - ein Stern auf GitHub noch mehr, und ein Kaffee hält alles am Laufen.",
    aboutDeveloperLabel: "Entwickler",
    aboutDeveloperLinkedIn: "LinkedIn",
    aboutCoffeeLink: "Buy me a coffee",
  },
};
