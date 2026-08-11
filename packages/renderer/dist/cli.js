import { createHash } from 'node:crypto';
import { access, cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import YAML from 'yaml';
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_PDF_BYTES = 15 * 1024 * 1024;
const MAX_LOG_BYTES = 64 * 1024;
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function sha256(value) {
    return createHash('sha256').update(value).digest('hex');
}
function prepareCliYaml(yaml) {
    const document = YAML.parse(yaml, { maxAliasCount: 50 });
    if (!isRecord(document) || !isRecord(document.cv) || !isRecord(document.cv.sections))
        return yaml;
    for (const entries of Object.values(document.cv.sections)) {
        if (!Array.isArray(entries))
            continue;
        for (const entry of entries) {
            if (!isRecord(entry) || typeof entry.position !== 'string')
                continue;
            if (!entry.company && entry.position.startsWith('RCVSPACING'))
                entry.company = 'RCVCONTINUATION';
        }
    }
    return YAML.stringify(document);
}
async function stageTheme(yaml, directory, themesRoot) {
    const document = YAML.parse(yaml, { maxAliasCount: 50 });
    const design = isRecord(document) && isRecord(document.design) ? document.design : null;
    const theme = typeof design?.theme === 'string' ? design.theme.trim() : '';
    if (!theme || !/^[a-zA-Z0-9_-]{1,80}$/.test(theme))
        return;
    const source = join(themesRoot, theme);
    if (!await access(source).then(() => true).catch(() => false))
        return;
    const target = join(directory, theme);
    await cp(source, target, { recursive: true, errorOnExist: true });
    if (theme !== 'ahmadstyle' && theme !== 'tylerstyle')
        return;
    for (const relative of ['ExperienceEntry.j2.typ', 'entries/ExperienceEntry.j2.typ']) {
        const path = join(target, relative);
        const template = await readFile(path, 'utf-8').catch(() => null);
        if (!template)
            continue;
        await writeFile(path, template.replace('{% if entry.company %}', '{% if entry.company and entry.company != "RCVCONTINUATION" %}'), 'utf-8');
    }
}
async function readBoundedOutput(stream) {
    const reader = stream.getReader();
    const chunks = [];
    let kept = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done)
            break;
        if (!value || kept >= MAX_LOG_BYTES)
            continue;
        const remaining = MAX_LOG_BYTES - kept;
        const chunk = value.byteLength > remaining ? value.subarray(0, remaining) : value;
        chunks.push(chunk);
        kept += chunk.byteLength;
    }
    return Buffer.concat(chunks).toString('utf-8');
}
export function createRenderCvCliRenderer(options) {
    return {
        id: 'rendercv-cli',
        async render(request) {
            const effectiveYaml = prepareCliYaml(request.yaml);
            const directory = await mkdtemp(join(tmpdir(), 'rendercv-toolkit-'));
            try {
                await stageTheme(effectiveYaml, directory, options.themesRoot);
                const inputPath = join(directory, 'CV.yaml');
                const outputPath = join(directory, 'resume.pdf');
                await writeFile(inputPath, effectiveYaml, { encoding: 'utf-8', mode: 0o600 });
                const processHandle = Bun.spawn([
                    options.binary, 'render', inputPath,
                    '--pdf-path', outputPath,
                    '--dont-generate-markdown',
                    '--dont-generate-html',
                    '--dont-generate-png',
                    '--quiet'
                ], {
                    cwd: directory,
                    stdin: 'ignore',
                    stdout: 'pipe',
                    stderr: 'pipe',
                    env: {
                        PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
                        HOME: directory,
                        LANG: process.env.LANG || 'C.UTF-8'
                    }
                });
                let timedOut = false;
                const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
                const timer = setTimeout(() => {
                    timedOut = true;
                    processHandle.kill();
                }, timeoutMs);
                try {
                    const [exitCode, stdout, stderr] = await Promise.all([
                        processHandle.exited,
                        readBoundedOutput(processHandle.stdout),
                        readBoundedOutput(processHandle.stderr)
                    ]);
                    if (timedOut)
                        throw new Error(`RenderCV exceeded the ${timeoutMs / 1000}-second timeout.`);
                    if (exitCode !== 0) {
                        const details = (stderr || stdout).trim().slice(-4000);
                        throw new Error(`RenderCV exited with code ${exitCode}${details ? `: ${details}` : ''}`);
                    }
                }
                finally {
                    clearTimeout(timer);
                }
                const pdf = await readFile(outputPath);
                if (pdf.byteLength < 5 || pdf.subarray(0, 5).toString('ascii') !== '%PDF-') {
                    throw new Error('RenderCV did not produce a valid PDF artifact.');
                }
                const maxPdfBytes = options.maxPdfBytes ?? DEFAULT_MAX_PDF_BYTES;
                if (pdf.byteLength > maxPdfBytes)
                    throw new Error(`Rendered PDF exceeds the ${maxPdfBytes}-byte limit.`);
                return {
                    pdf,
                    pdfSha256: sha256(pdf),
                    effectiveYamlSha256: sha256(effectiveYaml),
                    compilerVersion: request.compilerVersion,
                    rendererVersion: options.rendererVersion || 'rendercv-cli',
                };
            }
            finally {
                await rm(directory, { recursive: true, force: true });
            }
        }
    };
}
export async function getRenderCvCliStatus(options) {
    return {
        available: await access(options.binary).then(() => true).catch(() => false),
        executable: basename(options.binary),
        customThemesAvailable: await access(options.themesRoot).then(() => true).catch(() => false)
    };
}
//# sourceMappingURL=cli.js.map