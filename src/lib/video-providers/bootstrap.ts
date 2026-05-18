import { dashscopeVideoAdapter } from '@/lib/video-providers/dashscope-video-generation';
import { soraVideoAdapter } from '@/lib/video-providers/openai-videos';
import { PLACEHOLDER_VIDEO_ADAPTERS } from '@/lib/video-providers/placeholder-adapters';
import {
    listRegisteredVideoAdapters,
    registerVideoAdapter
} from '@/lib/video-providers/registry';

let bootstrapped = false;

export function bootstrapVideoAdapters(): void {
    if (bootstrapped) return;
    registerVideoAdapter(soraVideoAdapter);
    registerVideoAdapter(dashscopeVideoAdapter);
    for (const adapter of PLACEHOLDER_VIDEO_ADAPTERS) {
        registerVideoAdapter(adapter);
    }
    bootstrapped = true;
}

export function isVideoAdapterBootstrapped(): boolean {
    return bootstrapped;
}

export function resetVideoAdapterBootstrapForTests(): void {
    bootstrapped = false;
}

export function getBootstrappedVideoAdapters() {
    bootstrapVideoAdapters();
    return listRegisteredVideoAdapters();
}
