import { Command } from 'commander';
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { AGE_KEY_FILE, SECRETS_FILE } from '../util/paths.js';
import { checkSopsBinaries, editSecrets, setSecret, listSecretKeys } from '../util/sops.js';
import { info, success, die } from '../util/log.js';

async function checkPrerequisites(): Promise<void> {
  const bins = await checkSopsBinaries();
  if (!bins.sops) die('sops is not installed. Install sops first.');
  if (!bins.age) die('age is not installed. Install age first.');
  if (!existsSync(AGE_KEY_FILE)) {
    die(`Age key not found at ${AGE_KEY_FILE}. Run "claude-env init" first.`);
  }
}

function readStdinValue(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data.trim()));
  });
}

function promptValue(key: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`Value for ${key}: `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export function registerSecret(program: Command): void {
  const secret = program
    .command('secret')
    .description('Manage encrypted secrets');

  secret
    .command('edit')
    .description('Edit secrets file in $EDITOR via sops')
    .action(async () => {
      await checkPrerequisites();
      if (!existsSync(SECRETS_FILE)) {
        die(`Secrets file not found: ${SECRETS_FILE}. Run "claude-env init" first.`);
      }
      await editSecrets();
      success('Secrets updated');
    });

  secret
    .command('set <key>')
    .description('Set a secret value (prompts or reads from stdin)')
    .action(async (key: string) => {
      await checkPrerequisites();

      let value: string;
      if (!process.stdin.isTTY) {
        value = await readStdinValue();
      } else {
        value = await promptValue(key);
      }

      if (!value) die('Empty value provided');

      await setSecret(key, value);
      success(`Secret "${key}" set`);
    });

  secret
    .command('list')
    .description('List secret keys (not values)')
    .action(async () => {
      await checkPrerequisites();
      if (!existsSync(SECRETS_FILE)) {
        info('No secrets file found');
        return;
      }
      const keys = await listSecretKeys();
      if (keys.length === 0) {
        info('No secrets defined');
      } else {
        for (const k of keys) {
          info(k);
        }
      }
    });
}
