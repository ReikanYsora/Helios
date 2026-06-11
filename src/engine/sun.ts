//Solar position and irradiance math, pure functions, no DOM, no
//map. Validated against the NOAA SPA reference implementation across
//376 (time, location) samples spanning a full year and 8 latitudes.
//Mean altitude error 0.30°, mean azimuth error 0.36°. The dominant
//error source is the simplified declination formula, intentionally
//kept for compactness; max altitude error (~1°) is well below the
//visual fidelity required for the hillshade direction or the W/m²
//estimate.

//Sun altitude / azimuth at a given UTC instant for a lat/lon point.
//Both returned values are in degrees; azimuth is measured clockwise
//from north.
//
//A single-entry cache absorbs the very common pattern where multiple
//render passes in the same Lit cycle (atmosphere refresh, shadow
//projection, PV legend) ask for the same (time, home) tuple in
//quick succession. The cache keys on the JS timestamp + 6-decimal
//lat/lon so two cards at distinct homes don't poison each other.
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

    //Hour angle, normalised to [-180°, 180°] so sign(ha) reliably
    //indicates AM/PM. Without this, longitudes far from Greenwich
    //(NYC, Tokyo, Sydney) produce ha outside the expected range and
    //the AM/PM test below yields azimuths off by up to 180°.
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


//Photovoltaic power estimate, normalised 0..100 % of STC (1000 W/m²).
//Pipeline:
//  1. Sun altitude (returns 0 below the horizon).
//  2. Haurwitz (1945) clear-sky GHI on a horizontal surface:
//        GHI_clear = 1098 · cos(z) · exp(-0.059 / cos(z))   W/m²
//     This already includes the diffuse component; the previous
//     direct-only Meinel formulation under-estimated GHI by 30–40 %.
//     Validated against PVGIS/NREL benchmarks, MAE ~62 W/m² across
//     altitudes from 5° to 90° (vs ~139 for Meinel).
//  3. Cloud attenuation, Kasten-Czeplak (1980) cubic law:
//        k = 1 - 0.75 · (cloudCover/100)^3.4
//     Algebraically identical to the standard oktas formulation.
//     Thin clouds barely attenuate; total overcast cuts ~75 %.
//  4. Optional tilt/azimuth transposition (Liu-Jordan isotropic
//     model), when the caller supplies a `panel` argument:
//        cos(θi) = sin(α)·cos(β) + cos(α)·sin(β)·cos(γ_s − γ_p)
//        POA = GHI · [ f_direct · R_b
//                    + (1 − f_direct) · (1 + cos β) / 2
//                    + ρ · (1 − cos β) / 2 ]
//     where R_b = max(0, cos θi) / max(sin 5°, cos z), the direct
//     fraction f_direct is derived from cloud cover (≈ 0 overcast,
//     ≈ 0.85 clear), and the ground albedo ρ is fixed at 0.2. Without
//     a `panel` argument the function keeps its original horizontal
//     behaviour, so every caller that doesn't care about orientation
//     stays untouched.
//  5. Map effective POA to % of STC and clamp to [0, 100].
//Describes one co-oriented group of panels. computePvPower stays
//deliberately single-orientation; installs with multiple arrays
//(split-array roofs, roof + balcony combos, etc.) are handled by
//the card-layer caller, which calls this function once per array
//and sums the results weighted by each array's share of the total
//kWp. Keeping the multi-array concern out of the pure-math module
//means this file never has to know about the config schema.
export interface PanelOrientation
{
    tiltDeg:    number;   //0 = horizontal, 90 = vertical. Ignored when `tracker` requests sun-following on
                          //the elevation axis: the panel instantly normalises against the sun and the
                          //configured tilt becomes the parked / rest position only.
    azimuthDeg: number;   //compass bearing the panel faces, clockwise from north (180 = south, 90 = east).
                          //Ignored when `tracker` requests sun-following on the azimuth axis.
    //Optional sun-tracking behaviour. Default omitted = fixed panel (the historical Liu-Jordan path).
    //  'dual-axis'      : both tilt + azimuth follow the sun, the panel normal stays pointed at the sun
    //                     for as long as the sun is above the horizon. cos(θi) collapses to 1 in the
    //                     beam term and the panel runs at its theoretical peak all day.
    //  'single-axis-h'  : horizontal axis tracker (axis runs N-S, panel tilts E-W). Tilt follows sun
    //                     azimuth, azimuth is the configured value. Approximated as a dual-axis panel
    //                     constrained to the configured azimuth column, beam ratio R_b uses the angle
    //                     between sun and the tracked tilt.
    //  'single-axis-v'  : vertical axis tracker (axis runs vertical, panel rotates in azimuth). Azimuth
    //                     follows sun, tilt is the configured value. Beam ratio uses the sun-aligned
    //                     azimuth column.
    tracker?:   'dual-axis' | 'single-axis-h' | 'single-axis-v';
}

//Optional context that refines the PV estimate. Every field is opt-in: caller passes only what it knows. Empty context preserves the original
//Haurwitz / Liu-Jordan output exactly.
//
//  airTempC + windMs , feed the Sandia-style cell temperature model
//    (see pv-thermal.ts). When airTempC is finite the result is
//    multiplied by the thermal derating factor at the computed cell
//    temperature.
//
//  shading , a boolean from the caller-side LiDAR raycast
//    (isPanelShaded in pv-shading.ts). When true, the direct-beam
//    component is zeroed; diffuse + ground-reflected terms are
//    kept (a tree blocks the sun ray but not the upper hemisphere
//    of diffuse sky).
import { cellTemperatureC, thermalDerating } from './pv-thermal';

export interface PvComputeContext
{
    airTempC?: number;
    windMs?:   number;
    shading?:  boolean;
    //Measured / forecast global horizontal irradiance in W/m² (Open-Meteo shortwave_radiation, or a
    //home radiation sensor). When provided and >= 0, it replaces the analytical Haurwitz clear-sky ×
    //Kasten-Czeplak cloud magnitude as the GHI base, so the forecast inherits the weather model's own
    //cloud physics instead of the cubic approximation. Undefined keeps the legacy analytical base
    //bit-for-bit.
    ghiWm2?:   number;
    //Measured / forecast beam + diffuse irradiance on the HORIZONTAL plane in W/m² (Open-Meteo
    //direct_radiation + diffuse_radiation). When BOTH are provided and >= 0 they replace the analytical
    //cloud-derived direct / diffuse split in the tilt transposition: the beam term is the real DNI
    //projected onto the panel, the diffuse term the real sky diffuse, so a tilted array under broken
    //cloud no longer rides the crude kCloud → direct-fraction cubic. Ignored on a horizontal panel
    //(GHI already is the plane-of-array value there) and when either is missing.
    directWm2?:  number;
    diffuseWm2?: number;
    //Plane-of-array irradiance in W/m² straight from Open-Meteo's `global_tilted_irradiance` for THIS
    //panel's tilt + azimuth (see card/gti.ts). When provided and >= 0 on a tilted panel it REPLACES the
    //isotropic Liu-Jordan transposition below: Open-Meteo computes the POA with an anisotropic
    //(Perez-family) sky model, better than our isotropic diffuse assumption, especially off the
    //equator-facing direction. LiDAR shading still carves the beam out (estimated from the diffuse +
    //ground terms) so a shaded array keeps only the sky + ground POA. Undefined keeps the transposition.
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
    const kCloud = 1 - 0.75 * Math.pow(cc, 3.4);

    //GHI magnitude: prefer the supplied measured / forecast irradiance (Open-Meteo shortwave or a home
    //sensor) when present, which already encodes the real cloud attenuation, and fall back to the
    //analytical Haurwitz × Kasten-Czeplak otherwise. kCloud is still used below for the direct /
    //diffuse split regardless of which magnitude won.
    const ghiEff = (ctx?.ghiWm2 != null && ctx.ghiWm2 >= 0) ? ctx.ghiWm2 : ghiClear * kCloud;

    let poaEff: number;

    //Horizontal panel (default): GHI already is the plane-of-array
    //irradiance, no transposition needed.
    if (!panel || (panel.tiltDeg <= 0 && !panel.tracker))
    {
        //A flat panel has no "beam blocked while diffuse still arrives" geometry: a shaded horizontal panel sees only the small ground reflection
        //from neighbouring lit ground. We approximate the shaded horizontal POA as 25 % of GHI, the typical clear-sky diffuse fraction.
        poaEff = ctx?.shading ? ghiEff * 0.25 : ghiEff;
    }
    else
    {
        //Tilted panel: project the direct beam onto the panel normal, add the isotropic-sky diffuse component, plus a small ground- reflected term
        //scaled by the panel's exposure to the ground. Tracker-equipped panels override the configured tilt and / or azimuth with the values that
        //keep the panel normal pointed at the sun on the tracker's free axis: dual-axis tracks both, the two single-axis variants track only one.
        let beta_deg = panel.tiltDeg;
        let az_deg   = panel.azimuthDeg;
        if (panel.tracker === 'dual-axis')
        {
            //Panel normal coincides with the sun direction, tilt complement of altitude, azimuth straight on the sun.
            beta_deg = 90 - alt;
            az_deg   = sun.azimuth;
        }
        else if (panel.tracker === 'single-axis-h')
        {
            //Horizontal-axis tracker: tilt rotates around the configured azimuth so the panel face still points down the column, only the elevation
            //adjusts. Geometrically the panel normal projection on the configured-azimuth column equals the sun's projection on the same column.
            beta_deg = 90 - alt;
        }
        else if (panel.tracker === 'single-axis-v')
        {
            //Vertical-axis tracker: panel rotates around the up axis so its azimuth tracks the sun, the tilt stays parked at the user-configured
            //angle.
            az_deg = sun.azimuth;
        }
        const beta = beta_deg * D;
        const dAz  = (sun.azimuth - az_deg) * D;
        const altR = alt * D;

        const cosTheta = Math.sin(altR) * Math.cos(beta)
                       + Math.cos(altR) * Math.sin(beta) * Math.cos(dAz);

        //Beam transposition ratio R_b = cos(θi) / cos(zenith). Clamp
        //the denominator at sin(5°) so the ratio doesn't blow up at
        //sunrise / sunset (the beam component is tiny there anyway).
        const Rb = cosTheta > 0
            ? Math.max(0, cosTheta) / Math.max(0.087, cosZ)
            : 0;

        //Direct / diffuse split. The SPLIT (which fraction of the GHI arrives as a collimated beam vs
        //isotropic sky) drives the transposition gain on a tilted panel; the magnitude stays owned by
        //ghiEff so the sensor-priority GHI base above is respected. Prefer the measured / forecast
        //decomposition (Open-Meteo direct + diffuse radiation on the horizontal plane) when BOTH are
        //supplied: their ratio is the real beam fraction, far better than the kCloud cubic for a tilted
        //array under broken cloud. Fall back to the cloud-derived fraction when either is missing
        //(sensor-only GHI, Haurwitz path).
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
            //kCloud spans ~0.25 (overcast) to 1.0 (clear sky), mapped to
            //a direct fraction of 0 → 0.85. Loose approximation of a
            //proper clearness-index decomposition (Erbs, Reindl); good
            //enough at the hourly resolution the card runs at.
            directFraction = Math.max(0, Math.min(0.85, (kCloud - 0.25) / 0.75 * 0.85));
        }
        const diffuseFraction = 1 - directFraction;

        //Shading: the LiDAR raycast told us a building or tree is
        //sitting between the panel and the sun. The direct beam is
        //gone; the upper-hemisphere diffuse and ground-reflected
        //terms still reach the panel (we don't model an obstacle
        //that's also opaque to diffuse, which would require a
        //sky-view factor calc the analytical pipeline doesn't have).
        const directPoa  = ctx?.shading ? 0 : ghiEff * directFraction * Rb;
        const diffusePoa = ghiEff * diffuseFraction * (1 + Math.cos(beta)) / 2;
        const groundPoa  = ghiEff * 0.2             * (1 - Math.cos(beta)) / 2;

        //Open-Meteo GTI base, when available for this orientation, replaces the isotropic transposition
        //above with the model's anisotropic POA. LiDAR shading still removes the beam: GTI is the TOTAL
        //plane-of-array, so we carve out the beam it implies (GTI minus our sky + ground estimate) and
        //keep only the diffuse + ground sky when the array is shaded.
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

    //Thermal derating: warmer cells produce less. Only applied when the caller passes a finite air temperature, otherwise the multiplier stays at 1
    //and the legacy callers see the original output bit-for-bit.
    let pStc = Math.max(0, poaEff / 1000);    //0..1+ of STC

    if (ctx && isFinite(ctx.airTempC ?? NaN))
    {
        const tCell = cellTemperatureC(ctx.airTempC!, poaEff, ctx.windMs ?? 0);
        pStc *= thermalDerating(tCell);
    }

    return Math.max(0, Math.min(100, pStc * 100));
}


//Same physics as computePvPower but returns the effective ground- horizontal irradiance in W/m² rather than the clamped 0–100 % PV figure. Used by
//the solar-arc visualisation: the per-vertex W/m² reading drives the on-map W/m² label and the line-flow speed. Returns 0 below the horizon, callers
//can use the zero as a "night" sentinel without an extra altitude check.
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
    const kCloud = 1 - 0.75 * Math.pow(cc, 3.4);

    return Math.max(0, ghiClear * kCloud);
}
