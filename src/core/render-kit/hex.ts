//Hex colour primitives shared by the scene painters and the card charts. Pure, no deps.

//Linear interpolate from a to b by t.
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

//Read the byte at offset i of a #rrggbb hex (i = 1 red, 3 green, 5 blue).
export const hexByte = (hex: string, i: number): number => parseInt(hex.slice(i, i + 2), 16);

//Blend two #rrggbb colours per channel (t: 0 = hexA, 1 = hexB, unclamped). Runs per shape per frame, kept cheap.
export function mixHex(hexA: string, hexB: string, t: number): string
{
    let out = '#';
    for (let i = 1; i < 7; i += 2)
    {
        const a = hexByte(hexA, i);
        out += Math.round(a + (hexByte(hexB, i) - a) * t).toString(16).padStart(2, '0');
    }
    return out;
}
