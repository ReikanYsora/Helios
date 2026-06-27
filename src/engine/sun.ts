//Solar position and irradiance math: pure functions, no DOM/map. Validated against NOAA SPA over a year × 8 latitudes
//(mean alt error 0.30°, az 0.36°, max alt ~1°), well under the fidelity needed for shadow direction and the W/m² estimate.

//Sun altitude/azimuth (degrees, azimuth clockwise from north) at a UTC instant for a lat/lon point.
//Single-entry cache: many render passes in one render cycle (atmosphere, shadows, PV legend) ask for the same (time, home)
//tuple in succession. Key includes 6-decimal lat/lon so two cards at distinct homes don't poison each other.
let _sunCacheKey: string | null = null;
let _sunCacheValue: { altitude: number; azimuth: number } | null = null;

export function getSunPosition(date: Date, lat: number, lon: number):
    { altitude: number; azimuth: number }
{
    const key = `${date.getTime()}|${lat.toFixed(6)}|${lon.toFixed(6)}`;
    if (key === _sunCacheKey && _sunCacheValue !== null)
    {
        return _sunCacheValue;
    }

    const D    = Math.PI / 180;
    const H    = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
    const doy  = Math.floor((date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86_400_000);
    const decl = 23.45 * Math.sin(D * (360 / 365) * (doy - 81));
    const B    = D * (360 / 365) * (doy - 81);
    const eot  = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);

    //Normalise hour angle to [-180°, 180°] so sign(ha) reliably gives AM/PM; without it, longitudes far from Greenwich
    //(NYC, Tokyo, Sydney) push ha out of range and flip the azimuth by up to 180°.
    let ha = 15 * (H + lon / 15 + eot / 60 - 12);
    ha = ((ha + 180) % 360 + 360) % 360 - 180;

    const sinA = Math.sin(D * lat) * Math.sin(D * decl)
               + Math.cos(D * lat) * Math.cos(D * decl) * Math.cos(D * ha);
    const alt  = Math.asin(Math.max(-1, Math.min(1, sinA))) / D;
    const cAlt = Math.cos(alt * D);
    const cAz  = cAlt > 1e-4
        ? (Math.sin(D * decl) - Math.sin(D * lat) * sinA) / (Math.cos(D * lat) * cAlt)
        : 0;
    let az = Math.acos(Math.max(-1, Math.min(1, cAz))) / D;
    if (ha > 0)
    {
        az = 360 - az;
    }
    const result = { altitude: alt, azimuth: az };
    _sunCacheKey   = key;
    _sunCacheValue = result;
    return result;
}


//PV power estimate, 0..100% of STC (1000 W/m²). Pipeline:
//  1. Sun altitude (0 below horizon).
//  2. Haurwitz (1945) clear-sky GHI: 1098·cos(z)·exp(-0.059/cos(z)) W/m², includes diffuse (vs direct-only Meinel which
//     under-estimated GHI by 30-40%; MAE ~62 vs ~139 W/m² over 5°-90°).
//  3. Cloud attenuation, Kasten-Czeplak (1980): k = 1 - 0.75·(cloudCover/100)^3.4 (overcast cuts ~75%).
//  4. Optional tilt/azimuth transposition (Liu-Jordan isotropic) when a `panel` is given; no panel keeps horizontal behaviour.
//  5. Map effective POA to % of STC, clamp [0, 100].

//One co-oriented group of panels. computePvPower is single-orientation by design; multi-array installs (split roofs, roof +
//balcony) are summed by the card-layer caller (once per array, weighted by kWp share), keeping the config schema out of this
//pure-math module.
export interface PanelOrientation
{
    tiltDeg:    number;   //0 = horizontal, 90 = vertical. Ignored on elevation-axis trackers, where it becomes the
                          //parked/rest position only.
    azimuthDeg: number;   //compass bearing faced, clockwise from north (180 = south, 90 = east). Ignored on azimuth-axis trackers.
    //Optional sun-tracking. Omitted = fixed panel (Liu-Jordan path).
    //  'dual-axis'     : tilt + azimuth both follow the sun; cos(θi) collapses to 1, peak output all day.
    //  'single-axis-h' : horizontal N-S axis, tilt follows sun azimuth, azimuth stays configured; treated as dual-axis
    //                    constrained to the configured azimuth column.
    //  'single-axis-v' : vertical axis, azimuth follows sun, tilt stays configured.
    tracker?:   'dual-axis' | 'single-axis-h' | 'single-axis-v';
}

//Optional context refining the PV estimate; every field opt-in, empty context preserves the original Haurwitz/Liu-Jordan output.
export interface PvComputeContext
{
    airTempC?: number;   //accepted so existing callers compile; does not affect output (cell-temp derating lives in the HA forecast)
    windMs?:   number;   //ditto airTempC
    shading?:  boolean;  //Obstacle-shading hook: true zeroes the direct beam, keeps diffuse + ground (currently unset)
    //Measured/forecast GHI W/m² (Open-Meteo shortwave or home sensor). When >= 0 it replaces the analytical Haurwitz ×
    //Kasten-Czeplak magnitude so cloud physics come from the weather model. Undefined keeps the analytical base bit-for-bit.
    ghiWm2?:   number;
    //Measured/forecast beam + diffuse irradiance on the horizontal plane (Open-Meteo direct + diffuse). When both >= 0 they
    //replace the cloud-derived direct/diffuse split in the transposition with the real ratio. Ignored on a horizontal panel
    //(GHI already is POA) and when either is missing.
    directWm2?:  number;
    diffuseWm2?: number;
    //Plane-of-array W/m² from Open-Meteo global_tilted_irradiance for THIS tilt+azimuth (card/gti.ts). When >= 0 on a tilted
    //panel it REPLACES the isotropic Liu-Jordan transposition with Open-Meteo's anisotropic (Perez) POA. Obstacle shading
    //still carves out the beam (estimated from diffuse + ground). Undefined keeps the transposition.
    poaWm2?:     number;
}

export function computePvPower(
    date:          Date,
    lat:           number,
    lon:           number,
    cloudCoverPct: number,
    panel?:        PanelOrientation,
    ctx?:          PvComputeContext,
): number
{
    const sun = getSunPosition(date, lat, lon);
    const alt = sun.altitude;
    if (alt <= 0)
    {
        return 0;
    }

    const D    = Math.PI / 180;
    const cosZ = Math.sin(alt * D);
    const ghiClear = 1098 * cosZ * Math.exp(-0.059 / cosZ);

    const cc     = Math.max(0, Math.min(100, cloudCoverPct)) / 100;
    const kCloud = 1 - 0.75 * cc**3.4;

    //Prefer supplied measured/forecast GHI (already encodes real cloud attenuation), else analytical Haurwitz × Kasten-Czeplak.
    //kCloud is still used below for the direct/diffuse split regardless of which magnitude won.
    const ghiEff = (ctx?.ghiWm2 != null && ctx.ghiWm2 >= 0) ? ctx.ghiWm2 : ghiClear * kCloud;

    let poaEff: number;

    //Horizontal panel (default): GHI already is the plane-of-array irradiance, no transposition.
    if (!panel || (panel.tiltDeg <= 0 && !panel.tracker))
    {
        //A shaded flat panel still sees ~ground reflection from lit neighbouring ground; approximate as 25% of GHI (the
        //typical clear-sky diffuse fraction).
        poaEff = ctx?.shading ? ghiEff * 0.25 : ghiEff;
    }
    else
    {
        //Tilted panel: project direct beam onto the normal, add isotropic diffuse + a small ground-reflected term. Trackers
        //override the configured tilt/azimuth with values keeping the normal on the sun along their free axis.
        let beta_deg = panel.tiltDeg;
        let az_deg   = panel.azimuthDeg;
        if (panel.tracker === 'dual-axis')
        {
            //Normal on the sun: tilt is complement of altitude, azimuth straight at the sun.
            beta_deg = 90 - alt;
            az_deg   = sun.azimuth;
        }
        else if (panel.tracker === 'single-axis-h')
        {
            //Horizontal-axis: only elevation adjusts; normal's projection on the configured-azimuth column matches the sun's.
            beta_deg = 90 - alt;
        }
        else if (panel.tracker === 'single-axis-v')
        {
            //Vertical-axis: azimuth tracks the sun, tilt stays at the configured angle.
            az_deg = sun.azimuth;
        }
        const beta = beta_deg * D;
        const dAz  = (sun.azimuth - az_deg) * D;
        const altR = alt * D;

        const cosTheta = Math.sin(altR) * Math.cos(beta)
                       + Math.cos(altR) * Math.sin(beta) * Math.cos(dAz);

        //Beam transposition ratio R_b = cos(θi)/cos(zenith). Clamp the denominator at sin(5°) so it doesn't blow up at
        //sunrise/sunset (beam is tiny there anyway).
        const rb = cosTheta > 0
            ? Math.max(0, cosTheta) / Math.max(0.087, cosZ)
            : 0;

        //Direct/diffuse split drives the tilted-panel transposition gain (magnitude stays owned by ghiEff). Prefer the
        //measured/forecast decomposition (Open-Meteo direct + diffuse) when BOTH supplied; else the cloud-derived fraction.
        const hasSplit = ctx?.directWm2 != null && ctx.directWm2 >= 0
                      && ctx?.diffuseWm2 != null && ctx.diffuseWm2 >= 0
                      && (ctx.directWm2 + ctx.diffuseWm2) > 0;

        let directFraction: number;
        if (hasSplit)
        {
            directFraction = ctx!.directWm2! / (ctx!.directWm2! + ctx!.diffuseWm2!);
        }
        else
        {
            //kCloud ~0.25 (overcast) → 1.0 (clear) mapped to direct fraction 0 → 0.85; loose stand-in for a proper
            //clearness-index decomposition (Erbs, Reindl), fine at hourly resolution.
            directFraction = Math.max(0, Math.min(0.85, (kCloud - 0.25) / 0.75 * 0.85));
        }
        const diffuseFraction = 1 - directFraction;

        //Shading: an obstacle blocks the sun ray. Direct beam gone; diffuse + ground terms still reach the panel
        //(we don't model an obstacle opaque to diffuse, which needs a sky-view factor the pipeline lacks).
        const directPoa  = ctx?.shading ? 0 : ghiEff * directFraction * rb;
        const diffusePoa = ghiEff * diffuseFraction * (1 + Math.cos(beta)) / 2;
        const groundPoa  = ghiEff * 0.2             * (1 - Math.cos(beta)) / 2;

        //Open-Meteo GTI, when available, replaces the isotropic transposition with the model's anisotropic POA. Since GTI is
        //the TOTAL POA, shading carves out the implied beam (GTI minus our sky + ground), keeping only diffuse + ground.
        if (ctx?.poaWm2 != null && ctx.poaWm2 >= 0)
        {
            if (ctx.shading)
            {
                const skyGround = Math.min(ctx.poaWm2, diffusePoa + groundPoa);
                poaEff = skyGround;
            }
            else
            {
                poaEff = ctx.poaWm2;
            }
        }
        else
        {
            poaEff = directPoa + diffusePoa + groundPoa;
        }
    }

    //Normalise POA against STC (1000 W/m²) and clamp to 0-100%.
    const pStc = Math.max(0, poaEff / 1000);    //0..1+ of STC

    return Math.max(0, Math.min(100, pStc * 100));
}


//Same physics as computePvPower but returns effective ground-horizontal irradiance in W/m² instead of the clamped 0-100% PV
//figure. Drives the solar-arc W/m² label and line-flow speed; returns 0 below the horizon as a "night" sentinel.
export function computeIrradianceWm2(date: Date, lat: number, lon: number, cloudCoverPct: number): number
{
    const sun = getSunPosition(date, lat, lon);
    const alt = sun.altitude;
    if (alt <= 0)
    {
        return 0;
    }

    const D    = Math.PI / 180;
    const cosZ = Math.sin(alt * D);
    const ghiClear = 1098 * cosZ * Math.exp(-0.059 / cosZ);

    const cc     = Math.max(0, Math.min(100, cloudCoverPct)) / 100;
    const kCloud = 1 - 0.75 * cc**3.4;

    return Math.max(0, ghiClear * kCloud);
}
