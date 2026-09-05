//Minimal structural type of the Home Assistant `hass` object, covering exactly the fields the card reads. Helios has
//no dependency on a full HomeAssistant type; typing the boundary keeps those reads honest (an untyped hass lets a
//Promise pass as an unsubscribe function). Widen only when a new field is genuinely read: every member below is
//backed by a real access site.

//Called to tear down a subscription. Async subscribeEvents resolves to one of these.
export type UnsubscribeFunc = () => void;

//A single entity's state. `attributes` stays a permissive record: HA attributes are genuinely heterogeneous.
export interface HassEntity
{
    entity_id?:    string;
    state:         string;
    attributes:    Record<string, any>;
    last_changed?: string;
    last_updated?: string;
}

//The subset of HA's unit system the card reads. HA reports the display unit for each measurement family; only
//temperature is consumed today (the readouts the card owns are otherwise its own configured units).
export interface HassUnitSystem
{
    temperature?: string;
}

export interface HassConfig
{
    time_zone?:   string;
    latitude?:    number;
    longitude?:   number;
    elevation?:   number;
    currency?:    string;
    unit_system?: HassUnitSystem;
}

export interface HassLocale
{
    language?:    string;
    time_format?: string;
}

export interface HassThemes
{
    darkMode?: boolean;
}

export interface HassConnection
{
    subscribeEvents: <T = unknown>(callback: (ev: T) => void, eventType: string) => Promise<UnsubscribeFunc>;
}

export interface HassLike
{
    states:     Record<string, HassEntity>;
    config:     HassConfig;
    connection: HassConnection;
    callWS:     <T>(payload: object) => Promise<T>;
    language:   string;
    locale?:    HassLocale;
    themes?:    HassThemes;
    //Present on every real HA frontend `hass`; optional here so a minimal test/mock hass still type-checks.
    user?:      { is_admin?: boolean };
}
