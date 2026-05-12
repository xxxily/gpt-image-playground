import { NextRequest } from 'next/server';
import { adminJsonError, assertAdminMutationOrigin } from '@/lib/server/admin-api';
import { logoutAdmin } from '@/lib/server/auth';

export async function POST(request: NextRequest) {
    try {
        assertAdminMutationOrigin(request);
        return logoutAdmin(request);
    } catch (error) {
        return adminJsonError(error);
    }
}
