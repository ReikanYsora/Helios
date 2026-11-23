//Custom house options are flat keys, like the rest of Helios's public YAML schema.
import type { HeliosConfig } from './helios-config';

export const HOUSE_MODEL_CONFIG_KEYS = [
    'house-model-url', 'house-model-size-m', 'house-model-scale',
    'house-model-rotation-deg', 'house-model-up-axis',
    'house-model-offset-east-m', 'house-model-offset-north-m',
] as const;

export interface HouseModelOptions
{
    url: string;
    sizeM: number;
    scale: number;
    rotationDeg: number;
    upAxis: 'y' | 'z';
    offsetEastM: number;
    offsetNorthM: number;
}

function numberOption(config: HeliosConfig, key: string, fallback: number, min: number, max: number): number
{
    const raw = config[key];
    const n = typeof raw === 'number' ? raw
        : typeof raw === 'string' && raw.trim() ? Number(raw) : NaN;
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

export function houseModelOptions(config: HeliosConfig | undefined): HouseModelOptions | null
{
    const raw = config?.['house-model-url'];
    if (!config || typeof raw !== 'string' || !raw.trim())
    {
        return null;
    }
    const angle = numberOption(config, 'house-model-rotation-deg', 0, -36000, 36000);
    return {
        url: raw.trim(),
        sizeM: numberOption(config, 'house-model-size-m', 12, 0.1, 100),
        scale: numberOption(config, 'house-model-scale', 1, 0.01, 10),
        rotationDeg: ((angle % 360) + 360) % 360,
        upAxis: config['house-model-up-axis'] === 'z' ? 'z' : 'y',
        offsetEastM: numberOption(config, 'house-model-offset-east-m', 0, -100, 100),
        offsetNorthM: numberOption(config, 'house-model-offset-north-m', 0, -100, 100),
    };
}
