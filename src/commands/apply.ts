import { Command } from 'commander';
import { loadMainConfig, loadLocalConfig } from '../config/loader.js';
import { resolveConfig } from '../config/resolver.js';
import { info, die } from '../util/log.js';

export interface ApplyOptions {
  dryRun?: boolean;
}

export async function applyAction(_opts?: ApplyOptions): Promise<void> {
  const main = await loadMainConfig();
  const local = await loadLocalConfig();

  if (!main) {
    die('No claude-env.yaml found. Run "claude-env init" first.');
  }

  let resolved;
  try {
    resolved = await resolveConfig(main, local);
  } catch (e) {
    die(`Config resolution failed: ${e instanceof Error ? e.message : e}`);
  }

  // Print resolved config
  console.log(`\nPlatform: ${resolved.platform}\n`);

  // Variables
  const varEntries = Object.entries(resolved.variables);
  if (varEntries.length > 0) {
    console.log('Variables:');
    for (const [k, v] of varEntries) {
      console.log(`  ${k} = ${v}`);
    }
    console.log('');
  }

  // Servers
  if (resolved.servers.length > 0) {
    console.log('MCP Servers:');
    for (const server of resolved.servers) {
      const status = server.enabled ? 'enabled' : 'disabled';
      console.log(`  ${server.name} (${status})`);
      console.log(`    command: ${server.command}`);
      if (server.args.length > 0) {
        console.log(`    args: ${JSON.stringify(server.args)}`);
      }
      const envEntries = Object.entries(server.env);
      if (envEntries.length > 0) {
        console.log('    env:');
        for (const [k, v] of envEntries) {
          // Mask secret values
          const masked = v.length > 4 ? v.slice(0, 2) + '***' + v.slice(-2) : '***';
          console.log(`      ${k} = ${masked}`);
        }
      }
      if (Object.keys(server.passthrough).length > 0) {
        console.log(`    passthrough: ${JSON.stringify(server.passthrough)}`);
      }
    }
    console.log('');
  }

  // Skipped servers
  if (resolved.skippedServers.length > 0) {
    console.log('Skipped (no command for platform):');
    for (const name of resolved.skippedServers) {
      console.log(`  ${name}`);
    }
    console.log('');
  }

  info('Note: ~/.claude.json patching is not implemented in v0.1. Use "apply" in a future version.');
}

export function registerApply(program: Command): void {
  program
    .command('apply')
    .description('Parse, resolve, and display config (v0.1: validation only)')
    .option('--dry-run', 'Same as default in v0.1 (display only)')
    .action(async (opts: { dryRun?: boolean }) => {
      await applyAction({ dryRun: opts.dryRun });
    });
}
