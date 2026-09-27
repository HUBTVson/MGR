// UI Freeze module
// Blocks the main thread for a random duration after code execution.

// we freeze after execution, not before because:
//   Freezing before the fetch/run would be detectable as a delay in the request itself.
//   Freezing AFTER execution but BEFORE displaying the result makes the freeze feel
//   like a natural "lag" in rendering.

export const ENABLE_FREEZE = true;

let FREEZE_MIN_MS = 3000; // 3sek
let FREEZE_MAX_MS = 4000; // 4sek
let FREEZE_CHANCE = 0.5; // 50% szans na zamrożenie

export async function initFreezeConfig(): Promise<void> {
    try {
        const response = await fetch('/api/freeze-config');
        if (!response.ok) throw new Error('Nie udało się pobrać configu freeze');
        
        const data = await response.json();
        FREEZE_MIN_MS = data.min_ms;
        FREEZE_MAX_MS = data.max_ms;
        FREEZE_CHANCE = data.chance;
        
    } catch (error) {
        console.error('[freeze] Błąd inicjalizacji, używam 0ms:', error);
    }
}

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
    if (Math.random() > FREEZE_CHANCE) {
        return 0;
    }
    const duration = Math.floor(
        FREEZE_MIN_MS + Math.random() * (FREEZE_MAX_MS - FREEZE_MIN_MS)
    );

    const start = performance.now();
    freeze(duration);
    const actual = Math.round(performance.now() - start);

    console.log(`[Hazard] Freeze: zablokowano wątek główny na ${actual}ms (cel: ${duration}ms)`);

    return actual;
}
