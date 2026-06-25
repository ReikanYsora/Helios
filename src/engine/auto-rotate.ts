//Smooth time-based auto-rotation around the home, counter to the sun's apparent
//motion (decreasing bearing in NH) so camera and sun visually counter-orbit,
//keeping the card alive with no user input. Pauses for AUTO_ROTATE_INACTIVITY_MS
//after every user gesture, then resumes from the camera's current bearing (no
//recalibration). Tweens in seconds (delta-time integrated) rather than a fixed
//per-frame increment so speed is constant across refresh rates and survives
//tab-throttling without visible jumps.

import type { SceneRenderer } from '../scene';
import type { HeliosConfig } from '../helios-config';
import { AUTO_ROTATE_DEG_PER_SEC, AUTO_ROTATE_INACTIVITY_MS } from '../constants';


//Engine surface this loop reads/writes. Gesture handlers bump
//`_autoRotateLastUserAction` directly (no wrapper for a 1-line assignment).
export interface AutoRotateHost
{
    readonly _renderer?:   SceneRenderer;
    readonly cfg:          HeliosConfig;

    _autoRotateRaf?:           number;
    _autoRotateLastFrame:      number;
    _autoRotateLastUserAction: number;
    //Bearing integrated in our own float; round-tripping through getBearing()
    //clamps/normalises and may quantise the sub-degree increment into jitter.
    _autoRotateBearing?:       number;
}


//Kick off the rotation rAF loop. Idempotent. Self-terminates when the map goes
//away; engine cleanup also cancels the rAF directly to drop it on the same frame.
export function startAutoRotateLoop(host: AutoRotateHost): void
{
    if (host._autoRotateRaf !== undefined || !host._renderer)
    {
        return;
    }
    host._autoRotateLastFrame      = performance.now();
    host._autoRotateLastUserAction = 0;
    //Seed local bearing from the renderer so the first step picks up from the current camera.
    host._autoRotateBearing = host._renderer.getCameraBearing();

    const tick = (t: number) =>
    {
        const renderer = host._renderer;
        if (!renderer)
        {
            host._autoRotateRaf = undefined;
            return;
        }

        const dt = Math.max(0, t - host._autoRotateLastFrame) / 1000;
        host._autoRotateLastFrame = t;

        const sinceUser = Date.now() - host._autoRotateLastUserAction;
        //Defaults OFF (undefined config): rotation is opt-in via the editor toggle
        //since it can distract and, in scrub mode, blur "did the camera move or did
        //time pass?". Detail mode also suppresses it.
        const autoRotateEnabled = host.cfg['auto-rotate-enabled'] === true;
        //camera-locked overrides too: the lock means "stays where I dialled it in".
        const cameraLocked      = (host.cfg as Record<string, unknown>)['camera-locked'] === true;
        //Long-lived disable: suspend the rAF loop rather than self-resubmit at 60Hz
        //forever. `updateConfig` re-arms the loop when either flag flips back.
        if (!autoRotateEnabled || cameraLocked)
        {
            host._autoRotateRaf = undefined;
            return;
        }
        if (autoRotateEnabled
            && !cameraLocked
            && sinceUser >= AUTO_ROTATE_INACTIVITY_MS)
        {
            //Negative delta: bearing decreases, camera rotates CCW about the up axis;
            //map content drifts CW on screen, opposite the sun.
            //
            //Re-sync local bearing from the map right when the user stops touching the
            //camera (sinceUser crosses the threshold), else a mid-loop drag snaps back.
            if (host._autoRotateBearing === undefined
                || sinceUser - AUTO_ROTATE_INACTIVITY_MS < 16)
            {
                host._autoRotateBearing = renderer.getCameraBearing();
            }
            host._autoRotateBearing -= AUTO_ROTATE_DEG_PER_SEC * dt;
            renderer.setCameraBearing(host._autoRotateBearing);
        }
        else
        {
            //While paused, track the live camera so a resume picks up from the edited pose.
            host._autoRotateBearing = renderer.getCameraBearing();
        }

        host._autoRotateRaf = requestAnimationFrame(tick);
    };
    host._autoRotateRaf = requestAnimationFrame(tick);
}
