import type { Translations } from "../index";

//Spanish (Spain) locale.
export const es: Translations = {
  cardName: "Helios",
  cardDescription:
    "☀️ Una vista 2.5D en tiempo real de tu casa con el sol, el tiempo, la producción solar, la batería y la red, además de sombras proyectadas y una línea de tiempo interactiva",

  period: {
    rangeLabel: "Periodo",
    forecast: "Previsión",
    yesterday: "Ayer",
    today: "Hoy",
    week: "Semana",
    month: "Mes",
    year: "Año",
  },

  cloudCover: {
    cloudLow: "Nubosidad baja",
    cloudMid: "Nubosidad media",
    cloudHigh: "Nubosidad alta",
  },

  mapConfig: {
    section: "Configuración del mapa",
    intro:
      "El mapa base se dibuja a partir de teselas vectoriales de OpenStreetMap. Auto sigue tu tema, Oscuro / Claro fuerzan uno, y Personalizado te permite ajustar cada color y ocultar cualquier capa.",
    modeAuto: "Auto",
    modeDark: "Oscuro",
    modeLight: "Claro",
    modeCustom: "Personalizado",
    land: "Fondo",
    water: "Agua",
    wood: "Bosque",
    grass: "Zonas verdes",
    sand: "Arena",
    wetland: "Humedal",
    ice: "Hielo y nieve",
    landuse: "Suelo urbanizado",
    roadMajor: "Carreteras principales",
    roadMinor: "Carreteras secundarias",
    roadCasing: "Contorno de las vías",
    path: "Sendas y caminos",
    rail: "Vías férreas",
    building: "Edificios",
    boundary: "Límites administrativos",
  },

  editor: {
    locationSection: "Ubicación del domicilio",
    homeLatitude: "Latitud del domicilio",
    homeLongitude: "Longitud del domicilio",
    locationHint:
      "Sustituye la dirección del domicilio usada como centro de la tarjeta. Deja ambos campos vacíos para usar el domicilio configurado en Home Assistant. La sustitución solo se aplica cuando AMBOS campos contienen coordenadas válidas.",
    uiAndMapSection: "UI",
    autoRotate: "Rotación automática de la cámara",
    autoRotateHint:
      "Tras unos segundos de inactividad, la cámara orbita lentamente alrededor de la casa (unos 1.5°/s, en sentido contrario al movimiento aparente del sol). Un arrastre con un dedo la pausa al instante y se reanuda en cuanto sueltas. Evítala en dispositivos muy antiguos: la rotación automática fuerza un renderizado cada segundo.",
    autoRotateOn: "Activada",
    autoRotateOff: "Desactivada",
    dataDisplaySection: "Visualización de datos",
    displayUpdateFrequency: "Detalle del gráfico",
    displayUpdateFrequencyHelp:
      "Cuántos puntos por hora dibujan los gráficos. Los datos en sí siempre son las estadísticas de 5 minutos de Home Assistant; esto solo controla la densidad del trazado de la curva: 1 = un punto por hora (lo más suave, lo más ligero de renderizar), 6 = un punto cada 10 minutos (detalle máximo, lo más pesado). Por defecto 4 = un punto cada 15 minutos. Bájalo en dispositivos antiguos o lentos para reducir el coste de renderizado. La curva de previsión sigue la misma cadencia, así que un ajuste más fino también revela las bajadas cortas por sombra (un árbol que corta la producción media hora) que una curva horaria pasa por alto.",
    valueDecimals: "Decimales",
    valueDecimalsHelp:
      "Número de decimales mostrados en cada lectura de valor, para que los chips se lean uniformes. Se aplica a los valores en kW (los vatios enteros siguen siendo enteros) y a los kWh. De 0 a 3, por defecto 1.",
    powerUnit: "Unidad de potencia",
    powerUnitHelp:
      "Unidad para cada lectura de potencia en la tarjeta (chips, información sobre herramientas del gráfico). La energía también la sigue, así que la tarjeta se mantiene coherente: kW se combina con kWh, y W con Wh.",
    irradianceUnit: "Unidad de constante solar",
    irradianceUnitHelp:
      "Unidad para la lectura de la constante solar (irradiancia) sobre el sol.",
    batterySign: "Signo de la batería",
    batterySignHelp:
      "Signo que se muestra en el chip de la batería. Por defecto es menos al cargar y más al descargar. Invertido lo cambia. Oculto muestra el valor sin signo.",
    batterySignDefault: "Por defecto",
    batterySignInverted: "Invertido",
    batterySignHidden: "Oculto",
    noUiMode: "Modo sin interfaz",
    noUiModeHint:
      "Atenúa la línea de tiempo y los controles de la tarjeta tras unos segundos de inactividad. Cualquier toque o movimiento los vuelve a mostrar. Ideal para una pantalla de pared.",
    noUiDelay: "Retraso de inactividad antes de ocultar",
    noUiDelayHint:
      "Segundos de inactividad antes de que la línea de tiempo y los controles se desvanezcan en el modo sin interfaz. 0 mantiene la interfaz oculta de forma permanente. Solo se usa cuando el modo sin interfaz está activado.",
    showTimeline: "Mostrar línea de tiempo",
    showTimelineHint:
      "Muestra la línea de tiempo y el selector de periodo debajo de la escena. Al desactivarlo, solo se muestra la escena.",
    showDetailPanel: "Mostrar información adicional",
    showDetailPanelHint:
      "Permite que el mini-panel de cada chip (métricas agregadas) se abra en la esquina superior derecha al tocar un chip. Desactivado, nunca se muestra.",
    showSunTimes: "Mostrar horas de salida y puesta del sol",
    showSunTimesHint:
      "Muestra las horas de salida y puesta del sol y sus marcadores en los extremos del arco solar.",
    lockRotation: "Bloquear rotación",
    lockRotationHint:
      "Ajusta el ángulo de visión directamente en la vista previa (arrastra para rotar e inclinar la escena) y luego activa el bloqueo para fijarlo: se desactivan el arrastre para rotar y la órbita automática por inactividad, conservando el ángulo elegido.",
    chipsSection: "Visualización de entidades",
    chipsIntro:
      "Muestra u oculta cada entidad, y elige su icono y color. La casa sigue el color del chip seleccionado, o el color principal por defecto.",
    chipIrradiance: "Visualización de la irradiancia",
    chipProduction: "Visualización de la producción",
    chipGrid: "Visualización de la red",
    chipBattery: "Visualización de la batería",
    chipHome: "Visualización del consumo del hogar",
    groupsConfigTitle: "Configuración de grupos",
    optionalSensors: "Sensores opcionales",
    solarIrradianceEntity: "Entidad de irradiancia solar",
    solarIrradianceEntityHelp:
      "Elige un sensor que reporte la irradiancia global de onda corta en W/m² (típico de estaciones Ecowitt / Davis / meteorológicas personales). Cuando se define, su estado actual y su historial del recorder reemplazan a Open-Meteo para la irradiancia en directo y pasada en todos los sitios donde aparece (número del chip del sol, eje Y del gráfico FV, coloreado del arco solar). Las horas de previsión siguen usando Open-Meteo, ya que un sensor no puede tener valores futuros.",
    liveDataTitle: "Estado de la configuración",
    liveDataIntro:
      "Los chips en directo solo muestran sensores medidos. Cada familia necesita el sensor de potencia en directo opcional de su fuente en el panel de Energía; las curvas y los totales siempre provienen de tus medidores.",
    liveSolarOk: "Solar: sensor de potencia en directo detectado.",
    liveSolarMissing:
      "Solar: no hay sensor de potencia en directo, el chip de producción permanece oculto. Añade uno en Ajustes > Paneles > Energía > Paneles solares.",
    liveSolarAbsent:
      "Solar: no está configurado en tu panel de Energía. Añade paneles solares ahí para obtener el chip de producción.",
    liveGridOk: "Red: sensor de potencia en directo detectado.",
    liveGridMissing:
      "Red: no hay sensor de potencia en directo, los chips de importación/exportación permanecen ocultos. Añade uno en Ajustes > Paneles > Energía > Red eléctrica.",
    liveGridMiswired:
      "Red: el sensor de potencia en directo contradice tus medidores (parece medir un solo sentido). Los chips permanecen ocultos; configura un sensor con signo o el modo Dos sensores.",
    liveGridAbsent:
      "Red: no está configurada en tu panel de Energía. Añade la red eléctrica ahí para obtener los chips de importación y exportación.",
    liveBatteryOk:
      "Batería: los sensores de potencia en directo cubren todas las baterías.",
    liveBatteryMissing:
      "Batería: falta la potencia en directo en al menos una batería, el chip de potencia permanece oculto. Añade el/los sensor(es) de potencia en Ajustes > Paneles > Energía > Batería.",
    liveBatteryAbsent:
      "Batería: no está configurada en tu panel de Energía. Añade una batería ahí para obtener el chip de carga y descarga.",
    liveHomeOk:
      "Consumo del hogar: mostrado, derivado de las familias en directo anteriores.",
    liveHomeNote:
      "Consumo del hogar: aparece cuando cada familia configurada arriba tiene su sensor en directo.",
    openEnergyConfig: "Abrir configuración de Energía",
    buildingsSection: "Casa y edificios",
    buildingsHint:
      'Para mantener la tarjeta fluida en zonas urbanas densas, solo se renderizan en 3D los edificios dentro del radio configurado alrededor de la casa. La casa en sí se mantiene a plena opacidad; los edificios cercanos se renderizan con la opacidad configurada para dar contexto urbano sin competir con las capas de datos. El radio de agrupación reúne los anexos adosados (porches, garajes, cobertizos) en el grupo "casa".',
    displayRadius: "Radio de visualización",
    displayRadiusHelp:
      "Radio alrededor de la casa en el que se obtienen y dibujan los edificios, hasta el borde del disco del mapa difuminado. Bájalo para aligerar el renderizado en un dispositivo lento; 0 muestra solo la casa.",
    buildingCount: "Número de edificios",
    buildingCountHelp:
      "Número máximo de edificios cercanos a dibujar. Bájalo para aligerar el renderizado en un dispositivo lento.",
    buildingRealSize: "Alturas reales de los edificios",
    buildingRealSizeOn: "Sí",
    buildingRealSizeOff: "No",
    buildingRealSizeHint:
      "Sí: usa las alturas reales de OpenStreetMap (limitadas para mantener un encuadre legible). No: da a cada edificio la misma altura fija de abajo.",
    buildingHeight: "Altura de los edificios",
    hiddenDevicesEmpty:
      "Todavía no hay dispositivos individuales registrados en tu panel de Energía. Añade ahí el consumo de dispositivos para controlarlos aquí.",
    deviceVisibilityLabel: "Mostrar dispositivo",
    deviceGroupLabel: "Grupo de monitorización",
    group: "Grupo",
    noGroup: "Sin grupo",
    devicesEnergyNote:
      "Estos son los dispositivos individuales configurados actualmente en tu panel de Energía de Home Assistant. El ojo muestra u oculta cada uno en todas partes, y la píldora lo asigna a un grupo.",
    buildingClusterRadius: "Radio de agrupación de la casa",
    buildingClusterRadiusHelp:
      "Radio alrededor de la casa dentro del cual los anexos adosados (porches, garajes, cobertizos) se tratan como parte de la casa: se renderizan con la opacidad y el color completos de la casa en lugar de como vecinos difuminados. 0 mantiene solo el edificio principal.",
    buildingOpacity: "Opacidad del entorno",
    buildingColor: "Color de los edificios",
    buildingColorHelp:
      "Tinte base aplicado a los edificios del entorno en la escena.",
    shadowsSection: "Sombras",
    shadowsEnabled: "Mostrar sombras",
    shadowsEnabledOn: "Mostradas",
    shadowsEnabledOff: "Ocultas",
    shadowsEnabledHint:
      "Activa u oculta las sombras proyectadas en el suelo por los edificios a medida que el sol se mueve.",
    shadowOpacity: "Opacidad de las sombras",
    shadowOpacityHint: "Opacidad de las sombras proyectadas en el suelo.",
    resetSection: "Restablecer",
    resetSectionHint:
      "Herramientas de mantenimiento: vuelve a obtener los datos en caché de la tarjeta, o restablece todas las opciones a sus valores por defecto.",
    resetCacheButton: "Restablecer la caché de datos",
    resetCacheWarning:
      "Aviso: esto vuelve a obtener todo lo que la tarjeta tiene en caché: el tiempo de Open-Meteo, cada serie de energía en memoria (producción, red, batería, dispositivos, irradiancia), la calibración de la previsión afinada y las huellas de los edificios de OpenFreeMap, para todas las tarjetas Helios abiertas en esta página. Úsalo para borrar una calibración bloqueada o datos de tiempo/mapa obsoletos; una recarga completa tarda unos minutos según tu servidor de Home Assistant. Tus datos dentro de Home Assistant nunca se tocan.",
    resetCacheDone: "Caché borrada ✓",
    resetOptionsButton: "Restablecer opciones a los valores por defecto",
    resetOptionsConfirm: "Vuelve a pulsar para confirmar",
    resetOptionsWarning:
      "Aviso: esto restablece TODAS las opciones de esta tarjeta a sus valores por defecto: visibilidad, colores e iconos de los chips, nombres/colores/iconos de los grupos, edificios, sombras, unidades y cualquier otro ajuste. Tus datos de Home Assistant y tu panel de Energía no se ven afectados, pero tu personalización se borra y no se puede deshacer.",
    resetOptionsDone: "Opciones restablecidas ✓",
    aboutSection: "Acerca de",
    aboutVersionLabel: "Versión",
    aboutRepoCard: "Helios",
    aboutCoffeeMessage:
      "Construyo Helios yo solo, casi siempre de noche, persiguiendo los pequeños detalles hasta que el sol y tu energía cobran vida en la pantalla. Si ha encontrado un sitio en tu panel, eso ya me hace feliz; una estrella en GitHub, todavía más, y un café ayuda a que todo siga avanzando.",
    aboutDeveloperLabel: "Desarrollador",
    aboutDeveloperLinkedIn: "LinkedIn",
    aboutCoffeeLink: "Invítame a un café",
  },
};
