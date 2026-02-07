import { execFile as execFileCb, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { SECRETS_FILE, AGE_KEY_FILE } from './paths.js';

const execFile = promisify(execFileCb);

function sopsEnv(): NodeJS.ProcessEnv {
  return { ...process.env, SOPS_AGE_KEY_FILE: AGE_KEY_FILE };
}

async function commandExists(cmd: string): Promise<boolean> {
  try {
    await execFile('which', [cmd]);
    return true;
  } catch {
    return false;
  }
}

export async function checkSopsBinaries(): Promise<{ sops: boolean; age: boolean }> {
  const [sops, age] = await Promise.all([commandExists('sops'), commandExists('age')]);
  return { sops, age };
}

export async function decryptSecrets(): Promise<Record<string, string>> {
  if (!existsSync(SECRETS_FILE)) return {};
  try {
    const { stdout } = await execFile('sops', ['--decrypt', SECRETS_FILE], {
      env: sopsEnv(),
    });
    const parsed = parseYaml(stdout);
    if (parsed === null || parsed === undefined) return {};
    if (typeof parsed !== 'object') return {};
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      result[k] = String(v);
    }
    return result;
  } catch {
    throw new Error('Failed to decrypt secrets. Is your age key available?');
  }
}

export async function editSecrets(): Promise<void> {
  const child = spawn('sops', [SECRETS_FILE], {
    env: sopsEnv(),
    stdio: 'inherit',
  });
  await new Promise<void>((resolve, reject) => {
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`sops exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

export async function setSecret(key: string, value: string): Promise<void> {
  // Decrypt existing secrets (or start empty)
  let secrets: Record<string, string> = {};
  if (existsSync(SECRETS_FILE)) {
    try {
      secrets = await decryptSecrets();
    } catch {
      secrets = {};
    }
  }

  // Update the value
  secrets[key] = value;

  // Write plaintext, then encrypt in-place
  const plaintext = stringifyYaml(secrets);
  await writeFile(SECRETS_FILE, plaintext, 'utf-8');

  await execFile('sops', ['--encrypt', '--in-place', SECRETS_FILE], {
    env: sopsEnv(),
  });
}

export async function getAgePublicKey(): Promise<string | null> {
  if (!existsSync(AGE_KEY_FILE)) return null;
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
  } catch {
    return null;
  }
}

export async function listSecretKeys(): Promise<string[]> {
  const secrets = await decryptSecrets();
  return Object.keys(secrets);
}
