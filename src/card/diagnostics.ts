//Module-load diagnostics for the Helios card: install banner, the public window.heliosStats() dump, the
//debug-only home-location override helpers, and the page-wide data-cache reset bus. All side-effects run
//once at import; helios-card.ts imports this module for those effects and shares the live-card registry.
//Kept out of the card module so the class file stays focused on the element itself.

//Minimal surface the diagnostics need from a live card, so this module never imports the card class.
export interface HeliosDiagnosticsCard
{
    resetDataCache():    void;
    invalidateLocation(): void;
    getStatsSnapshot():  {
        config: Record<string, unknown>;
        engine: Record<string, unknown> | null;
        pv:     Record<string, unknown>;
    };
}

//Registry of every live card, maintained by the card's connected/disconnectedCallback so window.heliosStats()
//can enumerate on-screen cards and the reset bus can sweep them all. Module-level so these helpers close over
//it without the class being fully constructed.
export const liveCards = new Set<HeliosDiagnosticsCard>();

interface HeliosWin extends Window
{
    heliosStats?:              () => Record<string, unknown>;
    __heliosStats?:            Record<string, unknown>;
    setHeliosLocation?:        (lat: number, lon: number) => void;
    clearHeliosLocation?:      () => void;
    __heliosLocationOverride?: { lat: number; lon: number };
}

//Install banner: two adjacent chips (card name + build version), like other HACS frontends. Guarded
//against double-print on bundle reload. Version is inlined at build time from package.json by vite.config.ts.
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
        // eslint-disable-next-line no-console -- intentional install banner hint pointing at the diagnostic command
        console.info(
            `%c☀ HELIOS%c run window.heliosStats() in the console for a live config + engine dump`,
            labelStyle,
            'color:#6b7280;font-style:italic;'
        );
    }
}

//Public diagnostic command, exposed once on first bundle load. Returns a JSON-safe snapshot AND prints
//a grouped console dump (build version, engine lifecycle counters, one section per card). Config values
//are PII-free and safe to paste into an issue (no API keys; basemap is keyless CARTO raster tiles).
{
    const w = window as HeliosWin;
    if (!w.heliosStats)
    {
        w.heliosStats = () =>
        {
            const cards = Array.from(liveCards).map((c, i) =>
            ({
                index:  i,
                snapshot: c.getStatsSnapshot()
            }));

            const out: Record<string, unknown> =
            {
                version:   __HELIOS_VERSION__,
                cards:     cards.length,
                lifecycle: w.__heliosStats ?? null,
                details:   cards
            };

            const label    = 'background:#f59e0b;color:#1f2937;padding:2px 8px;border-radius:4px;font-weight:bold;';
            const heading  = 'color:#f59e0b;font-weight:bold;';
            /* eslint-disable no-console -- intentional diagnostic dump exposed via window.heliosStats() */
            console.groupCollapsed(`%c☀ HELIOS stats%c v${__HELIOS_VERSION__}, ${cards.length} card${cards.length === 1 ? '' : 's'} alive`,
                label, 'color:#6b7280;font-weight:normal;');
            console.log('%cLifecycle counters', heading, w.__heliosStats ?? '(none yet)');
            cards.forEach((c, i) =>
            {
                const snap = c.snapshot;
                console.groupCollapsed(`%cCard #${i + 1}`, heading);
                console.log('config:', snap.config);
                console.log('engine:', snap.engine);
                console.log('pv:',     snap.pv);
                console.groupEnd();
            });
            console.groupEnd();
            /* eslint-enable no-console */
            return out;
        };
    }
}

//Debug-only home-location override. setHeliosLocation(lat, lon) renders every live card as if HA's home
//were elsewhere; clearHeliosLocation() reverts. Stored on window only (no localStorage), so a refresh
//restores hass.config. getHomeCoords() prefers the override; setting it reinits every live card so the
//engine, weather fetch and PV calibration cache all swap immediately.
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
                //Out-of-range or non-numeric input: ignore the override request.
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
                //No override active: nothing to revert.
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
