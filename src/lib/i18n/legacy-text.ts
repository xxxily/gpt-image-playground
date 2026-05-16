const EXACT_ZH_TO_EN: Record<string, string> = {
    系统配置: 'System Settings',
    '供应商 API 配置': 'Provider API Settings',
    提示词润色配置: 'Prompt Polishing Settings',
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
    图生文与多模态: 'Image-to-Text and Multimodal',
    '配置图片理解、提示词反推和多模态文本输出模型。':
        'Configure image understanding, prompt inversion, and multimodal text output models.',
    返回系统配置: 'Back to System Settings',
    设置: 'Settings',
    切换到深色主题: 'Switch to dark theme',
    切换到浅色主题: 'Switch to light theme',
    深色主题: 'Dark theme',
    浅色主题: 'Light theme',
    新增供应商端点: 'Add Provider Endpoint',
    新增图生文端点: 'Add Image-to-Text Endpoint',
    供应商类型: 'Provider Type',
    端点类型: 'Endpoint Type',
    '供应商名称（可选）': 'Provider name (optional)',
    '端点名称（可选）': 'Endpoint name (optional)',
    添加端点: 'Add Endpoint',
    '填写端点名称、API Key、Base URL 和兼容模式。':
        'Fill in the endpoint name, API key, base URL, and compatibility mode.',
    兼容模式: 'Compatibility Mode',
    '模型 ID（逗号分隔）': 'Model IDs (comma-separated)',
    '复用 OpenAI 图片供应商凭证': 'Reuse OpenAI image provider credentials',
    默认图生文配置: 'Default Image-to-Text Settings',
    默认模型: 'Default Model',
    默认任务类型: 'Default Task Type',
    '默认视觉 detail': 'Default Vision Detail',
    默认输出格式: 'Default Output Format',
    默认兼容模式: 'Default Compatibility Mode',
    '最大输出 Token': 'Max Output Tokens',
    默认流式输出: 'Default Streaming',
    默认结构化输出: 'Default Structured Output',
    系统提示词: 'System Prompt',
    '控制默认任务行为和输出。': 'Control default task behavior and output.',
    运行与存储: 'Runtime and Storage',
    'API 连接模式': 'API Connection Mode',
    服务器中转: 'Server Proxy',
    客户端直连: 'Client Direct',
    并发任务数: 'Concurrent Tasks',
    提示词历史数量: 'Prompt History Limit',
    图片存储模式: 'Image Storage Mode',
    自动检测: 'Auto Detect',
    文件系统: 'File System',
    桌面端设置: 'Desktop Settings',
    云存储同步: 'Cloud Storage Sync',
    刷新状态: 'Refresh Status',
    '测试 S3 连接': 'Test S3 Connection',
    '清除本地 S3 配置': 'Clear Local S3 Settings',
    重置所有配置: 'Reset All Settings',
    '配置已保存，立即生效。': 'Settings saved and applied.',
    生成图片: 'Generate Image',
    编辑图片: 'Edit Image',
    图生文: 'Image to Text',
    开始生成: 'Generate',
    开始编辑: 'Edit',
    生成文本: 'Generate Text',
    图生文模型: 'Image-to-Text Model',
    提示词: 'Prompt',
    高级选项: 'Advanced Options',
    选择供应商: 'Select provider',
    选择模型: 'Select model',
    添加源图片: 'Add Source Image',
    源图片: 'Source Images',
    保存蒙版: 'Save Mask',
    '蒙版保存成功！': 'Mask saved successfully.',
    随机: 'Random',
    历史记录: 'History',
    生成历史: 'Generation History',
    清空历史: 'Clear History',
    删除: 'Delete',
    下载: 'Download',
    复制: 'Copy',
    分享: 'Share',
    统一模型目录: 'Unified Model Catalog',
    '搜索模型 ID、显示名、端点、厂商或能力': 'Search model ID, display name, endpoint, provider, or capability',
    '展示发现模型、自定义模型和能力覆盖。任务选择器会优先使用这里的能力标注。':
        'Show discovered models, custom models, and capability overrides. Task selectors prefer the capability labels here.',
    添加模型: 'Add Model',
    自定义模型能力覆盖: 'Custom Model Capability Overrides',
    '自定义模型 ID 仍可单独覆盖尺寸、能力和供应商参数。':
        'Custom model IDs can still override size, capabilities, and provider parameters.',
    '新增模型请进入上方“供应商 API 配置”刷新或手动添加；这里保留的是模型级别的高级覆盖项。':
        'Add new models from the provider settings above or add them manually; this section keeps model-level advanced overrides.',
    '可为自定义模型覆盖能力、默认尺寸和预设；常用供应商参数会在生成表单中显示，JSON 仅作为新参数临时兜底。':
        'Custom models can override capabilities, default sizes, and presets; common provider parameters appear in the generation form, and JSON is only a temporary fallback for new parameters.',
    '还没有匹配的目录项。刷新模型列表后，发现结果会出现在这里。':
        'No catalog items match yet. Refresh the model list to see discovered results here.',
    '还没有自定义模型。系统预置模型仍会正常显示。': 'No custom models yet. Built-in models will still appear.',
    允许自定义尺寸: 'Allow custom size',
    支持图片编辑: 'Support image editing',
    支持蒙版: 'Support mask',
    支持质量参数: 'Support quality parameter',
    支持输出格式: 'Support output format',
    支持背景参数: 'Support background parameter',
    支持审核参数: 'Support moderation parameter',
    支持压缩率: 'Support compression rate',
    支持流式预览: 'Support streaming preview',
    '默认尺寸 2K 或 2048x2048': 'Default size 2K or 2048x2048',
    '正方形 2048x2048': 'Square 2048x2048',
    '横向 2560x1440': 'Landscape 2560x1440',
    '纵向 1440x2560': 'Portrait 1440x2560',
    发现: 'Discovered',
    自定义: 'Custom',
    预置: 'Built-in',
    未分类: 'Unclassified',
    已启用: 'Enabled',
    已禁用: 'Disabled',
    恢复自动: 'Restore Auto',
    全局自定义: 'Global custom',
    绑定: 'Bound to',
    刷新模型: 'Refresh Models',
    刷新模型列表: 'Refresh Model List',
    取消: 'Cancel',
    保存: 'Save',
    关闭: 'Close',
    确认: 'Confirm',
    应用配置: 'App Configuration',
    提示词历史: 'Prompt History',
    提示词库: 'Prompt Library',
    生成历史记录: 'Generation History',
    历史图片文件: 'History Image Files',
    自动同步: 'Auto Sync',
    未配置: 'Not Configured',
    本地已配置: 'Configured Locally',
    默认: 'Default',
    可切换: 'Switchable',
    当前选择: 'Selected',
    已开启: 'Enabled',
    禁用代理: 'Disable Proxy',
    调试模式: 'Debug Mode',
    '关于 GPT Image Playground': 'About GPT Image Playground',
    设置密码: 'Set Password',
    '请先输入提示词，再进行润色。': 'Please enter a prompt before polishing.',
    '提示词润色失败，请稍后重试。': 'Prompt polishing failed. Please try again later.',
    '正在读取模型列表…': 'Loading model list...',
    '刷新模型列表需要配置 API Key。': 'Refreshing the model list requires an API key.',
    '该供应商暂不支持自动读取模型列表。': 'This provider does not support automatic model discovery yet.',
    '模型列表读取失败。': 'Failed to load the model list.',
    密码: 'Password',
    保存到本地设置: 'Save to Local Settings',
    仅本次使用: 'Use This Time Only',
    保存前请确认来源可信: 'Confirm the Source Before Saving',
    系统设置: 'System Settings',
    后台管理: 'Admin',
    展示内容: 'Promo Content',
    用户: 'Users',
    审计日志: 'Audit Logs',
    退出登录: 'Log Out'
};

const EXTENDED_EXACT_ZH_TO_EN: Record<string, string> = {
    ...EXACT_ZH_TO_EN,

    // Prompt template library shell. Template prompt bodies intentionally stay untranslated.
    我的模板: 'My Templates',
    '保存在当前浏览器里的个人模板。': 'Personal templates saved in this browser.',
    '默认模板暂时不可用，仍可使用本地模板。':
        'Default templates are temporarily unavailable. Local templates are still available.',
    用户自定义分类: 'User custom category',
    全部模板: 'All Templates',
    跨分类查找和使用模板: 'Search and use templates across categories',
    '默认模板不可直接修改，保存后会生成一份本地副本。':
        'Default templates cannot be edited directly. Saving creates a local copy.',
    '已置顶该分类。': 'Category pinned.',
    '已取消该分类置顶。': 'Category unpinned.',
    '请填写模板名称和提示词。': 'Enter a template name and prompt.',
    '已更新本地模板。': 'Local template updated.',
    '已保存到当前浏览器。': 'Saved to this browser.',
    '已删除本地模板。': 'Local template deleted.',
    '已导出本地模板。': 'Local templates exported.',
    '导入失败，请检查 JSON 文件。': 'Import failed. Check the JSON file.',
    '读取导入文件失败。': 'Failed to read the import file.',
    打开提示词模板库: 'Open prompt template library',
    提示词模板: 'Prompt Templates',
    提示词模板库: 'Prompt Template Library',
    切换分类面板: 'Toggle category panel',
    分类: 'Categories',
    关闭分类: 'Close categories',
    '搜索名称、分类或提示词…': 'Search name, category, or prompt...',
    搜索模板: 'Search templates',
    添加模板: 'Add Template',
    取消置顶: 'Unpin',
    置顶分类: 'Pin Category',
    查看模板: 'Browse Templates',
    管理本地: 'Manage Local',
    没有匹配的模板: 'No matching templates',
    预设: 'Preset',
    本地: 'Local',
    使用模板: 'Use Template',
    编辑模板: 'Edit Template',
    复制为本地模板: 'Copy as Local Template',
    选择一个模板查看详情: 'Select a template to view details',
    本地模板: 'Local Templates',
    返回查看: 'Back to Browse',
    模板名称: 'Template Name',
    '例如：我的产品海报风格…': 'Example: my product poster style...',
    '例如：风格转换 / 产品图 / 头像…': 'Example: style transfer / product shot / avatar...',
    模板提示词: 'Template Prompt',
    '写入你常用的完整提示词…': 'Enter your frequently used full prompt...',
    清空重填: 'Clear and Refill',
    保存修改: 'Save Changes',
    保存为本地模板: 'Save as Local Template',
    迁移和备份: 'Migration and Backup',
    管理本地模板: 'Manage Local Templates',
    '导入 JSON': 'Import JSON',
    '导出 JSON': 'Export JSON',
    模板: 'Templates',
    本地模板列表: 'Local Template List',
    新增: 'Add',
    还没有本地模板: 'No local templates yet',
    '查看提示词模板详情并选择是否使用。': 'View prompt template details and choose whether to use it.',
    风格转换: 'Style Transfer',
    电商商品图: 'E-commerce Product Images',
    社交媒体内容: 'Social Media Content',
    品牌营销: 'Brand Marketing',
    餐饮美食: 'Food and Dining',
    时尚美妆: 'Fashion and Beauty',
    地产空间: 'Real Estate and Interiors',
    教育培训: 'Education and Training',
    游戏概念: 'Game Concepts',
    科技产品: 'Tech Products',
    旅行文旅: 'Travel and Tourism',
    健康生活: 'Health and Lifestyle',
    头像人像: 'Avatars and Portraits',
    商务办公: 'Business and Office',
    节日季节: 'Holidays and Seasons',
    纹理背景: 'Textures and Backgrounds',

    // Main generation and prompt controls.
    '通过文本提示词创建新图片。': 'Create new images from a text prompt.',
    '例如，一位在太空中漂浮的宇航员，写实风格': 'Example: a photorealistic astronaut floating in space',
    启用流式预览: 'Enable Streaming Preview',
    '仅在生成单张图片（n=1）时支持流式预览。': 'Streaming preview is supported only when generating one image (n=1).',
    '在图片生成过程中展示预览，提供更交互式的体验。':
        'Show previews during image generation for a more interactive experience.',
    '图片数量:': 'Image Count:',
    '压缩率:': 'Compression:',
    尺寸: 'Size',
    纵向: 'Portrait',
    横向: 'Landscape',
    正方形: 'Square',
    '宽度 (px)': 'Width (px)',
    '高度 (px)': 'Height (px)',
    '像素 (': 'pixels (',
    '% 最大值) ·': '% max) ·',
    '限制: 16 的倍数，边长最大 3840px，宽高比 ≤ 3:1，总像素 655,360 至 8,294,400。':
        'Limits: multiples of 16, max side 3840px, aspect ratio <= 3:1, total pixels from 655,360 to 8,294,400.',
    质量: 'Quality',
    低: 'Low',
    中: 'Medium',
    高: 'High',
    背景: 'Background',
    不透明: 'Opaque',
    透明: 'Transparent',
    内容审核: 'Moderation',
    清晰度: 'Clarity',
    比例: 'Ratio',
    分辨率: 'Resolution',
    模型默认: 'Model Default',
    'Ctrl/⌘ + Enter 提交': 'Ctrl/⌘ + Enter to submit',
    '可选：描述你希望模型从图片中提取什么，或要求反推文生图提示词':
        'Optional: describe what to extract from the image, or ask for an image prompt inversion',
    '例如，给主体人物添加一顶派对帽，或输入 / 搜索提示词模板':
        'Example: add a party hat to the main subject, or type / to search prompt templates',
    '例如，一位在太空中漂浮的宇航员，写实风格，或输入 / 搜索提示词模板':
        'Example: a photorealistic astronaut floating in space, or type / to search prompt templates',
    提示词快捷操作: 'Prompt quick actions',
    清空提示词和源图片: 'Clear prompt and source images',
    清空: 'Clear',
    正在润色提示词: 'Polishing prompt',
    打开润色预设选择器: 'Open polish preset picker',
    润色提示词: 'Polish Prompt',
    润色中: 'Polishing',
    润色: 'Polish',
    退出图生文模式: 'Exit image-to-text mode',
    切换到图生文模式: 'Switch to image-to-text mode',
    '从源图片生成文本、说明或提示词': 'Generate text, descriptions, or prompts from source images',
    添加源图片后可用: 'Available after adding source images',
    搜索提示词模板: 'Search prompt templates',
    打开提示词历史: 'Open prompt history',
    历史: 'History',
    打开高级选项: 'Open advanced options',
    高级: 'Advanced',
    '自定义参数无效，请打开高级选项修改后再提交。':
        'Custom parameters are invalid. Open Advanced Options and fix them before submitting.',
    '搜索最近使用的提示词…': 'Search recently used prompts...',
    搜索提示词历史: 'Search prompt history',
    删除这条提示词历史: 'Delete this prompt history item',
    删除这条历史: 'Delete this history item',
    '提交一次提示词后，这里会显示最近使用记录。': 'Recently used prompts appear here after you submit one.',
    '条，可在系统设置修改。': 'items. You can change this in System Settings.',
    最多保留: 'Keep up to',
    清空历史: 'Clear History',
    提示词模板快捷命令: 'Prompt template quick command',
    '输入 / 搜索模板，↑↓ 选择，Enter 快速填入，Esc 关闭':
        'Type / to search templates, use up/down to select, Enter to insert, Esc to close',
    '没有匹配的模板，继续输入可直接作为提示词。':
        'No matching templates. Continue typing to use it directly as the prompt.',
    润色预设选择: 'Polish Preset Selection',
    '搜索润色预设…': 'Search polish presets...',
    搜索润色预设: 'Search polish presets',
    '没有匹配的润色预设。': 'No matching polish presets.',
    内置: 'Built-in',
    临时: 'Temporary',
    临时自定义: 'Temporary Custom',
    临时自定义润色提示词: 'Temporary Custom Polish Prompt',
    临时自定义润色系统提示词: 'Temporary Custom Polish System Prompt',
    '仅本次润色生效，不会保存': 'Applies only to this polish run and will not be saved',
    '仅本次润色使用，不会保存或覆盖系统设置。':
        'Used only for this polish run. It will not be saved or overwrite system settings.',
    返回预设: 'Back to Presets',
    '输入本次润色的系统提示词…': 'Enter the system prompt for this polish run...',
    自定义润色系统提示词: 'Custom polish system prompt',
    '使用临时自定义提示词润色，仅本次生效': 'Polish with a temporary custom prompt for this run only',
    '源图片 (最多': 'Source Images (up to',
    '张)': 'images)',
    继续添加: 'Add More',
    添加原图: 'Add Source',
    已达上限: 'Limit Reached',
    '配置供应商、模型与图片生成参数。': 'Configure provider, model, and image-generation parameters.',
    图生文供应商: 'Image-to-Text Provider',
    '源图片会作为多模态输入发送；提示词可留空，系统会按当前任务类型使用默认分析指令。':
        'Source images are sent as multimodal input. The prompt can be empty; the system will use default analysis instructions for the current task type.',
    任务类型: 'Task Type',
    '视觉 detail': 'Vision Detail',
    自然语言文本: 'Natural Language Text',
    '结构化 JSON': 'Structured JSON',
    流式输出: 'Streaming Output',
    完成后解析结构化字段: 'Parse structured fields after completion',
    供应商: 'Provider',
    当前使用: 'Currently using',
    '的 API Key/Base URL；高级参数仍按': 'API Key/Base URL; advanced parameters are still shown by',
    '能力显示。': 'capabilities.',
    'gpt-image-2 始终以高保真度处理参考图片。这提升了编辑质量，但每次请求消耗的图片输入 token 比 gpt-image-1.5 默认保真度更多。':
        'gpt-image-2 always processes reference images at high fidelity. This improves edit quality but uses more image input tokens per request than the default fidelity of gpt-image-1.5.',
    'gpt-image-2 支持更灵活的生成尺寸与质量控制。':
        'gpt-image-2 supports more flexible generation size and quality controls.',
    蒙版: 'Mask',
    关闭蒙版编辑器: 'Close Mask Editor',
    编辑已保存蒙版: 'Edit Saved Mask',
    创建蒙版: 'Create Mask',
    '(已保存)': '(Saved)',
    '在下方图片上绘制，标记需要编辑的区域 (绘制区域在蒙版中变为透明)。':
        'Draw on the image below to mark the area to edit. Drawn areas become transparent in the mask.',
    '笔刷大小:': 'Brush Size:',
    上传蒙版: 'Upload Mask',
    清除: 'Clear',
    '蒙版预览:': 'Mask Preview:',
    '蒙版生成中…': 'Generating mask...',
    '已应用蒙版:': 'Applied mask:',
    '模型默认 · Gemini 自动选择': 'Model default · Gemini auto select',
    'Gemini 尺寸按官方 3.1 Flash Image Preview 表分组，支持 512、1K、2K、4K 和文档列出的全部比例。':
        'Gemini sizes are grouped by the official 3.1 Flash Image Preview table, with 512, 1K, 2K, 4K, and all documented ratios.',
    'SenseNova 尺寸按 2K 清晰度与比例分组；水印、response_format、背景和审核等 OpenAI 参数不会发送。':
        'SenseNova sizes are grouped by 2K clarity and ratio. OpenAI parameters such as watermark, response_format, background, and moderation are not sent.',
    'Seedream 尺寸已按模型支持的清晰度和比例分组；auto 表示让模型使用默认尺寸策略。':
        'Seedream sizes are grouped by model-supported clarity and ratio. auto lets the model use its default size strategy.',
    响应格式: 'Response Format',
    水印: 'Watermark',
    开启: 'On',
    序列生成: 'Sequential Generation',
    自动组图: 'Auto Image Set',
    '最大图片数:': 'Max Images:',
    提示词优化: 'Prompt Optimization',
    标准: 'Standard',
    快速: 'Fast',
    联网搜索: 'Web Search',
    '自定义参数 JSON': 'Custom Parameters JSON',
    '例如：{\n  "vendor_experimental_flag": true,\n  "new_parameter_from_docs": "value"\n}':
        'Example:\n{\n  "vendor_experimental_flag": true,\n  "new_parameter_from_docs": "value"\n}',
    '例如：{ "vendor_experimental_flag": true, "new_parameter_from_docs": "value" }':
        'Example: { "vendor_experimental_flag": true, "new_parameter_from_docs": "value" }',
    '仅用于供应商新加、低频或尚未做成控件的参数；常用参数请优先使用上方一等控件。同名字段会覆盖表单生成的参数，适合作为临时兜底。':
        'Use only for new, rare, or not-yet-modeled provider parameters. Prefer the controls above for common parameters. Duplicate fields override form-generated parameters as a temporary fallback.',
    '请稍候…': 'Please wait...',
    '提交前请先保存已绘制的遮罩。': 'Save the drawn mask before submitting.',
    '遮罩文件格式无效，请上传 PNG 文件。': 'Invalid mask file format. Upload a PNG file.',
    '无法读取上传的遮罩图片尺寸。': 'Unable to read the uploaded mask image size.',

    // Image-to-text result and history.
    图生文结果: 'Image-to-Text Result',
    '生成文本中...': 'Generating text...',
    '图生文结果将显示在这里。': 'Image-to-text results will appear here.',
    简述: 'Summary',
    负向提示词: 'Negative Prompt',
    替换: 'Replace',
    追加: 'Append',
    发送到生成器: 'Send to Generator',
    无文本结果: 'No text result',
    源图待恢复: 'Source image pending restore',
    未知模型: 'Unknown model',
    生成器: 'Generator',
    已同步: 'Synced',
    图生文历史详情: 'Image-to-Text History Details',
    '查看源图和图生文结果。': 'View source images and image-to-text result.',
    源图: 'Source Image',
    创建时间: 'Created At',
    '耗时 / 源图': 'Duration / Source Images',
    精度: 'Detail',
    用户指导词: 'User Instructions',
    完整结果: 'Full Result',
    主提示词: 'Main Prompt',
    风格标签: 'Style Tags',
    主体: 'Subject',
    构图: 'Composition',
    光照: 'Lighting',
    色彩: 'Colors',
    材质: 'Materials',
    文字识别: 'Text Recognition',
    画幅建议: 'Aspect Ratio Suggestion',
    生成注意事项: 'Generation Notes',
    风险提示: 'Warnings',
    复制全文: 'Copy Full Text',
    复制主提示词: 'Copy Main Prompt',
    替换提示词: 'Replace Prompt',
    追加提示词: 'Append Prompt',
    恢复到图生文: 'Restore to Image-to-Text',
    提示词反推: 'Prompt Extraction',
    图片描述: 'Image Description',
    设计规范: 'Design Specification',
    'OCR 与版式': 'OCR and Layout',
    自由问答: 'Freeform QA',
    '反推可直接用于文生图的提示词。': 'Extract a prompt directly usable for text-to-image.',
    '输出客观、简洁的图片说明。': 'Output an objective, concise image description.',
    '提炼 UI、海报或视觉设计规范。': 'Extract UI, poster, or visual design specifications.',
    '优先识别文字，并保留版式结构。': 'Prioritize text recognition and preserve layout structure.',
    '根据图片回答用户的具体问题。': 'Answer the user-specific question based on the image.',
    原图: 'Original',

    // Generation history, queue, zoom, and output panels.
    历史类型: 'History Type',
    图片: 'Images',
    '总计: $': 'Total: $',
    成本总计: 'Cost Total',
    '历史中所有已生成图片的总费用估算。': 'Estimated total cost for all generated images in history.',
    '生成图片总数:': 'Total Generated Images:',
    '每张图片平均费用:': 'Average Cost per Image:',
    '估算总费用:': 'Estimated Total Cost:',
    退出多选: 'Exit Multi-select',
    多选: 'Multi-select',
    清除已选: 'Clear Selection',
    全选: 'Select All',
    'S3 同步操作': 'S3 Sync Actions',
    同步配置: 'Sync Settings',
    历史图片: 'history images',
    图生文历史: 'image-to-text history',
    同步最近: 'Sync Recent',
    强制同步: 'Force Sync',
    '从 S3 恢复': 'Restore from S3',
    恢复配置: 'Restore Settings',
    恢复最近: 'Restore Recent',
    强制恢复: 'Force Restore',
    同步中: 'Syncing',
    收起详情: 'Collapse Details',
    展开详情: 'Expand Details',
    失败: 'Failed',
    跳过: 'Skipped',
    '目标:': 'Target:',
    '前缀:': 'Prefix:',
    '快照:': 'Snapshot:',
    '快照时间:': 'Snapshot Time:',
    成功: 'Succeeded',
    详细信息: 'Details',
    '生成的图片将显示在这里。': 'Generated images will appear here.',
    编辑: 'Edit',
    生成: 'Generate',
    '示例 ·': 'Example ·',
    已同步到云存储: 'Synced to cloud storage',
    '未同步，点击上传到云存储': 'Not synced. Click to upload to cloud storage.',
    同步此历史图片到云存储: 'Sync this history image to cloud storage',
    成本明细: 'Cost Details',
    '此图片生成的费用明细。': 'Cost details for this generated image.',
    '定价:': 'Pricing:',
    '文本输入 Token:': 'Text Input Tokens:',
    '图片输入 Token:': 'Image Input Tokens:',
    '图片输出 Token:': 'Image Output Tokens:',
    '总计:': 'Total:',
    内置示例: 'Built-in Example',
    图片总大小: 'Total Image Size',
    文件大小: 'File Size',
    索引: 'IndexedDB',
    审核: 'Moderation',
    下载此图片: 'Download this image',
    查看提示词: 'View Prompt',
    '生成此图片使用的完整提示词。': 'Full prompt used to generate this image.',
    提示词为空: 'Prompt is empty',
    删除此示例: 'Delete this example',
    删除此历史条目: 'Delete this history item',
    确认删除: 'Confirm Deletion',
    不再询问: 'Do not ask again',
    同时删除远端图片: 'Also delete remote images',
    '选择需要处理的最近时间范围。': 'Choose the recent time range to process.',
    时间单位: 'Time Unit',
    按天: 'By Days',
    按小时: 'By Hours',
    最近小时数: 'Recent Hours',
    最近天数: 'Recent Days',
    '请输入大于 0 的整数。': 'Enter an integer greater than 0.',
    继续恢复: 'Continue Restore',
    继续同步: 'Continue Sync',
    '流式预览中...': 'Streaming preview...',
    '编辑图片中...': 'Editing image...',
    '生成图片中...': 'Generating image...',
    '图片显示异常。': 'Image display failed.',
    查看图片: 'View Image',
    缩放控制: 'Zoom Controls',
    关闭: 'Close',
    上一张预览图: 'Previous preview image',
    下一张预览图: 'Next preview image',
    完整尺寸预览图: 'Full-size preview image',
    大图加载失败: 'Failed to load full-size image',
    '源图片预览地址可能已失效，请重新添加这张图片后再查看。':
        'The source image preview URL may have expired. Add this image again before viewing.',
    '加载中...': 'Loading...',
    缩小视图: 'Zoom Out',
    放大视图: 'Zoom In',
    重置缩放: 'Reset Zoom',
    重置: 'Reset',
    发送当前预览图片到编辑: 'Send current preview image to edit',
    '提交生成任务后，结果将显示在这里。': 'Submit a generation task and results will appear here.',
    历史预览: 'History Preview',
    全部完成: 'All Done',
    '· 共': '· Total',
    个: 'items',
    清空已完成: 'Clear Completed',
    '（无提示词）': '(No prompt)',
    排队中: 'Queued',
    重试: 'Retry',
    '排队中 — 等待空闲...': 'Queued - waiting for an available slot...',
    '流式生成中...': 'Streaming generation...',
    '正在处理...': 'Processing...',
    完成: 'Done',
    发送到编辑: 'Send to Edit',
    '尝试次数:': 'Attempts:',
    '任务队列 (': 'Task Queue (',
    '等待中...': 'Waiting...',
    出错: 'Error',
    流式文本: 'Streaming text',
    流式生成: 'Streaming generation',
    处理中: 'Processing',
    消息提示: 'Notifications',
    关闭通知: 'Dismiss notification',

    // Sharing, secure share, and shared config dialogs.
    已配置: 'Configured',
    '两次输入的解密密码不一致。': 'The two decryption passwords do not match.',
    配置和历史: 'Settings and history',
    全部历史图片: 'All history images',
    '默认只保存云存储配置，不自动拉取快照。':
        'By default, only cloud storage settings are saved and snapshots are not restored automatically.',
    保存后自动恢复: 'Auto-restore after saving',
    接收者手动确认后恢复: 'Restore after recipient confirmation',
    供应商端点: 'Provider endpoint',
    分享展示内容: 'Shared Promo Content',
    'API 地址': 'API URL',
    仅临时使用: 'Temporary use only',
    自动生成: 'Autostart',
    云存储同步配置: 'Cloud Storage Sync Settings',
    同步恢复策略: 'Sync Restore Strategy',
    密码加密: 'Password Encryption',
    自带解密密码: 'Includes Decryption Password',
    '加密分享链接生成失败。': 'Failed to generate encrypted share link.',
    分享当前提示词和配置: 'Share current prompt and settings',
    分享当前配置: 'Share Current Settings',
    '选择要写入链接的内容。接收者打开后会自动填入这些参数，页面随后会清理 URL，避免继续误分享。':
        'Choose what to write into the link. Recipients will have these parameters filled automatically, then the page will clean the URL to avoid accidental resharing.',
    请只分享你明确选择的内容: 'Share only what you explicitly select',
    '普通分享会把所选参数写入 URL；启用密码加密后，链接只显示一个 sdata 参数。API Key 默认不会包含。':
        'Normal sharing writes selected parameters into the URL. With password encryption, the link exposes only an sdata parameter. API keys are not included by default.',
    '当前提示词为空；仍可只分享配置。': 'The current prompt is empty. You can still share settings only.',
    '模型 ID': 'Model ID',
    '当前模型为空，将不会写入链接。': 'The current model is empty and will not be written into the link.',
    '需要同时分享模型 ID，才能准确恢复当前供应商端点。':
        'Share the model ID as well to restore the current provider endpoint accurately.',
    '适合分享第三方兼容端点；私有或内网地址对别人可能不可用。':
        'Useful for sharing third-party compatible endpoints. Private or intranet URLs may not work for others.',
    '当前没有可分享的 http/https API 地址。': 'There is no shareable http/https API URL.',
    打开后自动生成: 'Generate automatically after opening',
    '接收者打开链接后会立即提交一次生成请求，可能产生 API 费用。':
        'Recipients will submit a generation request immediately after opening the link, which may incur API costs.',
    '必须同时分享非空提示词，才能启用自动生成。': 'A non-empty prompt must also be shared to enable autostart.',
    '展示 Profile ID': 'Promo Profile ID',
    '由管理员创建分享展示组后提供，会写入分享链接用于加载已审核的分享内容。':
        'Provided after an admin creates a shared promo group. It is written into the share link to load approved shared content.',
    当前页面: 'Current Page',
    留空则不携带分享内容: 'Leave empty to omit shared promo content',
    '当前没有可分享的 API Key。': 'There is no shareable API key.',
    '我理解这个链接会包含明文 API Key': 'I understand this link will include a plaintext API key',
    '任何拿到链接的人都可能看到并使用它。未确认前不会复制包含 API Key 的链接。':
        'Anyone with the link may see and use it. Links containing API keys cannot be copied until you confirm.',
    只允许临时使用: 'Allow Temporary Use Only',
    '接收者打开后会直接临时套用，不会弹出保存到本地还是仅本次使用的确认框。':
        'Recipients will apply it temporarily without seeing the save-vs-temporary confirmation.',
    '包含 S3 Endpoint、Bucket、Access Key、Secret、根前缀和 Profile。接收者可保存后从最新快照恢复配置与历史图片。':
        'Includes S3 Endpoint, Bucket, Access Key, Secret, root prefix, and Profile. Recipients can save it and restore settings and history images from the latest snapshot.',
    '当前浏览器还没有完整的 S3 兼容对象存储配置；请先在系统设置里保存云存储同步。':
        'This browser does not have a complete S3-compatible object storage setup yet. Save cloud storage sync in System Settings first.',
    远端路径: 'Remote Path',
    保存云存储配置后自动恢复: 'Auto-restore after saving cloud storage settings',
    '默认关闭。关闭时，接收者只会看到按需恢复按钮，不会打开链接就开始下载。':
        'Off by default. When off, recipients only see manual restore buttons and downloads do not start on link open.',
    恢复配置和历史记录: 'Restore Settings and History',
    '包含应用设置、提示词历史、提示词模板和图片历史元数据，不会下载图片文件。':
        'Includes app settings, prompt history, prompt templates, and image history metadata. Image files are not downloaded.',
    历史图片文件: 'History Image Files',
    不恢复图片: 'Do Not Restore Images',
    最近图片: 'Recent Images',
    全部图片: 'All Images',
    最近图片恢复范围数值: 'Recent image restore range value',
    小时: 'Hours',
    天: 'Days',
    '全量恢复会扫描并下载远端快照里的全部历史图片。历史较多时可能耗时很久、占用大量带宽和浏览器 IndexedDB 空间。':
        'Full restore scans and downloads all history images in the remote snapshot. Large histories may take a long time and consume significant bandwidth and browser IndexedDB space.',
    '我理解全量恢复可能非常耗时、耗带宽，并可能写入大量本地图片数据。':
        'I understand full restore may take a long time, use bandwidth, and write many local image files.',
    我理解这个链接会包含云存储访问凭据: 'I understand this link will include cloud storage credentials',
    '勾选后会自动启用密码加密，并默认复制带解密密码的链接，方便你在新设备上一键保存并按需同步。请只发给自己的设备或可信接收者。':
        'Checking this automatically enables password encryption and copies a link with the decryption password by default, making it easy to save and sync on a new device. Send it only to your own devices or trusted recipients.',
    使用密码加密整个分享链接: 'Encrypt the entire share link with a password',
    '启用后，链接只会暴露一个 sdata 参数；可以选择另行发送密码，或复制一个自带解密密码的完整链接。':
        'When enabled, the link exposes only an sdata parameter. You can send the password separately or copy a full link that includes it.',
    解密密码: 'Decryption Password',
    再输入一次: 'Enter Again',
    确认解密密码: 'Confirm decryption password',
    隐藏解密密码: 'Hide decryption password',
    显示解密密码: 'Show decryption password',
    隐藏确认密码: 'Hide confirmation password',
    显示确认密码: 'Show confirmation password',
    复制时附带解密密码: 'Include decryption password when copying',
    '复制出来的完整链接会使用 #key= 携带密码，接收者打开后自动解密，不需要再手动输入。方便转发，但拿到完整链接的人也等同拿到了密码。':
        'The copied full link carries the password in #key=. Recipients can decrypt automatically without entering it manually. This is convenient to forward, but anyone with the full link also has the password.',
    '未勾选时，密码不会写进链接，也不会保存；请通过另一条消息或可信渠道告诉接收者。简单密码可以继续使用，但更容易被猜到。':
        'When unchecked, the password is not written into the link or saved. Tell the recipient through another message or trusted channel. Simple passwords can still be used but are easier to guess.',
    '这只是安全提醒，不会阻止你复制分享链接。': 'This is only a security reminder and will not block copying.',
    生成的分享链接: 'Generated Share Link',
    '未选择参数；当前只是应用入口链接。': 'No parameters selected. This is only the app entry link.',
    '复制时会生成加密后的链接。': 'An encrypted link will be generated when copying.',
    字符: 'characters',
    分享链接已复制: 'Share link copied',
    复制分享链接: 'Copy Share Link',
    复制链接: 'Copy Link',
    '需要先确认 API Key 风险，才能复制包含 Key 的链接。':
        'Confirm the API key risk before copying a link that includes a key.',
    '需要先确认云存储凭据风险，才能复制同步配置链接。':
        'Confirm the cloud storage credential risk before copying the sync settings link.',
    '全量图片恢复需要先确认耗时、带宽和本地空间风险。':
        'Confirm the time, bandwidth, and local storage risks before full image restore.',
    '复制失败，请手动选择链接复制。': 'Copy failed. Select the link manually to copy it.',
    '正在用密码加密分享参数…': 'Encrypting share parameters with password...',
    '链接较长，部分聊天工具可能会截断。': 'The link is long and some chat apps may truncate it.',
    重置选择: 'Reset Selection',
    '正在加密…': 'Encrypting...',
    解密分享链接: 'Decrypt Share Link',
    '这个链接使用密码加密了提示词、模型和可选 API 配置。请输入分享者通过其他渠道给你的密码，解密成功后才会应用这些参数。':
        'This link encrypts the prompt, model, and optional API settings with a password. Enter the password the sender gave you through another channel before these parameters are applied.',
    '密码不会保存到浏览器。加密只保护链接中的参数；如果链接包含 API Key，解密后仍请谨慎使用。':
        'The password is not saved in the browser. Encryption protects only the parameters in the link. If the link contains an API key, use it carefully after decryption.',
    '如果分享者就是这样设置的密码，可以继续解密。':
        'If the sender intentionally used this password, you can continue decrypting.',
    暂不解密: 'Not Now',
    '正在解密…': 'Decrypting...',
    解密并应用: 'Decrypt and Apply',
    '这个分享链接包含 API 配置': 'This share link contains API settings',
    保存前请确认来源可信: 'Confirm the source is trusted before saving',
    '选择“保存到本地设置”会把这些值写入浏览器 localStorage，同一浏览器之后都会优先使用它们。共享设备或不可信链接建议选择“仅本次使用”。':
        'Choosing "Save to Local Settings" writes these values to browser localStorage, and this browser will prefer them later. On shared devices or untrusted links, choose "Use This Time Only".',
    临时使用也会自动适配连接方式: 'Temporary use also adapts the connection mode',
    '如果这个 API 地址是第三方服务，且当前部署禁止服务器中转，选择“仅本次使用”时也会在本页面临时切到客户端直连，不需要再去系统配置保存一次。':
        'If this API URL is a third-party service and this deployment forbids server proxying, "Use This Time Only" temporarily switches this page to client-direct mode without saving it in System Settings.',
    忽略这些配置: 'Ignore These Settings',
    这个分享链接包含云存储同步配置: 'This share link contains cloud storage sync settings',
    '保存后，当前设备就能访问同一个 S3 兼容对象存储。是否恢复配置、历史和图片由你按需确认，不会默认全量下载。':
        'After saving, this device can access the same S3-compatible object storage. You choose whether to restore settings, history, and images; full download is not automatic by default.',
    配置和历史记录: 'Settings and History',
    '不恢复配置、历史或图片': 'Do not restore settings, history, or images',
    保存并全量恢复: 'Save and Full Restore',
    保存并按分享设置恢复: 'Save and Restore as Shared',
    访问凭据: 'Access Credentials',
    '分享配置允许同步删除远端图片；请确认这是你自己的空间。':
        'The shared settings allow syncing remote image deletion. Confirm this is your own storage.',
    '未开启，普通同步不需要 DeleteObject 权限。': 'Not enabled. Normal sync does not require DeleteObject permission.',
    分享者设置的恢复策略: 'Restore Strategy Set by Sender',
    '分享者设置了打开后自动恢复；链接解密后会保存配置并按这个策略执行。':
        'The sender enabled auto-restore on open. After decrypting, settings are saved and this strategy is run.',
    '默认不自动恢复。保存配置后，你也可以之后在历史面板手动同步。':
        'Auto-restore is off by default. After saving settings, you can sync manually from the history panel later.',
    全量图片恢复可能很慢: 'Full image restore may be slow',
    '远端历史图片较多时，全量恢复会消耗大量时间、网络流量和本地浏览器存储空间。建议只在新设备初始化时使用。':
        'If there are many remote history images, full restore can consume significant time, network traffic, and local browser storage. Use it mainly when initializing a new device.',
    保存前请确认这是你自己的同步空间: 'Confirm this is your own sync storage before saving',
    '选择保存会把对象存储凭据写入浏览器 localStorage。“保存并同步”会立即读取远端最新快照，并覆盖本地同步到的配置和历史记录。':
        'Saving writes object storage credentials to browser localStorage. "Save and sync" immediately reads the latest remote snapshot and overwrites locally synced settings and history.',
    忽略同步配置: 'Ignore Sync Settings',
    仅保存配置: 'Save Settings Only',

    // Settings panels and advanced configuration.
    '模型、接口、存储方式等非敏感设置。': 'Non-sensitive settings such as models, endpoints, and storage mode.',
    自定义润色提示词: 'Custom Polish Prompts',
    '润色系统提示词、预设和自定义润色提示词。': 'Polish system prompts, presets, and custom polish prompts.',
    '输入过的提示词记录。': 'Previously entered prompt records.',
    '用户自定义提示词模板。': 'User-defined prompt templates.',
    '历史条目、提示词、参数和图片文件名。': 'History entries, prompts, parameters, and image filenames.',
    '只上传新增或变化的历史图片文件。': 'Upload only new or changed history image files.',
    图生文历史记录: 'Image-to-Text History',
    '图生文结果、参数和源图文件名。': 'Image-to-text results, parameters, and source image filenames.',
    图生文源图文件: 'Image-to-Text Source Image Files',
    '只上传新增或变化的图生文源图。': 'Upload only new or changed image-to-text source images.',
    'OpenAI 兼容': 'OpenAI Compatible',
    'Anthropic 兼容': 'Anthropic Compatible',
    '发送 thinking.type 与 reasoning_effort。': 'Send thinking.type and reasoning_effort.',
    '发送 thinking.type 与 output_config.effort。': 'Send thinking.type and output_config.effort.',
    '同时发送三种字段，适合明确支持混合参数的中转。':
        'Send all three fields, suitable for relays that explicitly support mixed parameters.',
    全部能力: 'All Capabilities',
    文生图: 'Text to Image',
    图生图: 'Image to Image',
    蒙版编辑: 'Mask Editing',
    文本生成: 'Text Generation',
    推理文本: 'Reasoning Text',
    文生视频: 'Text to Video',
    图生视频: 'Image to Video',
    语音合成: 'Speech Synthesis',
    语音转写: 'Speech Transcription',
    向量嵌入: 'Embeddings',
    全部来源: 'All Sources',
    发现模型: 'Discovered Models',
    预置模型: 'Built-in Models',
    全部状态: 'All Statuses',
    '隐藏 API Key': 'Hide API Key',
    '显示 API Key': 'Show API Key',
    '当前浏览器尚未配置 S3 兼容对象存储。': 'This browser has no S3-compatible object storage configured.',
    '官方 OpenAI 或 OpenAI 兼容端点。': 'Official OpenAI or OpenAI-compatible endpoint.',
    '.env 中已配置，当前为空时使用 ENV 值。': '.env is configured and will be used when this field is empty.',
    'Gemini 图像模型接口配置。': 'Gemini image model API settings.',
    '.env 中已配置 GEMINI_API_KEY，当前为空时使用 ENV 值。':
        'GEMINI_API_KEY is configured in .env and will be used when this field is empty.',
    '用于 Google Gemini 图像模型。': 'Used for Google Gemini image models.',
    'Seedream / 火山方舟': 'Seedream / Volcano Ark',
    '豆包 Seedream 文生图、图生图和组图接口。': 'Doubao Seedream text-to-image, image-to-image, and image set API.',
    '.env 中已配置 SEEDREAM_API_KEY，当前为空时使用 ENV 值。':
        'SEEDREAM_API_KEY is configured in .env and will be used when this field is empty.',
    '支持 Seedream 默认图片生成接口；高级参数在生成表单中配置。':
        'Supports the default Seedream image generation API. Advanced parameters are configured in the generation form.',
    '商汤 SenseNova U1 Fast 图像生成接口。': 'SenseTime SenseNova U1 Fast image generation API.',
    '.env 中已配置 SENSENOVA_API_KEY，当前为空时使用 ENV 值。':
        'SENSENOVA_API_KEY is configured in .env and will be used when this field is empty.',
    '内置模型 sensenova-u1-fast 默认使用独立图片生成接口。':
        'The built-in sensenova-u1-fast model uses the dedicated image generation endpoint by default.',
    '当前浏览器尚未配置完整的 S3 兼容对象存储信息。':
        'This browser does not have complete S3-compatible object storage information configured.',
    'S3 状态获取失败。': 'Failed to get S3 status.',
    '请先填写 Endpoint、Bucket、Access Key ID 和 Secret Access Key。':
        'Fill in Endpoint, Bucket, Access Key ID, and Secret Access Key first.',
    'S3 连接测试成功。': 'S3 connection test succeeded.',
    连接失败: 'Connection failed',
    'S3 连接测试失败。': 'S3 connection test failed.',
    '请输入代理地址，例如 127.0.0.1:7890 或 socks5://127.0.0.1:1080':
        'Enter a proxy address, for example 127.0.0.1:7890 or socks5://127.0.0.1:1080',
    '代理 URL 必须是有效的 http、https、socks5 或 socks5h 地址':
        'Proxy URL must be a valid http, https, socks5, or socks5h address',
    '请输入展示服务域名，例如 https://content.example.com':
        'Enter a promo service origin, for example https://content.example.com',
    '请输入完整展示接口地址，例如 https://content.example.com/api/promo/placements':
        'Enter the full promo API URL, for example https://content.example.com/api/promo/placements',
    '展示服务域名必须是有效的 http 或 https 地址': 'Promo service origin must be a valid http or https URL',
    '展示接口地址必须是有效的 http 或 https 地址': 'Promo API URL must be a valid http or https URL',
    '配置已保存。直连生成仍需要在浏览器配置 OpenAI、Gemini、SenseNova、Seedream 或提示词润色 API Key；云存储配置不会因此被阻止。':
        'Settings saved. Direct generation still requires configuring OpenAI, Gemini, SenseNova, Seedream, or prompt-polish API keys in the browser. Cloud storage settings were not blocked.',
    '配置已保存。当前直连 OpenAI 兼容接口缺少 API Base URL，生成请求可能失败；云存储配置已正常保存。':
        'Settings saved. The current direct OpenAI-compatible endpoint is missing an API Base URL, so generation may fail. Cloud storage settings were saved.',
    '按供应商、端点、能力、来源和状态筛选模型目录。':
        'Filter the model catalog by provider, endpoint, capability, source, and status.',
    '同一供应商类型现在可以保存多个命名端点；高级选项里会直接显示这些命名供应商。新增端点未填写名称时，会默认使用 Base URL 的域名作为名称。':
        'Each provider type can now save multiple named endpoints. Advanced Options show these named providers directly. If a new endpoint has no name, the Base URL domain is used by default.',
    '选择兼容类型，填写 API Key / Base URL，可留空名称自动使用域名。':
        'Choose a compatibility type, enter API Key / Base URL, and leave the name empty to use the domain automatically.',
    添加供应商: 'Add Provider',
    设为默认: 'Set as Default',
    选择: 'Select',
    可用模型: 'Available Models',
    '不勾选任何限制时默认可用该类型全部模型；勾选后只在高级选项中显示已选模型。':
        'When no restriction is checked, all models of this type are available by default. After checking, only selected models appear in Advanced Options.',
    '添加该供应商提供的自定义模型 ID': 'Add custom model IDs provided by this provider',
    '按供应商、端点、能力和状态管理发现模型与能力覆盖。':
        'Manage discovered models and capability overrides by provider, endpoint, capability, and status.',
    '管理图像供应商的 API Key、Base URL 和可用模型。':
        'Manage image provider API keys, Base URLs, and available models.',
    '配置 API 连接、并发任务数量和图片存储模式。':
        'Configure API connections, concurrent task count, and image storage mode.',
    已锁定客户端直连: 'Locked to Client Direct',
    直连模式注意事项: 'Client Direct Notes',
    '浏览器会直接访问供应商或中转服务，API Key 会在 Network 面板可见。':
        'The browser directly accesses the provider or relay service, and API keys are visible in the Network panel.',
    'OpenAI 兼容端点通常需要 CORS 支持；Google Gemini 可使用官方 REST 端点。':
        'OpenAI-compatible endpoints usually require CORS support. Google Gemini can use the official REST endpoint.',
    '服务器配置了 APP_PASSWORD，直连模式将绕过密码验证。':
        'APP_PASSWORD is configured on the server; client-direct mode bypasses password verification.',
    '直连模式不经过服务器，不会触发 APP_PASSWORD 验证。':
        'Client-direct mode does not go through the server and will not trigger APP_PASSWORD verification.',
    '请求经服务器转发，API Key 不在浏览器暴露，更安全。':
        'Requests are proxied through the server, so API keys are not exposed in the browser.',
    '同时执行的 API 请求数量，值越大效率越高但更容易触发速率限制。':
        'Number of API requests to run concurrently. Higher values can be faster but may hit rate limits more easily.',
    '记录最近使用的提示词，默认保留 20 条，方便从输入框下方快速找回。':
        'Records recently used prompts. Defaults to 20 items so they can be quickly recovered below the input.',
    保存图生文历史和源图: 'Save image-to-text history and source images',
    '关闭后，图生文结果只在当前任务结果区展示，不写入本地历史，也不持久化源图片。':
        'When off, image-to-text results are shown only in the current result area and are not written to local history or persisted with source images.',
    选择存储模式: 'Choose Storage Mode',
    '自动检测:': 'Auto detect:',
    'Vercel → IndexedDB，本地运行 → 文件系统': 'Vercel -> IndexedDB, local run -> file system',
    '文件系统:': 'File system:',
    'Web 端保存到': 'Web saves to',
    '；桌面端保存到应用数据目录或下方选择的文件夹':
        '; desktop saves to the app data directory or the folder selected below',
    '图片保存在浏览器本地存储，适合无服务器部署':
        'Images are saved in browser local storage, suitable for serverless deployments',
    桌面端文件夹: 'Desktop Folder',
    自定义路径: 'Custom Path',
    默认路径: 'Default Path',
    留空时使用默认应用数据目录: 'Leave empty to use the default app data directory',
    使用默认路径: 'Use Default Path',
    留空时默认保存到应用数据目录下的: 'When empty, saves by default under the app data directory',
    '。如需自定义目录，请直接填写本机文件夹绝对路径。':
        '. To use a custom directory, enter the absolute local folder path.',
    '为当前设备配置 S3 兼容对象存储，同步配置、提示词、历史记录与历史图片。':
        'Configure S3-compatible object storage for this device to sync settings, prompts, history, and history images.',
    '这是单机/自托管模式：每个访问者在本机保存对象存储配置。默认使用客户端直连；Web 端需要对象存储支持 CORS，桌面端会通过 Tauri Rust 网络层请求对象存储。':
        'This is single-user/self-hosted mode: each visitor saves object storage settings locally. Client direct is used by default. Web requires object storage CORS support, while desktop requests object storage through the Tauri Rust network layer.',
    'S3 兼容对象存储': 'S3-Compatible Object Storage',
    远端根前缀: 'Remote Root Prefix',
    'Profile / 设备命名空间': 'Profile / Device Namespace',
    '使用 path-style 访问（RustFS / MinIO / IP 地址端点通常需要开启）':
        'Use path-style access (usually required for RustFS / MinIO / IP address endpoints)',
    允许同步删除远端图片: 'Allow syncing remote image deletion',
    '默认关闭，普通同步只需要读取、列出和写入权限。关闭时，本地删除不会发布远端删除标记，也不会请求 DeleteObject；需要多设备同步删除且凭据确实具备删除权限时再开启。':
        'Off by default. Normal sync only needs read, list, and write permissions. When off, local deletion does not publish remote delete markers or request DeleteObject. Enable only when multi-device delete sync is needed and credentials really have delete permission.',
    云存储请求方式: 'Cloud Storage Request Mode',
    '桌面 Rust 中转': 'Desktop Rust Proxy',
    '使用本地 Tauri 网络层，避免 WebView CORS。': 'Use the local Tauri network layer to avoid WebView CORS.',
    '默认方式，需要对象存储端点允许当前站点 CORS。':
        'Default mode. Requires the object storage endpoint to allow CORS from the current site.',
    '仅在直连跨域失败且服务端已配置 S3 时使用。': 'Use only when direct CORS fails and the server has S3 configured.',
    '当前部署启用了 CLIENT_DIRECT_LINK_PRIORITY，云存储服务器中转不可用。':
        'CLIENT_DIRECT_LINK_PRIORITY is enabled for this deployment, so cloud storage server proxying is unavailable.',
    '开启后会在本机内容变化后按所选范围上传。': 'When enabled, local changes are uploaded for the selected scope.',
    根前缀: 'Root Prefix',
    远端删除: 'Remote Delete',
    已允许: 'Allowed',
    未开启: 'Off',
    '保存配置后，生成历史右上角会显示一个云同步图标；点击后可手动上传快照或从最新快照恢复。':
        'After saving, a cloud sync icon appears in the upper-right of Generation History. Click it to manually upload snapshots or restore from the latest snapshot.',
    '管理润色模型、自定义提示词，以及“润色”按钮弹出选项顺序。':
        'Manage polishing models, custom prompts, and the order of options in the Polish button picker.',
    未添加: 'Not Added',
    'Tauri 桌面 Rust 中转代理、调试模式。': 'Tauri desktop Rust proxy and debug mode.',
    '代理模式（仅桌面端 Rust 请求）': 'Proxy Mode (desktop Rust requests only)',
    默认环境代理: 'Default Environment Proxy',
    手动代理: 'Manual Proxy',
    代理地址: 'Proxy Address',
    '127.0.0.1:7890 或 socks5://127.0.0.1:1080': '127.0.0.1:7890 or socks5://127.0.0.1:1080',
    '使用 Rust HTTP 客户端默认代理行为（如环境变量代理）；如需稳定指定代理，建议选择手动代理。':
        'Use the default proxy behavior of the Rust HTTP client, such as environment proxies. Choose manual proxy for a stable explicit proxy.',
    'Rust 中转将直接连接 API 服务器，不使用代理。':
        'The Rust proxy connects directly to API servers without using a proxy.',
    展示内容读取: 'Promo Content Fetching',
    当前站点: 'Current Site',
    自定义域名: 'Custom Domain',
    完整接口: 'Full Endpoint',
    展示服务域名: 'Promo Service Domain',
    完整展示接口地址: 'Full Promo API URL',
    '桌面端会请求当前站点的 /api/promo/placements。': 'Desktop requests /api/promo/placements from the current site.',
    '桌面端不会请求展示接口，所有展示位保持隐藏。':
        'Desktop does not request the promo API and all promo slots stay hidden.',
    '开启后，Rust 中转会在 API 请求中附加调试头并返回更详细的错误信息。':
        'When enabled, the Rust proxy attaches debug headers to API requests and returns more detailed errors.',
    '当前为 Web 应用，桌面端配置未启用': 'This is the Web app; desktop settings are not enabled',
    下载或更新桌面端: 'Download or Update Desktop App',
    '统一模型目录会合并供应商发现模型、预置模型和自定义模型。筛选后仍可直接调整任务能力、启用状态和自定义模型覆盖。':
        'The unified model catalog merges provider-discovered, built-in, and custom models. After filtering, you can still adjust task capabilities, enabled state, and custom model overrides directly.',
    '搜索模型 ID、显示名、端点、厂商、能力或元数据':
        'Search model ID, display name, endpoint, provider, capability, or metadata',
    全部供应商: 'All Providers',
    全部端点: 'All Endpoints',
    清除筛选: 'Clear Filters',
    '还没有匹配的目录项。可以清除筛选，或在“供应商 API 配置”里刷新模型列表。':
        'No catalog items match. Clear filters or refresh the model list in Provider API Settings.',
    '新增模型请进入“供应商 API 配置”刷新或手动添加；这里保留的是模型级别的高级覆盖项。':
        'To add models, refresh or add them manually in Provider API Settings. This area keeps model-level advanced overrides.',
    '润色 API Key': 'Polish API Key',
    '(可选)': '(optional)',
    '复用 OpenAI': 'Reuse OpenAI',
    '留空时复用 OpenAI API Key 或 POLISHING_API_KEY': 'Leave empty to reuse OpenAI API Key or POLISHING_API_KEY',
    '留空时优先使用 .env 的 POLISHING_API_KEY，其次复用 OpenAI API Key。':
        'When empty, POLISHING_API_KEY from .env is used first, then the OpenAI API key is reused.',
    '润色 API Base URL': 'Polish API Base URL',
    '支持 OpenAI-compatible Chat Completions 端点；若直链优先开启且这里是非官方地址，会锁定客户端直连。':
        'Supports OpenAI-compatible Chat Completions endpoints. If client-direct priority is enabled and this is not the official endpoint, client direct is locked.',
    '润色模型 ID': 'Polish Model ID',
    润色思考模式: 'Polish Thinking Mode',
    关闭思考: 'Disable Thinking',
    开启思考: 'Enable Thinking',
    思考强度参数格式: 'Thinking Effort Parameter Format',
    选择兼容格式: 'Select compatibility format',
    思考强度: 'Thinking Effort',
    开启后会发送: 'When enabled, sends',
    '，并按格式附加': ', and appends by format',
    或: 'or',
    '.env 可配置 POLISHING_THINKING_ENABLED / POLISHING_THINKING_EFFORT / POLISHING_THINKING_EFFORT_FORMAT':
        '.env can configure POLISHING_THINKING_ENABLED / POLISHING_THINKING_EFFORT / POLISHING_THINKING_EFFORT_FORMAT',
    默认内置预设: 'Default Built-in Preset',
    '当前选中：': 'Selected:',
    添加提示词: 'Add Prompt',
    编辑提示词: 'Edit Prompt',
    新增提示词: 'New Prompt',
    名称: 'Name',
    '例如：电商文案专用': 'Example: e-commerce copywriting',
    '输入完整提示词...': 'Enter full prompt...',
    上移: 'Move Up',
    下移: 'Move Down',
    删除提示词: 'Delete Prompt',
    '还没有自定义提示词。点击「添加提示词」创建。': 'No custom prompts yet. Click "Add Prompt" to create one.',
    润色下拉选择顺序: 'Polish Picker Order',
    '调整润色弹出窗口中各选项的显示顺序。': 'Adjust the display order of options in the polish popover.',
    使用默认内置: 'Use Default Built-in',
    均衡润色: 'Balanced Polish',
    '本次手动输入，不保存': 'Manual input for this run, not saved',
    未知项: 'Unknown Item',
    '已保存，配置立即生效 ✓': 'Saved. Settings take effect immediately ✓',
    保存配置: 'Save Settings',
    '放弃未保存的配置？': 'Discard unsaved settings?',
    '当前配置有未保存修改。关闭后这些修改不会写入本机存储。':
        'Current settings have unsaved changes. Closing will not write them to local storage.',
    继续编辑: 'Keep Editing',
    放弃修改: 'Discard Changes',

    // Preset and provider option labels shown in pickers.
    精简润色: 'Concise Polish',
    编辑精修: 'Edit Refinement',
    电影质感: 'Cinematic',
    照片写实: 'Photorealistic',
    插画艺术: 'Illustration Art',
    品牌视觉: 'Brand Visual',
    极简设计: 'Minimalist Design',
    通用: 'General',
    风格生成: 'Style Generation',
    '通用场景，精准保留意图并增强视觉语言':
        'General scenarios, preserving intent precisely while strengthening visual language',
    '短输入友好，高效精炼输出': 'Friendly to short inputs with concise output',
    已有完整提示词时做微调增强: 'Fine-tune and enhance existing complete prompts',
    '镜头语言、光影戏剧、电影级构图': 'Camera language, dramatic lighting, cinematic composition',
    '商业摄影级别真实感，材质物理准确': 'Commercial-photography realism with physically accurate materials',
    '水彩、油画、数字绘画等艺术技法': 'Art techniques such as watercolor, oil painting, and digital painting',
    '电商产品、品牌营销、品牌视觉': 'E-commerce products, brand marketing, and brand visuals',
    '少即是多，留白与几何构成': 'Less is more, negative space and geometric composition',
    'URL 链接': 'URL Link',
    '返回 24 小时有效的图片下载链接，适合浏览器直连展示。':
        'Return an image download link valid for 24 hours, suitable for direct browser display.',
    '返回 Base64 图片数据，适合需要本地保存或避免外链失效的场景。':
        'Return Base64 image data, suitable for local saving or avoiding expired external links.',
    默认横向尺寸: 'Default landscape size',
    '竖版封面/短视频': 'Vertical cover / short video',
    摄影常用比例: 'Common photography ratio',
    '海报/人像': 'Poster / portrait',
    通用横幅: 'General banner',
    通用竖图: 'General vertical image',
    轻横幅: 'Light banner',
    社媒竖图: 'Social vertical image',
    电影宽屏: 'Cinematic widescreen',
    '长图/手机壁纸': 'Long image / mobile wallpaper',

    // About and update panel.
    '操作失败，请检查网络连接': 'Operation failed. Check your network connection.',
    未找到发布标签: 'Release tag not found',
    正在下载更新: 'Downloading update',
    开始下载更新: 'Starting update download',
    '下载完成，正在安装更新': 'Download complete. Installing update.',
    准备下载更新: 'Preparing update download',
    '安装完成，正在重启应用': 'Installation complete. Restarting app.',
    关于: 'About',
    版本: 'Version',
    作者: 'Author',
    网址: 'Website',
    联系方式: 'Contact',
    联系方式二维码: 'Contact QR code',
    扫码联系: 'Scan to contact',
    '用于 OpenAI GPT 图像模型生成、编辑、历史管理和提示词模板管理的本地工作台。':
        'A local workbench for OpenAI GPT image model generation, editing, history management, and prompt template management.',
    '检查中...': 'Checking...',
    检查更新: 'Check for Updates',
    安装新版本: 'Install New Version',
    当前已是最新版本: 'You are on the latest version',
    '），可直接下载并安装。': '), and it can be downloaded and installed directly.',
    '），点击前往发布页': '), click to open the release page',
    '更新已安装，正在重启应用。': 'Update installed. Restarting app.',
    '当前版本 v': 'Current version v',
    '，最新 GitHub 发布版本同样为 v': ', and the latest GitHub release is also v',

    // Safety, errors, and confirmations.
    '重大操作：清空生成历史': 'Destructive Action: Clear Generation History',
    '此操作将永久删除所有已生成的图片及历史记录，不可撤销。':
        'This permanently deletes all generated images and history records. It cannot be undone.',
    '同时会清除浏览器中存储的所有图片数据。': 'It will also clear all image data stored in the browser.',
    '提示词历史不会受到影响。': 'Prompt history is not affected.',
    同时删除云存储中这些历史图片对应的远端文件:
        'Also delete the remote files for these history images from cloud storage',
    '自定义参数必须是 JSON 对象，且只能包含 JSON 可序列化的值。':
        'Custom parameters must be a JSON object and contain only JSON-serializable values.',
    'JSON 解析失败。': 'JSON parse failed.',
    'Base URL 格式无效。': 'Base URL format is invalid.',
    'Base URL 只支持 http 或 https 协议。': 'Base URL supports only http or https.',
    'Base URL 不允许包含用户名或密码。': 'Base URL must not contain a username or password.',
    'Base URL 缺少主机名。': 'Base URL is missing a hostname.',
    'Base URL 不允许指向 localhost 或本机服务。': 'Base URL must not point to localhost or local services.',
    'Base URL 不允许指向私网、链路本地、回环或保留 IPv4 地址。':
        'Base URL must not point to private, link-local, loopback, or reserved IPv4 addresses.',
    'Base URL 不允许指向私网、链路本地、回环或保留 IPv6 地址。':
        'Base URL must not point to private, link-local, loopback, or reserved IPv6 addresses.',
    '导入文件格式无效：需要包含 templates 数组，或直接是模板数组。':
        'Invalid import file format: expected a templates array or a direct template array.',
    '导入文件中没有可用模板。': 'The import file contains no usable templates.',
    建议使用桌面端: 'Desktop app recommended',
    '如果浏览器因为 CORS 跨域策略、直链访问限制或服务器中转资源不足导致请求不可用，请下载并使用桌面端。桌面端内置 Rust 中转能力，可以在不消耗服务器中转资源的情况下继续访问第三方服务。':
        'If browser requests fail because of CORS, direct-link restrictions, or insufficient server proxy resources, download and use the desktop app. The desktop app includes Rust proxying so third-party services remain available without consuming server proxy resources.',
    '当前配置仅桌面端可用。Web 应用无法使用本机 Rust 中转代理、系统代理或桌面调试模式；如需这些能力，请下载并使用桌面端。':
        'This setting is available only on desktop. The Web app cannot use the local Rust proxy, system proxy, or desktop debug mode. Download the desktop app if you need these capabilities.',
    '当前环境不支持安全加密分享。': 'This environment does not support secure encrypted sharing.',
    '加密迭代次数配置无效。': 'Encryption iteration count is invalid.',
    '请输入用于加密分享的密码。': 'Enter a password for encrypted sharing.',
    '密码过于常见，请换一个更难猜的密码。': 'This password is too common. Choose one harder to guess.',
    '密码不能只由重复字符组成。': 'Password cannot be made only of repeated characters.',
    '密码不能使用连续字母或数字序列。': 'Password cannot use consecutive letters or number sequences.',
    '随机密码长度配置无效。': 'Random password length setting is invalid.',
    '加密分享链接格式无效。': 'Encrypted share link format is invalid.',
    '暂不支持这个加密分享链接版本。': 'This encrypted share link version is not supported yet.',
    '密码错误，或分享链接已被修改。': 'Password is incorrect, or the share link was modified.',
    '加密分享内容无法解析。': 'Encrypted share content cannot be parsed.',
    '加密分享内容格式无效。': 'Encrypted share content format is invalid.',
    '桌面端 Rust 中转请求失败。': 'Desktop Rust proxy request failed.',
    '编辑模式至少需要一张图片。': 'Edit mode requires at least one image.',
    未知错误: 'Unknown error',
    任务已取消: 'Task cancelled',
    未生成任何图片: 'No images were generated',
    'API 响应中没有有效的图片数据。': 'The API response contains no valid image data.',
    流式响应未返回完整数据: 'The streaming response did not return complete data.',
    '密码错误。请重新输入。': 'Incorrect password. Please enter it again.',
    'API 响应中没有有效的图片数据或文件名。': 'The API response contains no valid image data or filenames.',
    流式响应未生成任何图片: 'The streaming response generated no images.',
    图生文任务执行失败: 'Image-to-text task failed',
    '直连模式需要配置 API Key，请在系统设置中填写。':
        'Client-direct mode requires an API key. Fill it in under System Settings.',
    '请先在系统设置中配置 S3 兼容对象存储。': 'Configure S3-compatible object storage in System Settings first.',
    错误: 'Error',

    // Runtime notices and page-level dialogs.
    模型: 'Model',
    自动: 'Auto',
    输出格式: 'Output Format',
    已复制: 'Copied',
    刚刚: 'just now',
    需修正: 'Needs Fixes',
    'OpenAI 自定义尺寸需为 16 的倍数，最长边不超过 3840px，长短边比例不超过 3:1，总像素 655,360 至 8,294,400。':
        'OpenAI custom sizes must be multiples of 16. The longest side must be at most 3840px, aspect ratio at most 3:1, and total pixels from 655,360 to 8,294,400.',
    当前旧版比例会解析为: 'The current legacy ratio resolves to',
    图片历史: 'Image History',
    示例图片: 'Example Images',
    提示词润色: 'Prompt Polishing',
    自定义模型: 'Custom Models',
    历史结果: 'History Result',
    '生成历史保存失败：浏览器存储空间可能不足，或当前浏览器禁止本地存储。':
        'Failed to save generation history: browser storage may be full or local storage may be blocked.',
    '图生文历史保存失败：浏览器存储空间可能不足，或当前浏览器禁止本地存储。':
        'Failed to save image-to-text history: browser storage may be full or local storage may be blocked.',
    '无法读取剪贴板中的图片。': 'Unable to read images from the clipboard.',
    '密码无效。请输入有效密码。': 'Invalid password. Enter a valid password.',
    '图生文结果已生成，但部分源图未完整保存。':
        'Image-to-text result was generated, but some source images were not fully saved.',
    '已提交图生文任务，结果区会显示文本输出。': 'Image-to-text task submitted. The result area will show text output.',
    '已提交编辑任务，结果区会显示处理进度。': 'Edit task submitted. The result area will show progress.',
    '已提交生成任务，结果区会显示处理进度。': 'Generation task submitted. The result area will show progress.',
    '已识别加密分享链接，正在自动解密。': 'Encrypted share link detected. Decrypting automatically.',
    '已识别加密分享链接，请输入解密密码。': 'Encrypted share link detected. Enter the decryption password.',
    '已识别分享链接并应用参数。': 'Share link detected and parameters applied.',
    '云存储同步配置已保存。可以在历史面板右上角继续手动同步或恢复。':
        'Cloud storage sync settings saved. You can continue manual sync or restore from the upper-right of the history panel.',
    '云存储配置已保存。稍后可在历史面板右上角点击云同步恢复。':
        'Cloud storage settings saved. You can restore later from the cloud sync button in the history panel.',
    '加密分享链接解密失败。': 'Failed to decrypt encrypted share link.',
    '确定要删除这条图生文历史吗？此操作不可撤销。': 'Delete this image-to-text history item? This cannot be undone.',
    '确定要清空所有图生文历史吗？图片生成历史不会受到影响。':
        'Clear all image-to-text history? Image generation history will not be affected.',
    '已清空图生文历史。': 'Image-to-text history cleared.',
    '无法清除浏览器中的生成历史记录。': 'Unable to clear generation history records from the browser.',
    '无法发送图片到编辑模式。': 'Unable to send image to edit mode.',
    删除失败: 'Delete failed',
    '下载图片时发生未知错误。': 'Unknown error while downloading images.',
    '没有可下载的选中图片。': 'No selected images are available to download.',
    '没有选中的历史条目可删除。': 'No selected history items to delete.',
    '当前浏览器无法保持屏幕唤醒。同步或生成图片时请保持页面前台运行，锁屏/切后台可能会暂停请求。':
        'This browser cannot keep the screen awake. Keep the page in the foreground during sync or image generation; locking the screen or switching apps may pause requests.',
    '页面进入后台后，移动浏览器可能暂停同步或图片生成请求。':
        'After the page goes to the background, mobile browsers may pause sync or image generation requests.',
    配置和记录: 'Settings and records',
    '自动同步失败。': 'Auto sync failed.',
    '远端删除同步未开启。已保留云存储中的图片；如需同步删除，请先在云存储同步设置中开启远端删除。':
        'Remote delete sync is off. Images in cloud storage were kept. Enable remote delete in cloud sync settings if you need synced deletion.',
    '正在删除远端图片…': 'Deleting remote images...',
    '正在更新远端删除清单…': 'Updating remote delete manifest...',
    远端图片删除完成: 'Remote image deletion complete',
    '远端图片删除失败。': 'Remote image deletion failed.',
    远端图片删除失败: 'Remote image deletion failed',
    '正在打包配置和记录…': 'Packing settings and records...',
    '准备配置和记录清单…': 'Preparing settings and records manifest...',
    '上传配置和记录清单…': 'Uploading settings and records manifest...',
    配置和记录同步完成: 'Settings and records sync complete',
    '上传快照时发生未知错误。': 'Unknown error while uploading snapshot.',
    配置和记录同步失败: 'Settings and records sync failed',
    'S3 上传失败。': 'S3 upload failed.',
    '统计同步内容失败。': 'Failed to count sync content.',
    统计同步内容失败: 'Failed to count sync content',
    当前图片: 'Current image',
    '当前历史图片无法读取本地文件，未执行云同步。':
        'The current history image local file could not be read, so cloud sync was not run.',
    当前图片同步失败: 'Current image sync failed',
    '当前图片同步失败。': 'Current image sync failed.',
    当前图生文: 'Current image-to-text',
    '图生文历史同步失败。': 'Image-to-text history sync failed.',
    '统计图生文同步内容失败。': 'Failed to count image-to-text sync content.',
    统计图生文同步内容失败: 'Failed to count image-to-text sync content',
    '正在准备恢复配置和记录…': 'Preparing to restore settings and records...',
    配置和记录恢复完成: 'Settings and records restore complete',
    配置和记录恢复失败: 'Settings and records restore failed',
    '正在查找最新快照清单…': 'Finding latest snapshot manifest...',
    '正在读取最新快照清单…': 'Reading latest snapshot manifest...',
    '未找到可用的 S3 快照。': 'No available S3 snapshot found.',
    '未找到可用的 S3 快照': 'No available S3 snapshot found',
    '正在恢复配置和记录…': 'Restoring settings and records...',
    '恢复配置和记录中…': 'Restoring settings and records...',
    '恢复快照时发生未知错误。': 'Unknown error while restoring snapshot.',
    '恢复快照时发生错误。': 'Error while restoring snapshot.',
    '云存储同步配置已保存。这个分享链接未要求恢复配置、历史或图片。':
        'Cloud storage sync settings saved. This share link did not request restoring settings, history, or images.',
    '云存储同步配置已保存，开始按分享设置恢复。':
        'Cloud storage sync settings saved. Starting restore using shared settings.',
    '强制同步会重新上传范围内的所有图片，即使远端已经存在同名内容。':
        'Force sync reuploads all images in scope even if matching remote files already exist.',
    '将先跳过远端已经存在且内容匹配的图片，只上传需要补齐的内容。':
        'Images already present remotely with matching content are skipped; only missing content is uploaded.',
    确认同步: 'Confirm Sync',
    '强制同步会重新上传范围内的所有图生文源图，即使远端已经存在同名内容。':
        'Force sync reuploads all image-to-text source images in scope even if matching remote files already exist.',
    '将同步图生文历史元数据，并只上传需要补齐的源图。':
        'Sync image-to-text history metadata and upload only missing source images.',
    '强制恢复会重新下载范围内的所有远端图片，并覆盖本地同名图片。':
        'Force restore redownloads all remote images in scope and overwrites local files with the same names.',
    '将跳过本地已经存在且内容匹配的图片，只下载缺失或不一致的内容。':
        'Local images with matching content are skipped; only missing or mismatched content is downloaded.',
    确认恢复: 'Confirm Restore',
    '统计恢复内容失败。': 'Failed to count restore content.',
    统计恢复内容失败: 'Failed to count restore content',
    '强制恢复会重新下载范围内的所有图生文源图，并覆盖本地同名源图。':
        'Force restore redownloads all image-to-text source images in scope and overwrites local source images with the same names.',
    '将恢复图生文历史和对应源图，跳过本地已经存在且内容匹配的源图。':
        'Restore image-to-text history and source images, skipping local source images with matching content.',
    '统计图生文恢复内容失败。': 'Failed to count image-to-text restore content.',
    统计图生文恢复内容失败: 'Failed to count image-to-text restore content',
    释放以添加图片: 'Release to add images',
    添加源图片后将自动执行编辑任务: 'After adding source images, an edit task will run automatically',
    需要密码认证: 'Password required',
    '服务器需要密码，或之前输入的密码不正确。请输入密码以继续。':
        'The server requires a password, or the previous password was incorrect. Enter the password to continue.',
    '为 API 请求设置密码。': 'Set a password for API requests.',
    范围: 'Scope',
    候选源图: 'Candidate source images',
    候选图片: 'Candidate images',
    需要上传: 'Need Upload',
    需要下载: 'Need Download',
    可跳过: 'Skippable',
    确认批量删除: 'Confirm Batch Delete',
    '个条目吗？将移除相关图片。此操作不可撤销。': 'items? Related images will be removed. This cannot be undone.',
    链接里提供了: 'The link provides',
    '的 API Key、API 地址和模型 ID。你可以只在当前页面临时使用，或保存到本地浏览器设置中供以后继续使用。':
        'API Key, API URL, and model ID. You can use them temporarily on this page or save them to local browser settings for later.',
    '如果没有唤起默认浏览器，已复制链接，请手动打开访问。':
        'If the default browser did not open, the link was copied. Open it manually.',
    '如果没有唤起默认浏览器，也未能复制链接，请手动打开访问。':
        'If the default browser did not open and the link could not be copied, open it manually.',
    '无法唤起默认浏览器，已复制链接，请手动打开访问。':
        'Unable to open the default browser. The link was copied; open it manually.',
    '无法唤起默认浏览器，也未能复制链接，请手动打开访问。':
        'Unable to open the default browser and copy the link. Open it manually.',
    '无法打开外部浏览器，已复制链接。': 'Unable to open the external browser. Link copied.',
    '无法打开外部浏览器，也未能复制链接。': 'Unable to open the external browser and copy the link.',
    '内容接口请求失败。': 'Content API request failed.',
    '· 自定义': '· Custom',
    '，需修正': ', needs fixes',
    个模型: 'models',
    已选: 'Selected',
    项: 'items',
    详情: 'Details',
    快照时间: 'Snapshot Time',
    张: 'images',
    张源图: 'source images',
    个匹配模型: 'matching models',
    同步: 'Sync',
    恢复: 'Restore',
    桌面端图片存储路径: 'Desktop image storage path',
    '确定要删除此历史条目吗？将移除': 'Delete this history item? This removes',
    '张图片。 此操作不可撤销。': 'images. This cannot be undone.',
    确定要删除选中的: 'Delete the selected',
    '新版本 v': 'New version v',
    '可用（当前 v': ' is available (current v',
    一图速览: 'One-Page Overview',
    提示词资产: 'Prompt Assets',
    项目总览: 'Project Overview',
    体系能力: 'System Capabilities'
};

const ATTRIBUTE_ZH_TO_EN: Record<string, string> = {
    ...EXTENDED_EXACT_ZH_TO_EN,
    Settings: 'Settings',
    '关于 GPT Image Playground': 'About GPT Image Playground',
    查看源图片: 'View source image',
    移除源图片: 'Remove source image',
    桌面端图片存储路径: 'Desktop image storage path'
};

type LegacyTextReplacement = [RegExp, string | ((match: RegExpMatchArray) => string)];

export function translateLegacyUiString(input: string): string | null {
    const normalizedInput = normalizeLookupText(input);
    const exact = EXTENDED_EXACT_ZH_TO_EN[normalizedInput];
    if (exact) return preserveOuterWhitespace(input, exact);

    const replacements: LegacyTextReplacement[] = [
        [/^GitHub API 返回\s*(\d+)$/, 'GitHub API returned $1'],
        [/^默认模板加载失败\s+\((\d+)\)$/, 'Failed to load default templates ($1)'],
        [/^自动安装暂不可用：(.+)$/, 'Automatic installation is temporarily unavailable: $1'],
        [
            /^自动更新检查失败：(.+)；GitHub 检查失败：(.+)$/,
            'Automatic update check failed: $1; GitHub check failed: $2'
        ],
        [/^更新已安装，请手动重启应用：(.+)$/, 'Update installed. Please restart the app manually: $1'],
        [
            /^新版本 v(.+) 可用（当前 v(.+)），可直接下载并安装。$/,
            'New version v$1 is available (current v$2) and can be downloaded and installed directly.'
        ],
        [
            /^新版本 v(.+) 可用（当前 v(.+)），点击前往发布页$/,
            'New version v$1 is available (current v$2). Click to open the release page.'
        ],
        [
            /^当前版本 v(.+)，最新 GitHub 发布版本同样为 v(.+)。$/,
            'Current version v$1; the latest GitHub release is also v$2.'
        ],
        [/^(.+)\s+·\s+发现$/, '$1 · Discovered'],
        [/^(.+)\s+·\s+自定义$/, '$1 · Custom'],
        [/^(.+)\s+·\s+预置$/, '$1 · Built-in'],
        [/^(.+)\s+·\s+默认$/, '$1 · Default'],
        [/^(\d+)\s+条目录项$/, '$1 catalog items'],
        [/^(\d+)\s+条匹配$/, '$1 matches'],
        [/^(\d+)\s+条自定义$/, '$1 custom'],
        [/^(\d+)\s+条图片$/, '$1 images'],
        [/^(\d+)\s+条图生文$/, '$1 image-to-text items'],
        [/^(\d+)\s+条$/, '$1 items'],
        [/^(\d+)\s+项$/, '$1 items'],
        [/^(\d+)\s+已启用$/, '$1 enabled'],
        [/^(\d+)\s+未分类$/, '$1 unclassified'],
        [/^(\d+)\s+个端点$/, '$1 endpoints'],
        [/^(\d+)\s+个模型$/, '$1 models'],
        [/^(\d+)\s+个匹配模型$/, '$1 matching models'],
        [/^已发现\s+(\d+)\s+个模型。$/, 'Discovered $1 models.'],
        [/^绑定\s+(.+)$/, 'Bound to $1'],
        [/^(.+)\s+·\s+(\d+)\s+个端点$/, '$1 · $2 endpoints'],
        [/^删除模型\s+(.+)$/, 'Delete model $1'],
        [/^删除供应商\s+(.+)$/, 'Delete provider $1'],
        [/^删除图生文端点\s+(.+)$/, 'Delete image-to-text endpoint $1'],
        [/^切换模型\s+(.+)$/, 'Toggle model $1'],
        [/^当前默认内置：(.+)$/, 'Current default built-in: $1'],
        [/^（当前 ENV 格式：(.+)）$/, '(current ENV format: $1)'],
        [/^模型列表 Base URL 不安全：(.+)$/, 'Model list Base URL is unsafe: $1'],
        [/^刷新模型列表需要配置 API Key。$/, 'Refreshing the model list requires an API key.'],
        [/^该供应商暂不支持自动读取模型列表。$/, 'This provider does not support automatic model discovery yet.'],
        [/^模型列表读取失败：HTTP\s*(\d+)$/, 'Failed to load the model list: HTTP $1'],
        [/^模型列表响应解析失败：(.+)$/, 'Failed to parse the model list response: $1'],
        [
            /^(.+) 暂未接入桌面端 Rust 中转，请切换到客户端直连或等待支持。$/,
            '$1 is not connected to the desktop Rust proxy yet. Switch to client direct or wait for support.'
        ],
        [/^(.+) 暂不支持图像编辑。$/, '$1 does not support image editing.'],
        [
            /^(.+) 暂不支持蒙版编辑，请移除蒙版后重试。$/,
            '$1 does not support mask editing. Remove the mask and try again.'
        ],
        [/^处理图片 (.+) 失败：(.+)$/, 'Failed to process image $1: $2'],
        [
            /^(.+) 暂不支持流式预览，请关闭流式预览后重试。$/,
            '$1 does not support streaming preview. Disable streaming preview and try again.'
        ],
        [
            /^(.+) 暂不支持桌面端流式预览，请关闭流式预览后重试。$/,
            '$1 does not support desktop streaming preview. Disable streaming preview and try again.'
        ],
        [
            /^直连模式请求失败：目标地址可能不支持 CORS。原始错误:\s*(.+)$/,
            'Client-direct request failed: the target may not support CORS. Original error: $1'
        ],
        [/^OpenAI 执行器不支持模型 (.+)$/, 'The OpenAI executor does not support model $1'],
        [/^提示词润色失败：模型未返回有效内容。$/, 'Prompt polishing failed: the model returned no valid content.'],
        [
            /^直连模式润色提示词需要配置 API Key，请在系统配置的“提示词润色”中填写。$/,
            'Direct-mode prompt polishing requires an API key. Fill it in under Prompt Polishing in System Settings.'
        ],
        [
            /^直连模式润色失败：目标地址可能不支持 CORS。原始错误:\s*(.+)$/,
            'Direct-mode prompt polishing failed: the target may not support CORS. Original error: $1'
        ],
        [/^直连模式润色失败：(.+)$/, 'Direct-mode prompt polishing failed: $1'],
        [/^(\d+)\s+分钟前$/, '$1 minutes ago'],
        [/^(\d+)\s+小时前$/, '$1 hours ago'],
        [/^(\d+)\s+天前$/, '$1 days ago'],
        [/^(\d+)\s+张源图$/, '$1 source images'],
        [/^(\d+)\s+张$/, '$1 images'],
        [/^已选\s+(\d+)\s+项$/, '$1 selected'],
        [/^总计:\s*\$(.+)$/, 'Total: $$$1'],
        [/^查看图片，生成于\s+(.+)。点击打开完整预览。$/, 'View image generated at $1. Click to open full preview.'],
        [/^批量生成预览，时间\s+(.+)$/, 'Batch generation preview, time $1'],
        [/^点击查看费用明细，\$(.+)$/, 'View cost details, $$$1'],
        [/^生成于\s+(.+)$/, 'Generated at $1'],
        [
            /^确定要删除此历史条目吗？将移除\s*(\d+)\s*张图片。此操作不可撤销。$/,
            'Delete this history item? This removes $1 images. This cannot be undone.'
        ],
        [/^恢复最近(.+)$/, (match) => `Restore ${translateEmbeddedLegacySegment(`最近${match[1]}`)}`],
        [/^同步最近(.+)$/, (match) => `Sync ${translateEmbeddedLegacySegment(`最近${match[1]}`)}`],
        [/^强制同步(.+)$/, (match) => `Force Sync ${translateEmbeddedLegacySegment(match[1])}`],
        [/^强制恢复(.+)$/, (match) => `Force Restore ${translateEmbeddedLegacySegment(match[1])}`],
        [/^同步(.+)$/, (match) => `Sync ${translateEmbeddedLegacySegment(match[1])}`],
        [/^恢复(.+)$/, (match) => `Restore ${translateEmbeddedLegacySegment(match[1])}`],
        [/^文本\s+([\d,]+)$/, 'Text $1'],
        [/^图片\s+([\d,]+)$/, 'Images $1'],
        [/^输出\s+([\d,]+)$/, 'Output $1'],
        [/^查看源图片\s+(\d+)$/, 'View source image $1'],
        [/^移除源图片\s+(\d+)$/, 'Remove source image $1'],
        [/^查看源图\s+(\d+)$/, 'View source image $1'],
        [/^打开源图\s+(\d+)$/, 'Open source image $1'],
        [/^源图片预览\s+(\d+)$/, 'Source image preview $1'],
        [/^查看图片\s+(\d+)$/, 'View image $1'],
        [/^预览\s+(\d+)$/, 'Preview $1'],
        [/^结果\s+(\d+)$/, 'Result $1'],
        [/^历史\s+(\d+)$/, 'History $1'],
        [/^(.+):1 比例$/, '$1:1 ratio'],
        [/^最近\s+(\d+)\s+天图片$/, 'Images from the last $1 days'],
        [/^最近\s+(\d+)\s+小时图片$/, 'Images from the last $1 hours'],
        [/^最近\s+(\d+)\s+天图生文$/, 'Image-to-text from the last $1 days'],
        [/^最近\s+(\d+)\s+小时图生文$/, 'Image-to-text from the last $1 hours'],
        [/^全部图生文$/, 'All image-to-text'],
        [/^全部历史图片$/, 'All history images'],
        [/^包含当前输入框内容（(\d+) 个字符）。$/, 'Includes the current input content ($1 characters).'],
        [/^接收者将使用 (.+)。$/, 'Recipients will use $1.'],
        [
            /^接收者会优先切换到当前命名供应商端点（(.+)）。$/,
            'Recipients will prefer the current named provider endpoint ($1).'
        ],
        [/^(.+) API 地址$/, '$1 API URL'],
        [
            /^当前检测到 (.+)；强烈建议只分享临时或受限 Key。$/,
            'Detected $1. Strongly prefer sharing only temporary or restricted keys.'
        ],
        [/^最近\s+(\d+)\s+小时图片$/, 'Images from the last $1 hours'],
        [/^最近\s+(\d+)\s+天图片$/, 'Images from the last $1 days'],
        [/^建议至少\s+(\d+)\s+个字符$/, 'At least $1 characters recommended'],
        [/^随机生成\s+(\d+)\s+位解密密码$/, 'Generate a random $1-character decryption password'],
        [/^密码至少需要\s+(\d+)\s+个字符。$/, 'Password must be at least $1 characters.'],
        [/^包含：(.+)$/, (match) => `Includes: ${translateLegacyList(match[1])}`],
        [/^已导入\s+(\d+)\s+个模板。$/, 'Imported $1 templates.'],
        [/^取消置顶分类\s+(.+)$/, (match) => `Unpin category ${translateStandaloneLegacySegment(match[1])}`],
        [/^置顶分类\s+(.+)$/, (match) => `Pin category ${translateStandaloneLegacySegment(match[1])}`],
        [/^编辑模板\s+(.+)$/, 'Edit template $1'],
        [/^删除模板\s+(.+)$/, 'Delete template $1'],
        [/^(.+)（自定义）$/, '$1 (Custom)'],
        [/^最多只能选择\s+(\d+)\s+张图片。$/, 'You can select at most $1 images.'],
        [/^最多只能添加\s+(\d+)\s+张编辑图片。$/, 'You can add at most $1 edit images.'],
        [
            /^仅还能添加\s+(\d+)\s+张图片，已自动忽略多余文件。$/,
            'Only $1 more images can be added; extra files were ignored.'
        ],
        [
            /^遮罩尺寸\s+(\d+)x(\d+)\s+必须与源图片尺寸\s+(\d+)x(\d+)\s+一致。$/,
            'Mask size $1x$2 must match source image size $3x$4.'
        ],
        [/^已选择\s+(\d+)\s+张源图片$/, '$1 source images selected'],
        [
            /^(.+) 暂不支持图片编辑，请切换到支持编辑的模型或移除源图片后生成。$/,
            '$1 does not support image editing. Switch to a model that supports editing or remove source images to generate.'
        ],
        [
            /^(.+) 支持参考图编辑，但不支持蒙版参数；已保存的蒙版不会随请求发送。$/,
            '$1 supports reference-image editing but not mask parameters. Saved masks will not be sent with the request.'
        ],
        [/^(.+) 的当前模型暂不支持流式预览。$/, 'The current model for $1 does not support streaming preview.'],
        [
            /^当前配置：(.+?)，需修正。点击打开高级选项$/,
            (match) =>
                `Current settings: ${translateStandaloneLegacySegment(
                    match[1]
                )}, needs fixes. Click to open Advanced Options.`
        ],
        [
            /^当前配置：(.+)。点击打开高级选项$/,
            (match) =>
                `Current settings: ${translateStandaloneLegacySegment(match[1])}. Click to open Advanced Options.`
        ],
        [/^(.+) · 需修正$/, '$1 · Needs Fixes'],
        [/^(.+) \/ (.+) · (.+) · (.+) · (\d+) 张$/, '$1 / $2 · $3 · $4 · $5 images'],
        [/^使用默认内置：(.+)$/, 'Use default built-in: $1'],
        [/^使用默认内置 (.+) (.+)$/, 'Use default built-in $1 $2'],
        [/^模型默认 · (.+)$/, 'Model default · $1'],
        [/^最大图片数:\s*(\d+)$/, 'Max Images: $1'],
        [/^图片数量:\s*(\d+)$/, 'Image Count: $1'],
        [/^压缩率:\s*(\d+)%$/, 'Compression: $1%'],
        [/^笔刷大小:\s*(\d+)px$/, 'Brush Size: $1px'],
        [/^(\d+)\s+个任务运行中$/, '$1 tasks running'],
        [/^已删除\s+(\d+)\s+个历史条目。$/, 'Deleted $1 history items.'],
        [/^已删除\s+(\d+)\s+条图生文历史。$/, 'Deleted $1 image-to-text history items.'],
        [
            /^已恢复图生文结果，(\d+) 张源图待恢复。$/,
            'Restored image-to-text result; $1 source images pending restore.'
        ],
        [
            /^确定要删除选中的\s+(\d+)\s+条图生文历史吗？此操作不可撤销。$/,
            'Delete the selected $1 image-to-text history items? This cannot be undone.'
        ],
        [/^图片下载失败：(.+)$/, 'Image download failed: $1'],
        [/^无法读取图片缓存：(.+)$/, 'Unable to read image cache: $1'],
        [/^图片不存在：(.+)$/, 'Image does not exist: $1'],
        [/^开始下载\s+(\d+)\s+张图片\.\.\.$/, 'Starting download for $1 images...'],
        [/^开始批量下载\s+(\d+)\s+张图片\.\.\.$/, 'Starting batch download for $1 images...'],
        [/^批量下载进度\s+(\d+)\/(\d+)$/, 'Batch download progress $1/$2'],
        [/^批量下载完成\s+(\d+)\/(\d+)\s+张，(\d+)\s+张失败。$/, 'Batch download complete: $1/$2 images, $3 failed.'],
        [
            /^已删除\s+(\d+)\s+个历史条目，(\d+)\s+个本地文件删除失败。$/,
            'Deleted $1 history items; $2 local files failed to delete.'
        ],
        [/^自动同步(.+)…$/, (match) => `Auto syncing ${translateEmbeddedLegacySegment(match[1])}...`],
        [
            /^自动上传(.+)\s+(\d+)\/(\d+)$/,
            (match) => `Auto uploading ${translateEmbeddedLegacySegment(match[1])} ${match[2]}/${match[3]}`
        ],
        [/^自动同步(.+)清单…$/, (match) => `Auto syncing ${translateEmbeddedLegacySegment(match[1])} manifest...`],
        [/^自动上传(.+)清单…$/, (match) => `Auto uploading ${translateEmbeddedLegacySegment(match[1])} manifest...`],
        [/^自动同步(.+)完成$/, (match) => `Auto sync ${translateEmbeddedLegacySegment(match[1])} complete`],
        [/^自动同步(.+)失败$/, (match) => `Auto sync ${translateEmbeddedLegacySegment(match[1])} failed`],
        [/^正在删除远端图片\s+(\d+)\/(\d+)$/, 'Deleting remote images $1/$2'],
        [/^已同步删除\s+(\d+)\s+个远端图片对象。$/, 'Deleted $1 remote image objects from sync.'],
        [/^本地已删除，远端删除失败：(.+)$/, 'Deleted locally, but remote deletion failed: $1'],
        [/^配置和记录已同步到 S3：(.+)$/, 'Settings and records synced to S3: $1'],
        [/^强制同步(.+)$/, (match) => `Force sync ${translateEmbeddedLegacySegment(match[1])}`],
        [/^同步(.+)$/, (match) => `Sync ${translateEmbeddedLegacySegment(match[1])}`],
        [/^正在打包(.+)…$/, (match) => `Packing ${translateEmbeddedLegacySegment(match[1])}...`],
        [/^无(.+)需要上传$/, (match) => `No ${translateEmbeddedLegacySegment(match[1])} needs upload`],
        [
            /^上传(.+)\s+(\d+)\/(\d+)$/,
            (match) => `Uploading ${translateEmbeddedLegacySegment(match[1])} ${match[2]}/${match[3]}`
        ],
        [/^上传(.+)清单…$/, (match) => `Uploading ${translateEmbeddedLegacySegment(match[1])} manifest...`],
        [/^(.+)完成$/, (match) => `${translateStandaloneLegacySegment(match[1])} complete`],
        [/^，跳过\s+(\d+)\s+张已存在图片$/, ', skipped $1 existing images'],
        [
            /^(.+)完成(.+)：(.+)$/,
            (match) =>
                `${translateStandaloneLegacySegment(match[1])} complete${translateStandaloneLegacySegment(match[2])}: ${
                    match[3]
                }`
        ],
        [/^(.+)失败$/, (match) => `${translateStandaloneLegacySegment(match[1])} failed`],
        [/^正在统计(.+)同步内容…$/, (match) => `Counting ${translateEmbeddedLegacySegment(match[1])} sync content...`],
        [/^当前\s+(\d+)\s+张图片$/, 'Current $1 images'],
        [/^正在同步(.+)…$/, (match) => `Syncing ${translateEmbeddedLegacySegment(match[1])}...`],
        [/^同步(.+)清单…$/, (match) => `Syncing ${translateEmbeddedLegacySegment(match[1])} manifest...`],
        [/^(.+)同步完成$/, (match) => `${translateStandaloneLegacySegment(match[1])} sync complete`],
        [
            /^(.+)已同步到云存储(.+)。$/,
            (match) =>
                `${translateStandaloneLegacySegment(match[1])} synced to cloud storage${translateStandaloneLegacySegment(
                    match[2]
                )}.`
        ],
        [
            /^上传(.+)源图\s+(\d+)\/(\d+)$/,
            (match) => `Uploading ${translateEmbeddedLegacySegment(match[1])} source images ${match[2]}/${match[3]}`
        ],
        [/^，跳过\s+(\d+)\s+张已存在源图$/, ', skipped $1 existing source images'],
        [/^正在准备恢复(.+)…$/, (match) => `Preparing to restore ${translateEmbeddedLegacySegment(match[1])}...`],
        [
            /^(.+)(恢复|强制恢复)(.+)完成$/,
            (match) =>
                `${translateStandaloneLegacySegment(match[1])}${translateSyncRestoreAction(match[2])} ${translateEmbeddedLegacySegment(
                    match[3]
                )} complete`
        ],
        [
            /^(.+)(恢复|强制恢复)(.+)失败$/,
            (match) =>
                `${translateStandaloneLegacySegment(match[1])}${translateSyncRestoreAction(match[2])} ${translateEmbeddedLegacySegment(
                    match[3]
                )} failed`
        ],
        [/^正在下载(.+)…$/, (match) => `Downloading ${translateEmbeddedLegacySegment(match[1])}...`],
        [
            /^下载(.+)\s+(\d+)\/(\d+)$/,
            (match) => `Downloading ${translateEmbeddedLegacySegment(match[1])} ${match[2]}/${match[3]}`
        ],
        [
            /^写入(.+)\s+(\d+)\/(\d+)$/,
            (match) => `Writing ${translateEmbeddedLegacySegment(match[1])} ${match[2]}/${match[3]}`
        ],
        [/^恢复(.+)中…$/, (match) => `Restoring ${translateEmbeddedLegacySegment(match[1])}...`],
        [
            /^，跳过\s+(\d+)\s+张本地已存在(.+)$/,
            (match) => `, skipped ${match[1]} locally existing ${translateEmbeddedLegacySegment(match[2])}`
        ],
        [
            /^正在统计(.+)恢复内容…$/,
            (match) => `Counting ${translateEmbeddedLegacySegment(match[1])} restore content...`
        ],
        [/^正在检查本地已存在图片\s+(\d+)\/(\d+)$/, 'Checking existing local images $1/$2'],
        [/^正在检查本地已存在源图\s+(\d+)\/(\d+)$/, 'Checking existing local source images $1/$2'],
        [
            /^确定要删除选中的\s+(\d+)\s+个条目吗？将移除相关图片。此操作不可撤销。$/,
            'Delete the selected $1 items? Related images will be removed. This cannot be undone.'
        ],
        [/^已保存\s+(\d+)\s+张图片到系统下载目录。$/, 'Saved $1 images to the system downloads folder.'],
        [/^已触发\s+(\d+)\s+张图片下载。$/, 'Started $1 image downloads.'],
        [
            /^历史条目已移除，但\s+(\d+)\s+个本地文件删除失败。$/,
            'The history item was removed, but $1 local files failed to delete.'
        ]
    ];

    const trimmed = normalizedInput;
    for (const [pattern, replacement] of replacements) {
        const match = trimmed.match(pattern);
        if (match) {
            const translated =
                typeof replacement === 'function' ? replacement(match) : trimmed.replace(pattern, replacement);
            return preserveOuterWhitespace(input, translated);
        }
    }

    return null;
}

export function translateLegacyUiAttribute(input: string): string | null {
    const exact = ATTRIBUTE_ZH_TO_EN[normalizeLookupText(input)];
    return exact ? preserveOuterWhitespace(input, exact) : translateLegacyUiString(input);
}

function normalizeLookupText(input: string): string {
    return input.trim().replace(/\s+/g, ' ');
}

function preserveOuterWhitespace(original: string, translated: string): string {
    const leading = original.match(/^\s*/)?.[0] ?? '';
    const trailing = original.match(/\s*$/)?.[0] ?? '';
    return `${leading}${translated}${trailing}`;
}

function translateStandaloneLegacySegment(input: string): string {
    const normalized = normalizeLookupText(input);
    const exact = EXTENDED_EXACT_ZH_TO_EN[normalized];
    if (exact) return exact;

    const replacements: Array<[RegExp, string]> = [
        [/^(.+) \/ (.+) · (.+) · (.+) · (\d+) 张$/, '$1 / $2 · $3 · $4 · $5 images'],
        [/^最近\s+(\d+)\s+小时图片$/, 'Images from the last $1 hours'],
        [/^最近\s+(\d+)\s+天图片$/, 'Images from the last $1 days'],
        [/^最近\s+(\d+)\s+小时图生文$/, 'Image-to-text from the last $1 hours'],
        [/^最近\s+(\d+)\s+天图生文$/, 'Image-to-text from the last $1 days'],
        [/^当前\s+(\d+)\s+张图片$/, 'Current $1 images'],
        [/^，跳过\s+(\d+)\s+张已存在图片$/, ', skipped $1 existing images'],
        [/^，跳过\s+(\d+)\s+张已存在源图$/, ', skipped $1 existing source images'],
        [/^(\d+)\s+张本地已存在(.+)$/, '$1 locally existing $2'],
        [/^(\d+)\s+张源图$/, '$1 source images'],
        [/^(\d+)\s+张$/, '$1 images']
    ];

    for (const [pattern, replacement] of replacements) {
        if (pattern.test(normalized)) return normalized.replace(pattern, replacement);
    }

    return normalized;
}

function translateEmbeddedLegacySegment(input: string): string {
    return lowercaseInitialWord(translateStandaloneLegacySegment(input));
}

function translateLegacyList(input: string): string {
    return input
        .split('、')
        .map((item) => translateEmbeddedLegacySegment(item))
        .join(', ');
}

function translateSyncRestoreAction(input: string): string {
    if (input === '恢复') return ' restore';
    if (input === '强制恢复') return ' force restore';
    return input;
}

function lowercaseInitialWord(input: string): string {
    return input.replace(/^[A-Z](?=[a-z])/, (letter) => letter.toLowerCase());
}
