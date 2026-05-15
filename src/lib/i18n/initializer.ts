import { DEFAULT_APP_LANGUAGE, normalizeAppLanguage } from './language';

export const APP_LANGUAGE_DATA_ATTRIBUTE = 'appLanguage';
export const APP_LANGUAGE_CONFIG_KEY = 'gpt-image-playground-config';

export function getDocumentAppLanguage(): string | null {
    if (typeof document === 'undefined') return null;
    return document.documentElement.dataset[APP_LANGUAGE_DATA_ATTRIBUTE] || document.documentElement.lang || null;
}

export function buildLanguageInitializerScript(): string {
    const payload = JSON.stringify({
        configKey: APP_LANGUAGE_CONFIG_KEY,
        dataAttribute: APP_LANGUAGE_DATA_ATTRIBUTE,
        fallbackLanguage: DEFAULT_APP_LANGUAGE
    });

    return `(()=>{try{const c=${payload};const r=document.documentElement;const n=(v)=>{if(typeof v!=="string")return null;const s=v.trim().replace("_","-").toLowerCase();if(!s)return null;if(s==="zh"||s.startsWith("zh-"))return"zh-CN";if(s==="en"||s.startsWith("en-"))return"en-US";return null};let l=null;try{const raw=localStorage.getItem(c.configKey);if(raw){const parsed=JSON.parse(raw);l=n(parsed&&parsed.appLanguage)}}catch(e){}if(!l){const langs=Array.isArray(navigator.languages)?navigator.languages:[navigator.language];for(const item of langs){l=n(item);if(l)break}}l=l||c.fallbackLanguage;r.lang=l;r.dataset[c.dataAttribute]=l}catch(e){}})();`;
}

export function normalizeDocumentAppLanguage(value: unknown) {
    return normalizeAppLanguage(value) ?? DEFAULT_APP_LANGUAGE;
}

