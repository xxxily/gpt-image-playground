const EXACT_ZH_TO_EN: Record<string, string> = {
    '系统配置': 'System Settings',
    '供应商 API 配置': 'Provider API Settings',
    '提示词润色配置': 'Prompt Polishing Settings',
    '管理各供应商的 API Key 与 Base URL。': 'Manage API keys and base URLs for each provider.',
    '管理润色模型、自定义提示词和润色下拉顺序。': 'Manage polishing models, custom prompts, and picker order.',
    '配置 API、模型、运行参数与桌面端选项。': 'Configure APIs, models, runtime behavior, and desktop options.',
    '返回系统配置': 'Back to System Settings',
    '新增供应商端点': 'Add Provider Endpoint',
    '供应商类型': 'Provider Type',
    '供应商名称（可选）': 'Provider name (optional)',
    '添加端点': 'Add Endpoint',
    '运行与存储': 'Runtime and Storage',
    'API 连接模式': 'API Connection Mode',
    '服务器中转': 'Server Proxy',
    '客户端直连': 'Client Direct',
    '并发任务数': 'Concurrent Tasks',
    '提示词历史数量': 'Prompt History Limit',
    '图片存储模式': 'Image Storage Mode',
    '自动检测': 'Auto Detect',
    '文件系统': 'File System',
    '桌面端设置': 'Desktop Settings',
    '云存储同步': 'Cloud Storage Sync',
    '刷新状态': 'Refresh Status',
    '测试 S3 连接': 'Test S3 Connection',
    '清除本地 S3 配置': 'Clear Local S3 Settings',
    '重置所有配置': 'Reset All Settings',
    '配置已保存，立即生效。': 'Settings saved and applied.',
    '生成图片': 'Generate Image',
    '编辑图片': 'Edit Image',
    '图生文': 'Image to Text',
    '开始生成': 'Generate',
    '开始编辑': 'Edit',
    '生成文本': 'Generate Text',
    '提示词': 'Prompt',
    '高级选项': 'Advanced Options',
    '选择供应商': 'Select provider',
    '选择模型': 'Select model',
    '添加源图片': 'Add Source Image',
    '源图片': 'Source Images',
    '保存蒙版': 'Save Mask',
    '蒙版保存成功！': 'Mask saved successfully.',
    '随机': 'Random',
    '历史记录': 'History',
    '生成历史': 'Generation History',
    '清空历史': 'Clear History',
    '删除': 'Delete',
    '下载': 'Download',
    '复制': 'Copy',
    '分享': 'Share',
    '取消': 'Cancel',
    '保存': 'Save',
    '关闭': 'Close',
    '确认': 'Confirm',
    '应用配置': 'App Configuration',
    '提示词历史': 'Prompt History',
    '提示词库': 'Prompt Library',
    '生成历史记录': 'Generation History',
    '历史图片文件': 'History Image Files',
    '自动同步': 'Auto Sync',
    '未配置': 'Not Configured',
    '本地已配置': 'Configured Locally',
    '默认': 'Default',
    '可切换': 'Switchable',
    '当前选择': 'Selected',
    '已开启': 'Enabled',
    '禁用代理': 'Disable Proxy',
    '调试模式': 'Debug Mode',
    '关于 GPT Image Playground': 'About GPT Image Playground',
    '设置密码': 'Set Password',
    '密码': 'Password',
    '保存到本地设置': 'Save to Local Settings',
    '仅本次使用': 'Use This Time Only',
    '保存前请确认来源可信': 'Confirm the Source Before Saving',
    '系统设置': 'System Settings',
    '后台管理': 'Admin',
    '展示内容': 'Promo Content',
    '用户': 'Users',
    '审计日志': 'Audit Logs',
    '退出登录': 'Log Out'
};

const ATTRIBUTE_ZH_TO_EN: Record<string, string> = {
    ...EXACT_ZH_TO_EN,
    'Settings': 'Settings',
    '关于 GPT Image Playground': 'About GPT Image Playground',
    '查看源图片': 'View source image',
    '移除源图片': 'Remove source image',
    '桌面端图片存储路径': 'Desktop image storage path'
};

export function translateLegacyUiString(input: string): string | null {
    const exact = EXACT_ZH_TO_EN[input.trim()];
    if (exact) return preserveOuterWhitespace(input, exact);

    const replacements: Array<[RegExp, string]> = [
        [/^查看源图片\s+(\d+)$/, 'View source image $1'],
        [/^移除源图片\s+(\d+)$/, 'Remove source image $1'],
        [/^最近\s+(\d+)\s+天图片$/, 'Images from the last $1 days'],
        [/^已删除\s+(\d+)\s+个历史条目。$/, 'Deleted $1 history items.'],
        [/^已保存\s+(\d+)\s+张图片到系统下载目录。$/, 'Saved $1 images to the system downloads folder.'],
        [/^历史条目已移除，但\s+(\d+)\s+个本地文件删除失败。$/, 'The history item was removed, but $1 local files failed to delete.']
    ];

    const trimmed = input.trim();
    for (const [pattern, replacement] of replacements) {
        if (pattern.test(trimmed)) {
            return preserveOuterWhitespace(input, trimmed.replace(pattern, replacement));
        }
    }

    return null;
}

export function translateLegacyUiAttribute(input: string): string | null {
    const exact = ATTRIBUTE_ZH_TO_EN[input.trim()];
    return exact ? preserveOuterWhitespace(input, exact) : translateLegacyUiString(input);
}

function preserveOuterWhitespace(original: string, translated: string): string {
    const leading = original.match(/^\s*/)?.[0] ?? '';
    const trailing = original.match(/\s*$/)?.[0] ?? '';
    return `${leading}${translated}${trailing}`;
}
