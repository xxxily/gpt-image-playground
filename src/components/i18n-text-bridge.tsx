'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { translateLegacyUiAttribute, translateLegacyUiString } from '@/lib/i18n/legacy-text';
import * as React from 'react';

const TEXT_SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE']);
const ATTRIBUTE_SKIP_TAGS = new Set(['SCRIPT', 'STYLE']);
const TRANSLATABLE_ATTRIBUTES = ['aria-label', 'title', 'placeholder', 'alt'];

const originalText = new WeakMap<Text, string>();

export function I18nTextBridge() {
    const { language } = useAppLanguage();

    React.useEffect(() => {
        const root = document.body;
        if (!root) return undefined;

        let frame: number | null = null;
        const apply = () => {
            if (frame !== null) return;
            frame = window.requestAnimationFrame(() => {
                frame = null;
                applyLegacyTranslation(root, language === 'en-US');
            });
        };
        apply();

        const observer = new MutationObserver(() => apply());
        observer.observe(root, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: TRANSLATABLE_ATTRIBUTES
        });

        return () => {
            observer.disconnect();
            if (frame !== null) {
                window.cancelAnimationFrame(frame);
            }
        };
    }, [language]);

    return null;
}

function applyLegacyTranslation(root: HTMLElement, translateToEnglish: boolean) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let current: Text | null;
    while ((current = walker.nextNode() as Text | null)) {
        const parent = current.parentElement;
        if (!parent || shouldSkipText(parent)) continue;

        if (!translateToEnglish) {
            const original = originalText.get(current);
            if (original !== undefined && current.nodeValue !== original) {
                current.nodeValue = original;
            }
            continue;
        }

        const storedOriginal = originalText.get(current);
        const storedTranslation = storedOriginal ? translateLegacyUiString(storedOriginal) : null;
        const source =
            storedOriginal && current.nodeValue === storedTranslation ? storedOriginal : (current.nodeValue ?? '');
        const translated = translateLegacyUiString(source);
        if (translated && translated !== current.nodeValue) {
            originalText.set(current, source);
            current.nodeValue = translated;
        }
    }

    for (const element of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
        if (shouldSkipAttribute(element)) continue;
        for (const attribute of TRANSLATABLE_ATTRIBUTES) {
            const value = element.getAttribute(attribute);
            if (!value) continue;
            const originalAttr = `data-i18n-original-${attribute}`;
            if (!translateToEnglish) {
                const original = element.getAttribute(originalAttr);
                if (original !== null) {
                    element.setAttribute(attribute, original);
                    element.removeAttribute(originalAttr);
                }
                continue;
            }
            const storedOriginal = element.getAttribute(originalAttr);
            const storedTranslation = storedOriginal ? translateLegacyUiAttribute(storedOriginal) : null;
            const source = storedOriginal && value === storedTranslation ? storedOriginal : value;
            const translated = translateLegacyUiAttribute(source);
            if (translated && translated !== value) {
                element.setAttribute(originalAttr, source);
                element.setAttribute(attribute, translated);
            }
        }
    }
}

function shouldSkipText(element: Element): boolean {
    return TEXT_SKIP_TAGS.has(element.tagName) || isI18nSkipped(element);
}

function shouldSkipAttribute(element: Element): boolean {
    return ATTRIBUTE_SKIP_TAGS.has(element.tagName) || isI18nSkipped(element);
}

function isI18nSkipped(element: Element): boolean {
    return element.closest('[data-i18n-skip="true"]') !== null;
}
