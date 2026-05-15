const EXACT_ZH_TO_EN: Record<string, string> = {
    '系统配置': 'System Settings',
    '供应商 API 配置': 'Provider API Settings',
    '提示词润色配置': 'Prompt Polishing Settings',
    '管理图像供应商的 API Key 与 Base URL。': 'Manage image provider API keys and base URLs.',
    '管理各供应商的 API Key 与 Base URL。': 'Manage API keys and base URLs for each provider.',
    '管理润色模型、多个自定义提示词，以及“润色”按钮弹出选项顺序。':
        'Manage polishing models, multiple custom prompts, and the order of options in the Polish picker.',
    '管理润色模型、自定义提示词和润色下拉顺序。': 'Manage polishing models, custom prompts, and picker order.',
    '这里配置提示词润色的所有参数：API 连接、模型、思考模式、默认内置预设、自定义提示词管理以及下拉选择顺序。':
        'Configure every prompt-polishing setting here: API connection, model, thinking mode, default built-in presets, custom prompt management, and picker order.',
    '检测到 .env 中配置了 POLISHING_PROMPT；浏览器下拉不会直接显示 ENV 值，如需常用，请在这里添加为自定义提示词并保存。':
        'POLISHING_PROMPT is configured in .env. The browser picker does not show ENV values directly; if you use it often, add it here as a custom prompt and save it.',
    '配置 API、模型、运行参数与桌面端选项。': 'Configure APIs, models, runtime behavior, and desktop options.',
    '管理图生文专用端点、默认模型和多模态输出参数。这里的配置不会混入图片生成供应商。':
        'Manage image-to-text specific endpoints, default models, and multimodal output parameters. These settings stay separate from image-generation providers.',
    '图生文与多模态': 'Image-to-Text and Multimodal',
    '配置图片理解、提示词反推和多模态文本输出模型。':
        'Configure image understanding, prompt inversion, and multimodal text output models.',
    '返回系统配置': 'Back to System Settings',
    '新增供应商端点': 'Add Provider Endpoint',
    '新增图生文端点': 'Add Image-to-Text Endpoint',
    '供应商类型': 'Provider Type',
    '端点类型': 'Endpoint Type',
    '供应商名称（可选）': 'Provider name (optional)',
    '端点名称（可选）': 'Endpoint name (optional)',
    '添加端点': 'Add Endpoint',
    '填写端点名称、API Key、Base URL 和兼容模式。': 'Fill in the endpoint name, API key, base URL, and compatibility mode.',
    '兼容模式': 'Compatibility Mode',
    '模型 ID（逗号分隔）': 'Model IDs (comma-separated)',
    '复用 OpenAI 图片供应商凭证': 'Reuse OpenAI image provider credentials',
    '默认图生文配置': 'Default Image-to-Text Settings',
    '默认模型': 'Default Model',
    '默认任务类型': 'Default Task Type',
    '默认视觉 detail': 'Default Vision Detail',
    '默认输出格式': 'Default Output Format',
    '默认兼容模式': 'Default Compatibility Mode',
    '最大输出 Token': 'Max Output Tokens',
    '默认流式输出': 'Default Streaming',
    '默认结构化输出': 'Default Structured Output',
    '系统提示词': 'System Prompt',
    '控制默认任务行为和输出。': 'Control default task behavior and output.',
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
    '图生文模型': 'Image-to-Text Model',
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
    '统一模型目录': 'Unified Model Catalog',
    '搜索模型 ID、显示名、端点、厂商或能力': 'Search model ID, display name, endpoint, provider, or capability',
    '展示发现模型、自定义模型和能力覆盖。任务选择器会优先使用这里的能力标注。':
        'Show discovered models, custom models, and capability overrides. Task selectors prefer the capability labels here.',
    '添加模型': 'Add Model',
    '自定义模型能力覆盖': 'Custom Model Capability Overrides',
    '自定义模型 ID 仍可单独覆盖尺寸、能力和供应商参数。':
        'Custom model IDs can still override size, capabilities, and provider parameters.',
    '新增模型请进入上方“供应商 API 配置”刷新或手动添加；这里保留的是模型级别的高级覆盖项。':
        'Add new models from the provider settings above or add them manually; this section keeps model-level advanced overrides.',
    '可为自定义模型覆盖能力、默认尺寸和预设；常用供应商参数会在生成表单中显示，JSON 仅作为新参数临时兜底。':
        'Custom models can override capabilities, default sizes, and presets; common provider parameters appear in the generation form, and JSON is only a temporary fallback for new parameters.',
    '还没有匹配的目录项。刷新模型列表后，发现结果会出现在这里。':
        'No catalog items match yet. Refresh the model list to see discovered results here.',
    '还没有自定义模型。系统预置模型仍会正常显示。':
        'No custom models yet. Built-in models will still appear.',
    '允许自定义尺寸': 'Allow custom size',
    '支持图片编辑': 'Support image editing',
    '支持蒙版': 'Support mask',
    '支持质量参数': 'Support quality parameter',
    '支持输出格式': 'Support output format',
    '支持背景参数': 'Support background parameter',
    '支持审核参数': 'Support moderation parameter',
    '支持压缩率': 'Support compression rate',
    '支持流式预览': 'Support streaming preview',
    '默认尺寸 2K 或 2048x2048': 'Default size 2K or 2048x2048',
    '正方形 2048x2048': 'Square 2048x2048',
    '横向 2560x1440': 'Landscape 2560x1440',
    '纵向 1440x2560': 'Portrait 1440x2560',
    '发现': 'Discovered',
    '自定义': 'Custom',
    '预置': 'Built-in',
    '未分类': 'Unclassified',
    '已启用': 'Enabled',
    '已禁用': 'Disabled',
    '恢复自动': 'Restore Auto',
    '全局自定义': 'Global custom',
    '绑定': 'Bound to',
    '刷新模型': 'Refresh Models',
    '刷新模型列表': 'Refresh Model List',
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
    '请先输入提示词，再进行润色。': 'Please enter a prompt before polishing.',
    '提示词润色失败，请稍后重试。': 'Prompt polishing failed. Please try again later.',
    '正在读取模型列表…': 'Loading model list...',
    '刷新模型列表需要配置 API Key。': 'Refreshing the model list requires an API key.',
    '该供应商暂不支持自动读取模型列表。': 'This provider does not support automatic model discovery yet.',
    '模型列表读取失败。': 'Failed to load the model list.',
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
        [/^(.+)\s+·\s+发现$/, '$1 · Discovered'],
        [/^(.+)\s+·\s+自定义$/, '$1 · Custom'],
        [/^(.+)\s+·\s+预置$/, '$1 · Built-in'],
        [/^(\d+)\s+条目录项$/, '$1 catalog items'],
        [/^(\d+)\s+条自定义$/, '$1 custom'],
        [/^(\d+)\s+已启用$/, '$1 enabled'],
        [/^(\d+)\s+未分类$/, '$1 unclassified'],
        [/^已发现\s+(\d+)\s+个模型。$/, 'Discovered $1 models.'],
        [/^绑定\s+(.+)$/, 'Bound to $1'],
        [/^删除模型\s+(.+)$/, 'Delete model $1'],
        [/^删除图生文端点\s+(.+)$/, 'Delete image-to-text endpoint $1'],
        [/^切换模型\s+(.+)$/, 'Toggle model $1'],
        [/^模型列表 Base URL 不安全：(.+)$/, 'Model list Base URL is unsafe: $1'],
        [/^刷新模型列表需要配置 API Key。$/, 'Refreshing the model list requires an API key.'],
        [/^该供应商暂不支持自动读取模型列表。$/, 'This provider does not support automatic model discovery yet.'],
        [/^模型列表读取失败：HTTP\s*(\d+)$/, 'Failed to load the model list: HTTP $1'],
        [/^模型列表响应解析失败：(.+)$/, 'Failed to parse the model list response: $1'],
        [/^提示词润色失败：模型未返回有效内容。$/, 'Prompt polishing failed: the model returned no valid content.'],
        [/^直连模式润色提示词需要配置 API Key，请在系统配置的“提示词润色”中填写。$/, 'Direct-mode prompt polishing requires an API key. Fill it in under Prompt Polishing in System Settings.'],
        [/^直连模式润色失败：目标地址可能不支持 CORS。原始错误:\s*(.+)$/, 'Direct-mode prompt polishing failed: the target may not support CORS. Original error: $1'],
        [/^直连模式润色失败：(.+)$/, 'Direct-mode prompt polishing failed: $1'],
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
