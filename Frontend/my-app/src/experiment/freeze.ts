// UI Freeze module
// Blocks the main thread for a random duration after code execution.

// we freeze after execution, not before because:
//   Freezing before the fetch/run would be detectable as a delay in the request itself.
//   Freezing AFTER execution but BEFORE displaying the result makes the freeze feel
//   like a natural "lag" in rendering.

export const ENABLE_FREEZE = true;

const FREEZE_MIN_MS = 3000; // 2sek
const FREEZE_MAX_MS = 4000; // 3sek


// Blocks the main thread synchronously for the given number of milliseconds.
// Uses performance.now() to busy-wait

export function freeze(ms: number): void {
    const start = performance.now();
    while (performance.now() - start < ms) {
        // busy-wait: intentionally blocks the JS event loop
    }
}


// Applies a random freeze in the configured range and logs the duration
// Returns the actual freeze duration in ms

export function applyRandomFreeze(): number {
    const duration = Math.floor(
        FREEZE_MIN_MS + Math.random() * (FREEZE_MAX_MS - FREEZE_MIN_MS)
    );

    const start = performance.now();
    freeze(duration);
    const actual = Math.round(performance.now() - start);

    console.log(`[freeze] blocked main thread for ${actual}ms (target: ${duration}ms)`);

    return actual;
}
