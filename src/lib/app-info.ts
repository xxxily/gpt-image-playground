import packageJson from '../../package.json';

const APP_DESCRIPTION = '用于 OpenAI GPT 图像模型生成、编辑、历史管理和提示词模板管理的本地工作台。';
const CONTACT_LABEL = '扫码联系';
const CONTACT_QR_CODE_PATH = '/qrcode.png';

type PackageRepository = string | { url?: string };

export type AppInfo = {
    name: string;
    description: string;
    version: string;
    author: string;
    contact: string;
    websiteUrl: string;
    websiteDisplay: string;
    githubUrl: string;
    githubDisplay: string;
    contactQrCodePath: string;
};

export function formatUrlDisplay(url: string): string {
    return url.trim().replace(/^git\+/, '').replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export function formatRepositoryDisplay(url: string): string {
    return formatUrlDisplay(url).replace(/^github\.com\//, '').replace(/\.git$/, '');
}

export function resolveRepositoryUrl(repository: PackageRepository): string {
    return typeof repository === 'string' ? repository : repository.url ?? '';
}

const repositoryUrl = resolveRepositoryUrl(packageJson.repository);

export const appInfo: AppInfo = {
    name: 'GPT Image Playground',
    description: APP_DESCRIPTION,
    version: packageJson.version,
    author: packageJson.author,
    contact: CONTACT_LABEL,
    websiteUrl: packageJson.homepage,
    websiteDisplay: formatUrlDisplay(packageJson.homepage),
    githubUrl: repositoryUrl,
    githubDisplay: formatRepositoryDisplay(repositoryUrl),
    contactQrCodePath: CONTACT_QR_CODE_PATH
};
