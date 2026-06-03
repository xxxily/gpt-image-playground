import { describe, expect, it } from 'vitest';
import {
    AUTO_SYNC_SCOPE_OPTIONS,
    PROMPT_TOOLBAR_BUTTON_OPTIONS,
    TASK_DEFAULT_ROW_CONFIGS,
    VIDEO_SYNC_OPTION_CONFIGS,
    batchStrategyLabelKey
} from './settings-options';

describe('settings options', () => {
    it('keeps option ids stable for settings views', () => {
        expect(PROMPT_TOOLBAR_BUTTON_OPTIONS.map((option) => option.key)).toEqual(
            expect.arrayContaining(['clear', 'polish', 'batch', 'visionText', 'video'])
        );
        expect(TASK_DEFAULT_ROW_CONFIGS.map((row) => row.task)).toEqual(
            expect.arrayContaining(['image.generate', 'image.edit', 'vision.text', 'video.generate'])
        );
        expect(VIDEO_SYNC_OPTION_CONFIGS.map((option) => option.key)).toEqual(
            expect.arrayContaining(['videoHistory', 'videoSourceImages', 'videoThumbnails', 'videoFiles'])
        );
        expect(AUTO_SYNC_SCOPE_OPTIONS.map((option) => option.key)).toContain('appConfig');
    });

    it('maps batch strategy ids to i18n label keys', () => {
        expect(batchStrategyLabelKey('content-split')).toBe('batch.dialog.mode.contentSplit');
        expect(batchStrategyLabelKey('json-import')).toBe('batch.source.json');
        expect(batchStrategyLabelKey('auto')).toBe('batch.dialog.mode.auto');
    });
});
