import { Command } from 'commander';
import { existsSync } from 'node:fs';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { CLAUDE_DIR, CONFIG_FILE, LOCAL_CONFIG_FILE, SECRETS_FILE, AGE_KEY_FILE } from '../util/paths.js';
import { isGitRepo, hasRemote } from '../util/git.js';
import { checkSopsBinaries, decryptSecrets } from '../util/sops.js';
import { loadMainConfig, loadLocalConfig } from '../config/loader.js';

const execFile = promisify(execFileCb);

type Status = 'pass' | 'warn' | 'fail';

function icon(status: Status): string {
  switch (status) {
    case 'pass': return '✓';
    case 'warn': return '⚠';
    case 'fail': return '✗';
  }
}

interface Check {
  name: string;
  status: Status;
  detail?: string;
}

async function getNodeVersion(): Promise<string> {
  return process.version;
}

async function commandVersion(cmd: string, args: string[] = ['--version']): Promise<string | null> {
  try {
    const { stdout } = await execFile(cmd, args);
    return stdout.trim();
  } catch {
    return null;
  }
}

export function registerDoctor(program: Command): void {
  program
    .command('doctor')
    .description('Run diagnostic checks')
    .action(async () => {
      const checks: Check[] = [];

      // Node >= 18
      const nodeVer = await getNodeVersion();
      const major = parseInt(nodeVer.replace('v', ''), 10);
      checks.push({
        name: 'Node.js >= 18',
        status: major >= 18 ? 'pass' : 'fail',
        detail: nodeVer,
      });

      // git installed
      const gitVer = await commandVersion('git');
      checks.push({
        name: 'git installed',
        status: gitVer ? 'pass' : 'fail',
        detail: gitVer ?? 'not found',
      });

      // sops installed
      const sopsVer = await commandVersion('sops');
      checks.push({
        name: 'sops installed',
        status: sopsVer ? 'pass' : 'warn',
        detail: sopsVer ?? 'not found (optional)',
      });

      // age installed
      const ageVer = await commandVersion('age', ['--version']);
      checks.push({
        name: 'age installed',
        status: ageVer ? 'pass' : 'warn',
        detail: ageVer ?? 'not found (optional)',
      });

      // ~/.claude/ is a git repo
      const isRepo = await isGitRepo();
      checks.push({
        name: '~/.claude/ is a git repo',
        status: isRepo ? 'pass' : 'fail',
        detail: isRepo ? 'yes' : 'run "claude-env init"',
      });

      // Remote configured
      const remote = isRepo ? await hasRemote() : false;
      checks.push({
        name: 'Remote configured',
        status: remote ? 'pass' : 'warn',
        detail: remote ? 'yes' : 'no remote origin',
      });

      // Age key file
      checks.push({
        name: 'Age key file exists',
        status: existsSync(AGE_KEY_FILE) ? 'pass' : 'warn',
        detail: existsSync(AGE_KEY_FILE) ? AGE_KEY_FILE : 'not found (optional)',
      });

      // claude-env.yaml exists and parses
      if (existsSync(CONFIG_FILE)) {
        try {
          const config = await loadMainConfig();
          checks.push({
            name: 'claude-env.yaml parses',
            status: config !== null ? 'pass' : 'fail',
            detail: 'ok',
          });
        } catch (e) {
          checks.push({
            name: 'claude-env.yaml parses',
            status: 'fail',
            detail: e instanceof Error ? e.message : String(e),
          });
        }
      } else {
        checks.push({
          name: 'claude-env.yaml exists',
          status: 'warn',
          detail: 'not found',
        });
      }

      // settings.local.yaml parses (if present)
      if (existsSync(LOCAL_CONFIG_FILE)) {
        try {
          const local = await loadLocalConfig();
          checks.push({
            name: 'settings.local.yaml parses',
            status: local !== null ? 'pass' : 'fail',
            detail: 'ok',
          });
        } catch (e) {
          checks.push({
            name: 'settings.local.yaml parses',
            status: 'fail',
            detail: e instanceof Error ? e.message : String(e),
          });
        }
      }

      // secrets.enc.yaml decrypts (if present)
      if (existsSync(SECRETS_FILE)) {
        const { sops, age } = await checkSopsBinaries();
        if (sops && age && existsSync(AGE_KEY_FILE)) {
          try {
            await decryptSecrets();
            checks.push({
              name: 'secrets.enc.yaml decrypts',
              status: 'pass',
              detail: 'ok',
            });
          } catch (e) {
            checks.push({
              name: 'secrets.enc.yaml decrypts',
              status: 'fail',
              detail: e instanceof Error ? e.message : String(e),
            });
          }
        } else {
          checks.push({
            name: 'secrets.enc.yaml decrypts',
            status: 'warn',
            detail: 'skipped (sops/age/key not available)',
          });
        }
      }

      // Print results
      console.log('\nclaude-env doctor\n');
      let hasFailure = false;
      for (const check of checks) {
        const detail = check.detail ? ` (${check.detail})` : '';
        console.log(`  ${icon(check.status)} ${check.name}${detail}`);
        if (check.status === 'fail') hasFailure = true;
      }
      console.log('');

      if (hasFailure) {
        process.exitCode = 1;
      }
    });
}
