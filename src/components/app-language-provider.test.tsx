import { AppLanguageProvider, useAppLanguage } from './app-language-provider';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

function LanguageProbe() {
    const { language } = useAppLanguage();
    return <span>{language}</span>;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('AppLanguageProvider', () => {
    it('keeps the static-render language on the first React render', () => {
        vi.stubGlobal('document', {
            documentElement: {
                dataset: { appLanguage: 'en-US' },
                lang: 'en-US'
            }
        });

        expect(
            renderToStaticMarkup(
                <AppLanguageProvider>
                    <LanguageProbe />
                </AppLanguageProvider>
            )
        ).toContain('zh-CN');
    });
});
