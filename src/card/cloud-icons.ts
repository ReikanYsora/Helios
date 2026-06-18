//Cloud-cover and per-altitude layer MDI icon resolvers, shared between the cloud-cover toggle and the per-layer chips.


//Map a 0..100 cloud cover to a Material Design weather glyph.
export function cloudCoverIcon(coverPct: number): string
{
    if (coverPct < 0)
    {
        return 'mdi:weather-cloudy';
    }
    if (coverPct < 15)
    {
        return 'mdi:weather-sunny';
    }
    if (coverPct < 40)
    {
        return 'mdi:weather-partly-cloudy';
    }
    if (coverPct < 75)
    {
        return 'mdi:weather-cloudy';
    }
    return 'mdi:weather-pouring';
}


//Per-altitude cloud layer icon. Vertical-align glyphs read more clearly than weather glyphs at this
//size: "thing at the bottom / centre / top of a frame" maps directly to low / mid / high layers.
export function cloudLayerIcon(layer: 'low' | 'mid' | 'high'): string
{
    if (layer === 'low')
    {
        return 'mdi:format-vertical-align-bottom';
    }
    if (layer === 'mid')
    {
        return 'mdi:format-vertical-align-center';
    }
    return 'mdi:format-vertical-align-top';
}
