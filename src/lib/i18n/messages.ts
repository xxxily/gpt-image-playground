import type { AppLanguage } from './language';

export type I18nMessages = Record<string, string>;

export const APP_MESSAGES: Record<AppLanguage, I18nMessages> = {
    'zh-CN': {
        'app.title': 'GPT Image Playground',
        'app.description': '使用 OpenAI GPT Image 模型生成和编辑图片。',
        'common.settings': '设置',
        'common.save': '保存',
        'common.cancel': '取消',
        'common.reset': '重置',
        'theme.switchToLight': '切换到浅色主题',
        'theme.switchToDark': '切换到深色主题',
        'theme.light': '浅色主题',
        'theme.dark': '深色主题',
        'settings.title': '系统配置',
        'settings.description': '配置 API、模型、运行参数与桌面端选项。',
        'settings.providersTitle': '供应商 API 配置',
        'settings.providersDescription': '管理各供应商的 API Key 与 Base URL。',
        'settings.polishTitle': '提示词润色配置',
        'settings.polishDescription': '管理润色模型、自定义提示词和润色下拉顺序。',
        'settings.general.title': '常规',
        'settings.general.description': '配置界面语言等通用体验偏好。',
        'settings.language.label': '界面语言',
        'settings.language.description': '切换后当前界面立即更新，刷新或重启后仍保持。',
        'settings.language.statusAuto': '自动匹配',
        'settings.language.statusSaved': '已保存',
        'settings.language.zh': '简体中文',
        'settings.language.en': 'English',
        'settings.saveSuccess': '配置已保存，立即生效。'
        ,
        'password.title': '设置密码',
        'password.placeholder': '输入密码',
        'password.save': '保存'
    },
    'en-US': {
        'app.title': 'GPT Image Playground',
        'app.description': 'Generate and edit images with OpenAI GPT Image models.',
        'common.settings': 'Settings',
        'common.save': 'Save',
        'common.cancel': 'Cancel',
        'common.reset': 'Reset',
        'theme.switchToLight': 'Switch to light theme',
        'theme.switchToDark': 'Switch to dark theme',
        'theme.light': 'Light theme',
        'theme.dark': 'Dark theme',
        'settings.title': 'System Settings',
        'settings.description': 'Configure APIs, models, runtime behavior, and desktop options.',
        'settings.providersTitle': 'Provider API Settings',
        'settings.providersDescription': 'Manage API keys and base URLs for each provider.',
        'settings.polishTitle': 'Prompt Polishing Settings',
        'settings.polishDescription': 'Manage polishing models, custom prompts, and picker order.',
        'settings.general.title': 'General',
        'settings.general.description': 'Configure interface language and general experience preferences.',
        'settings.language.label': 'Interface Language',
        'settings.language.description': 'The interface updates immediately and stays selected after refresh or restart.',
        'settings.language.statusAuto': 'Auto detected',
        'settings.language.statusSaved': 'Saved',
        'settings.language.zh': 'Chinese (Simplified)',
        'settings.language.en': 'English',
        'settings.saveSuccess': 'Settings saved and applied.'
        ,
        'password.title': 'Set Password',
        'password.placeholder': 'Enter password',
        'password.save': 'Save'
    }
};
