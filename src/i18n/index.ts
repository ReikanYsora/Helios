/*
 * Lightweight i18n for HELIOS: synchronous, zero-dep. Locales are inlined at build time. The
 * active language comes from `hass.language`; missing languages fall back to English.
 */

//Contractual shape every locale must implement. Declared explicitly (not derived via `typeof en`)
//so the English locale can import the type without a circular dependency. New keys must be added
//here and in every locale (TS error otherwise).
export interface Translations
{
    cardName:        string;
    cardDescription: string;
    //Detail dashboard, opened by clicking the home: camera eases in (zoom + pitch), a full-card
    //overlay takes over while the pre-existing HUD fades out.
    detail:
    {
        exitHint:  string;       //close-button aria-label

        //CoverFlow dashboard panel. Keys are OPTIONAL: the renderer falls back to the inline
        //English text via `??` when the active locale lacks them.
        tileProductionLabel?:   string; //'Production'
        dayLabelToday?:         string; //'Today'
        dayLabelYesterday?:     string; //'Yesterday'
        dayLabelDayBefore?:     string; //'2 days ago'
        dayLabelTomorrow?:      string; //'Tomorrow'
        dayLabelDayAfter?:      string; //'In 2 days'
        loadingLabel?:          string; //'Fetching data...' (top-of-card loading banner)
        //Open-Meteo HTTP 429 (rate limit) alert under the loading banner; clears once a fetch
        //succeeds.
        weatherRateLimitTitle?:   string; //'OpenMeteo rate limit'
        weatherRateLimitMessage?: string; //'Too many requests, please wait'
        //Radial dial chip strip badges.
        radialProductionLabel?: string; //'Production'
        radialBatteryLabel?:    string; //'Battery'
        radialCloudLabel?:      string; //'Cloud'
        radialIrradianceLabel?: string; //'Irradiance'
        //"Back to live" button: clears the parked hover cursor and snaps the dial to its live
        //read-out (aria label + visible text).
        radialBackToLive?:      string; //'Back to live'
        //View-mode toggle in the CoverFlow bandeau (aria label + title; icon is a glyph).
        dashViewRadialLabel?:   string; //'Radial view'
        dashViewGraphLabel?:    string; //'Graph view'
        //Mini-card label above the graph view's forecast value (daily kWh, or the hovered hour's
        //instantaneous W).
        dashForecastLabel?:     string; //'Forecast'
    };

    //In-card rolling-period selector on the timeline. Optional; renderer falls back to English.
    period?:
    {
        rangeLabel?:    string; //'Time range' (aria-label on the selector group)
        today?:         string; //'Today'
        configDefault?: string; //'Default' (returns to the configured span)
        last7Days?:     string; //'7 d'
    };

    editor:
    {
        //Optional home-location override for the card's center. Blank → falls back to hass.config;
        //valid coords (lat -90..90, lon -180..180) win over HA's configured home.
        locationSection:          string;
        homeLatitude:             string;
        homeLongitude:            string;
        locationHint:             string;
        //Map style + label visibility + camera auto-rotate. Titled "UI & map" since it bundles
        //basemap chrome with the camera animation.
        uiAndMapSection:          string;
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
        //Data display: density of the unified data source (buckets per hour, 1-60). Sits above the
        //PV install section.
        dataDisplaySection:           string;
        displayUpdateFrequency:       string;
        displayUpdateFrequencyHelp:   string;
        //Decimal-precision slider (0-3) for value readouts. Optional; falls back to inline English.
        valueDecimals?:               string;
        valueDecimalsHelp?:           string;
        //Global display radius slider (50-500 m). Optional, FR-only for now; perf lever (smaller
        //disc = less geometry per frame). Re-added in v1.8.4.
        displayRadius?:               string;
        displayRadiusHelp?:           string;
        //PV install: inverter cap, per-row panel orientation, inverter-cutoff SoC guard, optional
        //solar-radiation override sensor — every install-level knob with no HA Energy equivalent.
        installationSection:      string;
        //Section-top hint: entity wiring (production, grid, battery) lives in HA Energy now; this
        //section only adds install details that improve forecast accuracy.
        installationHint:         string;
        //Inverter clipping cap (kW AC). Optional; forecast tops out here so an over-sized DC array
        //on a smaller inverter doesn't render an unachievable peak.
        pvInverterMaxKw:          string;
        pvInverterMaxKwHelp:      string;
        //Multi-array PV layout. Each entry: tilt (0..90), azimuth (0..360 cw from north, 180=south),
        //share % of total kWp. Shares are normalised to sum 1.0 at compute time, so the editor warns
        //when typed shares don't add to 100. "+ Add array" hidden past 6 entries. pvArraysSection is
        //its own block so the region reads as a discrete sub-section.
        pvArraysSection:          string;
        pvArraysHelp:             string;
        pvArrayTitle:             string;   //e.g. "Array {n}"
        pvArrayName:              string;
        pvArrayNameHelp:          string;
        pvArrayTilt:              string;
        pvArrayAzimuth:           string;
        //Per-string peak power (kWp); total install power is the row sum.
        pvArrayPeakKwp:           string;
        pvArrayPeakKwpHelp:       string;
        pvArrayAdd:               string;
        pvArrayRemove:            string;
        pvArrayNormHint:          string;
        //Per-field helps for tilt / azimuth / share; share help spells out auto-normalisation (50/50
        //and 1/1 give the same forecast).
        pvArrayTiltHelp:          string;
        pvArrayAzimuthHelp:       string;
        //Optional per-array GPS coords, for panels a meaningful distance from the home (e.g.
        //ground-mounted in a clearing): drives true sun position + a map marker at the panel.
        pvArrayLatitude:          string;
        pvArrayLongitude:         string;
        pvArrayCoordsHelp:        string;
        pvArrayCoordsPlaceholder: string;
        //Panel-group height above ground (m). Kept for the per-array geometry; no longer used for
        //obstacle shading now that LiDAR is gone.
        pvArrayHeight:            string;
        pvArrayHeightHelp:        string;
        //Sun-tracking selector per row: 'none' (fixed, default), 'dual-axis' (tilt+azimuth track),
        //'single-axis-h' (tilt only), 'single-axis-v' (azimuth only).
        pvArrayTracker:           string;
        pvArrayTrackerNone:       string;
        pvArrayTrackerDual:       string;
        pvArrayTrackerSingleH:    string;
        pvArrayTrackerSingleV:    string;
        pvArrayTrackerHelp:       string;
        //Inverter cutoff SoC: % at which a hybrid inverter clamps PV once the battery ceiling is hit.
        //Forecast learning drops every hour that reached this SoC so blocked production doesn't train
        //as phantom shadow.
        inverterCutoffSocPct:       string;
        inverterCutoffSocPctHelp:   string;
        //Optional W/m² sensor override (Ecowitt / Davis / PWS). When wired, preferred over Open-Meteo
        //for live + past irradiance; forecast hours always fall through to the model.
        solarRadiationEntity:     string;
        solarRadiationEntityHelp: string;
        //Surrounding buildings: cluster radius grows the home group to include attached outbuildings,
        //opacity sets neighbour transparency, colour is the base tint for every building.
        buildingsSection:         string;
        buildingsHint:            string;
        buildingClusterRadius:    string;
        buildingOpacity:          string;
        //Third map-style segment: a curated minimal basemap (no POIs / place labels / road shields)
        //for low-end devices.
        mapStyleMinimal:          string;
        //Shadow options.
        shadowsSection:           string;
        //Master shadow toggle (OpenFreeMap building footprints).
        shadowsEnabled:           string;
        shadowsEnabledOn:         string;
        shadowsEnabledOff:        string;
        shadowsEnabledHint:       string;
        //Cast-shadow opacity, 0..1 slider.
        shadowOpacity:            string;
        shadowOpacityHint:        string;
        //Reset: one destructive button wiping every cached payload (weather, PV history, sample
        //buffer) and forcing a fresh fetch. Own collapsible section at the editor bottom.
        //resetCacheDone is a transient post-click confirmation on the button.
        resetSection:             string;
        resetSectionHint:         string;
        resetCacheButton:         string;
        resetCacheWarning:        string;
        resetCacheDone:           string;
        //About section at the editor bottom: version string, the source repo, an appreciation line +
        //Buy Me A Coffee link. (aboutSiteTitle/aboutSiteDescription are unused since the companion-site
        //link was removed with LiDAR; pending removal in the translation cleanup.)
        aboutSection:             string;
        aboutVersionLabel:        string;
        aboutSiteTitle:           string;
        aboutSiteDescription:     string;
        aboutCodeLabel:           string;
        aboutRepoCard:            string;
        aboutCoffeeMessage:       string;
        aboutCoffeeLink:          string;
        //Developer block (X profile + LinkedIn), right after the version row.
        aboutDeveloperLabel:      string;
        aboutDeveloperLinkedIn:   string;
    };
}

//Locale registry mirroring HA's 64 built-in languages. pickTranslations walks the hass.language tag
//through this map, falling back to English. Regional variants (en-GB, pt-BR, es-419, sr-Latn,
//zh-Hans, zh-Hant) get their own entry so dialect phrasing wins over the language root.
import { af } from './locales/af';
import { ar } from './locales/ar';
import { bg } from './locales/bg';
import { bn } from './locales/bn';
import { bs } from './locales/bs';
import { ca } from './locales/ca';
import { cs } from './locales/cs';
import { cy } from './locales/cy';
import { da } from './locales/da';
import { de } from './locales/de';
import { el } from './locales/el';
import { en } from './locales/en';
import { enGB } from './locales/en-GB';
import { eo } from './locales/eo';
import { es } from './locales/es';
import { es419 } from './locales/es-419';
import { et } from './locales/et';
import { eu } from './locales/eu';
import { fa } from './locales/fa';
import { fi } from './locales/fi';
import { fr } from './locales/fr';
import { fy } from './locales/fy';
import { gl } from './locales/gl';
import { gsw } from './locales/gsw';
import { he } from './locales/he';
import { hi } from './locales/hi';
import { hr } from './locales/hr';
import { hu } from './locales/hu';
import { hy } from './locales/hy';
import { id } from './locales/id';
//`is` is a TS contextual keyword that confuses the parser at module scope; the locale file exports
//`is_`, the map below keys it as the natural `is` tag.
import { is_ } from './locales/is';
import { it } from './locales/it';
import { ja } from './locales/ja';
import { ka } from './locales/ka';
import { ko } from './locales/ko';
import { lb } from './locales/lb';
import { lt } from './locales/lt';
import { lv } from './locales/lv';
import { ml } from './locales/ml';
import { nb } from './locales/nb';
import { nl } from './locales/nl';
import { nn } from './locales/nn';
import { no } from './locales/no';
import { pl } from './locales/pl';
import { pt } from './locales/pt';
import { ptBR } from './locales/pt-BR';
import { ro } from './locales/ro';
import { ru } from './locales/ru';
import { si } from './locales/si';
import { sk } from './locales/sk';
import { sl } from './locales/sl';
import { sr } from './locales/sr';
import { srLatn } from './locales/sr-Latn';
import { sv } from './locales/sv';
import { ta } from './locales/ta';
import { te } from './locales/te';
import { th } from './locales/th';
import { tr } from './locales/tr';
import { uk } from './locales/uk';
import { ur } from './locales/ur';
import { vi } from './locales/vi';
import { zhHans } from './locales/zh-Hans';
import { zhHant } from './locales/zh-Hant';

const LOCALES: Record<string, Translations> =
{
    af, ar, bg, bn, bs, ca, cs, cy, da, de, el, en, eo, es, et, eu, fa, fi, fr, fy, gl, gsw,
    he, hi, hr, hu, hy, id, it, ja, ka, ko, lb, lt, lv, ml, nb, nl, nn, no, pl, pt, ro, ru, si,
    sk, sl, sr, sv, ta, te, th, tr, uk, ur, vi,
    'is':      is_,
    'en-GB':   enGB,
    'es-419':  es419,
    'pt-BR':   ptBR,
    'sr-Latn': srLatn,
    'zh-Hans': zhHans,
    'zh-Hant': zhHant,
};

const FALLBACK: Translations = en;

//Adding a locale: create ./locales/xx.ts exporting `xx: Translations`, import it here and add to
//LOCALES; pickTranslations then resolves `xx-YY` → `xx-yy` → `xx` → `en`.
export function pickTranslations(haLanguage: string | undefined): Translations
{
    if (!haLanguage)
    {
        return FALLBACK;
    }

    //Match by specificity: full tag → language root → English
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
