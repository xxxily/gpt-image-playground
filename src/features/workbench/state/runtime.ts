import { isAboveOrAtBreakpoint } from '@/lib/breakpoints';
import type { TaskStatus } from '@/lib/tasks';
import type { VideoGenerationStatus } from '@/lib/video-types';

export type ServerRuntimeConfig = {
    clientDirectLinkPriority?: boolean;
};

export type DesktopRemoteImageResponse = {
    bytes: number[];
    contentType: string;
};

const BLOCKING_IMAGE_TASK_STATUSES = new Set<TaskStatus>(['queued', 'running', 'streaming']);
const BLOCKING_VIDEO_TASK_STATUSES = new Set<VideoGenerationStatus>(['queued', 'running', 'polling']);

export function parseServerRuntimeConfig(value: unknown): ServerRuntimeConfig {
    if (typeof value !== 'object' || value === null || !('clientDirectLinkPriority' in value)) return {};

    const { clientDirectLinkPriority } = value;
    return typeof clientDirectLinkPriority === 'boolean' ? { clientDirectLinkPriority } : {};
}

export function isEditablePasteTarget(target: EventTarget | null): boolean {
    if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false;

    const tagName = target.tagName.toLowerCase();
    return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

export function prefersReducedMotion(): boolean {
    if (typeof window === 'undefined') return false;
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function isLargeLayout(): boolean {
    return isAboveOrAtBreakpoint('lg');
}

export function hasBlockingUnloadTask({
    imageTasks,
    videoTasks
}: {
    imageTasks: readonly { status: TaskStatus }[];
    videoTasks: readonly { status: VideoGenerationStatus }[];
}): boolean {
    return (
        imageTasks.some((task) => BLOCKING_IMAGE_TASK_STATUSES.has(task.status)) ||
        videoTasks.some((task) => BLOCKING_VIDEO_TASK_STATUSES.has(task.status))
    );
}
