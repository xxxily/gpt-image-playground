/**
 * Throttle logic for secure share unlock attempts.
 *
 * Uses sessionStorage so throttle state does NOT persist across browser restarts.
 * A user closing the tab and coming back later is fine; rapid-fire attacks in-session
 * are blocked. All sessionStorage access is wrapped in try/catch with console.warn
 * fallback for environments where storage is unavailable.
 *
 * shareThrottleKey uses btoa for a stable, lightweight hash. This is NOT
 * cryptographically strong, but it is sufficient here: the key only needs
 * to be stable within a session so that different share links throttle
 * independently. We are not storing passwords — this is purely an in-session
 * rate-limit namespace.
 */

export type ThrottleState = {
    failedAttempts: number;
    nextAllowedAt: number; // epoch ms
};

/** Number of free failed attempts before backoff kicks in. */
export const UNLOCK_THROTTLE_THRESHOLD = 5;

/**
 * Backoff delays applied once failedAttempts >= threshold.
 * Index 0 → 10s (attempts 5), Index 1 → 30s (attempts 6), etc.
 * When attempts exceed the array length, the last value is reused.
 */
export const UNLOCK_THROTTLE_DELAYS_MS = [10_000, 30_000, 60_000, 300_000]; // 10s, 30s, 1min, 5min

const STORAGE_PREFIX = 'gpt-image-playground:unlock-throttle:';

function safeSessionStorage(): Storage | null {
    if (typeof window === 'undefined') return null;
    try {
        return window.sessionStorage;
    } catch {
        console.warn('[unlock-throttle] sessionStorage unavailable');
        return null;
    }
}

/**
 * Produce a stable throttle key from a share identifier.
 * Uses btoa for a simple, deterministic transform. Different share links
 * get different keys so throttling is isolated per link.
 */
export function shareThrottleKey(shareId: string): string {
    try {
        const encoded = typeof window !== 'undefined' && typeof btoa === 'function'
            ? btoa(shareId).slice(0, 12)
            : shareId.slice(0, 12);
        return `${STORAGE_PREFIX}${encoded}`;
    } catch {
        // Fallback for non-latin shareId that might break btoa
        return `${STORAGE_PREFIX}${shareId.slice(0, 12)}`;
    }
}

/**
 * Read throttle state from sessionStorage.
 * Returns a default state when nothing is stored.
 */
export function getThrottleState(key: string): ThrottleState {
    const storage = safeSessionStorage();
    if (!storage) return { failedAttempts: 0, nextAllowedAt: 0 };

    try {
        const raw = storage.getItem(key);
        if (!raw) return { failedAttempts: 0, nextAllowedAt: 0 };

        const parsed = JSON.parse(raw) as Partial<ThrottleState>;
        return {
            failedAttempts: typeof parsed.failedAttempts === 'number' ? parsed.failedAttempts : 0,
            nextAllowedAt: typeof parsed.nextAllowedAt === 'number' ? parsed.nextAllowedAt : 0
        };
    } catch (err) {
        console.warn('[unlock-throttle] Failed to read throttle state:', err);
        return { failedAttempts: 0, nextAllowedAt: 0 };
    }
}

/**
 * Return milliseconds remaining until the next unlock attempt is allowed.
 * Returns 0 if no throttling is active.
 */
export function getRemainingThrottleMs(key: string): number {
    const state = getThrottleState(key);
    if (state.nextAllowedAt <= 0) return 0;

    return Math.max(0, state.nextAllowedAt - Date.now());
}

function persistState(key: string, state: ThrottleState): void {
    const storage = safeSessionStorage();
    if (!storage) return;

    try {
        storage.setItem(key, JSON.stringify(state));
    } catch (err) {
        console.warn('[unlock-throttle] Failed to persist throttle state:', err);
    }
}

/**
 * Record a failed unlock attempt.
 * Increments the counter and, once the threshold is reached, sets a
 * nextAllowedAt based on the exponential backoff schedule.
 */
export function recordFailedAttempt(key: string): ThrottleState {
    const state = getThrottleState(key);
    state.failedAttempts += 1;

    if (state.failedAttempts > UNLOCK_THROTTLE_THRESHOLD) {
        const delayIndex = Math.min(
            state.failedAttempts - UNLOCK_THROTTLE_THRESHOLD - 1,
            UNLOCK_THROTTLE_DELAYS_MS.length - 1
        );
        state.nextAllowedAt = Date.now() + UNLOCK_THROTTLE_DELAYS_MS[delayIndex];
    } else {
        state.nextAllowedAt = 0;
    }

    persistState(key, state);
    return state;
}

/**
 * Clear throttle state after a successful unlock.
 */
export function clearThrottleState(key: string): void {
    const storage = safeSessionStorage();
    if (!storage) return;

    try {
        storage.removeItem(key);
    } catch (err) {
        console.warn('[unlock-throttle] Failed to clear throttle state:', err);
    }
}
