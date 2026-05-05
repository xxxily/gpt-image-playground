import packageJson from '../../package.json';
import { appInfo, formatRepositoryDisplay, formatUrlDisplay, resolveRepositoryUrl } from './app-info';
import { describe, expect, it } from 'vitest';

describe('appInfo', () => {
    it('keeps About dialog metadata in sync with package.json', () => {
        expect(appInfo.version).toBe(packageJson.version);
        expect(appInfo.author).toBe(packageJson.author);
        expect(appInfo.websiteUrl).toBe(packageJson.homepage);
        expect(appInfo.githubUrl).toBe(packageJson.repository.url);
    });

    it('formats display labels without losing repository path information', () => {
        expect(appInfo.websiteDisplay).toBe('img-playground.anzz.site');
        expect(appInfo.githubDisplay).toBe('xxxily/gpt-image-playground');
        expect(formatUrlDisplay('https://example.com/')).toBe('example.com');
        expect(formatRepositoryDisplay('git+https://github.com/acme/example.git')).toBe('acme/example');
    });

    it('supports both npm repository metadata shapes', () => {
        expect(resolveRepositoryUrl({ url: 'https://github.com/acme/object-repo' })).toBe('https://github.com/acme/object-repo');
        expect(resolveRepositoryUrl('github:acme/string-repo')).toBe('github:acme/string-repo');
    });
});
