import type { Translations } from '../index';

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
    cardName:        'HELIOS',
    cardDescription: 'Real-time solar energy and cloud coverage visualization',

    placeholder:
    {
        subtitle: 'Solar exposure & cloud coverage'
    },

    detail:
    {
        title:    'Detailed view',
        subtitle: 'Detailed dashboard coming soon.',
        exitHint: 'Tap anywhere to exit',
    
        todayLabel:         'Today',
        todayProduced:      'produced',
        todayForecast:      'forecast',
        todayPeak:          'peak',
        todayNotStartedYet: 'production hasn\'t started yet',
        tomorrowLabel:      'Tomorrow',
        tomorrowPeak:       'peak expected around',
        batteryLabel:       'Battery',
        batteryCharged:     'charged',
        batteryDischarged:  'discharged',},

    editor:
    {
        locationSection:    'Location',
        homeLatitude:       'Home latitude *',
        homeLongitude:      'Home longitude *',
        locationHint:       'Override the home address used as the card\'s center. Leave both fields empty to use Home Assistant\'s configured home. The override is only applied when BOTH fields are set to valid coordinates; partial or out-of-range values silently fall back to the HA default.',
        mapSection:         'Map',
        mapStyle:           'Map style *',
        mapStyleHint:       'Three basemaps: Streets (sober, urban), Topo (contour lines and earth tones, better in hilly terrain), or Minimal (loads Streets then strips every non-essential label, POI icon and road shield for a faster render). 3D buildings and labels behave identically on Streets and Topo. The dark variant of the chosen style is used automatically when the card theme is set to dark.',
        mapStyleStreet:     'Streets',
        cardTheme:          'Card theme *',
        cardThemeHint:      'Switches the card chrome (chips, charts, buttons, tooltips, scrub overlay) and the 3D map basemap between a light skin (default, on a white surface) and a dark skin (on a near-black surface) so the card sits cleanly inside light or dark Home Assistant dashboards.',
        cardThemeLight:     'Light',
        cardThemeDark:      'Dark',
        showLabels:         'Show labels *',
        showLabelsHint:     'Toggles street names, building numbers, points of interest and place names on the basemap.',
        labelsOn:           'Shown',
        labelsOff:          'Hidden',
        autoRotate:         'Camera auto-rotation *',
        autoRotateHint:     'When idle for a few seconds, the camera slowly orbits the home (about 1.5°/s, opposite to the sun\'s apparent motion). Any pinch, drag or wheel pauses it instantly and it resumes once you let go.',
        autoRotateOn:       'On',
        autoRotateOff:      'Off',
        timeline:           'Timeline',
        timelineHint:       'Format of the date labels shown on the timeline and inside the scrub chip.',
        dateFormat:         'Date format * (default: mm-dd)',
        dateFormatHelp:     'Tokens: yyyy, yy, mm, dd. Examples:',
        timeFormat:         'Time format *',
        timeFormat12:       '12 h',
        timeFormat24:       '24 h',
        colors:             'Colors',
        colorsHint:         'One colour per metric, reused everywhere it appears. The sun colour paints the arc, the sun disc and the upper area of the timeline. The cloud colour paints the on-ground disc and the lower area of the timeline.',
        sunColor:           'Sun color *',
        cloudColor:         'Cloud color *',
        pvSection:          'Solar production',
        pvHint:             'Optional. When set, a chip appears near the home with the instant production (computed over the last minute) and a dedicated graph is added above the timeline. Accepts either a power sensor (W/kW) or a cumulative energy sensor (Wh/kWh).',
        pvEntity:           'Production entity',
        pvEntityHelp:       'Pick a solar power or energy sensor (W, kW, Wh, kWh).',
        pvPeakPower:        'Peak power (kWp)',
        pvPeakPowerHelp:    'Installed peak power of your array in kilowatt-peak. Drives the dotted forecast line on the PV chart and the PV → home leader\'s flow saturation. Leave empty to hide the forecast; observed production and the daily peak still render.',
        pvTilt:             'Panel tilt (°)',
        pvTiltHelp:         'Tilt angle of your panels from horizontal, 0 for a flat install and 90 for a fully vertical install such as a balcony. Leave empty or set to 0 to keep the original flat-panel forecast. Combined with the azimuth, it powers a Liu-Jordan transposition that projects the predicted irradiance onto the panel plane, fixing the overshoot seen on steeply pitched roofs and balcony setups.',
        pvAzimuth:          'Panel azimuth (°)',
        pvAzimuthHelp:      'Compass bearing your panels face, clockwise from north: 0 = north, 90 = east, 180 = south, 270 = west. Defaults to 180 (south-facing) when tilt is set. Only used when tilt is greater than 0.',
        pvColor:            'Production color *',
        batterySection:     'Home battery',
        batteryHint:        'Optional. Each entity surfaces as its own chip flanking the PV chip, State of Charge on the LEFT, signed Power on the RIGHT, connected to PV with a static dotted hairline. Either entity is independently optional; the chip on its side appears as soon as the entity is set.',
        batterySocEntity:   'State of charge entity',
        batterySocEntityHelp: 'Pick a battery State of Charge sensor (%, usually with device_class "battery"). Renders as a chip on the left of the PV chip showing the live percentage.',
        batteryPowerEntity: 'Power entity',
        batteryPowerEntityHelp: 'Pick a battery power sensor (W or kW). Sign convention follows the entity itself; positive is interpreted as charging and is shown verbatim on the chip (e.g. "+3.00 kW" charging, "-1.20 kW" discharging).',
        batteryColor:       'Battery color *',
        buildingsSection:   'Surrounding buildings',
        buildingsHint:      'To keep the card smooth in dense urban areas, only buildings within the configured radius around the home are rendered in 3D. The home itself stays at full opacity; nearby buildings are rendered with the configured opacity so they provide urban context without competing with the data overlays. The cluster radius groups attached outbuildings (verandas, garages, sheds) into the "home" set.',
        displayRadius:         'Display radius *',
        displayRadiusHint:     'Defines the visible area around the home. Anything past this radius is hidden: basemap, neighbouring buildings, shadows. Also drives the LiDAR fetch extent and the projected-shadow clip.',
        buildingClusterRadius: 'Home cluster radius *',
        buildingOpacity:       'Surrounding opacity *',
        buildingColor:         'Building color *',
        pixelRatio:            'Pixel ratio *',
        pixelRatioAuto:        'Auto',
        pixelRatio1x:          '1x',
        pixelRatioHint:        'Auto (default) uses your screen\'s native devicePixelRatio (capped at 2 on desktop, 1.25 on mobile) for crisp rendering. 1x forces the value to 1.0 for the cheapest possible per-frame fragment workload, useful on low-end devices or for long sessions where battery life / heat matters more than crispness.',
        mapStyleMinimal:       'Minimal',
        shadowsSection:        'Shading',
        shadowsEnabled:        'Show shadows *',
        shadowsEnabledOn:      'Shown',
        shadowsEnabledOff:     'Hidden',
        shadowsEnabledHint:    'Master toggle for cast ground shadows. When hidden, no shadows are projected at all. When shown, the source picks itself: a LiDAR provider when one covers your location (buildings + vegetation), OpenFreeMap building footprints otherwise (buildings only).',
        lidarPrecision:        'LiDAR precision *',
        lidarPrecisionLow:     'Low',
        lidarPrecisionMedium:  'Medium',
        lidarPrecisionHigh:    'High',
        lidarPrecisionHint:    'If your home sits inside a LiDAR provider integrated with Helios, you get more realistic shadows (buildings AND vegetation). Some offset may show up between the rendered buildings and their shadows: the LiDAR survey is captured at a given date and may not reflect the current state of the ground. Out of LiDAR coverage, shadows fall back to the flat OpenFreeMap building footprints and this setting has no effect.',
        shadowOpacity:         'Shadow opacity *',
        shadowOpacityHint:     'Opacity of the cast ground shadows.'
    }
};
