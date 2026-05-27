import { describe, expect, it } from 'vitest';
import {
    WORKSPACE_RIGHT_DEFAULT_WIDTH_PX,
    WORKSPACE_RIGHT_MAX_WIDTH_PX,
    WORKSPACE_RIGHT_MIN_WIDTH_PX,
    WORKSPACE_SPLIT_MIN_VIEWPORT_PX,
    getWorkspaceRightPaneDefaultWidth,
    getWorkspaceRightPaneMaxWidth,
    normalizeWorkspaceLayoutState
} from './workspace-panel-preferences';

describe('workspace panel preferences', () => {
    it('normalizes an empty layout to a right resource pane', () => {
        const { layout, rightPane, canSplit } = normalizeWorkspaceLayoutState(null, 1440);

        expect(canSplit).toBe(true);
        expect(layout.version).toBe(1);
        expect(layout.activeAuxiliaryPaneId).toBeUndefined();
        expect(rightPane.id).toBe('right-resource');
        expect(rightPane.kind).toBe('creative-resources');
        expect(rightPane.sizePx).toBeGreaterThanOrEqual(WORKSPACE_RIGHT_MIN_WIDTH_PX);
        expect(rightPane.sizePx).toBeLessThanOrEqual(WORKSPACE_RIGHT_MAX_WIDTH_PX);
    });

    it('clamps stored sizes so the main pane remains visible', () => {
        const { rightPane } = normalizeWorkspaceLayoutState(
            {
                version: 1,
                panes: [
                    {
                        id: 'right-resource',
                        active: true,
                        collapsed: false,
                        sizePx: 2000,
                        previousSizePx: 2000
                    }
                ],
                lastUpdatedAt: 1
            },
            1100
        );

        expect(rightPane.sizePx).toBe(getWorkspaceRightPaneMaxWidth(1100));
        expect(1100 - (rightPane.sizePx ?? 0)).toBeGreaterThanOrEqual(560);
    });

    it('prefers valid stored ratio when restoring across viewport sizes', () => {
        const { rightPane } = normalizeWorkspaceLayoutState(
            {
                version: 1,
                panes: [
                    {
                        id: 'right-resource',
                        active: true,
                        collapsed: false,
                        sizePx: 520,
                        sizeRatio: 0.4
                    }
                ],
                activeAuxiliaryPaneId: 'right-resource',
                lastUpdatedAt: 1
            },
            1600
        );

        expect(rightPane.sizePx).toBe(640);
    });

    it('disables split panes below the minimum split viewport', () => {
        const { rightPane, canSplit } = normalizeWorkspaceLayoutState(
            {
                version: 1,
                panes: [
                    {
                        id: 'right-resource',
                        active: true,
                        collapsed: true,
                        sizePx: 500
                    }
                ],
                activeAuxiliaryPaneId: 'right-resource',
                lastUpdatedAt: 1
            },
            WORKSPACE_SPLIT_MIN_VIEWPORT_PX - 1
        );

        expect(canSplit).toBe(false);
        expect(rightPane.active).toBe(false);
        expect(rightPane.collapsed).toBe(false);
    });

    it('uses constrained defaults for common desktop widths', () => {
        expect(getWorkspaceRightPaneDefaultWidth(1440)).toBe(Math.round(1440 * 0.36));
        expect(getWorkspaceRightPaneDefaultWidth(1600)).toBe(WORKSPACE_RIGHT_DEFAULT_WIDTH_PX);
        expect(getWorkspaceRightPaneDefaultWidth(1000)).toBe(WORKSPACE_RIGHT_MIN_WIDTH_PX);
    });
});
