import type { HassLike, HassEntity, HassConfig, UnsubscribeFunc } from '../src/core/ha-types';
import type { HeliosConfig } from '../src/core/config/helios-config';

export interface SandboxSimState {
    solarPower: number; // Watts
    gridPower: number; // Watts (+ = import, - = export)
    batteryPower: number; // Watts (+ = charge, - = discharge)
    batterySoc: number; // 0..100 %
    temperature: number; // °C
    humidity: number; // %
    weatherCondition: string; // sunny, cloudy, rainy, snowy, lightning
}

export class MockHassManager {
    public simState: SandboxSimState = {
        solarPower: 3450,
        gridPower: -850,
        batteryPower: 1200,
        batterySoc: 78,
        temperature: 21.5,
        humidity: 55,
        weatherCondition: 'sunny',
    };

    public config: HassConfig = {
        time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris',
        latitude: 48.8566,
        longitude: 2.3522,
        elevation: 35,
        currency: '€',
        unit_system: {
            temperature: '°C',
        },
    };

    public language = 'fr';
    public darkMode = true;

    private _listeners: Set<() => void> = new Set();
    private _eventListeners: Map<string, Set<(ev: unknown) => void>> = new Map();

    public onChange(fn: () => void): () => void {
        this._listeners.add(fn);
        return () => this._listeners.delete(fn);
    }

    private _notify(): void {
        for (const fn of this._listeners) {
            try {
                fn();
            } catch (e) {
                console.error('Error in MockHass listener:', e);
            }
        }
    }

    public updateSimState(partial: Partial<SandboxSimState>): void {
        Object.assign(this.simState, partial);
        this._notify();
    }

    public updateConfig(partial: Partial<HassConfig>): void {
        Object.assign(this.config, partial);
        this._notify();
    }

    public setDarkMode(dark: boolean): void {
        this.darkMode = dark;
        this._notify();
    }

    public setLanguage(lang: string): void {
        this.language = lang;
        this._notify();
    }

    public triggerEnergyPrefsUpdated(): void {
        const cbs = this._eventListeners.get('energy_preferences_updated');
        if (cbs) {
            for (const cb of cbs) {
                cb({});
            }
        }
    }

    public createHassObject(): HassLike {
        const nowIso = new Date().toISOString();

        const states: Record<string, HassEntity> = {
            'sensor.solar_production': {
                entity_id: 'sensor.solar_production',
                state: String(Math.round(this.simState.solarPower)),
                attributes: {
                    unit_of_measurement: 'W',
                    device_class: 'power',
                    friendly_name: 'Production Solaire',
                },
                last_changed: nowIso,
                last_updated: nowIso,
            },
            'sensor.solar_energy_total': {
                entity_id: 'sensor.solar_energy_total',
                state: '18.4',
                attributes: {
                    unit_of_measurement: 'kWh',
                    device_class: 'energy',
                    state_class: 'total_increasing',
                    friendly_name: 'Énergie Solaire Totale',
                },
                last_changed: nowIso,
                last_updated: nowIso,
            },
            'sensor.grid_power': {
                entity_id: 'sensor.grid_power',
                state: String(Math.round(this.simState.gridPower)),
                attributes: {
                    unit_of_measurement: 'W',
                    device_class: 'power',
                    friendly_name: 'Puissance Réseau',
                },
                last_changed: nowIso,
                last_updated: nowIso,
            },
            'sensor.grid_import_total': {
                entity_id: 'sensor.grid_import_total',
                state: '4.2',
                attributes: {
                    unit_of_measurement: 'kWh',
                    device_class: 'energy',
                    state_class: 'total_increasing',
                    friendly_name: 'Import Réseau',
                },
                last_changed: nowIso,
                last_updated: nowIso,
            },
            'sensor.grid_export_total': {
                entity_id: 'sensor.grid_export_total',
                state: '6.8',
                attributes: {
                    unit_of_measurement: 'kWh',
                    device_class: 'energy',
                    state_class: 'total_increasing',
                    friendly_name: 'Export Réseau',
                },
                last_changed: nowIso,
                last_updated: nowIso,
            },
            'sensor.battery_power': {
                entity_id: 'sensor.battery_power',
                state: String(Math.round(this.simState.batteryPower)),
                attributes: {
                    unit_of_measurement: 'W',
                    device_class: 'power',
                    friendly_name: 'Puissance Batterie',
                },
                last_changed: nowIso,
                last_updated: nowIso,
            },
            'sensor.battery_soc': {
                entity_id: 'sensor.battery_soc',
                state: String(Math.round(this.simState.batterySoc)),
                attributes: {
                    unit_of_measurement: '%',
                    device_class: 'battery',
                    friendly_name: 'Batterie SoC',
                },
                last_changed: nowIso,
                last_updated: nowIso,
            },
            'sensor.battery_charge_total': {
                entity_id: 'sensor.battery_charge_total',
                state: '5.1',
                attributes: {
                    unit_of_measurement: 'kWh',
                    device_class: 'energy',
                    state_class: 'total_increasing',
                    friendly_name: 'Charge Batterie',
                },
                last_changed: nowIso,
                last_updated: nowIso,
            },
            'sensor.battery_discharge_total': {
                entity_id: 'sensor.battery_discharge_total',
                state: '3.4',
                attributes: {
                    unit_of_measurement: 'kWh',
                    device_class: 'energy',
                    state_class: 'total_increasing',
                    friendly_name: 'Décharge Batterie',
                },
                last_changed: nowIso,
                last_updated: nowIso,
            },
            'sensor.outdoor_temperature': {
                entity_id: 'sensor.outdoor_temperature',
                state: this.simState.temperature.toFixed(1),
                attributes: {
                    unit_of_measurement: '°C',
                    device_class: 'temperature',
                    friendly_name: 'Température Extérieure',
                },
                last_changed: nowIso,
                last_updated: nowIso,
            },
            'sensor.outdoor_humidity': {
                entity_id: 'sensor.outdoor_humidity',
                state: String(Math.round(this.simState.humidity)),
                attributes: {
                    unit_of_measurement: '%',
                    device_class: 'humidity',
                    friendly_name: 'Humidité Extérieure',
                },
                last_changed: nowIso,
                last_updated: nowIso,
            },
            'sensor.device_ev_charger': {
                entity_id: 'sensor.device_ev_charger',
                state: '1800',
                attributes: {
                    unit_of_measurement: 'W',
                    device_class: 'power',
                    friendly_name: 'Borne VE',
                    icon: 'mdi:car-electric',
                },
                last_changed: nowIso,
                last_updated: nowIso,
            },
            'sensor.device_heatpump': {
                entity_id: 'sensor.device_heatpump',
                state: '850',
                attributes: {
                    unit_of_measurement: 'W',
                    device_class: 'power',
                    friendly_name: 'Pompe à Chaleur',
                    icon: 'mdi:heat-pump',
                },
                last_changed: nowIso,
                last_updated: nowIso,
            },
            'sensor.device_water_heater': {
                entity_id: 'sensor.device_water_heater',
                state: '0',
                attributes: {
                    unit_of_measurement: 'W',
                    device_class: 'power',
                    friendly_name: 'Chauffe-eau',
                    icon: 'mdi:water-boiler',
                },
                last_changed: nowIso,
                last_updated: nowIso,
            },
            'weather.home': {
                entity_id: 'weather.home',
                state: this.simState.weatherCondition,
                attributes: {
                    temperature: this.simState.temperature,
                    humidity: this.simState.humidity,
                    friendly_name: 'Météo Locale',
                },
                last_changed: nowIso,
                last_updated: nowIso,
            },
        };

        const subscribeEvents = async <T = unknown>(callback: (ev: T) => void, eventType: string): Promise<UnsubscribeFunc> => {
            if (!this._eventListeners.has(eventType)) {
                this._eventListeners.set(eventType, new Set());
            }
            const set = this._eventListeners.get(eventType)!;
            const cb = callback as (ev: unknown) => void;
            set.add(cb);
            return () => {
                set.delete(cb);
            };
        };

        const callWS = async <T>(payload: { type: string; [k: string]: unknown }): Promise<T> => {
            const type = payload.type;

            if (type === 'energy/get_prefs') {
                return {
                    energy_sources: [
                        {
                            type: 'solar',
                            stat_energy_from: 'sensor.solar_energy_total',
                            stat_rate: 'sensor.solar_production',
                        },
                        {
                            type: 'grid',
                            name: 'Réseau Enedis',
                            stat_energy_from: 'sensor.grid_import_total',
                            stat_energy_to: 'sensor.grid_export_total',
                            stat_rate: 'sensor.grid_power',
                            flow_from: [
                                {
                                    stat_energy_from: 'sensor.grid_import_total',
                                    number_energy_price: 0.2516,
                                    stat_cost: 'sensor.grid_import_total_cost',
                                },
                            ],
                            flow_to: [
                                {
                                    stat_energy_to: 'sensor.grid_export_total',
                                    number_energy_price: 0.13,
                                    stat_compensation: 'sensor.grid_export_total_compensation',
                                },
                            ],
                        },
                        {
                            type: 'battery',
                            name: 'Batterie Domestique',
                            stat_energy_from: 'sensor.battery_discharge_total',
                            stat_energy_to: 'sensor.battery_charge_total',
                            power_config: {
                                stat_rate_inverted: 'sensor.battery_power',
                            },
                            stat_soc: 'sensor.battery_soc',
                        },
                    ],
                    device_consumption: [
                        {
                            stat_consumption: 'sensor.device_ev_charger_kwh',
                            stat_rate: 'sensor.device_ev_charger',
                            name: 'Borne VE',
                        },
                        {
                            stat_consumption: 'sensor.device_heatpump_kwh',
                            stat_rate: 'sensor.device_heatpump',
                            name: 'Pompe à Chaleur',
                        },
                        {
                            stat_consumption: 'sensor.device_water_heater_kwh',
                            stat_rate: 'sensor.device_water_heater',
                            name: 'Chauffe-eau',
                        },
                    ],
                } as unknown as T;
            }

            if (type === 'energy/info') {
                return {
                    cost_sensors: {
                        'sensor.grid_import_total': 'sensor.grid_import_total_cost',
                        'sensor.grid_export_total': 'sensor.grid_export_total_compensation',
                    },
                } as unknown as T;
            }

            if (type === 'recorder/statistics_during_period') {
                const startTime = new Date(payload.start_time as string).getTime();
                const endTime = new Date(payload.end_time as string).getTime();
                const statisticIds = (payload.statistic_ids as string[]) || [];
                const types = (payload.types as string[]) || ['change'];
                const period = (payload.period as string) || 'hour';

                let stepMs = 3600 * 1000;
                if (period === '5minute') stepMs = 5 * 60 * 1000;
                if (period === 'day') stepMs = 24 * 3600 * 1000;

                const result: Record<string, Record<string, unknown>[]> = {};

                for (const statId of statisticIds) {
                    const buckets: Record<string, unknown>[] = [];
                    for (let t = startTime; t < endTime; t += stepMs) {
                        const bEnd = Math.min(t + stepMs, endTime);
                        const d = new Date(t);
                        const hour = d.getHours() + d.getMinutes() / 60;

                        const bucket: Record<string, unknown> = {
                            start: t,
                            end: bEnd,
                        };

                        if (types.includes('change')) {
                            let changeKwh = 0;
                            if (statId.includes('solar')) {
                                if (hour >= 7 && hour <= 20) {
                                    const peak = 4.5;
                                    const factor = Math.sin(((hour - 7) / 13) * Math.PI);
                                    changeKwh = (peak * factor * (stepMs / 3600000)) * (0.8 + 0.4 * Math.sin(t / 1000000));
                                }
                            } else if (statId.includes('grid_import')) {
                                const baseImport = (hour < 7 || hour > 19) ? 0.6 : 0.2;
                                changeKwh = baseImport * (stepMs / 3600000) * (0.9 + 0.2 * Math.cos(t / 800000));
                            } else if (statId.includes('grid_export')) {
                                if (hour >= 11 && hour <= 16) {
                                    changeKwh = 1.2 * (stepMs / 3600000);
                                }
                            } else if (statId.includes('battery_charge')) {
                                if (hour >= 9 && hour <= 13) {
                                    changeKwh = 1.5 * (stepMs / 3600000);
                                }
                            } else if (statId.includes('battery_discharge')) {
                                if (hour >= 19 && hour <= 23) {
                                    changeKwh = 0.8 * (stepMs / 3600000);
                                }
                            } else if (statId.includes('device')) {
                                changeKwh = 0.3 * (stepMs / 3600000);
                            }
                            bucket.change = Math.max(0, changeKwh);
                        }

                        if (types.includes('mean')) {
                            if (statId.includes('temperature')) {
                                bucket.mean = this.simState.temperature;
                            } else if (statId.includes('humidity')) {
                                bucket.mean = this.simState.humidity;
                            } else if (statId.includes('soc')) {
                                bucket.mean = this.simState.batterySoc;
                            } else if (statId.includes('grid_power')) {
                                bucket.mean = this.simState.gridPower;
                            } else if (statId.includes('battery_power')) {
                                bucket.mean = this.simState.batteryPower;
                            } else {
                                bucket.mean = 0;
                            }
                        }

                        if (types.includes('min') || types.includes('max')) {
                            if (statId.includes('grid_power')) {
                                bucket.min = -3000;
                                bucket.max = 3000;
                            } else if (statId.includes('battery_power')) {
                                bucket.min = -2500;
                                bucket.max = 2500;
                            } else {
                                bucket.min = 0;
                                bucket.max = 100;
                            }
                        }

                        buckets.push(bucket);
                    }
                    result[statId] = buckets;
                }

                return result as unknown as T;
            }

            if (type === 'history/history_during_period') {
                const entityIds = (payload.entity_ids as string[]) || [];
                const now = new Date();
                const result: Record<string, unknown[]> = {};
                for (const id of entityIds) {
                    let sVal = '0';
                    if (id.includes('temperature')) sVal = this.simState.temperature.toFixed(1);
                    else if (id.includes('humidity')) sVal = String(Math.round(this.simState.humidity));
                    else if (id.includes('weather')) sVal = this.simState.weatherCondition;
                    else if (id.includes('soc')) sVal = String(Math.round(this.simState.batterySoc));

                    result[id] = [
                        {
                            s: sVal,
                            lu: (now.getTime() - 3600000) / 1000,
                        },
                        {
                            s: sVal,
                            lu: now.getTime() / 1000,
                        },
                    ];
                }
                return result as unknown as T;
            }

            if (type === 'helios_forecast/series' || type === 'energy/solar_forecast') {
                const now = new Date();
                const forecast: Record<string, number> = {};
                for (let h = 0; h < 48; h++) {
                    const t = new Date(now.getTime() + h * 3600 * 1000);
                    t.setMinutes(0, 0, 0);
                    const hour = t.getHours();
                    let w = 0;
                    if (hour >= 7 && hour <= 20) {
                        w = Math.round(3800 * Math.sin(((hour - 7) / 13) * Math.PI));
                    }
                    forecast[t.toISOString()] = w;
                }
                return {
                    wh_hours: forecast,
                } as unknown as T;
            }

            return {} as unknown as T;
        };

        return {
            states,
            config: this.config,
            connection: {
                subscribeEvents,
            },
            callWS,
            language: this.language,
            locale: {
                language: this.language,
                time_format: '24',
            },
            themes: {
                darkMode: this.darkMode,
            },
            user: {
                is_admin: true,
            },
        };
    }
}

export const defaultSandboxConfig: HeliosConfig = {
    'home-latitude': 48.8566,
    'home-longitude': 2.3522,
    'display-radius': 200,
    'building-count': 50,
    'building-opacity': 0.5,
    'building-real-size': true,
    'shadows-enabled': true,
    'shadow-opacity': 0.32,
    'show-timeline': true,
    'show-detail-panel': true,
    'weather-enabled': true,
    'auto-rotate-enabled': false,
    'camera-locked': false,
    'scene-zoom': '1',
    'arc-zoom': 1,
    'battery-above-arc': false,
    'value-decimals': 1,
    'max-expected-power': 5000,
    'map-theme-mode': 'auto',
    'temperature-entity': 'sensor.outdoor_temperature',
    'humidity-entity': 'sensor.outdoor_humidity',
    'weather-entity': 'weather.home',
    'show-temperature': true,
    'show-humidity': true,
};
