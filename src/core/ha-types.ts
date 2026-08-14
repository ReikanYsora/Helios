//Minimal structural type of the Home Assistant `hass` object, covering exactly the fields the card reads. Helios has
//no dependency on a full HomeAssistant type, so the data + format + editor layers used `any`; that is what let a
//Promise be stored as an unsubscribe function (the energy-prefs leak). Typing the boundary here keeps those reads
//honest. Widen only when a new field is genuinely read - every member below is backed by a real access site.

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

export interface HassConfig
{
    time_zone?: string;
    latitude?:  number;
    longitude?: number;
    elevation?: number;
    currency?:  string;
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
}
