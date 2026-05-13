import { NextResponse } from 'next/server';

function adminOnlyResponse() {
    return NextResponse.json(
        { error: '分享展示内容只能由管理员在后台创建和维护。请联系管理员获取 promoProfileId。' },
        { status: 410 }
    );
}

export async function POST() {
    return adminOnlyResponse();
}

export async function PUT() {
    return adminOnlyResponse();
}
