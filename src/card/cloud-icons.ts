//Cloud-cover MDI icon resolver for the cloud-cover chip.


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
