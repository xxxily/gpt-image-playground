import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const PROJECT_ROOT = process.cwd();
const CJK_PATTERN = /[\u4e00-\u9fff]/u;
const IGNORED_TEXT_PATTERN = /^(?:[\s:：,，.。;；!！?？/|()（）[\]{}·•+\-*#]+|[0-9]+|[A-Z0-9_./:-]+)$/u;
const VISIBLE_ATTRIBUTE_NAMES = new Set(['aria-label', 'title', 'placeholder', 'alt', 'label', 'description']);

function getJsxAttributeName(name: ts.JsxAttributeName): string | null {
    return ts.isIdentifier(name) ? name.text : null;
}

function listTrackedTsxFiles(): string[] {
    return execFileSync('git', ['ls-files', 'src/**/*.tsx'], {
        cwd: PROJECT_ROOT,
        encoding: 'utf8'
    })
        .split('\n')
        .filter(Boolean)
        .filter((file) => file.startsWith('src/app/') || file.startsWith('src/components/'))
        .filter((file) => !file.startsWith('src/app/api/') && !file.endsWith('.test.tsx'));
}

function hasI18nSkipAttribute(attributes: ts.JsxAttributes | undefined): boolean {
    return Boolean(
        attributes?.properties.some(
            (property) => ts.isJsxAttribute(property) && getJsxAttributeName(property.name) === 'data-i18n-skip'
        )
    );
}

function isInsideI18nSkippedElement(node: ts.Node): boolean {
    let current: ts.Node | undefined = node.parent;
    while (current) {
        if (ts.isJsxElement(current) && hasI18nSkipAttribute(current.openingElement.attributes)) return true;
        if (ts.isJsxSelfClosingElement(current) && hasI18nSkipAttribute(current.attributes)) return true;
        current = current.parent;
    }
    return false;
}

function normalizeCandidate(text: string): string | null {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized || IGNORED_TEXT_PATTERN.test(normalized)) return null;
    return CJK_PATTERN.test(normalized) ? normalized : null;
}

function collectHardCodedJsxCopy(file: string): string[] {
    const absolutePath = path.join(PROJECT_ROOT, file);
    if (!existsSync(absolutePath)) return [];

    const source = readFileSync(absolutePath, 'utf8');
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const findings: string[] = [];

    const visit = (node: ts.Node) => {
        let kind: string | null = null;
        let text: string | null = null;

        if (ts.isJsxText(node) && !isInsideI18nSkippedElement(node)) {
            kind = 'text';
            text = normalizeCandidate(node.getText(sourceFile));
        } else if (
            ts.isJsxExpression(node) &&
            node.expression &&
            ts.isStringLiteral(node.expression) &&
            !isInsideI18nSkippedElement(node)
        ) {
            kind = 'expression';
            text = normalizeCandidate(node.expression.text);
        } else if (
            ts.isJsxAttribute(node) &&
            VISIBLE_ATTRIBUTE_NAMES.has(getJsxAttributeName(node.name) ?? '') &&
            node.initializer &&
            !isInsideI18nSkippedElement(node)
        ) {
            kind = `attribute:${getJsxAttributeName(node.name) ?? 'unknown'}`;
            if (ts.isStringLiteral(node.initializer)) {
                text = normalizeCandidate(node.initializer.text);
            } else if (
                ts.isJsxExpression(node.initializer) &&
                node.initializer.expression &&
                ts.isStringLiteral(node.initializer.expression)
            ) {
                text = normalizeCandidate(node.initializer.expression.text);
            }
        } else if (ts.isStringLiteral(node) && !isInsideI18nSkippedElement(node)) {
            kind = 'string';
            text = normalizeCandidate(node.text);
        } else if (ts.isNoSubstitutionTemplateLiteral(node) && !isInsideI18nSkippedElement(node)) {
            kind = 'template';
            text = normalizeCandidate(node.text);
        } else if (ts.isTemplateExpression(node) && !isInsideI18nSkippedElement(node)) {
            kind = 'template';
            text = normalizeCandidate(node.getText(sourceFile));
        }

        if (kind && text) {
            const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
            findings.push(`${file}:${position.line + 1}:${kind}: ${text}`);
        }

        ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return findings;
}

describe('i18n static audit', () => {
    it('does not ship the legacy DOM text bridge', () => {
        expect(existsSync(path.join(PROJECT_ROOT, 'src/components/i18n-text-bridge.tsx'))).toBe(false);
    });

    it('keeps audited UI files out of hard-coded Chinese text', () => {
        const findings = listTrackedTsxFiles().flatMap(collectHardCodedJsxCopy);
        expect(findings).toEqual([]);
    });
});
