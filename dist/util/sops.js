import { execFile as execFileCb, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { SECRETS_FILE, AGE_KEY_FILE } from './paths.js';
const execFile = promisify(execFileCb);
function sopsEnv() {
    return { ...process.env, SOPS_AGE_KEY_FILE: AGE_KEY_FILE };
}
async function commandExists(cmd) {
    try {
        await execFile('which', [cmd]);
        return true;
    }
    catch {
        return false;
    }
}
export async function checkSopsBinaries() {
    const [sops, age] = await Promise.all([commandExists('sops'), commandExists('age')]);
    return { sops, age };
}
export async function decryptSecrets() {
    if (!existsSync(SECRETS_FILE))
        return {};
    try {
        const { stdout } = await execFile('sops', ['--decrypt', SECRETS_FILE], {
            env: sopsEnv(),
        });
        const parsed = parseYaml(stdout);
        if (parsed === null || parsed === undefined)
            return {};
        if (typeof parsed !== 'object')
            return {};
        const result = {};
        for (const [k, v] of Object.entries(parsed)) {
            result[k] = String(v);
        }
        return result;
    }
    catch {
        throw new Error('Failed to decrypt secrets. Is your age key available?');
    }
}
/**
 * Encrypt YAML plaintext to a file without ever writing plaintext to the
 * destination. Uses a temp file in the OS temp directory (outside the repo)
 * and cleans up on failure.
 */
export async function encryptYamlToFile(plaintext, destPath) {
    const tmpFile = join(tmpdir(), `.claude-env-${randomBytes(8).toString('hex')}.yaml`);
    try {
        await writeFile(tmpFile, plaintext, { encoding: 'utf-8', mode: 0o600 });
        const pubKey = await getAgePublicKey();
        if (!pubKey)
            throw new Error('Age public key not found. Ensure age key exists.');
        const { stdout } = await execFile('sops', [
            '--encrypt', '--age', pubKey,
            '--input-type', 'yaml',
            tmpFile,
        ], { env: sopsEnv() });
        await writeFile(destPath, stdout, 'utf-8');
    }
    finally {
        await unlink(tmpFile).catch(() => { });
    }
}
export async function editSecrets() {
    const child = spawn('sops', [SECRETS_FILE], {
        env: sopsEnv(),
        stdio: 'inherit',
    });
    await new Promise((resolve, reject) => {
        child.on('close', (code) => {
            if (code === 0)
                resolve();
            else
                reject(new Error(`sops exited with code ${code}`));
        });
        child.on('error', reject);
    });
}
export async function setSecret(key, value) {
    // Decrypt existing secrets (or start empty)
    let secrets = {};
    if (existsSync(SECRETS_FILE)) {
        try {
            secrets = await decryptSecrets();
        }
        catch {
            secrets = {};
        }
    }
    // Update the value
    secrets[key] = value;
    // Encrypt via temp file to avoid writing plaintext to the repo
    await encryptYamlToFile(stringifyYaml(secrets), SECRETS_FILE);
}
export async function getAgePublicKey() {
    if (!existsSync(AGE_KEY_FILE))
        return null;
    const content = await readFile(AGE_KEY_FILE, 'utf-8');
    for (const line of content.split('\n')) {
        if (line.startsWith('# public key: ')) {
            return line.replace('# public key: ', '').trim();
        }
    }
    // Try age-keygen -y
    try {
        const { stdout } = await execFile('age-keygen', ['-y', AGE_KEY_FILE]);
        return stdout.trim();
    }
    catch {
        return null;
    }
}
export async function listSecretKeys() {
    const secrets = await decryptSecrets();
    return Object.keys(secrets);
}
//# sourceMappingURL=sops.js.map