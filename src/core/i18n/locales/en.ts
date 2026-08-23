import type { Translations } from "../index";

/*
 * English, reference locale.
 *
 * The Translations type (defined in ../index.ts) is derived from this
 * object's runtime shape. Because we annotate `en` with that very
 * type, it must contain all keys but is NOT typed as a literal, so
 * other locales can supply any string for each key. Adding a new key
 * here automatically widens Translations and triggers a TypeScript
 * error in every locale that hasn't been updated.
 */

export const en: Translations = {
  cardName: "Helios",
  cardDescription:
    "☀️ A real-time 2.5D view of your home with the sun, weather, solar production, battery and grid, plus cast shadows and an interactive timeline",

  period: {
    rangeLabel: "Time range",
    forecast: "Forecast",
    yesterday: "Yesterday",
    today: "Today",
    week: "Week",
    month: "Month",
    year: "Year",
  },

  compass: "N,NE,E,SE,S,SW,W,NW",

  cloudCover: {
    cloudLow: "Low cloud cover",
    cloudMid: "Mid cloud cover",
    cloudHigh: "High cloud cover",
  },

  mapConfig: {
    section: "Map configuration",
    intro:
      "The basemap is drawn from OpenStreetMap vector tiles. Auto follows your theme, Dark / Light force one, and Custom lets you set every colour and hide any layer.",
    modeAuto: "Auto",
    modeDark: "Dark",
    modeLight: "Light",
    modeCustom: "Custom",
    land: "Background",
    water: "Water",
    wood: "Woodland",
    grass: "Greenery",
    sand: "Sand",
    wetland: "Wetland",
    ice: "Ice & snow",
    landuse: "Built-up land",
    roadMajor: "Major roads",
    roadMinor: "Minor roads",
    roadCasing: "Road outline",
    path: "Paths & tracks",
    rail: "Railways",
    building: "Buildings",
    boundary: "Boundaries",
  },

  editor: {
    locationSection: "Home location",
    homeLatitude: "Home latitude",
    homeLongitude: "Home longitude",
    locationHint:
      "Override the home address used as the card's center. Leave both fields empty to use Home Assistant's configured home. The override is only applied when BOTH fields are set to valid coordinates.",
    uiAndMapSection: "UI",
    autoRotate: "Camera auto-rotation",
    autoRotateHint:
      "When idle for a few seconds, the camera slowly orbits the home (about 1.5°/s, opposite to the sun's apparent motion). A single-finger drag pauses it instantly and it resumes once you let go. Avoid it on very old devices: auto-rotation forces a render every second.",
    autoRotateOn: "On",
    autoRotateOff: "Off",
    degradedRender: "Compatibility rendering",
    degradedRenderHint:
      "Draws the map with a simpler, more compatible method. Turn this on if the scene flickers or tears while you rotate or pan it. It fixes the glitch on some phones and tablets, at the cost of slightly less smooth motion.",
    dataDisplaySection: "Data display",
    displayUpdateFrequency: "Graph detail",
    displayUpdateFrequencyHelp:
      "How many points per hour the graphs draw. The data itself is always Home Assistant's 5-minute statistics - this only controls how densely the curve is plotted: 1 = one point per hour (smoothest, lightest to render), 6 = one point every 10 minutes (full detail, heaviest). Default 4 = a point every 15 minutes. Lower it on older or slower devices to cut rendering cost. The forecast curve follows the same cadence, so a finer setting also resolves short shadow dips (a tree clipping production for half an hour) that an hourly curve steps over.",
    valueDecimals: "Decimals",
    valueDecimalsHelp:
      "Number of decimals shown on every value readout, so the chips read uniform. Applies to kW values (whole watts stay integers) and to kWh. 0 to 3, default 1.",
    maxExpectedPower: "Max expected power",
    maxExpectedPowerHelp:
      "The power at which a flow animates at full speed. Every flow is paced against this single reference, so a bigger flow always reads as faster than a smaller one, whichever direction it runs. Raise it for a large installation, lower it for a small one. Default 5000 W.",
    sunChipMode: "Sun chip readout",
    sunChipModeHelp:
      "What the sun chip shows: live solar irradiance (default) or the sun's position (azimuth and elevation). The position needs no sensor, it comes from the card's own sun maths.",
      batteryChipMode: "Battery chip readout",
      batteryChipModeHelp: "What the battery chip shows: live power (default) or the state of charge (%). It falls back to whichever value your battery actually provides.",
      batteryChipModePower: "Power",
      batteryChipModeSoc: "State of charge",
    sunChipModeIrradiance: "Irradiance",
    sunChipModePosition: "Sun position",
    powerUnit: "Power unit",
    powerUnitHelp:
      "Unit for every power readout on the card (chips, graph tooltips). Energy follows it by default too (kW pairs with kWh, W with Wh), unless you set an energy unit of its own below.",
    energyUnit: "Energy unit",
    energyUnitHelp:
      "Unit for every energy total (the day curve, the detail panel, the timeline's day totals). Auto follows the power unit above; pick Wh or kWh to set it on its own.",
    energyUnitAuto: "Auto",
    irradianceUnit: "Solar constant unit",
    irradianceUnitHelp:
      "Unit for the solar constant (irradiance) readout above the sun.",
    batterySign: "Battery chip: charge shown as",
    batterySignHelp:
      "This only changes how the badge is shown (the + or - sign), not the flow: the charge and discharge direction is detected automatically from your Energy dashboard meters.",
    batterySignDefault: "- when charging",
    batterySignInverted: "+ when charging",
    batterySignHidden: "Hidden (magnitude only)",
    weatherEnabled: "Weather effects",
    weatherEnabledHint:
      "Paint the real sky over the scene: sunshine, clouds, rain, snow and thunderstorms from your local weather, following the timeline as you scrub. Off keeps a clear scene.",
    noUiMode: "No UI mode",
    noUiModeHint:
      "Fade the timeline and the on-card controls after a few seconds of inactivity. Any tap or move brings them back. Great for a wall display.",
    noUiDelay: "Idle delay before hiding",
    noUiDelayHint:
      "Seconds of inactivity before the timeline and controls fade away in No UI mode. 0 keeps the UI hidden permanently. Only used when No UI mode is on.",
    showTimeline: "Show timeline",
    showTimelineHint:
      "Show the timeline and the period selector below the scene. Off keeps just the scene.",
    showDetailPanel: "Show additional info",
    showDetailPanelHint:
      "Allow the per-chip mini-panel (aggregated metrics) to open top-right when a chip is tapped. Off never shows it.",
    showSunTimes: "Show sunrise / sunset times",
    showSunTimesHint:
      "Show the sunrise and sunset times and their markers at the feet of the solar arc.",
    showHorizonLine: "Show terrain horizon",
    showHorizonLineHint: "Draw the terrain skyline around the home, computed from the local relief. The horizon always dims the sun realistically behind hills; this only toggles the drawn line.",
    horizonLineColor: "Terrain horizon colour",
    horizonLineColorHint: "Colour of the terrain horizon line.",
    lockRotation: "Lock rotation",
    lockRotationHint:
      "Drag the preview to rotate and tilt the scene to the view you want, then turn this on. Locking freezes that view (drag-to-rotate and the idle auto-orbit stop) and saves the angle to the card, so the exact same view appears on every device and browser. Turn it off to rotate freely again.",
    chipsSection: "Entity display",
    chipsIntro:
      "Show or hide each entity, and pick its icon and colour. The home follows the selected chip, or your primary colour by default.",
    chipIrradiance: "Irradiance display",
    chipProduction: "Production display",
    chipGrid: "Grid display",
    chipBattery: "Battery display",
    chipHome: "Home consumption display",
    chipTemperature: "Temperature display",
    chipHumidity: "Humidity display",
    chipCost: "Cost display",
    groupsConfigTitle: "Group configuration",
    optionalSensors: "Optional sensors",
    solarIrradianceEntity: "Solar irradiance entity",
    solarIrradianceEntityHelp:
      "Pick a sensor reporting global shortwave irradiance in W/m² (typical Ecowitt / Davis / personal weather station). When set, its current state and recorder history replace Open-Meteo for the live + past irradiance everywhere it appears (sun chip number, PV chart Y axis, sun arc colouring). Forecast hours stay on Open-Meteo since a sensor cannot carry future values.",
    temperatureEntity: "Temperature sensor",
    temperatureEntityHelp:
      "Optional. Use a local outdoor temperature sensor (°C) instead of the Open-Meteo value for the temperature chip. Its live state and recorder history are used for the live + past; forecast hours stay on the model.",
    humidityEntity: "Humidity sensor",
    humidityEntityHelp:
      "Optional. Use a local relative-humidity sensor (%) instead of the Open-Meteo value, for the live + past.",
    cloudCoverEntity: "Cloud cover sensor",
    cloudCoverEntityHelp:
      "Optional. Use a local cloud-cover sensor (%) to drive the sky grade (sun, greying) instead of the Open-Meteo value, for the live + past.",
    precipitationEntity: "Precipitation sensor",
    precipitationEntityHelp:
      "Optional. Use a local precipitation sensor (mm) to drive the rain layer instead of the Open-Meteo value, for the live + past.",
    snowfallEntity: "Snowfall sensor",
    snowfallEntityHelp:
      "Optional. Use a local snowfall sensor (cm) to drive the snow layer instead of the Open-Meteo value, for the live + past.",
    weatherEntity: "Weather entity",
    weatherEntityHelp:
      "Optional. Use a Home Assistant weather entity to drive the condition (rain / snow / thunderstorm) instead of the Open-Meteo value, for the live + past. Forecast hours stay on the model.",
    liveDataTitle: "Configuration status",
    liveDataIntro:
      "Live chips show measured sensors only. Each family needs the optional live power sensor of its energy dashboard source - curves and totals always come from your meters.",
    liveSolarOk: "Solar: live power sensor detected.",
    liveSolarMissing:
      "Solar: no live power sensor, the production chip stays hidden. Add one under Settings > Dashboards > Energy > Solar panels.",
    liveSolarAbsent:
      "Solar: not set up in your Energy dashboard. Add solar panels there to get the production chip.",
    liveGridOk: "Grid: live power sensor detected.",
    liveGridMissing:
      "Grid: no live power sensor, the import/export chips stay hidden. Add one under Settings > Dashboards > Energy > Grid.",
    liveGridMiswired:
      "Grid: the live power sensor contradicts your meters (it seems to measure a single direction). The chips stay hidden - configure a signed sensor or the Two sensors mode.",
    liveGridAbsent:
      "Grid: not set up in your Energy dashboard. Add the grid there to get the import and export chips.",
    liveBatteryOk: "Battery: live power sensors cover every battery.",
    liveBatteryMissing:
      "Battery: live power missing on at least one battery, the power chip stays hidden. Add the power sensor(s) under Settings > Dashboards > Energy > Battery.",
    liveBatteryAbsent:
      "Battery: not set up in your Energy dashboard. Add a battery there to get the charge and discharge chip.",
    liveHomeOk:
      "Home consumption: shown, derived from the live families above.",
    liveHomeNote:
      "Home consumption: appears once every configured family above has its live sensor.",
    openEnergyConfig: "Open Energy configuration",
    buildingsSection: "Home & buildings",
    buildingsHint:
      'To keep the card smooth in dense urban areas, only buildings within the configured radius around the home are rendered in 3D. The home itself stays at full opacity - nearby buildings are rendered with the configured opacity so they provide urban context without competing with the data overlays. The cluster radius groups attached outbuildings (verandas, garages, sheds) into the "home" set.',
    displayRadius: "Display radius",
    displayRadiusHelp:
      "Radius around the home in which buildings are fetched and drawn, up to the edge of the faded map disc. Lower it to lighten rendering on a slow device - 0 shows just the home.",
    buildingCount: "Building count",
    buildingCountHelp:
      "Maximum number of nearby buildings to draw. Lower it to lighten rendering on a slow device.",
    buildingRealSize: "Real building heights",
    buildingRealSizeOn: "On",
    buildingRealSizeOff: "Off",
    buildingRealSizeHint:
      "On: use real OpenStreetMap heights (capped to keep the framing readable). Off: give every building the same fixed height below.",
    buildingHeight: "Building height",
    hiddenDevicesEmpty:
      "No individual devices are tracked in your Energy dashboard yet. Add device consumption there to control them here.",
    deviceVisibilityLabel: "Show device",
    group: "Group",
    noGroup: "No group",
    groupAssignHint:
      "Drag your devices into a group. Anything left below belongs to no group.",
    groupDropHere: "Drop a device here",
    backToLive: "Back to live",
    buildingClusterRadius: "Home cluster radius",
    buildingClusterRadiusHelp:
      "Radius around the home within which attached outbuildings (verandas, garages, sheds) are treated as part of the home: they render at the home's full opacity and colour instead of as faded neighbours. 0 keeps only the main building.",
    buildingOpacity: "Surrounding opacity",
    buildingColor: "Building colour",
    buildingColorHelp:
      "Base tint applied to the surrounding buildings in the scene.",
    shadowsSection: "Shadows",
    shadowsEnabled: "Show shadows",
    shadowsEnabledOn: "Shown",
    shadowsEnabledOff: "Hidden",
    shadowsEnabledHint:
      "Toggles the ground shadows cast by the buildings as the sun moves.",
    shadowOpacity: "Shadow opacity",
    shadowOpacityHint: "Opacity of the cast ground shadows.",
    resetSection: "Reset",
    resetSectionHint:
      "Maintenance tools: refetch the card's cached data, or reset every option to its default.",
    resetCacheButton: "Reset data cache",
    resetCacheWarning:
      "Warning: this refetches everything the card has cached - the Open-Meteo weather, every in-memory energy series (production, grid, battery, devices, irradiance), the refined forecast's calibration, and the OpenFreeMap building footprints - for every Helios card open on this page. Use it to clear stuck calibration or stale weather/map data - a full refetch takes a few minutes depending on your Home Assistant server. Your data inside Home Assistant is never touched.",
    resetCacheDone: "Cache cleared ✓",
    resetOptionsButton: "Reset options to defaults",
    resetOptionsConfirm: "Click again to confirm",
    resetOptionsWarning:
      "Warning: this resets ALL of this card's options to their defaults - chip visibility, colours and icons, group names/colours/icons, buildings, shadows, units and every other setting. Your Home Assistant data and Energy dashboard are untouched, but your customisation is cleared and cannot be undone.",
    resetOptionsDone: "Options reset ✓",
    aboutSection: "About",
    aboutVersionLabel: "Version",
    aboutRepoCard: "Helios",
    aboutCoffeeMessage:
      "I build Helios alone, mostly at night, chasing the small details until the sun and your energy feel alive on screen. If it has found a place on your dashboard, that already makes me happy - a star on GitHub even more, and a coffee keeps it all moving forward.",
    aboutDeveloperLabel: "Developer",
    aboutDeveloperLinkedIn: "LinkedIn",
    aboutCoffeeLink: "Buy me a coffee",
  },
};
