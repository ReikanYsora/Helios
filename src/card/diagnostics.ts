//Module-load diagnostics for the Helios card: install banner, the debug-only home-location override helpers, and the
//page-wide data-cache reset bus. All side-effects run once at import; the card module imports this for those effects
//and shares the live-card registry.

//Minimal surface the diagnostics need from a live card, so this module never imports the card class.
export interface HeliosDiagnosticsCard
{
    resetDataCache():    void;
    invalidateLocation(): void;
}

//Registry of every live card, maintained by the card's connected/disconnectedCallback so the location-override
//helpers can re-init on-screen cards and the reset bus can sweep them all. Module-level so these helpers close over
//it without the class being constructed.
export const liveCards = new Set<HeliosDiagnosticsCard>();

interface HeliosWin extends Window
{
    setHeliosLocation?:        (lat: number, lon: number) => void;
    clearHeliosLocation?:      () => void;
    __heliosLocationOverride?: { lat: number; lon: number };
}

//Install banner: two adjacent chips (card name + build version). Guarded against double-print on bundle reload.
//Version is inlined at build time from package.json by vite.config.ts.
{
    const flagKey = '__heliosBannerPrinted';
    const w = window as unknown as Record<string, unknown>;
    if (!w[flagKey])
    {
        w[flagKey] = true;
        const labelStyle   = 'background:#f59e0b;color:#1f2937;padding:2px 8px;border-radius:4px 0 0 4px;font-weight:bold;';
        const versionStyle = 'background:#1f2937;color:#f59e0b;padding:2px 8px;border-radius:0 4px 4px 0;font-weight:bold;';
        // eslint-disable-next-line no-console -- intentional install/version banner, like other HACS frontends
        console.info(
            `%c☀ HELIOS%c v${__HELIOS_VERSION__}`,
            labelStyle,
            versionStyle
        );
    }
}

//Debug-only home-location override. setHeliosLocation(lat, lon) renders every live card as if HA's home were
//elsewhere; clearHeliosLocation() reverts. Stored on window only (no localStorage), so a refresh restores
//hass.config. getHomeCoords() prefers the override; setting it reinits every live card so the engine, weather fetch
//and PV calibration cache all swap immediately.
{
    const w = window as HeliosWin;

    if (!w.setHeliosLocation)
    {
        w.setHeliosLocation = (lat: number, lon: number) =>
        {
            if (typeof lat !== 'number' || typeof lon !== 'number'
                || !isFinite(lat)        || !isFinite(lon)
                || lat < -90  || lat > 90
                || lon < -180 || lon > 180)
            {
                return;
            }
            w.__heliosLocationOverride = { lat, lon };
            for (const card of liveCards)
            {
                card.invalidateLocation();
            }
        };
    }

    if (!w.clearHeliosLocation)
    {
        w.clearHeliosLocation = () =>
        {
            if (!w.__heliosLocationOverride)
            {
                return;
            }
            w.__heliosLocationOverride = undefined;
            for (const card of liveCards)
            {
                card.invalidateLocation();
            }
        };
    }
}

//Window-level reset bus: the editor's "reset data cache" button fires this so every live card on the
//page drops its cached data in one sweep. Wired once at module load, not per card.
window.addEventListener('helios-data-cache-reset', () =>
{
    for (const card of liveCards)
    {
        card.resetDataCache();
    }
});

