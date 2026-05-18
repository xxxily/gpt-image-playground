import type { ProviderProtocol } from '@/lib/provider-model-catalog';
import type { VideoProviderAdapter } from '@/lib/video-providers/adapter';

const REGISTRY = new Map<ProviderProtocol, VideoProviderAdapter>();

export function registerVideoAdapter(adapter: VideoProviderAdapter): void {
    REGISTRY.set(adapter.protocol, adapter);
}

export function getVideoAdapter(protocol: ProviderProtocol): VideoProviderAdapter | null {
    return REGISTRY.get(protocol) ?? null;
}

export function listRegisteredVideoAdapters(): VideoProviderAdapter[] {
    return Array.from(REGISTRY.values());
}

export function unregisterVideoAdapter(protocol: ProviderProtocol): void {
    REGISTRY.delete(protocol);
}

export function clearVideoAdapterRegistry(): void {
    REGISTRY.clear();
}
