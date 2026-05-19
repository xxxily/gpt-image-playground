import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    UNLOCK_THROTTLE_DELAYS_MS,
    UNLOCK_THROTTLE_THRESHOLD,
    clearThrottleState,
    getRemainingThrottleMs,
    getThrottleState,
    recordFailedAttempt,
    shareThrottleKey
} from './unlock-throttle';

describe('shareThrottleKey', () => {
    it('returns a stable key for the same shareId', () => {
        const key1 = shareThrottleKey('test-share-123');
        const key2 = shareThrottleKey('test-share-123');
        expect(key1).toBe(key2);
    });

    it('returns different keys for different shareIds', () => {
        const key1 = shareThrottleKey('share-a');
        const key2 = shareThrottleKey('share-b');
        expect(key1).not.toBe(key2);
    });
});

describe('throttle lifecycle', () => {
    let mockStorage: Record<string, string> = {};
    const testKey = shareThrottleKey('test-lifecycle');

    beforeEach(() => {
        mockStorage = {};
        const mockStorageObj = {
            getItem: vi.fn((key: string) => mockStorage[key] ?? null),
            setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value; }),
            removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
            clear: vi.fn(() => { mockStorage = {}; }),
            length: 0,
            key: vi.fn()
        };
        vi.stubGlobal('sessionStorage', mockStorageObj);
        vi.stubGlobal('window', { ...globalThis, sessionStorage: mockStorageObj });
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('starts with zero attempts and no delay', () => {
        const state = getThrottleState(testKey);
        expect(state.failedAttempts).toBe(0);
        expect(getRemainingThrottleMs(testKey)).toBe(0);
    });

    it('first 5 attempts do not trigger throttle', () => {
        for (let i = 0; i < UNLOCK_THROTTLE_THRESHOLD; i++) {
            recordFailedAttempt(testKey);
        }
        const state = getThrottleState(testKey);
        expect(state.failedAttempts).toBe(UNLOCK_THROTTLE_THRESHOLD);
        expect(getRemainingThrottleMs(testKey)).toBe(0);
    });

    it('6th attempt (first over threshold) triggers 10s lock', () => {
        for (let i = 0; i < UNLOCK_THROTTLE_THRESHOLD + 1; i++) {
            recordFailedAttempt(testKey);
        }
        const remaining = getRemainingThrottleMs(testKey);
        expect(remaining).toBeGreaterThan(0);
        expect(remaining).toBeLessThanOrEqual(UNLOCK_THROTTLE_DELAYS_MS[0]);
    });

    it('7th attempt extends to 30s lock', () => {
        for (let i = 0; i < UNLOCK_THROTTLE_THRESHOLD + 2; i++) {
            recordFailedAttempt(testKey);
        }
        const remaining = getRemainingThrottleMs(testKey);
        expect(remaining).toBeGreaterThan(UNLOCK_THROTTLE_DELAYS_MS[0]);
        expect(remaining).toBeLessThanOrEqual(UNLOCK_THROTTLE_DELAYS_MS[1]);
    });

    it('clearThrottleState resets all state', () => {
        for (let i = 0; i < UNLOCK_THROTTLE_THRESHOLD + 3; i++) {
            recordFailedAttempt(testKey);
        }
        expect(getRemainingThrottleMs(testKey)).toBeGreaterThan(0);
        clearThrottleState(testKey);
        expect(getThrottleState(testKey).failedAttempts).toBe(0);
        expect(getRemainingThrottleMs(testKey)).toBe(0);
    });

    it('getRemainingThrottleMs decreases over time with fake timers', () => {
        for (let i = 0; i < UNLOCK_THROTTLE_THRESHOLD + 1; i++) {
            recordFailedAttempt(testKey);
        }
        const initial = getRemainingThrottleMs(testKey);
        expect(initial).toBeGreaterThan(0);
        vi.advanceTimersByTime(5000);
        const after5s = getRemainingThrottleMs(testKey);
        expect(after5s).toBe(initial - 5000);
        vi.advanceTimersByTime(11000);
        const after16s = getRemainingThrottleMs(testKey);
        expect(after16s).toBe(0);
    });
});
