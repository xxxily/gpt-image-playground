import { spawn } from 'node:child_process';
import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const apiDir = path.join(projectRoot, 'src', 'app', 'api');
const backupRoot = path.join(projectRoot, '.desktop-build-api-backup');
const backupApiDir = path.join(backupRoot, 'api');

async function pathExists(filePath) {
    try {
        await readdir(filePath);
        return true;
    } catch (error) {
        void error;
        return false;
    }
}

async function restoreApiRoutes() {
    if (!(await pathExists(backupApiDir))) return;

    await mkdir(apiDir, { recursive: true });
    const entries = await readdir(backupApiDir, { withFileTypes: true });
    for (const entry of entries) {
        await rename(path.join(backupApiDir, entry.name), path.join(apiDir, entry.name));
    }
    await rm(backupRoot, { recursive: true, force: true });
}

async function hideApiRoutesForDesktopBuild() {
    await restoreApiRoutes();
    await mkdir(backupApiDir, { recursive: true });

    const entries = await readdir(apiDir, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        await rename(path.join(apiDir, entry.name), path.join(backupApiDir, entry.name));
    }
}

function runDesktopBuild() {
    return new Promise((resolve) => {
        const child = spawn('npm', ['run', 'build'], {
            cwd: projectRoot,
            env: { ...process.env, DESKTOP_BUILD: '1' },
            shell: process.platform === 'win32',
            stdio: 'inherit',
        });

        child.on('exit', (code, signal) => {
            if (signal) {
                resolve(1);
                return;
            }
            resolve(code ?? 1);
        });

        child.on('error', () => resolve(1));
    });
}

let exitCode = 1;

try {
    await hideApiRoutesForDesktopBuild();
    exitCode = await runDesktopBuild();
} finally {
    await restoreApiRoutes();
}

process.exit(exitCode);
