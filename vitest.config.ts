import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')
        }
    },
    test: {
        environment: 'node',
        exclude: ['**/node_modules/**', '**/dist/**', '.claude/**', '.deploy/**', '.next/**', '.omx/**']
    }
});
