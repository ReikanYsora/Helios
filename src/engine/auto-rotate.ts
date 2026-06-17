//Smooth, time-based auto-rotation around the home. Runs in the
//OPPOSITE direction to the sun's apparent motion (decreasing
//bearing in NH, where the sun goes east → south → west, i.e.
//clockwise from above) so the camera and the live sun visually
//counter-orbit each other, a quiet but constant motion that
//makes the card feel alive even with no user input. The rotation
//pauses for AUTO_ROTATE_INACTIVITY_MS after every user gesture
//(mouse down / wheel / touch) so the user has full control during
//a manipulation, then resumes from wherever the user left the
//camera, no recalibration to a fixed bearing.
//
//We tween in seconds (delta-time integrated against the frame
//rate) rather than a fixed per-frame increment so the rotation
//speed is constant across 60 Hz / 120 Hz displays and survives
//tab-throttling with no visible jumps when the user comes back.

import type { Map as MapLibreMap } from 'maplibre-gl';
import type { HeliosConfig } from '../helios-config';


//Speed picked so the rotation reads as a continuous slow drift
//rather than a sequence of pixel-snap "steps". The previous 1.5
//deg/s produced an infra-pixel delta per frame at the typical
//Helios zoom: the on-screen displacement only reached ~1 px once
//every 15 frames, which the eye reads as discrete jumps. 4 deg/s
//gives a sub-pixel delta around 0.18 px/frame at the same zoom,
//continuous enough for the eye while still slow enough that a
//full revolution takes 90 seconds.
const AUTO_ROTATE_DEG_PER_SEC   = 4.0;
const AUTO_ROTATE_INACTIVITY_MS = 5_000;


//Structural surface the engine exposes to this loop. Only the
//fields the loop actually reads / writes; gesture handlers in the
//engine bump `_autoRotateLastUserAction` directly, no helper here
//(a 1-line assignment doesn't benefit from a wrapper).
export interface AutoRotateHost
{
    readonly map?:         MapLibreMap;
    readonly cfg:          HeliosConfig;

    _autoRotateRaf?:           number;
    _autoRotateLastFrame:      number;
    _autoRotateLastUserAction: number;
    //Accumulated bearing held by the loop. Lets us integrate the
    //sub-degree per-frame delta in our own float without round-
    //tripping through MapLibre's getBearing(), which clamps and
    //returns a normalised value that may silently quantise the
    //increment near zero and produce the "step-by-step" jitter.
    _autoRotateBearing?:       number;
}


//Kick off the rotation rAF loop. Idempotent: a second call while
//the loop is already running is a no-op. The loop self-terminates
//when the map goes away (engine cleanup); the cleanup path also
//cancels the rAF directly to drop it on the same frame.
export function startAutoRotateLoop(host: AutoRotateHost): void
{
    if (host._autoRotateRaf !== undefined || !host.map)
    {
        return;
    }
    host._autoRotateLastFrame      = performance.now();
    host._autoRotateLastUserAction = 0;
    //Seed the locally tracked bearing from the map's current value
    //so the loop's first step picks up from wherever the camera
    //already is. Subsequent frames integrate against this slot
    //without round-tripping through getBearing().
    host._autoRotateBearing = host.map.getBearing();

    const tick = (t: number) =>
    {
        if (!host.map)
        {
            host._autoRotateRaf = undefined;
            return;
        }

        const dt = Math.max(0, t - host._autoRotateLastFrame) / 1000;
        host._autoRotateLastFrame = t;

        const sinceUser = Date.now() - host._autoRotateLastUserAction;
        //Strict equality check: an undefined config (the common
        //case for fresh installs) defaults to OFF. Auto-rotation
        //is a stylistic touch some users find distracting, and
        //in scrub mode it can confuse "did the camera move or
        //did time pass?". The user has to explicitly opt in via
        //the editor toggle. Detail mode also suppresses it.
        const autoRotateEnabled = host.cfg['auto-rotate-enabled'] === true;
        //camera-locked overrides auto-rotate too: the whole point of the
        //lock is "the camera stays exactly where I dialled it in", so a
        //slow idle orbit would defeat the user's intent.
        const cameraLocked      = (host.cfg as Record<string, unknown>)['camera-locked'] === true;
        //Long-lived disable: the user explicitly opted OUT or locked the camera. Suspend the rAF loop entirely
        //instead of self-resubmitting at 60 Hz forever. The engine re-arms the loop from `updateConfig` whenever
        //either flag flips back to its rotation-permitting state, so toggling the editor switch resumes seamlessly.
        if (!autoRotateEnabled || cameraLocked)
        {
            host._autoRotateRaf = undefined;
            return;
        }
        if (autoRotateEnabled
            && !cameraLocked
            && sinceUser >= AUTO_ROTATE_INACTIVITY_MS)
        {
            //Negative delta: bearing decreases, camera rotates counter-clockwise around the up axis as seen from above, map content drifts clockwise
            //on screen, opposite of the sun's apparent motion.
            //
            //Re-sync the locally tracked bearing with whatever the
            //map currently says when the user just stopped touching
            //the camera (sinceUser flips above the threshold): a
            //manual drag mid-loop would otherwise see us snap back
            //to the locally stored value at the next tick.
            if (host._autoRotateBearing === undefined
                || sinceUser - AUTO_ROTATE_INACTIVITY_MS < 16)
            {
                host._autoRotateBearing = host.map.getBearing();
            }
            host._autoRotateBearing -= AUTO_ROTATE_DEG_PER_SEC * dt;
            host.map.setBearing(host._autoRotateBearing);
        }
        else
        {
            //While paused, keep the locally tracked bearing in sync with the live map so a resume picks up smoothly from the user-edited camera.
            host._autoRotateBearing = host.map.getBearing();
        }

        host._autoRotateRaf = requestAnimationFrame(tick);
    };
    host._autoRotateRaf = requestAnimationFrame(tick);
}
