import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const args = new Set(process.argv.slice(2));
const includeUntracked = args.has('--include-untracked');
const checkEnvPresence = args.has('--check-env-presence');
const failOnTrackedEnv = args.has('--fail-on-tracked-env');
const maxFileBytes = 2 * 1024 * 1024;

const rules = [
    {
        name: 'private-key-block',
        pattern: /-----BEGIN (?:RSA |DSA |EC |OPENSSH |)?PRIVATE KEY-----/u
    },
    {
        name: 'openai-api-key',
        pattern: /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b/u
    },
    {
        name: 'github-token',
        pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/u
    },
    {
        name: 'aws-access-key-id',
        pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/u
    }
];

const placeholderPattern = /^(?:example|placeholder|changeme|change-me|your_|your-|xxx|x{8,}|test|dummy|secret|password|token|none|null|false|true|\{\{.*\}\}|<.*>)$/iu;

function gitList(argsForGit) {
    const output = execFileSync('git', argsForGit, {
        cwd: projectRoot,
        encoding: 'buffer',
        stdio: ['ignore', 'pipe', 'ignore']
    });
    return output
        .toString('utf8')
        .split('\0')
        .filter(Boolean);
}

function getFilesToScan() {
    const files = new Set(gitList(['ls-files', '-z']));
    if (includeUntracked) {
        for (const file of gitList(['ls-files', '--others', '--exclude-standard', '-z'])) {
            files.add(file);
        }
    }
    return [...files].sort();
}

function isBinary(buffer) {
    return buffer.includes(0);
}

function shouldIgnoreCapturedSecret(value) {
    const normalized = value.trim();
    if (!normalized) return true;
    return placeholderPattern.test(normalized) || normalized.includes('...');
}

function scanFile(file) {
    const absolutePath = path.resolve(projectRoot, file);
    const relative = path.relative(projectRoot, absolutePath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return [];
    if (!existsSync(absolutePath)) return [];

    const stats = statSync(absolutePath);
    if (!stats.isFile() || stats.size > maxFileBytes) return [];

    const buffer = readFileSync(absolutePath);
    if (isBinary(buffer)) return [];

    const text = buffer.toString('utf8');
    const findings = [];
    for (const rule of rules) {
        rule.pattern.lastIndex = 0;
        let match;
        while ((match = rule.pattern.exec(text))) {
            const captured = rule.capture ? match[rule.capture] : match[0];
            if (captured && shouldIgnoreCapturedSecret(captured)) continue;
            findings.push({ file, rule: rule.name });
            break;
        }
    }
    return findings;
}

function reportEnvPresence(trackedFiles) {
    const rootEnvFiles = readdirSync(projectRoot)
        .filter((name) => name === '.env' || name.startsWith('.env.'))
        .sort();
    const releaseBackupDir = path.join(projectRoot, 'tmp', 'release-backups');
    const releaseBackupFiles = existsSync(releaseBackupDir)
        ? readdirSync(releaseBackupDir)
              .filter((name) => name.startsWith('.env'))
              .map((name) => `tmp/release-backups/${name}`)
              .sort()
        : [];
    const envFiles = [...rootEnvFiles, ...releaseBackupFiles];

    if (envFiles.length === 0) {
        console.log('[secret-scan] no local env files found');
        return 0;
    }

    let trackedEnvCount = 0;
    for (const file of envFiles) {
        const tracked = trackedFiles.has(file);
        const allowedTrackedEnv = file === '.env.example' || file === '.env.production';
        if (tracked && !allowedTrackedEnv) trackedEnvCount += 1;
        console.log(`[secret-scan] env file present: ${file} tracked=${tracked ? 'yes' : 'no'}`);
    }

    if (failOnTrackedEnv && trackedEnvCount > 0) {
        console.error('[secret-scan] tracked private env files are not allowed');
        return 1;
    }
    return 0;
}

const trackedFiles = new Set(gitList(['ls-files', '-z']));
let exitCode = 0;

if (checkEnvPresence) {
    exitCode = Math.max(exitCode, reportEnvPresence(trackedFiles));
}

const findings = getFilesToScan().flatMap(scanFile);

if (findings.length > 0) {
    for (const finding of findings) {
        console.error(`[secret-scan] possible secret: file=${finding.file} rule=${finding.rule}`);
    }
    exitCode = 1;
} else {
    console.log(`[secret-scan] no possible secrets found in ${includeUntracked ? 'tracked/untracked' : 'tracked'} files`);
}

process.exit(exitCode);
