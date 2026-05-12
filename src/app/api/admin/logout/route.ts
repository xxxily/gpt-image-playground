import { logoutAdmin } from '@/lib/server/auth';

export async function POST(request: Request) {
    return logoutAdmin(request);
}

