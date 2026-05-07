import {
    DESKTOP_APP_GUIDANCE_MESSAGE,
    appendDesktopAppGuidance,
    isLikelyWebDirectAccessError
} from './desktop-guidance';
import { describe, expect, it } from 'vitest';

describe('desktop guidance helpers', () => {
    it('returns the desktop guidance message when no original message is provided', () => {
        expect(appendDesktopAppGuidance('   ')).toBe(DESKTOP_APP_GUIDANCE_MESSAGE);
    });

    it('appends desktop guidance to an existing message', () => {
        const message = appendDesktopAppGuidance('直连模式请求失败：目标地址可能不支持 CORS。');

        expect(message).toContain('直连模式请求失败');
        expect(message).toContain(DESKTOP_APP_GUIDANCE_MESSAGE);
    });

    it('detects browser direct-access errors that should offer desktop guidance', () => {
        expect(isLikelyWebDirectAccessError('Failed to fetch')).toBe(true);
        expect(isLikelyWebDirectAccessError('Access-Control-Allow-Origin header missing')).toBe(true);
        expect(isLikelyWebDirectAccessError('NetworkError when attempting to fetch resource')).toBe(true);
    });

    it('does not classify ordinary provider validation errors as browser access limits', () => {
        expect(isLikelyWebDirectAccessError('Invalid API key')).toBe(false);
        expect(isLikelyWebDirectAccessError('模型暂不支持图像编辑')).toBe(false);
    });
});
