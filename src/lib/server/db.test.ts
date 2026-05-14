import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { getServerDatabasePath } from '@/lib/server/db';

const originalAdminDatabasePath = process.env.ADMIN_DATABASE_PATH;

describe('server database path resolution', () => {
    afterEach(() => {
        if (typeof originalAdminDatabasePath === 'string') {
            process.env.ADMIN_DATABASE_PATH = originalAdminDatabasePath;
        } else {
            delete process.env.ADMIN_DATABASE_PATH;
        }
    });

    it('expands home-directory database paths from dotenv files', () => {
        process.env.ADMIN_DATABASE_PATH = '~/work/gpt-image-playground/promo-admin.sqlite';

        expect(getServerDatabasePath()).toBe(
            path.join(os.homedir(), 'work', 'gpt-image-playground', 'promo-admin.sqlite')
        );
    });
});
