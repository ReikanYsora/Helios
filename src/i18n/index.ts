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

    placeholder:
    {
        subtitle: string;
    };

    //Detail dashboard, opened by clicking the home. The camera eases
    //in (zoom + pitch) and a full-card overlay takes over while the
    //pre-existing HUD fades out.
    detail:
    {
        title:     string;       //"Detailed view" / "Vue détaillée"
        subtitle:  string;       //placeholder body line
        exitHint:  string;       //close-button aria-label

        //Section labels and short captions for the detail-mode
        //dashboard. Each section is one factual block:
        //  todayLabel      , top of the today section
        //  todayProduced   , subtitle under the produced kWh value
        //  todayForecast   , trailing text after the projected total
        //  todayPeak       , trailing text after the peak readout
        //  todayNotStartedYet , status line shown when produced is
        //                      effectively zero and the peak is still
        //                      in the future (production hasn't begun)
        //  tomorrowLabel   , top of the tomorrow card
        //  tomorrowPeak    , prefix before the peak time chip
        //  batteryLabel    , top of the battery vessel section
        //  batteryCharged  , label under the charge total
        //  batteryDischarged , label under the discharge total
        todayLabel:        string;
        todayProduced:     string;
        todayForecast:     string;
        todayPeak:         string;
        todayNotStartedYet: string;
        tomorrowLabel:     string;
        tomorrowPeak:      string;
        batteryLabel:      string;
        batteryCharged:    string;
        batteryDischarged: string;
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
        cardTheme:                string;
        cardThemeHint:            string;
        cardThemeLight:           string;
        cardThemeDark:            string;
        showLabels:               string;
        showLabelsHint:           string;
        labelsOn:                 string;
        labelsOff:                string;
        autoRotate:               string;
        autoRotateHint:           string;
        autoRotateOn:             string;
        autoRotateOff:            string;
        timeline:                 string;
        timelineHint:             string;
        dateFormat:               string;
        dateFormatHelp:           string;
        timeFormat:               string;
        timeFormat12:             string;
        timeFormat24:             string;
        //Fixed-colour design system. Each phenomenon (sun, cloud)
        //has one configurable colour reused across the timeline
        //mirror chart, the on-ground cloud disc and the on-arc sun
        //disc.
        colors:                   string;
        colorsHint:               string;
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
        //Panel orientation, optional. Tilt 0..90 (0 = horizontal, 90 =
        //vertical / balcony). Azimuth 0..360 (clockwise from north,
        //180 = south). Drives the Liu-Jordan transposition that
        //decides how the predicted GHI lands on the panel plane.
        pvTilt:                   string;
        pvTiltHelp:               string;
        pvAzimuth:                string;
        pvAzimuthHelp:            string;
        pvColor:                  string;
        batterySection:           string;
        batteryHint:              string;
        batterySocEntity:         string;
        batterySocEntityHelp:     string;
        batteryPowerEntity:       string;
        batteryPowerEntityHelp:   string;
        batteryColor:             string;
        //Display radius (m) around the home: everything outside this
        //disc is hidden by an opaque crop mask, regardless of what
        //the basemap would otherwise show. Originally a buildings-
        //only setting, hence the legacy `building-radius` config
        //key; now also drives the LiDAR fetch bbox, the shadow clip,
        //and the cropped viewport.
        displayRadius:            string;
        displayRadiusHint:        string;
        //Surrounding buildings options. Cluster radius grows the home
        //group to include attached outbuildings, opacity controls the
        //transparency of the neighbours and the colour is the base
        //tint reused for every rendered building.
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
        //LiDAR-driven shadow precision. Three named levels mapped to a
        //raster size in helios-engine. Only meaningful when the home
        //sits inside a LiDAR provider's coverage.
        lidarPrecision:          string;
        lidarPrecisionLow:       string;
        lidarPrecisionMedium:    string;
        lidarPrecisionHigh:      string;
        lidarPrecisionHint:      string;
        //Opacity of the cast ground shadows, 0..1 slider in the editor.
        shadowOpacity:            string;
        shadowOpacityHint:        string;
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

const LOCALES: Record<string, Translations> = { en, fr, de, es, it, nl, pt, no };

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