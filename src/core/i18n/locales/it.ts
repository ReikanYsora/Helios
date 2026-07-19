import type { Translations } from "../index";

//Italian locale.
export const it: Translations = {
  cardName: "Helios",
  cardDescription:
    "☀️ Una vista 2.5D in tempo reale di casa tua con il sole, il meteo, la produzione solare, la batteria e la rete, oltre alle ombre proiettate e una linea temporale interattiva",

  period: {
    rangeLabel: "Periodo",
    forecast: "Previsione",
    yesterday: "Ieri",
    today: "Oggi",
    week: "Settimana",
    month: "Mese",
    year: "Anno",
  },

  cloudCover: {
    cloudLow: "Nuvolosità bassa",
    cloudMid: "Nuvolosità media",
    cloudHigh: "Nuvolosità alta",
  },

  mapConfig: {
    section: "Configurazione mappa",
    intro:
      "La mappa di base è disegnata a partire dai tile vettoriali di OpenStreetMap. Auto segue il tuo tema, Dark / Light ne forzano uno, e Custom ti permette di impostare ogni colore e nascondere qualsiasi livello.",
    modeAuto: "Auto",
    modeDark: "Dark",
    modeLight: "Light",
    modeCustom: "Custom",
    land: "Sfondo",
    water: "Acqua",
    wood: "Boschi",
    grass: "Verde",
    sand: "Sabbia",
    wetland: "Zone umide",
    ice: "Ghiaccio e neve",
    landuse: "Aree edificate",
    roadMajor: "Strade principali",
    roadMinor: "Strade secondarie",
    roadCasing: "Contorno strade",
    path: "Sentieri e piste",
    rail: "Ferrovie",
    building: "Edifici",
    boundary: "Confini",
  },

  editor: {
    locationSection: "Posizione di casa",
    homeLatitude: "Latitudine di casa",
    homeLongitude: "Longitudine di casa",
    locationHint:
      "Sostituisce l'indirizzo di casa usato come centro della scheda. Lascia entrambi i campi vuoti per usare la casa configurata in Home Assistant. La sostituzione viene applicata solo quando ENTRAMBI i campi contengono coordinate valide.",
    uiAndMapSection: "UI",
    autoRotate: "Rotazione automatica della camera",
    autoRotateHint:
      "Dopo qualche secondo di inattività, la camera ruota lentamente intorno alla casa (circa 1,5°/s, in senso opposto al moto apparente del sole). Un trascinamento con un dito la mette in pausa all'istante e riprende appena lasci. Da evitare su dispositivi molto vecchi: la rotazione automatica forza un rendering ogni secondo.",
    autoRotateOn: "Attiva",
    autoRotateOff: "Disattiva",
    dataDisplaySection: "Visualizzazione dati",
    displayUpdateFrequency: "Dettaglio del grafico",
    displayUpdateFrequencyHelp:
      "Quanti punti per ora disegnano i grafici. I dati stessi sono sempre le statistiche a 5 minuti di Home Assistant; questo controlla solo quanto densamente viene tracciata la curva: 1 = un punto all'ora (la più morbida, la più leggera da rendere), 6 = un punto ogni 10 minuti (dettaglio massimo, la più pesante). Predefinito 4 = un punto ogni 15 minuti. Abbassalo su dispositivi vecchi o lenti per ridurre il costo di rendering. La curva di previsione segue la stessa cadenza, quindi un'impostazione più fine fa emergere anche i brevi cali d'ombra (un albero che taglia la produzione per mezz'ora) che una curva oraria scavalca.",
    valueDecimals: "Decimali",
    valueDecimalsHelp:
      "Numero di decimali mostrati su ogni valore, così i chip restano uniformi. Si applica ai valori in kW (i watt interi restano interi) e ai kWh. Da 0 a 3, predefinito 1.",
    powerUnit: "Unità di potenza",
    powerUnitHelp:
      "Unità per ogni lettura di potenza sulla scheda (chip, tooltip del grafico). Anche l'energia la segue, così la scheda resta coerente: kW si abbina a kWh, W a Wh.",
    irradianceUnit: "Unità della costante solare",
    irradianceUnitHelp:
      "Unità per la lettura della costante solare (irraggiamento) sopra il sole.",
    batterySign: "Segno della batteria",
    batterySignHelp:
      "Segno mostrato sul chip della batteria. Per impostazione predefinita è meno durante la carica e più durante la scarica. Invertito lo capovolge. Nascosto mostra il valore senza segno.",
    batterySignDefault: "Predefinito",
    batterySignInverted: "Invertito",
    batterySignHidden: "Nascosto",
    noUiMode: "Modalità senza interfaccia",
    noUiModeHint:
      "Sfuma la timeline e i controlli sulla scheda dopo alcuni secondi di inattività. Qualsiasi tocco o movimento li fa riapparire. Ottimo per un wall display.",
    noUiDelay: "Ritardo prima di nascondere",
    noUiDelayHint:
      "Secondi di inattività prima che la timeline e i controlli svaniscano in modalità senza interfaccia. 0 mantiene l'interfaccia nascosta in modo permanente. Usato solo quando la modalità senza interfaccia è attiva.",
    showTimeline: "Mostra timeline",
    showTimelineHint:
      "Mostra la timeline e il selettore del periodo sotto la scena. Disattivato, resta solo la scena.",
    showDetailPanel: "Mostra informazioni aggiuntive",
    showDetailPanelHint:
      "Consente l'apertura del mini-pannello per chip (metriche aggregate) in alto a destra al tocco di un chip. Disattivato, non compare mai.",
    showSunTimes: "Mostra orari alba / tramonto",
    showSunTimesHint:
      "Mostra gli orari di alba e tramonto e i relativi indicatori ai piedi dell'arco solare.",
    lockRotation: "Blocca rotazione",
    lockRotationHint:
      "Imposta l'angolo di visuale direttamente nell'anteprima (trascina per ruotare e inclinare la scena), poi attiva il blocco per congelarlo: il trascinamento per ruotare e la rotazione automatica in inattività vengono disattivati, mantenendo l'angolo impostato.",
    chipsSection: "Visualizzazione entità",
    chipsIntro:
      "Mostra o nascondi ogni entità e scegli la sua icona e il suo colore. La casa segue il chip selezionato, oppure il tuo colore primario per impostazione predefinita.",
    chipIrradiance: "Visualizzazione irraggiamento",
    chipProduction: "Visualizzazione produzione",
    chipGrid: "Visualizzazione rete",
    chipBattery: "Visualizzazione batteria",
    chipHome: "Visualizzazione consumo casa",
    groupsConfigTitle: "Configurazione gruppi",
    optionalSensors: "Sensori opzionali",
    solarIrradianceEntity: "Entità di irraggiamento solare",
    solarIrradianceEntityHelp:
      "Scegli un sensore che riporta l'irraggiamento globale a onda corta in W/m² (tipico delle stazioni Ecowitt / Davis / meteo personali). Quando impostato, il suo stato attuale e lo storico del recorder sostituiscono Open-Meteo per l'irraggiamento live e passato ovunque appaia (numero sul chip del sole, asse Y del grafico FV, colorazione dell'arco solare). Le ore di previsione restano su Open-Meteo, dato che un sensore non può avere valori futuri.",
    liveDataTitle: "Stato della configurazione",
    liveDataIntro:
      "I chip live mostrano solo sensori misurati. Ogni famiglia necessita del sensore di potenza live opzionale della propria fonte nel dashboard Energia; curve e totali provengono sempre dai tuoi contatori.",
    liveSolarOk: "Solare: sensore di potenza live rilevato.",
    liveSolarMissing:
      "Solare: nessun sensore di potenza live, il chip di produzione resta nascosto. Aggiungine uno in Impostazioni > Dashboard > Energia > Pannelli solari.",
    liveSolarAbsent:
      "Solare: non configurato nel tuo dashboard Energia. Aggiungi i pannelli solari lì per ottenere il chip di produzione.",
    liveGridOk: "Rete: sensore di potenza live rilevato.",
    liveGridMissing:
      "Rete: nessun sensore di potenza live, i chip import/export restano nascosti. Aggiungine uno in Impostazioni > Dashboard > Energia > Rete.",
    liveGridMiswired:
      "Rete: il sensore di potenza live contraddice i tuoi contatori (sembra misurare una sola direzione). I chip restano nascosti; configura un sensore con segno o la modalità Due sensori.",
    liveGridAbsent:
      "Rete: non configurata nel tuo dashboard Energia. Aggiungi la rete lì per ottenere i chip di import ed export.",
    liveBatteryOk: "Batteria: i sensori di potenza live coprono ogni batteria.",
    liveBatteryMissing:
      "Batteria: potenza live mancante su almeno una batteria, il chip di potenza resta nascosto. Aggiungi i sensori di potenza in Impostazioni > Dashboard > Energia > Batteria.",
    liveBatteryAbsent:
      "Batteria: non configurata nel tuo dashboard Energia. Aggiungi una batteria lì per ottenere il chip di carica e scarica.",
    liveHomeOk: "Consumo casa: mostrato, derivato dalle famiglie live sopra.",
    liveHomeNote:
      "Consumo casa: compare quando ogni famiglia configurata sopra ha il proprio sensore live.",
    openEnergyConfig: "Apri configurazione Energia",
    buildingsSection: "Casa ed edifici",
    buildingsHint:
      'Per mantenere la scheda fluida nelle zone urbane dense, solo gli edifici entro il raggio configurato attorno alla casa vengono resi in 3D. La casa stessa resta a piena opacità; gli edifici vicini vengono resi con l\'opacità configurata così da dare contesto urbano senza competere con i livelli di dati. Il raggio di raggruppamento unisce le pertinenze attigue (verande, garage, capanni) nel gruppo "casa".',
    displayRadius: "Raggio di visualizzazione",
    displayRadiusHelp:
      "Raggio attorno alla casa in cui gli edifici vengono recuperati e disegnati, fino al bordo del disco della mappa sfumato. Abbassalo per alleggerire il rendering su un dispositivo lento; 0 mostra solo la casa.",
    buildingCount: "Numero di edifici",
    buildingCountHelp:
      "Numero massimo di edifici vicini da disegnare. Abbassalo per alleggerire il rendering su un dispositivo lento.",
    buildingRealSize: "Altezze reali degli edifici",
    buildingRealSizeOn: "Sì",
    buildingRealSizeOff: "No",
    buildingRealSizeHint:
      "Sì: usa le altezze reali di OpenStreetMap (limitate per mantenere un'inquadratura leggibile). No: assegna a ogni edificio la stessa altezza fissa qui sotto.",
    buildingHeight: "Altezza degli edifici",
    hiddenDevicesEmpty:
      "Nessun dispositivo individuale è ancora tracciato nel tuo dashboard Energia. Aggiungi lì il consumo per dispositivo per gestirli qui.",
    deviceVisibilityLabel: "Mostra dispositivo",
    deviceGroupLabel: "Gruppo di monitoraggio",
    group: "Gruppo",
    noGroup: "Nessun gruppo",
    devicesEnergyNote:
      "Questi sono i dispositivi individuali attualmente configurati nel tuo dashboard Energia di Home Assistant. L'occhio mostra o nasconde ciascuno ovunque, e la pillola lo assegna a un gruppo.",
    buildingClusterRadius: "Raggio di raggruppamento casa",
    buildingClusterRadiusHelp:
      "Raggio attorno alla casa entro cui le pertinenze attigue (verande, garage, capanni) sono considerate parte della casa: vengono rese con la piena opacità e il colore della casa invece che come vicini sfumati. 0 mantiene solo l'edificio principale.",
    buildingOpacity: "Opacità circostante",
    buildingColor: "Colore degli edifici",
    buildingColorHelp:
      "Tinta di base applicata agli edifici circostanti nella scena.",
    shadowsSection: "Ombre",
    shadowsEnabled: "Mostra ombre",
    shadowsEnabledOn: "Mostrate",
    shadowsEnabledOff: "Nascoste",
    shadowsEnabledHint:
      "Attiva o nasconde le ombre proiettate al suolo dagli edifici mentre il sole si sposta.",
    shadowOpacity: "Opacità delle ombre",
    shadowOpacityHint: "Opacità delle ombre proiettate al suolo.",
    resetSection: "Reimposta",
    resetSectionHint:
      "Strumenti di manutenzione: recupera di nuovo i dati messi in cache dalla scheda, oppure reimposta tutte le opzioni ai valori predefiniti.",
    resetCacheButton: "Reimposta la cache dei dati",
    resetCacheWarning:
      "Attenzione: questo recupera di nuovo tutto ciò che la scheda ha messo in cache: il meteo Open-Meteo, ogni serie di energia in memoria (produzione, rete, batteria, dispositivi, irraggiamento), la calibrazione della previsione affinata e le impronte degli edifici OpenFreeMap, per ogni scheda Helios aperta su questa pagina. Usalo per risolvere una calibrazione bloccata o dati meteo/mappa obsoleti; un recupero completo richiede alcuni minuti a seconda del tuo server HA. I tuoi dati dentro Home Assistant non vengono mai toccati.",
    resetCacheDone: "Cache svuotata ✓",
    resetOptionsButton: "Reimposta le opzioni ai valori predefiniti",
    resetOptionsConfirm: "Clicca di nuovo per confermare",
    resetOptionsWarning:
      "Attenzione: questo reimposta TUTTE le opzioni di questa scheda ai valori predefiniti: visibilità, colori e icone dei chip, nomi/colori/icone dei gruppi, edifici, ombre, unità e ogni altra impostazione. I tuoi dati Home Assistant e il dashboard Energia non vengono toccati, ma la tua personalizzazione viene cancellata e non può essere ripristinata.",
    resetOptionsDone: "Opzioni reimpostate ✓",
    aboutSection: "Informazioni",
    aboutVersionLabel: "Versione",
    aboutRepoCard: "Helios",
    aboutCoffeeMessage:
      "Sviluppo Helios da solo, per lo più di notte, inseguendo i piccoli dettagli finché il sole e la tua energia non prendono vita sullo schermo. Se ha trovato un posto sul tuo dashboard, questo mi rende già felice; una stella su GitHub ancora di più, e un caffè tiene tutto in movimento.",
    aboutDeveloperLabel: "Sviluppatore",
    aboutDeveloperLinkedIn: "LinkedIn",
    aboutCoffeeLink: "Buy me a coffee",
  },
};
