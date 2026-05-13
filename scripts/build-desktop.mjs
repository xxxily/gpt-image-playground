import { spawn } from 'node:child_process';
import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const apiDir = path.join(projectRoot, 'src', 'app', 'api');
const adminDir = path.join(projectRoot, 'src', 'app', 'admin');
const backupRoot = path.join(projectRoot, '.desktop-build-api-backup');
const backupApiDir = path.join(backupRoot, 'api');
const backupAdminDir = path.join(backupRoot, 'admin');

async function pathExists(filePath) {
    try {
        await readdir(filePath);
        return true;
    } catch (error) {
        void error;
        return false;
    }
}

async function restoreRouteTree(sourceDir, backupDir) {
    if (!(await pathExists(backupDir))) return;

    await mkdir(sourceDir, { recursive: true });
    const entries = await readdir(backupDir, { withFileTypes: true });
    for (const entry of entries) {
        await rename(path.join(backupDir, entry.name), path.join(sourceDir, entry.name));
    }
    await rm(backupDir, { recursive: true, force: true });
}

async function restoreHiddenRouteTrees() {
    await restoreRouteTree(apiDir, backupApiDir);
    await restoreRouteTree(adminDir, backupAdminDir);
}

async function hideRouteTree(sourceDir, backupDir) {
    await restoreRouteTree(sourceDir, backupDir);
    await mkdir(backupDir, { recursive: true });

    const entries = await readdir(sourceDir, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        await rename(path.join(sourceDir, entry.name), path.join(backupDir, entry.name));
    }
}

async function hideApiRoutesForDesktopBuild() {
    await hideRouteTree(apiDir, backupApiDir);
    await hideRouteTree(adminDir, backupAdminDir);
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
    await restoreHiddenRouteTrees();
}

process.exit(exitCode);
