import { Command } from 'commander';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { createInterface } from 'node:readline';
import { CLAUDE_DIR, CONFIG_FILE, SECRETS_FILE, AGE_KEY_FILE } from '../util/paths.js';
import { git, isGitRepo, hasRemote, isClean } from '../util/git.js';
import { checkSopsBinaries, getAgePublicKey } from '../util/sops.js';
import { info, success, warn, error } from '../util/log.js';
import { installHint } from '../util/deps.js';

const execFile = promisify(execFileCb);

const GITIGNORE_CONTENT = `# claude-env local overrides (not synced)
settings.local.yaml
settings.local.json
*.key

# Claude Code runtime directories
history.jsonl
cache/
debug/
file-history/
paste-cache/
plans/
plugins/
projects/
session-env/
shell-snapshots/
statsig/
tasks/
telemetry/
todos/
ide/
stats-cache.json
.DS_Store
`;

const STARTER_CONFIG = `# claude-env configuration
# See: https://github.com/your-org/claude-env

variables:
  # Define variables here, optionally per-platform
  # MY_VAR: "value"
  # MY_PATH:
  #   darwin: "/usr/local/bin"
  #   linux: "/usr/bin"
  #   win32: "C:\\\\Program Files"

mcp_servers: {}
  # Example MCP server:
  # my-server:
  #   command: "node"
  #   args: ["\${HOME}/mcp/my-server/index.js"]
  #   env:
  #     API_KEY: "\${secret:MY_API_KEY}"
`;

const LOCAL_EXAMPLE = `# Local overrides (not committed to git)
# Copy this to settings.local.yaml and customize

variables: {}
  # Override or add variables for this machine
  # MY_VAR: "local-value"

mcp_servers: {}
  # Override server settings for this machine
  # my-server:
  #   enabled: false
`;

const SOPS_YAML = `creation_rules:
  - path_regex: secrets\\.enc\\.yaml$
    age: "REPLACE_WITH_AGE_PUBLIC_KEY"
`;

function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}


export function registerInit(program: Command): void {
  program
    .command('init')
    .description('Interactive first-time setup of claude-env')
    .action(async () => {
      // 1. Ensure ~/.claude/ exists
      if (!existsSync(CLAUDE_DIR)) {
        await mkdir(CLAUDE_DIR, { recursive: true });
        success('Created ~/.claude/');
      }

      // 2. Git init or clone
      if (await isGitRepo()) {
        info('~/.claude/ is already a git repo');
      } else {
        const cloneUrl = await ask('Git repo SSH URL to clone into ~/.claude/ (or press Enter to init fresh): ');
        if (cloneUrl) {
          info('Cloning...');
          // Clone into a temp dir, then move contents
          const tmpDir = `${CLAUDE_DIR}/.clone-tmp`;
          try {
            await execFile('git', ['clone', cloneUrl, tmpDir]);
            // Move .git from temp to CLAUDE_DIR
            await execFile('mv', ['-f', `${tmpDir}/.git`, `${CLAUDE_DIR}/.git`]);
            // Copy files (excluding .git)
            await execFile('bash', ['-c', `cp -rn "${tmpDir}"/* "${CLAUDE_DIR}/" 2>/dev/null || true`]);
            await execFile('rm', ['-rf', tmpDir]);
            await git('checkout', '--', '.');
            success('Cloned into ~/.claude/');
          } catch (e) {
            error(`Clone failed: ${e instanceof Error ? e.message : e}`);
            // Clean up
            await execFile('rm', ['-rf', tmpDir]).catch(() => {});
            // Fall back to fresh init
            await git('init');
            success('Initialized fresh git repo in ~/.claude/');
          }
        } else {
          await git('init');
          success('Initialized git repo in ~/.claude/');
        }
      }

      // 3. Remote
      if (!(await hasRemote())) {
        const remoteUrl = await ask('Remote URL for origin (or press Enter to skip): ');
        if (remoteUrl) {
          await git('remote', 'add', 'origin', remoteUrl);
          success('Added remote origin');
        } else {
          warn('No remote configured. Run: git -C ~/.claude remote add origin <url>');
        }
      } else {
        const { stdout: currentUrl } = await git('remote', 'get-url', 'origin');
        info(`Remote origin: ${currentUrl.trim()}`);
      }

      // 4. Write .gitignore
      const gitignorePath = `${CLAUDE_DIR}/.gitignore`;
      await writeFile(gitignorePath, GITIGNORE_CONTENT, 'utf-8');
      success('Wrote .gitignore');

      // 5. Check sops+age
      const bins = await checkSopsBinaries();
      let ageAvailable = false;

      if (!bins.sops) warn(`sops not found — needed for secrets support.\n  ${installHint('sops')}`);
      if (!bins.age) warn(`age not found — needed for secrets support.\n  ${installHint('age')}`);

      if (bins.sops && bins.age) {
        ageAvailable = true;

        // Generate age key if missing
        if (!existsSync(AGE_KEY_FILE)) {
          try {
            await execFile('age-keygen', ['-o', AGE_KEY_FILE]);
            success(`Generated age key at ${AGE_KEY_FILE}`);
          } catch (e) {
            error(`Failed to generate age key: ${e instanceof Error ? e.message : e}`);
            ageAvailable = false;
          }
        } else {
          info(`Age key exists: ${AGE_KEY_FILE}`);
        }
      }

      // 6. Starter configs
      if (!existsSync(CONFIG_FILE)) {
        await writeFile(CONFIG_FILE, STARTER_CONFIG, 'utf-8');
        success('Created claude-env.yaml');
      } else {
        info('claude-env.yaml already exists');
      }

      const localExamplePath = `${CLAUDE_DIR}/settings.local.example.yaml`;
      if (!existsSync(localExamplePath)) {
        await writeFile(localExamplePath, LOCAL_EXAMPLE, 'utf-8');
        success('Created settings.local.example.yaml');
      }

      // .sops.yaml
      const sopsYamlPath = `${CLAUDE_DIR}/.sops.yaml`;
      if (ageAvailable && !existsSync(sopsYamlPath)) {
        const pubKey = await getAgePublicKey();
        if (pubKey) {
          await writeFile(sopsYamlPath, SOPS_YAML.replace('REPLACE_WITH_AGE_PUBLIC_KEY', pubKey), 'utf-8');
          success('Created .sops.yaml with age public key');
        }
      }

      // 7. Create empty secrets.enc.yaml if sops+age available
      if (ageAvailable && !existsSync(SECRETS_FILE)) {
        // Create a minimal encrypted file
        try {
          await writeFile(SECRETS_FILE, '{}', 'utf-8');
          await execFile('sops', ['--encrypt', '--in-place', SECRETS_FILE], {
            env: { ...process.env, SOPS_AGE_KEY_FILE: AGE_KEY_FILE },
          });
          success('Created empty secrets.enc.yaml');
        } catch (e) {
          warn(`Could not create encrypted secrets file: ${e instanceof Error ? e.message : e}`);
          // Clean up the plaintext file
          await writeFile(SECRETS_FILE, '', 'utf-8').catch(() => {});
        }
      }

      // 8. Initial commit if there are changes
      if (!(await isClean())) {
        await git('add', '-A');
        await git('commit', '-m', 'claude-env init');
        success('Created initial commit');
      }

      // 9. Check if claude-env is in PATH
      let inPath = false;
      try {
        await execFile('which', ['claude-env']);
        inPath = true;
      } catch {
        // not in PATH
      }

      // Summary
      info('\n── Setup complete ──');
      if (!inPath) {
        warn('claude-env is not in your PATH.');
        info('Install globally with:  npm install -g /path/to/claude-env');
        info('Or from Git:  npm install -g git+ssh://git@github.com/on6qd/claude-env.git');
      }
      if (!bins.sops || !bins.age) {
        info('Install sops + age to enable encrypted secrets.');
      }
      if (!ageAvailable) {
        info('If joining an existing team, copy your age key to ~/.claude-env-key.txt');
      }
      info('Run "claude-env doctor" to verify your setup.');
    });
}
