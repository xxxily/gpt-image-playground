import {
    buildChatCompletionsUrl,
    buildPromptPolishMessages,
    DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT,
    extractPromptPolishText,
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
    it('uses the default system prompt when the configured prompt is blank', () => {
        expect(buildPromptPolishMessages('  a cat in rain  ', ' ')[0]).toEqual({
            role: 'system',
            content: DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT
        });
    });

    it('wraps the original prompt without losing user text', () => {
        const messages = buildPromptPolishMessages('赛博朋克城市', 'polish it');
        expect(messages[1].content).toContain('赛博朋克城市');
        expect(messages[1].content).toContain('请只输出润色后的最终提示词');
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
