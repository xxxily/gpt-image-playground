import {
    buildPromptPolishThinkingParams,
    buildChatCompletionsUrl,
    buildPromptPolishMessages,
    DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT,
    extractPromptPolishText,
    normalizePromptPolishThinkingEffort,
    normalizePromptPolishThinkingEffortFormat,
    normalizePromptPolishThinkingEnabled,
    normalizePolishedPrompt
} from './prompt-polish-core';
import { describe, expect, it } from 'vitest';

describe('buildChatCompletionsUrl', () => {
    it('uses the official OpenAI chat completions endpoint by default', () => {
        expect(buildChatCompletionsUrl()).toBe('https://api.openai.com/v1/chat/completions');
    });

    it('appends chat completions to v1-compatible base URLs', () => {
        expect(buildChatCompletionsUrl('https://relay.example.com/v1')).toBe('https://relay.example.com/v1/chat/completions');
        expect(buildChatCompletionsUrl('relay.example.com/v1/')).toBe('https://relay.example.com/v1/chat/completions');
    });

    it('normalizes bare hosts, ports, and custom root paths', () => {
        expect(buildChatCompletionsUrl('relay.example.com')).toBe('https://relay.example.com/v1/chat/completions');
        expect(buildChatCompletionsUrl('http://localhost:3000/v1')).toBe('http://localhost:3000/v1/chat/completions');
        expect(buildChatCompletionsUrl('https://api.example.com/my-api')).toBe(
            'https://api.example.com/my-api/v1/chat/completions'
        );
    });

    it('replaces image endpoint suffixes with chat completions', () => {
        expect(buildChatCompletionsUrl('https://relay.example.com/v1/images/generate')).toBe(
            'https://relay.example.com/v1/chat/completions'
        );
    });
});

describe('buildPromptPolishMessages', () => {
    it('keeps default prompt guidance for multiple input shapes', () => {
        expect(DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT).toContain('长文');
        expect(DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT).toContain('广告文案');
        expect(DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT).toContain('散乱词语');
        expect(DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT).toContain('较完整的生图提示词');
        expect(DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT).toContain('只输出润色后的最终生图提示词');
    });

    it('uses the default system prompt when the configured prompt is blank', () => {
        expect(buildPromptPolishMessages('  a cat in rain  ', ' ')[0]).toEqual({
            role: 'system',
            content: DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT
        });
    });

    it('wraps the original prompt without losing user text', () => {
        const messages = buildPromptPolishMessages('赛博朋克城市', 'polish it');
        expect(messages[1].content).toContain('赛博朋克城市');
        expect(messages[1].content).toContain('用户原始输入');
        expect(messages[1].content).toContain('请只输出润色后的最终提示词');
    });

    it('wraps long-form input without pre-truncating it', () => {
        const longInput = '产品发布会背景文案：'.repeat(80);
        const messages = buildPromptPolishMessages(longInput, 'polish it');

        expect(messages[1].content).toContain(longInput);
    });
});

describe('prompt polish thinking params', () => {
    it('omits thinking fields when disabled', () => {
        expect(buildPromptPolishThinkingParams({ enabled: false, effort: 'high', effortFormat: 'both' })).toEqual({});
    });

    it('builds OpenAI-compatible thinking fields', () => {
        expect(buildPromptPolishThinkingParams({ enabled: true, effort: 'max', effortFormat: 'openai' })).toEqual({
            thinking: { type: 'enabled' },
            reasoning_effort: 'max'
        });
    });

    it('builds Anthropic-compatible thinking fields', () => {
        expect(buildPromptPolishThinkingParams({ enabled: true, effort: 'high', effortFormat: 'anthropic' })).toEqual({
            thinking: { type: 'enabled' },
            output_config: { effort: 'high' }
        });
    });

    it('builds mixed compatibility fields for routers', () => {
        expect(buildPromptPolishThinkingParams({ enabled: true, effort: 'xhigh', effortFormat: 'both' })).toEqual({
            thinking: { type: 'enabled' },
            reasoning_effort: 'xhigh',
            output_config: { effort: 'xhigh' }
        });
    });

    it('preserves custom thinking effort values', () => {
        expect(buildPromptPolishThinkingParams({ enabled: true, effort: 'ultra', effortFormat: 'openai' })).toMatchObject({
            reasoning_effort: 'ultra'
        });
    });

    it('normalizes thinking option inputs safely', () => {
        expect(normalizePromptPolishThinkingEnabled('enabled')).toBe(true);
        expect(normalizePromptPolishThinkingEnabled('disabled')).toBe(false);
        expect(normalizePromptPolishThinkingEffort('  custom-max  ')).toBe('custom-max');
        expect(normalizePromptPolishThinkingEffort('')).toBe('high');
        expect(normalizePromptPolishThinkingEffortFormat('anthropic')).toBe('anthropic');
        expect(normalizePromptPolishThinkingEffortFormat('unknown')).toBe('openai');
    });
});

describe('extractPromptPolishText', () => {
    it('extracts the first assistant message content', () => {
        expect(
            extractPromptPolishText({
                choices: [{ message: { content: '  cinematic moonlit cat  ' } }]
            })
        ).toBe('cinematic moonlit cat');
    });

    it('falls back to legacy text completions-style content', () => {
        expect(extractPromptPolishText({ choices: [{ text: '  richer prompt  ' }] })).toBe('richer prompt');
    });

    it('returns null for invalid response shapes', () => {
        expect(extractPromptPolishText({ choices: [] })).toBeNull();
        expect(extractPromptPolishText({ choices: [{ message: { content: '' } }] })).toBeNull();
    });
});

describe('normalizePolishedPrompt', () => {
    it('removes surrounding markdown code fences', () => {
        expect(normalizePolishedPrompt('```text\nA richer prompt\n```')).toBe('A richer prompt');
        expect(normalizePolishedPrompt('```\nA richer prompt\n```')).toBe('A richer prompt');
    });
});
