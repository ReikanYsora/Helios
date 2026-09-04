/*
 * Lightweight i18n: synchronous, zero-dep. Locales are inlined at build time. The active language
 * comes from `hass.language`; missing languages fall back to English.
 */

import { bg } from './locales/bg';
import { cs } from './locales/cs';
import { da } from './locales/da';
import { de } from './locales/de';
import { el } from './locales/el';
import { en } from './locales/en';
import { es } from './locales/es';
import { et } from './locales/et';
import { fi } from './locales/fi';
import { fr } from './locales/fr';
import { hr } from './locales/hr';
import { hu } from './locales/hu';
import { isLocale } from './locales/is';
import { it } from './locales/it';
import { lt } from './locales/lt';
import { lv } from './locales/lv';
import { nb } from './locales/nb';
import { nl } from './locales/nl';
import { pl } from './locales/pl';
import { pt } from './locales/pt';
import { ro } from './locales/ro';
import { ru } from './locales/ru';
import { sk } from './locales/sk';
import { sl } from './locales/sl';
import { sr } from './locales/sr';
import { sv } from './locales/sv';
import { uk } from './locales/uk';

//Contractual shape every locale must implement. Declared explicitly (not derived via `typeof en`) so
//the English locale can import the type without a circular dependency. New keys must be added here and
//in every locale (TS error otherwise).
export interface Translations
{
    cardName:        string;
    cardDescription: string;

    //In-card rolling-period selector on the timeline.
    period:
    {
        rangeLabel: string; //'Time range' (aria-label on the selector group)
        forecast:   string; //'Forecast' (the J..J+2 rolling window: today and the two days ahead)
        yesterday:  string; //'Yesterday'
        today:      string; //'Today'
        week:       string; //'1 week'
        month:      string; //'1 month'
        year:       string; //'1 year'
    };


    //Eight-point compass abbreviations for the sun-position chip, N first and clockwise, comma-joined.
    compass: string;


    //The three cloud-cover band names shown in the timeline tooltip.
    cloudCover:
    {
        cloudLow:  string;
        cloudMid:  string;
        cloudHigh: string;
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
        //Decimal-precision slider (0-3) for value readouts.
        valueDecimals:               string;
        valueDecimalsHelp:           string;
        //Flow-animation reference power (W).
        maxExpectedPower:            string;
        maxExpectedPowerHelp:        string;
        //Sun-chip readout mode (irradiance / sun position) and its option labels.
        sunChipMode:                 string;
        sunChipModeHelp:             string;
        sunChipModeIrradiance:       string;
        sunChipModePosition:         string;
        //Battery-chip readout mode (power / state of charge) and its option labels.
        batteryChipMode:             string;
        batteryChipModeHelp:         string;
        batteryChipModePower:        string;
        batteryChipModeSoc:          string;
        //Power unit selector (W / kW), energy unit selector (auto / Wh / kWh, defaults to following the power
        //unit above), and solar-constant unit selector (W/m2 / kW/m2).
        powerUnit:                   string;
        powerUnitHelp:               string;
        energyUnit:                  string;
        energyUnitHelp:              string;
        energyUnitAuto:              string;
        irradianceUnit:              string;
        irradianceUnitHelp:          string;
        //Battery-sign selector + home-consumption override entity.
        batterySign:                 string;
        batterySignHelp:             string;
        batterySignDefault:          string;
        batterySignInverted:         string;
        batterySignHidden:           string;
        //"Your real sky" weather-effects toggle.
        weatherEnabled:              string;
        weatherEnabledHint:          string;
        //"No UI" mode toggle (auto-hide the timeline + controls).
        noUiMode:                    string;
        noUiModeHint:                string;
        //"No UI" idle-delay slider (0-10 s). Only editable when No UI mode is on.
        noUiDelay:                   string;
        noUiDelayHint:               string;
        //Scene element visibility toggles.
        showTimeline:                string;
        showTimelineHint:            string;
        showDetailPanel:             string;
        showDetailPanelHint:         string;
        showSunTimes:                string;
        showSunTimesHint:            string;
        //Terrain-horizon ridge: show/hide the drawn line + its colour. The sun gate always uses the terrain.
        showHorizonLine:             string;
        showHorizonLineHint:         string;
        horizonLineColor:            string;
        horizonLineColorHint:        string;
        //Moon arc + crescent: three-way visibility (always / night only / hidden). Cosmetic, no chip.
        moonDisplay:                 string;
        moonDisplayHint:             string;
        moonDisplayAlways:           string;
        moonDisplayNight:            string;
        moonDisplayHidden:           string;
        sceneZoom:                   string;
        sceneZoomHint:               string;
        //Camera pose controls (scene view): the lock toggle + a hint to set the angle by dragging the preview.
        lockRotation:                string;
        lockRotationHint:            string;
        //Compatibility ("degraded") renderer toggle: a last resort for devices whose WebView flickers.
        degradedRender:              string;
        degradedRenderHint:          string;
        //"Chips & colours" section: per-chip show/hide toggles + colour pickers.
        chipsSection:                string;
        chipsIntro:                  string;
        chipIrradiance:              string;
        chipProduction:              string;
        chipGrid:                    string;
        chipBattery:                 string;
        chipHome:                    string;
        chipTemperature:             string;
        chipHumidity:                string;
        chipCost:                    string;
        //Sections split out of "Entity display": group definitions and optional sensors.
        groupsConfigTitle:           string;
        optionalSensors:             string;
        //Global display radius slider (50-500 m).
        displayRadius:               string;
        displayRadiusHelp:           string;
        buildingCount:               string;
        buildingCountHelp:           string;
        buildingRealSize:            string;
        buildingRealSizeOn:          string;
        buildingRealSizeOff:         string;
        buildingRealSizeHint:        string;
        buildingHeight:              string;
        //Devices & monitoring groups: per-device show/hide and group assignment.
        hiddenDevicesEmpty:      string;
        //aria-label (screen-reader only, no visible tooltip) for the per-device show/hide toggle.
        deviceVisibilityLabel:      string;
        //The group pill: the "Group" word (+ number) and the "No group" state.
        group:                         string;
        noGroup:                       string;
        groupAssignHint:               string;
        groupDropHere:                 string;
        backToLive:                    string;
        //Solar-irradiance override entity (W/m² sensor). When wired, preferred over the model for live + past
        //irradiance; forecast hours always fall through to the model.
        solarIrradianceEntity:     string;
        solarIrradianceEntityHelp: string;
        //Local weather-override sensors.
        temperatureEntity:        string;
        temperatureEntityHelp:    string;
        humidityEntity:           string;
        humidityEntityHelp:       string;
        cloudCoverEntity:         string;
        cloudCoverEntityHelp:     string;
        precipitationEntity:      string;
        precipitationEntityHelp:  string;
        snowfallEntity:           string;
        snowfallEntityHelp:       string;
        weatherEntity:            string;
        weatherEntityHelp:        string;
        //Measured-only status lines (live chip readiness per energy family, configured or not).
        liveDataTitle:            string;
        liveDataIntro:            string;
        liveSolarOk:              string;
        liveSolarMissing:         string;
        liveSolarAbsent:          string;
        liveGridOk:               string;
        liveGridMissing:          string;
        liveGridMiswired:         string;
        liveGridAbsent:           string;
        liveBatteryOk:            string;
        liveBatteryMissing:       string;
        liveBatteryAbsent:        string;
        liveHomeOk:               string;
        liveHomeNote:             string;
        //Deep link on a non-OK status line to Home Assistant's Energy configuration.
        openEnergyConfig:         string;
        //Surrounding buildings: cluster radius, neighbour opacity, base tint.
        buildingsSection:         string;
        buildingsHint:            string;
        buildingClusterRadius:    string;
        buildingClusterRadiusHelp: string;
        buildingOpacity:          string;
        buildingColor:            string;
        buildingColorHelp:        string;
        //Shadow options.
        shadowsSection:           string;
        moonSection:              string;
        //Master shadow toggle (building footprints).
        shadowsEnabled:           string;
        shadowsEnabledOn:         string;
        shadowsEnabledOff:        string;
        shadowsEnabledHint:       string;
        //Cast-shadow opacity, 0..1 slider.
        shadowOpacity:            string;
        shadowOpacityHint:        string;
        //Reset: two buttons. One refetches every cached payload (weather, all energy series, forecast
        //calibration, OpenFreeMap footprints); the other resets every card option to its default (a confirming
        //second click). The *Done keys are transient confirmations shown on each button.
        resetSection:             string;
        resetSectionHint:         string;
        resetCacheButton:         string;
        resetCacheWarning:        string;
        resetCacheDone:           string;
        resetOptionsButton:      string;
        resetOptionsConfirm:     string;
        resetOptionsWarning:     string;
        resetOptionsDone:        string;
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

    //Vector basemap "Map configuration" section. The layer fields
    //are keyed by the GroundLayerKey names so the editor can look them up directly.
    mapConfig:
    {
        section:    string;
        intro:      string;
        modeAuto:   string;
        modeDark:   string;
        modeLight:  string;
        modeCustom: string;
        land:       string;
        water:      string;
        wood:       string;
        grass:      string;
        sand:       string;
        wetland:    string;
        ice:        string;
        landuse:    string;
        roadMajor:  string;
        roadMinor:  string;
        roadCasing: string;
        path:       string;
        rail:       string;
        building:   string;
        boundary:   string;
    };
}

const LOCALES: Record<string, Translations> =
{
    bg, cs, da, de, el, en, es, et, fi, fr, hr, hu, it, lt, lv, nb, nl, pl, pt, ro, ru,
    sk, sl, sr, sv, uk,
    'is': isLocale,
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
