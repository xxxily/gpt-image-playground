import { describe, expect, it } from 'vitest';
import { createInitialSettingsConfig } from './settings-config-state';

describe('createInitialSettingsConfig', () => {
    it('creates an isolated default settings snapshot for the current language', () => {
        const a = createInitialSettingsConfig('en-US');
        const b = createInitialSettingsConfig('zh-CN');

        a.hiddenPromptToolbarButtons.push('clear');

        expect(a.appLanguage).toBe('en-US');
        expect(b.appLanguage).toBe('zh-CN');
        expect(b.hiddenPromptToolbarButtons).not.toContain('clear');
        expect(b.providerEndpoints).toEqual([]);
        expect(b.connectionMode).toBe('proxy');
    });
});
