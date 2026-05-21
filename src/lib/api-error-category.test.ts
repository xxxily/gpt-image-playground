import { describe, expect, it } from 'vitest';
import { categorizeApiError, TaskExecutionError } from './api-error-category';

describe('categorizeApiError', () => {
    it('returns unknown + retryable for empty input', () => {
        const r = categorizeApiError('');
        expect(r.category).toBe('unknown');
        expect(r.retryable).toBe(true);
    });

    it('detects auth from 401 status text', () => {
        const r = categorizeApiError('API request failed with status 401');
        expect(r.category).toBe('auth');
        expect(r.retryable).toBe(false);
        expect(r.status).toBe(401);
    });

    it('detects auth from "Incorrect API key" message', () => {
        const r = categorizeApiError('Incorrect API key provided');
        expect(r.category).toBe('auth');
        expect(r.retryable).toBe(false);
    });

    it('detects rate-limit from 429 and parses Retry-After', () => {
        const r = categorizeApiError('API request failed with status 429. Retry-After: 60');
        expect(r.category).toBe('rate-limit');
        expect(r.retryable).toBe(true);
        expect(r.retryAfterSec).toBe(60);
    });

    it('detects server errors from 5xx', () => {
        expect(categorizeApiError('status 502 Bad Gateway').category).toBe('server');
        expect(categorizeApiError('Internal server error (status 500)').category).toBe('server');
    });

    it('detects quota errors regardless of status', () => {
        const r = categorizeApiError('You exceeded your current quota, please check your plan and billing details. status 429');
        expect(r.category).toBe('quota');
        expect(r.retryable).toBe(false);
    });

    it('detects network errors from common idioms', () => {
        expect(categorizeApiError('Failed to fetch').category).toBe('network');
        expect(categorizeApiError('The operation was aborted').category).toBe('network');
        expect(categorizeApiError('请求超时').category).toBe('network');
    });

    it('falls back to unknown for unmapped messages', () => {
        const r = categorizeApiError('Something else went wrong');
        expect(r.category).toBe('unknown');
        expect(r.retryable).toBe(true);
    });

    it('uses explicit status parameter over message extraction', () => {
        const r = categorizeApiError('some error', 403);
        expect(r.category).toBe('auth');
        expect(r.status).toBe(403);
    });

    it('uses retryAfterHeader parameter', () => {
        const r = categorizeApiError('rate limited', 429, '120');
        expect(r.category).toBe('rate-limit');
        expect(r.retryAfterSec).toBe(120);
    });

    it('handles TaskExecutionError with status property', () => {
        const err = new TaskExecutionError('Upstream failed', { status: 503, retryAfter: '45' });
        const r = categorizeApiError(err);
        expect(r.category).toBe('server');
        expect(r.status).toBe(503);
        expect(r.retryAfterSec).toBe(45);
        expect(r.retryable).toBe(true);
    });

    it('network category is retryable', () => {
        const r = categorizeApiError('Failed to fetch');
        expect(r.category).toBe('network');
        expect(r.retryable).toBe(true);
    });

    it('captures rawMessage field', () => {
        const r = categorizeApiError('API request failed with status 401');
        expect(r.rawMessage).toBe('API request failed with status 401');
    });
});
