//Pure HUD geometry helpers. Each function depends only on its arguments (no card state, no DOM).

//Nearest point on the home pill's stadium outline to (chipX, chipY): the straight top/bottom edge over the middle,
//the rounded end-cap arc beyond it. All chip leaders dock here so the home reads as the focal energy node. halfW and
//halfH are the pill's half-extents.
export function nudgeToHomePill(
    chipX: number, chipY: number,
    homeX: number, homeY: number,
    halfW: number, halfH: number,
): { x: number; y: number }
{
    const ex = chipX - homeX;
    const ey = chipY - homeY;
    //Width of the straight middle (between the two end-cap semicircles).
    const straightHalfW = Math.max(0, halfW - halfH);
    if (Math.abs(ex) <= straightHalfW)
    {
        //Over the straight middle: dock on the nearest top/bottom edge.
        return { x: chipX, y: homeY + (ey >= 0 ? 1 : -1) * halfH };
    }
    //Over an end cap: dock on the matching semicircle arc.
    const cornerX = homeX + (ex >= 0 ? 1 : -1) * straightHalfW;
    const dx = chipX - cornerX;
    const dy = chipY - homeY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: cornerX + (halfH * dx) / dist, y: homeY + (halfH * dy) / dist };
}
