/*
 * Lightweight i18n for HELIOS, synchronous, zero-dep.
 *
 * Locales are inlined at build time so the user never has to host them
 * separately. The active language is picked from Home Assistant's
 * `hass.language` property, which mirrors the user's HA UI language.
 * If the requested language is missing, we fall back to English.
 */

//Contractual shape every locale must implement.
//
//We declare it explicitly (rather than deriving it via `typeof en`) so
//that the English locale can also import the type without creating a
//circular dependency. Adding a new key requires:
//  1. Adding it here in Translations.
//  2. Adding it in every locale (TS error otherwise).
export interface Translations
{
    cardName:        string;
    cardDescription: string;
    //Label on the always-visible LiDAR-view chip in the top-right
    //corner of the card (the half of the LiDAR cluster that's
    //purely a text label; the adjacent button carries the state
    //icon). Stays short, ~10 chars max, to balance the clock chip
    //width on the opposite corner.
    lidarViewChipLabel: string;
    //Label on the shading-dome chip in the top-centre cluster.
    //Same short noun-phrase convention as lidarViewChipLabel; the
    //chip toggles the dome overlay where the learned PV residuals
    //are painted on the celestial hemisphere above the home.
    shadingDomeChipLabel: string;

    //Detail dashboard, opened by clicking the home. The camera eases
    //in (zoom + pitch) and a full-card overlay takes over while the
    //pre-existing HUD fades out.
    detail:
    {
        exitHint:  string;       //close-button aria-label

        //Section labels and short captions for the detail-mode
        //dashboard. Each section is one factual block:
        //  todayLabel      , top of the today section
        //  todayProduced   , trailing text after the produced total
        //  todayForecast   , trailing text after the projected total
        //  todayPeak       , trailing text after the actual peak readout
        //  todayPeakForecast , trailing text after the predicted peak
        //                      readout (twin of todayPeak for the model)
        //  todayNotStartedYet , status line shown when produced is
        //                      effectively zero and the peak is still
        //                      in the future (production hasn't begun)
        //  tomorrowLabel   , top of the tomorrow card
        //  tomorrowPeak    , prefix before the peak time chip
        //  batteryLabel    , top of the battery vessel section
        //  batteryCharged  , label under the charge total
        //  batteryDischarged , label under the discharge total
        //  actualShort     , short "Actual" label used in compact
        //                    spaces (chart hover tooltip)
        //  forecastShort   , short "Forecast" label used in compact
        //                    spaces (chart hover tooltip)
        //  deltaTooltip    , native title hover hint on the headline
        //                    (+X % / -X %) chip, explaining the
        //                    comparison reference
        //  forecastRefined , label on the small annotation under
        //                    PRÉVU showing the calibrated value
        //                    (e.g. "affiné" in fr)
        //  forecastCalibrationHint , hover hint explaining what the
        //                    refined value means and how many days
        //                    fed into it. Receives a {n} token to
        //                    be replaced with the day count.
        todayLabel:        string;
        todayProduced:     string;
        todayForecast:     string;
        todayPeak:         string;
        todayPeakForecast: string;
        todayNotStartedYet: string;
        tomorrowLabel:     string;
        tomorrowPeak:      string;
        batteryLabel:      string;
        batteryCharged:    string;
        batteryDischarged: string;
        actualShort:       string;
        forecastShort:     string;
        deltaTooltip:      string;
        forecastRefined:        string;
        forecastCalibrationHint: string;
    };

    editor:
    {
        //Optional override for the home location used as the card's
        //center. When both fields are blank the card falls back to
        //hass.config; when both are set to valid coords (lat -90..90,
        //lon -180..180) they win over HA's configured home.
        locationSection:          string;
        homeLatitude:             string;
        homeLongitude:            string;
        locationHint:             string;
        mapSection:               string;
        mapStyle:                 string;
        mapStyleHint:             string;
        mapStyleStreet:           string;
        showLabels:               string;
        showLabelsHint:           string;
        labelsOn:                 string;
        labelsOff:                string;
        autoRotate:               string;
        autoRotateHint:           string;
        autoRotateOn:             string;
        autoRotateOff:            string;
        dateFormat:               string;
        dateFormatHelp:           string;
        timeFormat:               string;
        timeFormat12:             string;
        timeFormat24:             string;
        //UI section, hosts the chrome-level customisation that
        //doesn't belong to a specific data overlay: sun + cloud
        //colours (the two phenomena that don't have their own
        //section), plus the date and time format toggles for the
        //clock chip + the timeline labels.
        uiSection:                string;
        uiColorsHint:             string;
        sunColor:                 string;
        cloudColor:               string;
        //Optional photovoltaic production overlay.
        pvSection:                string;
        pvHint:                   string;
        pvEntity:                 string;
        pvEntityHelp:             string;
        //Manual peak-power input (kWp). When set, drives the dotted
        //prediction line on the PV chart and the PV→home leader's
        //flow saturation. Optional; without it the card uses live
        //observation only.
        pvPeakPower:              string;
        pvPeakPowerHelp:          string;
        //Inverter clipping cap, in kW of AC output. Optional. When set, the forecast tops out at this value so an over-sized DC array hooked to a
        //smaller inverter doesn't render a peak above what the hardware can actually deliver.
        pvInverterMaxKw:          string;
        pvInverterMaxKwHelp:      string;
        //Multi-array PV layout. Each array entry exposes its own
        //tilt (0..90, 0 = horizontal, 90 = vertical / balcony),
        //azimuth (0..360 clockwise from north, 180 = south), and
        //share % of the total kWp. The card-side reader normalises
        //the shares to sum to 1.0 at compute time, so the editor
        //surfaces a small hint when the typed shares don't add to
        //100. The "+ Add array" button is hidden past 6 entries.
        //Section title for the multi-array region, lifted into its
        //own block so the editor reads as a discrete sub-section
        //instead of a free-form continuation of the kWp row above.
        pvArraysSection:          string;
        pvArraysHelp:             string;
        pvArrayTitle:             string;   //e.g. "Array {n}"
        pvArrayName:              string;
        pvArrayNameHelp:          string;
        pvArrayTilt:              string;
        pvArrayAzimuth:           string;
        pvArrayShare:             string;
        //Per-string peak power in kWp. Preferred over `share`; the
        //total install power is the sum across rows.
        pvArrayPeakKwp:           string;
        pvArrayPeakKwpHelp:       string;
        pvArrayAdd:               string;
        pvArrayRemove:            string;
        pvArrayNormHint:          string;
        //Per-field helps under tilt / azimuth / share, with the share-specific explanation of the auto-normalisation contract spelled out so users
        //know that 50/50 and 1/1 give the same forecast.
        pvArrayTiltHelp:          string;
        pvArrayAzimuthHelp:       string;
        pvArrayShareHelp:         string;
        //Optional per-array GPS coordinates. Used when the panels
        //sit a meaningful distance away from the home (e.g. ground-
        //mounted in a clearing while the home is under trees) so
        //the prediction uses the panel's true sun position and the
        //map shows a small marker at the panel location.
        pvArrayLatitude:          string;
        pvArrayLongitude:         string;
        pvArrayCoordsHelp:        string;
        pvArrayCoordsPlaceholder: string;
        //Height of this group of panels above ground in metres. Used by the LiDAR-aware PV forecast to position the ray-march origin for the
        //per-array shading check.
        pvArrayHeight:            string;
        pvArrayHeightHelp:        string;
        pvColor:                  string;
        batterySection:           string;
        batteryHint:              string;
        //Multi-bank battery editor. The section renders one collapsible card per bank (same widget as pv-arrays) so a user with house +
        //garage banks (or a hybrid + standalone) gets a dedicated row each. The chip on the card stays single, aggregating the banks as
        //a capacity-weighted SoC + summed signed power. `batteryBankTitle` carries the auto-numbered fallback used when the user hasn't
        //typed a name; `{n}` is substituted with the 1-based row index.
        batteryBankTitle:         string;
        batteryBankAdd:           string;
        batteryBankRemove:        string;
        batteryBankName:          string;
        batteryBankNameHelp:      string;
        batteryCapacityKwh:       string;
        batteryCapacityKwhHelp:   string;
        batterySocEntity:         string;
        batterySocEntityHelp:     string;
        batteryPowerEntity:       string;
        batteryPowerEntityHelp:   string;
        //Battery power sign-convention toggle. When the user's
        //entity reports charging as negative (some GivEnergy /
        //GivTCP setups), the inverted option flips the value once
        //at ingest so the rest of the card stays on the
        //"positive = charging" convention.
        batteryPowerInvert:         string;
        batteryPowerInvertStandard: string;
        batteryPowerInvertInverted: string;
        batteryPowerInvertHelp:     string;
        //Inverter cutoff SoC: percent at which the user's hybrid inverter clamps PV output once the battery hits its set ceiling. When set,
        //the shading-map trainer drops every observation bucket where the SoC reached this value so the inverter-blocked production doesn't
        //train as phantom shadow. Leave the field empty to keep the legacy "train every bucket" behaviour.
        inverterCutoffSocPct:       string;
        inverterCutoffSocPctHelp:   string;
        batteryColor:             string;
        //Grid section: import / export power readouts. Both sides
        //accept multiple entities; the chip displays whichever entity
        //last changed (typical for peak / off-peak indexes that never
        //increment at the same time).
        gridSection:              string;
        gridHint:                 string;
        gridImportTitle:          string;
        gridImportHint:           string;
        gridExportTitle:          string;
        gridExportHint:           string;
        gridSourceTitle:          string;
        gridSourceAdd:            string;
        gridSourceRemove:         string;
        //Combined signed grid-power entity: one sensor whose sign
        //routes to the import (>=0) or export (<0) chip, superseding
        //the two directional slots. The invert toggle flips the sign
        //convention for meters that report feed-in as positive.
        gridCombinedTitle:        string;
        gridCombinedHint:         string;
        gridInvertLabel:          string;
        gridInvertStandard:       string;
        gridInvertInverted:       string;
        gridInvertHelp:           string;
        //Weather section. Hosts the optional solar-radiation entity
        //override: when wired to a physical W/m² sensor at the home
        //(typical Ecowitt / Davis / personal weather station), the
        //card prefers it over Open-Meteo for the live + past
        //irradiance values. Forecast hours always fall through to
        //the model since a sensor only knows the present.
        weatherSection:           string;
        weatherHint:              string;
        solarRadiationEntity:     string;
        solarRadiationEntityHelp: string;
        //Display radius (m) around the home: everything outside this
        //disc is hidden by an opaque crop mask, regardless of what
        //the basemap would otherwise show. Originally a buildings-
        //only setting, hence the legacy `building-radius` config
        //key; now also drives the LiDAR fetch bbox, the shadow clip,
        //and the cropped viewport.
        displayRadius:            string;
        displayRadiusHint:        string;
        //Timeline sub-section, nested inside the UI section. Hosts the visibility toggle, the width slider and the per-day consumption-chip toggle.
        timelineSection:          string;
        timelineEnabled:          string;
        timelineEnabledOn:        string;
        timelineEnabledOff:       string;
        timelineEnabledHint:      string;
        timelineWidth:            string;
        timelineWidthHint:        string;
        timelineConsumption:      string;
        timelineConsumptionOn:    string;
        timelineConsumptionOff:   string;
        timelineConsumptionHint:  string;
        //Surrounding buildings options. Cluster radius grows the home group to include attached outbuildings, opacity controls the transparency of
        //the neighbours and the colour is the base tint reused for every rendered building.
        buildingsSection:         string;
        buildingsHint:            string;
        buildingClusterRadius:    string;
        buildingOpacity:          string;
        buildingColor:            string;
        //Pixel-ratio toggle replacing the old performance-mode
        //switch. 'Auto' uses the device's devicePixelRatio capped at
        //2 / 1.25 (desktop / mobile). '1x' forces 1.0 for the
        //cheapest per-frame fragment workload.
        pixelRatio:               string;
        pixelRatioAuto:           string;
        pixelRatio1x:             string;
        pixelRatioHint:           string;
        //Third map-style segment: a curated minimal basemap (no POIs,
        //no place labels, no road shields) for low-end devices.
        mapStyleMinimal:          string;
        //Section grouping every shadow-related option.
        shadowsSection:           string;
        //Master shadow toggle (LiDAR if available, OpenFreeMap
        //building footprints otherwise).
        shadowsEnabled:           string;
        shadowsEnabledOn:         string;
        shadowsEnabledOff:        string;
        shadowsEnabledHint:       string;
        //LiDAR-driven shadow precision. Three named levels mapped to a raster size in helios-engine. Only meaningful when the home sits inside a
        //LiDAR provider's coverage.
        lidarPrecision:          string;
        lidarPrecisionLow:       string;
        lidarPrecisionMedium:    string;
        lidarPrecisionHigh:      string;
        lidarPrecisionHint:      string;
        //Opacity of the cast ground shadows, 0..1 slider in the editor.
        shadowOpacity:            string;
        shadowOpacityHint:        string;
        //LiDAR View overlay (subsection inside Shading).
        //Lets the user tune the LiDAR view overlay (wireframe + fill
        //coloured by live solar exposure). Only the point size remains
        //tunable from the editor; the overall opacity is exposed
        //in-card via a bottom slider so the user can dial the layer
        //in/out while looking at the result.
        lidarViewSection:           string;
        lidarViewHint:              string;
        lidarViewPointSize:         string;
        //Collapsible advanced section that lets a power user point Helios at their own nDSM GeoTIFF for shadow data. Hidden by default behind a
        //<details>/<summary> toggle so the editor stays simple for the 99% of users who never need it.
        localLidarSection:        string;
        localLidarHint:           string;
        //Discoverability line shown right under localLidarHint that points users at the Python tooling in tools/lidar/ for preparing the nDSM raster
        //offline. Keeps the editor short while still making the helpers findable for users who don't yet know how to roll their own raster.
        localLidarToolsHint:      string;
        localLidarEnabled:        string;
        localLidarUrl:            string;
        localLidarMinLat:         string;
        localLidarMaxLat:         string;
        localLidarMinLon:         string;
        localLidarMaxLon:         string;
        //Reset section: a single destructive button that wipes
        //every cached payload (weather, PV history, sample
        //buffer) and forces a fresh fetch. Sits in its own
        //collapsible section at the very bottom of the editor.
        //  resetSection         , section title
        //  resetSectionHint     , one-liner under the title
        //  resetCacheButton     , button label
        //  resetCacheWarning    , destructive-action warning text
        //  resetCacheDone       , transient confirmation shown on
        //                         the button for a couple of seconds
        //                         after the user clicks
        resetSection:             string;
        resetSectionHint:         string;
        resetCacheButton:         string;
        resetCacheWarning:        string;
        resetCacheDone:           string;
        //About section pinned at the very bottom of the editor. Carries the running version string, a pointer at the companion site
        //helios-lidar.org, the two source-code repositories (the card + the companion site) and a short appreciation line + Buy Me A
        //Coffee link so a happy user has a frictionless path to support the work.
        aboutSection:             string;
        aboutVersionLabel:        string;
        aboutSiteTitle:           string;
        aboutSiteDescription:     string;
        aboutCodeLabel:           string;
        aboutRepoCard:            string;
        aboutRepoLidar:           string;
        aboutCoffeeMessage:       string;
        aboutCoffeeLink:          string;
        //Shading-map debug section. The scalar self-calibration
        //multiplier captures static biases; the shading map sits
        //on top of it and learns per-(sun-position, cloud-cover)
        //residuals so structured shadows (a tree, a neighbouring
        //roof) bend the forecast at the right times of day under
        //the right weather. This section shows what the map has
        //learned and offers export / import / reset.
        shadingSection:           string;
        shadingHint:              string;
        shadingStatsCells:        string;
        shadingStatsConfident:    string;
        shadingStatsUnder:        string;
        shadingStatsOver:         string;
        shadingExport:            string;
        shadingImport:            string;
        shadingImportError:       string;
        shadingReset:             string;
        shadingResetConfirm:      string;
    };
}

import { en } from './locales/en';
import { fr } from './locales/fr';
import { de } from './locales/de';
import { es } from './locales/es';
import { it } from './locales/it';
import { nl } from './locales/nl';
import { pt } from './locales/pt';
import { no } from './locales/no';
import { pl } from './locales/pl';
import { cs } from './locales/cs';
import { sv } from './locales/sv';

const LOCALES: Record<string, Translations> = { en, fr, de, es, it, nl, pt, no, pl, cs, sv };

const FALLBACK: Translations = en;

//Adding a new locale is a 3-step operation:
//  1. Create ./locales/xx.ts exporting `xx: Translations`
//  2. Import here and add the key to LOCALES
//  3. Done, pickTranslations will resolve `xx-YY` → `xx-yy` → `xx` → `en`
export function pickTranslations(haLanguage: string | undefined): Translations
{
    if (!haLanguage)
    {
        return FALLBACK;
    }

    //Match in order of specificity: full tag → language root → English
    const lower = haLanguage.toLowerCase();
    if (LOCALES[lower])
    {
        return LOCALES[lower];
    }

    const root = lower.split('-')[0];
    if (LOCALES[root])
    {
        return LOCALES[root];
    }

    return FALLBACK;
}