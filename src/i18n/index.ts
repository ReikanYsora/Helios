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
    //Detail dashboard, opened by clicking the home. The camera eases
    //in (zoom + pitch) and a full-card overlay takes over while the
    //pre-existing HUD fades out.
    detail:
    {
        exitHint:  string;       //close-button aria-label

        //CoverFlow dashboard panel. Each key is OPTIONAL because the renderer falls back to the
        //English text below via `??` when the active locale has not been updated yet, so locale
        //files only have to add these keys when ready.
        tileProductionLabel?:   string; //'Production'
        dayLabelToday?:         string; //'Today'
        dayLabelYesterday?:     string; //'Yesterday'
        dayLabelDayBefore?:     string; //'2 days ago'
        dayLabelTomorrow?:      string; //'Tomorrow'
        dayLabelDayAfter?:      string; //'In 2 days'
        //Label inside the top-of-card loading banner, visible while the first hydration wave of
        //data fetches is still in flight.
        loadingLabel?:          string; //'Fetching data...'
        //Headline + body for the alert banner that appears under the loading banner when the
        //Open-Meteo weather-data fetch hits HTTP 429 (rate limit). Goes away once a subsequent
        //fetch succeeds, the user knows the card is temporarily without fresh weather data and
        //why.
        weatherRateLimitTitle?:   string; //'OpenMeteo rate limit'
        weatherRateLimitMessage?: string; //'Too many requests, please wait'
        //Badge labels on the dashboard radial dial chip strip (Production / Battery / Cloud /
        //Irradiance).
        radialProductionLabel?: string; //'Production'
        radialBatteryLabel?:    string; //'Battery'
        radialCloudLabel?:      string; //'Cloud'
        radialIrradianceLabel?: string; //'Irradiance'
        //Aria label + visible text on the "back to live" button that appears in the top-right corner
        //of the radial card while a hover cursor is parked on the dial. Tapping it clears the cursor
        //and snaps the dial back to its live read-out.
        radialBackToLive?:      string; //'Back to live'
        //Aria label + title on the view-mode toggle in the CoverFlow card bandeau. The visible icon
        //is a glyph (radar dial vs chart line), the title carries the human-readable mode name.
        dashViewRadialLabel?:   string; //'Radial view'
        dashViewGraphLabel?:    string; //'Graph view'
        //Mini-card label above the graph view's forecast value (kWh predicted for the day, OR the
        //hovered hour's instantaneous W when the user parks the cursor on the chart).
        dashForecastLabel?:     string; //'Forecast'
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
        //Top section grouping the map style + label visibility + camera auto-rotate toggle. Title reads "UI & map" because it bundles the basemap
        //chrome with the camera animation that drives the user-facing motion.
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
        //Data display section: per-card knob that controls how dense the unified data source is
        //(buckets per hour, 1-60). Single slider, one hint. Sits above the PV install section so
        //the user sees the precision / cost knob before the install-level config.
        dataDisplaySection:           string;
        displayUpdateFrequency:       string;
        displayUpdateFrequencyHelp:   string;
        //Global display radius slider (50-500 m). Optional: only the FR locale carries it for now,
        //every other locale falls back to the inline default in the editor. Re-added in v1.8.4 as a
        //perf lever for older phones (smaller rendered disc = less geometry projected per frame).
        displayRadius?:               string;
        displayRadiusHelp?:           string;
        //Single section for the user's PV install. Bundles the inverter cap, the per-row panel orientation, the inverter-cutoff
        //SoC guard and the optional solar-radiation override sensor: every install-level knob that does NOT have a HA Energy
        //dashboard equivalent.
        installationSection:      string;
        //Hint rendered at the top of the section, telling the user every entity wiring (production, grid, battery) lives in
        //the HA Energy dashboard now and this section only adds the install-level details that improve forecast accuracy.
        installationHint:         string;
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
        //Per-string peak power in kWp. The total install power is
        //the sum across rows.
        pvArrayPeakKwp:           string;
        pvArrayPeakKwpHelp:       string;
        pvArrayAdd:               string;
        pvArrayRemove:            string;
        pvArrayNormHint:          string;
        //Per-field helps under tilt / azimuth / share, with the share-specific explanation of the auto-normalisation contract spelled out so users
        //know that 50/50 and 1/1 give the same forecast.
        pvArrayTiltHelp:          string;
        pvArrayAzimuthHelp:       string;
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
        //Sun-tracking selector on each pv-arrays row. 'none' (default) is a fixed install, 'dual-axis'
        //has both tilt and azimuth following the sun, 'single-axis-h' keeps the azimuth fixed and tracks
        //tilt only, 'single-axis-v' keeps the tilt fixed and tracks azimuth only.
        pvArrayTracker:           string;
        pvArrayTrackerNone:       string;
        pvArrayTrackerDual:       string;
        pvArrayTrackerSingleH:    string;
        pvArrayTrackerSingleV:    string;
        pvArrayTrackerHelp:       string;
        //Inverter cutoff SoC: percent at which the user's hybrid inverter clamps PV output once the battery hits its set ceiling. When set,
        //the forecast learning drops every hour where the SoC reached this value so the inverter-blocked production doesn't
        //train as phantom shadow.
        inverterCutoffSocPct:       string;
        inverterCutoffSocPctHelp:   string;
        //Optional W/m² sensor override (Ecowitt / Davis / personal weather station). When wired, the card prefers it over Open-Meteo
        //for the live + past irradiance values. Forecast hours always fall through to the model since a sensor only knows the present.
        solarRadiationEntity:     string;
        solarRadiationEntityHelp: string;
        //Surrounding buildings options. Cluster radius grows the home group to include attached outbuildings, opacity controls the transparency of
        //the neighbours and the colour is the base tint reused for every rendered building.
        buildingsSection:         string;
        buildingsHint:            string;
        buildingClusterRadius:    string;
        buildingOpacity:          string;
        //Pixel-ratio toggle replacing the old performance-mode
        //switch. 'Auto' uses the device's devicePixelRatio capped at
        //2 / 1.25 (desktop / mobile). '1x' forces 1.0 for the
        //cheapest per-frame fragment workload.
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
        //Collapsible nested section that lets a power user point Helios at their own nDSM GeoTIFF for shadow data. Hidden by default behind a
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
        //Developer block: surfaces the person behind the card with links to a personal X profile +
        //LinkedIn page. Sits right after the version row in the About section.
        aboutDeveloperLabel:      string;
        aboutDeveloperLinkedIn:   string;
    };
}

//Locale registry. Helios mirrors the 64 languages Home Assistant supports out of the box; pickTranslations walks the
//hass.language tag through this map and falls back to English when no entry matches. Regional variants (en-GB, pt-BR,
//es-419, sr-Latn, zh-Hans, zh-Hant) get their own entry so their dialect-specific phrasing wins over the language root.
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
//`is` is a TypeScript contextual keyword that confuses the parser at module scope; the locale file exports `is_`
//(trailing underscore), the map below keys it as the natural `is` tag.
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