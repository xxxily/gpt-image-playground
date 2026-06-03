import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const args = new Set(process.argv.slice(2));
const deep = args.has('--deep');
const dryRun = args.has('--dry-run');

const baseTargets = [
    '.next',
    '.desktop-build-api-backup',
    'out',
    'test-results',
    'tmp-qa',
    'playwright-report',
    'coverage',
    'tsconfig.tsbuildinfo'
];

const deepTargets = [
    'node_modules',
    'src-tauri/target',
    'src-tauri/gen/android/app/build'
];

const protectedTargets = new Set([
    '.env',
    '.env.local',
    '.env.production',
    'generated-images',
    'tmp/promo-admin.sqlite',
    'tmp/release-backups'
]);

function resolveTarget(target) {
    const resolved = path.resolve(projectRoot, target);
    const relative = path.relative(projectRoot, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`Refusing to clean outside the project root: ${target}`);
    }
    if (protectedTargets.has(target)) {
        throw new Error(`Refusing to clean protected project data: ${target}`);
    }
    return resolved;
}

const targets = [...baseTargets, ...(deep ? deepTargets : [])];

for (const target of targets) {
    const resolved = resolveTarget(target);
    if (!existsSync(resolved)) continue;

    if (dryRun) {
        console.log(`[clean] would remove ${target}`);
        continue;
    }

    await rm(resolved, { recursive: true, force: true });
    console.log(`[clean] removed ${target}`);
}

if (!dryRun) {
    console.log(deep ? '[clean] deep clean complete' : '[clean] clean complete');
}
