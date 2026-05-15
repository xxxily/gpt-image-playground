import { describe, expect, it } from 'vitest';
import { SUPPORTED_APP_LANGUAGES } from './language';
import { getMessageKeySet } from './translator';

describe('i18n message resources', () => {
    it('keeps all language packs on the same key set', () => {
        const [baseLanguage, ...otherLanguages] = SUPPORTED_APP_LANGUAGES;
        const baseKeys = getMessageKeySet(baseLanguage);

        for (const language of otherLanguages) {
            expect(getMessageKeySet(language)).toEqual(baseKeys);
        }
    });
});

