/*
 * Lightweight i18n: synchronous, zero-dep. Locales are inlined at build time. The active language
 * comes from `hass.language`; missing languages fall back to English.
 */

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
import { isLocale } from './locales/is';
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

//Contractual shape every locale must implement. Declared explicitly (not derived via `typeof en`) so
//the English locale can import the type without a circular dependency. New keys must be added here and
//in every locale (TS error otherwise).
export interface Translations
{
    cardName:        string;
    cardDescription: string;

    //In-card rolling-period selector on the timeline. Optional; renderer falls back to English.
    period?:
    {
        rangeLabel?: string; //'Time range' (aria-label on the selector group)
        standard?:   string; //'Standard' (J-2 .. J+2)
        today?:      string; //'Today'
        now?:        string; //legacy key (kept so existing locales still type-check)
        week?:       string; //'1 week'
        month?:      string; //'1 month'
        year?:       string; //'1 year'
    };

    //Energy-clock labels: ground compass letters (N/S/E/W, localised, e.g. W to O in French) and the three
    //cloud-cover band names in the tooltip.
    clock:
    {
        compassN: string;
        compassS: string;
        compassE: string;
        compassW: string;
        cloudLow:  string;
        cloudMid:  string;
        cloudHigh: string;
        //Home-hover tooltip header: the window aggregate for the active filters.
        total:     string;
    };

    editor:
    {
        //Home-location override for the card's center. Blank falls back to hass.config; valid coords
        //(lat -90..90, lon -180..180) win over HA's configured home.
        locationSection:          string;
        homeLatitude:             string;
        homeLongitude:            string;
        locationHint:             string;
        //Display radius + camera auto-rotate, titled "UI & map".
        uiAndMapSection:          string;
        autoRotate:               string;
        autoRotateHint:           string;
        autoRotateOn:             string;
        autoRotateOff:            string;
        //Data display: density of the unified data source (buckets per hour, 1-60).
        dataDisplaySection:           string;
        displayUpdateFrequency:       string;
        displayUpdateFrequencyHelp:   string;
        //Decimal-precision slider (0-3) for value readouts. Optional; falls back to inline English.
        valueDecimals?:               string;
        valueDecimalsHelp?:           string;
        //Power unit selector (W / kW) and solar-constant unit selector (W/m2 / kW/m2). Optional; fall back to English.
        powerUnit?:                   string;
        powerUnitHelp?:               string;
        irradianceUnit?:              string;
        irradianceUnitHelp?:          string;
        //Battery-sign selector + home-consumption override entity. Optional; fall back to English.
        batterySign?:                 string;
        batterySignHelp?:             string;
        batterySignDefault?:          string;
        batterySignInverted?:         string;
        batterySignHidden?:           string;
        homeConsumptionEntity?:       string;
        homeConsumptionEntityHelp?:   string;
        //Global display radius slider (50-500 m). Optional, FR-only.
        displayRadius?:               string;
        displayRadiusHelp?:           string;
        buildingCount?:               string;
        buildingCountHelp?:           string;
        buildingRealSize?:            string;
        buildingRealSizeOn?:          string;
        buildingRealSizeOff?:         string;
        buildingRealSizeHint?:        string;
        buildingHeight?:              string;
        buildingHeightHelp?:          string;
        //PV install: install-level knobs with no HA Energy equivalent (e.g. the solar-irradiance override).
        installationSection:      string;
        //Section-top hint: entity wiring (production, grid, battery) lives in HA Energy; this section only
        //adds install details that improve forecast accuracy.
        installationHint:         string;
        //W/m² sensor override. When wired, preferred over the model for live + past irradiance; forecast
        //hours always fall through to the model.
        solarIrradianceEntity:     string;
        solarIrradianceEntityHelp: string;
        customEntity:              string;
        customEntityHelp:          string;
        customEntityIcon:          string;
        customEntityColor:         string;
        customEntityColorHelp:     string;
        //Surrounding buildings: cluster radius, neighbour opacity, base tint.
        buildingsSection:         string;
        homeColor:                string;
        homeColorHelp:            string;
        buildingsHint:            string;
        buildingClusterRadius:    string;
        buildingOpacity:          string;
        buildingColor:            string;
        buildingColorHelp:        string;
        //Shadow options.
        shadowsSection:           string;
        //Master shadow toggle (building footprints).
        shadowsEnabled:           string;
        shadowsEnabledOn:         string;
        shadowsEnabledOff:        string;
        shadowsEnabledHint:       string;
        //Cast-shadow opacity, 0..1 slider.
        shadowOpacity:            string;
        shadowOpacityHint:        string;
        //Reset: one destructive button wiping every cached payload (weather, PV history, sample buffer)
        //and forcing a fresh fetch. resetCacheDone is a transient confirmation shown on the button.
        resetSection:             string;
        resetSectionHint:         string;
        resetCacheButton:         string;
        resetCacheWarning:        string;
        resetCacheDone:           string;
        //About section: version string, source repo, appreciation line + Buy Me A Coffee link.
        aboutSection:             string;
        aboutVersionLabel:        string;
        aboutRepoCard:            string;
        aboutCoffeeMessage:       string;
        aboutCoffeeLink:          string;
        //Developer block (X profile + LinkedIn), right after the version row.
        aboutDeveloperLabel:      string;
        aboutDeveloperLinkedIn:   string;
    };
}

const LOCALES: Record<string, Translations> =
{
    af, ar, bg, bn, bs, ca, cs, cy, da, de, el, en, eo, es, et, eu, fa, fi, fr, fy, gl, gsw,
    he, hi, hr, hu, hy, id, it, ja, ka, ko, lb, lt, lv, ml, nb, nl, nn, no, pl, pt, ro, ru, si,
    sk, sl, sr, sv, ta, te, th, tr, uk, ur, vi,
    'is':      isLocale,
    'en-gb':   enGB,
    'es-419':  es419,
    'pt-br':   ptBR,
    'sr-latn': srLatn,
    'zh-hans': zhHans,
    'zh-hant': zhHant,
};

const FALLBACK: Translations = en;

//Adding a locale: create ./locales/xx.ts exporting `xx: Translations`, import it here and add to
//LOCALES; pickTranslations then resolves `xx-YY` -> `xx-yy` -> `xx` -> `en`.
export function pickTranslations(haLanguage: string | undefined): Translations
{
    if (!haLanguage)
    {
        return FALLBACK;
    }

    //Match by specificity: full tag -> language root -> English
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
