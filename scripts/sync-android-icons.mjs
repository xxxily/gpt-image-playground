import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const sourceDir = path.join(projectRoot, 'src-tauri', 'icons', 'android');
const targetDir = path.join(projectRoot, 'src-tauri', 'gen', 'android', 'app', 'src', 'main', 'res');

if (!fs.existsSync(sourceDir)) {
    throw new Error(`Android icon source directory is missing: ${sourceDir}`);
}

if (!fs.existsSync(targetDir)) {
    console.warn(`Android project has not been initialized; skipped icon sync: ${targetDir}`);
    process.exit(0);
}

fs.cpSync(sourceDir, targetDir, {
    recursive: true,
    force: true
});

const requiredFiles = [
    'mipmap-anydpi-v26/ic_launcher.xml',
    'mipmap-mdpi/ic_launcher.png',
    'mipmap-mdpi/ic_launcher_foreground.png',
    'mipmap-mdpi/ic_launcher_round.png',
    'mipmap-hdpi/ic_launcher.png',
    'mipmap-hdpi/ic_launcher_foreground.png',
    'mipmap-hdpi/ic_launcher_round.png',
    'mipmap-xhdpi/ic_launcher.png',
    'mipmap-xhdpi/ic_launcher_foreground.png',
    'mipmap-xhdpi/ic_launcher_round.png',
    'mipmap-xxhdpi/ic_launcher.png',
    'mipmap-xxhdpi/ic_launcher_foreground.png',
    'mipmap-xxhdpi/ic_launcher_round.png',
    'mipmap-xxxhdpi/ic_launcher.png',
    'mipmap-xxxhdpi/ic_launcher_foreground.png',
    'mipmap-xxxhdpi/ic_launcher_round.png',
    'values/ic_launcher_background.xml'
];

const missingFiles = requiredFiles.filter((file) => !fs.existsSync(path.join(targetDir, file)));
if (missingFiles.length > 0) {
    throw new Error(`Android icon sync missed required files: ${missingFiles.join(', ')}`);
}

console.log(`Synced Android launcher icons from ${path.relative(projectRoot, sourceDir)} to ${path.relative(projectRoot, targetDir)}.`);
