import { describe, expect, it } from 'vitest';
import type { StorageObjectMetadata, StorageProvider } from '@/lib/sync/storage-provider';

class MemoryStorageProvider implements StorageProvider {
    readonly kind = 's3-compatible';
    readonly displayName = 'Memory S3-compatible provider';

    private readonly objects = new Map<string, { blob: Blob; metadata: StorageObjectMetadata }>();

    async putObject(key: string, blob: Blob, metadata?: StorageObjectMetadata): Promise<void> {
        this.objects.set(key, { blob, metadata: metadata ?? {} });
    }

    async getObject(key: string): Promise<Blob> {
        const object = this.objects.get(key);
        if (!object) throw new Error(`Object not found: ${key}`);
        return object.blob;
    }

    async headObject(key: string): Promise<{ contentLength?: number; metadata?: StorageObjectMetadata } | null> {
        const object = this.objects.get(key);
        if (!object) return null;
        return { contentLength: object.blob.size, metadata: object.metadata };
    }

    async listObjects(prefix: string): Promise<Array<{ key: string; size: number; lastModified: string }>> {
        return Array.from(this.objects.entries())
            .filter(([key]) => key.startsWith(prefix))
            .map(([key, object]) => ({
                key,
                size: object.blob.size,
                lastModified: new Date(1778310000000).toISOString()
            }));
    }

    async deleteObject(key: string): Promise<void> {
        this.objects.delete(key);
    }
}

describe('StorageProvider contract', () => {
    it('describes the minimal object storage operations sync clients depend on', async () => {
        const provider = new MemoryStorageProvider();
        await provider.putObject('root/images/photo.png', new Blob(['image'], { type: 'image/png' }), { sha256: 'abc' });

        await expect(provider.getObject('root/images/photo.png').then((blob) => blob.text())).resolves.toBe('image');
        await expect(provider.headObject('root/images/photo.png')).resolves.toEqual({
            contentLength: 5,
            metadata: { sha256: 'abc' }
        });
        await expect(provider.listObjects('root/')).resolves.toEqual([{
            key: 'root/images/photo.png',
            size: 5,
            lastModified: new Date(1778310000000).toISOString()
        }]);
        await provider.deleteObject('root/images/photo.png');
        await expect(provider.headObject('root/images/photo.png')).resolves.toBeNull();
    });
});
