// RandRemoveSign hazard
// Periodically deletes a random character from the editor content,
// skipping the protected prefix defined by corruptionLimit.

let corruptionLimit = 50;
let timeoutId: ReturnType<typeof setTimeout> | null = null;

export function setCorruptionLimit(limit: number): void {
    corruptionLimit = limit;
}

export function stopRandRemoveSign(): void {
    if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
    }
}

export function startRandRemoveSign(minIntervalMs: number, maxIntervalMs: number): void {
    stopRandRemoveSign();

    const step = () => {
        const bridge = (window as any).ideBridge;
        if (bridge) {
            const content: string = bridge.getEditorContent();
            if (content && content.length > corruptionLimit) {
                const idx = Math.floor(Math.random() * (content.length - corruptionLimit)) + corruptionLimit;
                console.log(`[Hazard] RandRemoveSign: usunięto znak na indeksie ${idx}`);
                bridge.deleteCharacterIndex(idx);
            }
        }

        const nextRun = Math.floor(Math.random() * (maxIntervalMs - minIntervalMs)) + minIntervalMs;
        timeoutId = setTimeout(step, nextRun);
    };

    const firstRun = Math.floor(Math.random() * (maxIntervalMs - minIntervalMs)) + minIntervalMs;
    timeoutId = setTimeout(step, firstRun);
}
