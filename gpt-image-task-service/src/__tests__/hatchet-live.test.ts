import { buildHatchetMockInput } from '../hatchet/live.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('Hatchet mock input contains only safe execution metadata', () => {
    const input = buildHatchetMockInput();
    const serialized = JSON.stringify(input);

    assert.equal(input.taskType, 'image.generate');
    assert.equal(input.endpointFingerprint, 'fp_gateway_example');
    assert.equal(input.modelId, 'gpt-image-1');
    assert.match(input.promptHash, /^[a-f0-9]{64}$/);

    assert.equal(serialized.includes('keyEnvelope'), false);
    assert.equal(serialized.includes('sealed-test-key'), false);
    assert.equal(serialized.includes('apiKey'), false);
    assert.equal(serialized.includes('https://gateway.example.com'), false);
    assert.equal(serialized.includes('Draw a compact phase one Hatchet mock image.'), false);
    assert.equal(serialized.includes('inputAssets'), false);
});
