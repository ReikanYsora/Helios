//Detection + messaging for retired card-YAML entity keys. Pure: depends only on the passed config. The card keeps
//the one-shot dedupe + persistent-notification dispatch; this module owns the key list and the copy.
import type { HeliosConfig } from '../helios-config';

const LEGACY_ENTITY_KEYS: readonly string[] =
[
    'pv-power-entity',
    'grid-import-entity',
    'grid-export-entity',
    'grid-power-entity',
    'grid-power-invert',
    'battery-soc-entity',
    'battery-power-entity',
    'battery-power-invert',
    'batteries',
];

//Retired entity keys present (non-empty) in the config, in declaration order.
export function detectLegacyEntityKeys(config: HeliosConfig): string[]
{
    const detected: string[] = [];
    for (const key of LEGACY_ENTITY_KEYS)
    {
        const v = (config as Record<string, unknown>)[key];
        if (v !== undefined && v !== null && v !== '')
        {
            detected.push(key);
        }
    }
    return detected;
}

//Persistent-notification body explaining the ignored keys and pointing at the HA Energy dashboard.
export function legacyEntityKeysMessage(detected: string[]): string
{
    return `The Helios card no longer reads its PV, grid and battery entities from the card YAML. `
        + `The following key${detected.length > 1 ? 's are' : ' is'} silently ignored: ${detected.map(k => '`' + k + '`').join(', ')}. `
        + `Helios now resolves these directly from the official Home Assistant Energy dashboard `
        + `(Settings -> Dashboards -> Energy -> your sources). The PV forecast is also read from the `
        + `Energy dashboard's configured solar forecast now, so the card no longer carries any PV `
        + `install configuration. Only the entity slots and the forecast config were retired; the `
        + `visual options still live in the card YAML.`;
}
