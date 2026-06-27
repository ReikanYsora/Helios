/*
 * Lightweight i18n for HELIOS: synchronous, zero-dep. Locales are inlined at build time. The
 * active language comes from `hass.language`; missing languages fall back to English.
 */

//Contractual shape every locale must implement. Declared explicitly (not derived via `typeof en`)
//so the English locale can import the type without a circular dependency. New keys must be added
//here and in every locale (TS error otherwise).
//Locale registry. Only English + French ship for now; the full language set is regenerated before
//release. pickTranslations walks the hass.language tag through this map, falling back to English.
import { en } from './locales/en';
import { fr } from './locales/fr';

export interface Translations
{
    cardName:        string;
    cardDescription: string;

    //In-card rolling-period selector on the timeline. Optional; renderer falls back to English.
    period?:
    {
        rangeLabel?: string; //'Time range' (aria-label on the selector group)
        now?:        string; //'Now' (today + tomorrow)
        week?:       string; //'1 week'
        month?:      string; //'1 month'
        year?:       string; //'1 year'
    };

    editor:
    {
        //Optional home-location override for the card's center. Blank → falls back to hass.config;
        //valid coords (lat -90..90, lon -180..180) win over HA's configured home.
        locationSection:          string;
        homeLatitude:             string;
        homeLongitude:            string;
        locationHint:             string;
        //Display radius + camera auto-rotate. Titled "UI & map" since it bundles the scene framing with
        //the camera animation.
        uiAndMapSection:          string;
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
        //Global display radius slider (50-500 m). Optional, FR-only; perf lever (smaller disc =
        //less geometry per frame).
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
        //PV install: inverter cap, per-row panel orientation, inverter-cutoff SoC guard, optional
        //solar-irradiance override sensor — every install-level knob with no HA Energy equivalent.
        installationSection:      string;
        //Section-top hint: entity wiring (production, grid, battery) lives in HA Energy now; this
        //section only adds install details that improve forecast accuracy.
        installationHint:         string;
        //Optional W/m² sensor override (Ecowitt / Davis / PWS). When wired, preferred over Open-Meteo
        //for live + past irradiance; forecast hours always fall through to the model.
        solarIrradianceEntity:     string;
        solarIrradianceEntityHelp: string;
        customEntity:              string;
        customEntityHelp:          string;
        customEntityIcon:          string;
        //Surrounding buildings: cluster radius grows the home group to include attached outbuildings,
        //opacity sets neighbour transparency, colour is the base tint for every building.
        buildingsSection:         string;
        buildingsHint:            string;
        buildingClusterRadius:    string;
        buildingOpacity:          string;
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
        //Reset: one destructive button wiping every cached payload (weather, PV history, sample
        //buffer) and forcing a fresh fetch. Own collapsible section at the editor bottom.
        //resetCacheDone is a transient post-click confirmation on the button.
        resetSection:             string;
        resetSectionHint:         string;
        resetCacheButton:         string;
        resetCacheWarning:        string;
        resetCacheDone:           string;
        //About section at the editor bottom: version string, the source repo, an appreciation line +
        //Buy Me A Coffee link.
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
    en, fr,
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
