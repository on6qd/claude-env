#!/usr/bin/env node

// Node version check
const major = parseInt(process.version.replace('v', ''), 10);
if (major < 18) {
  console.error(`claude-env requires Node.js >= 18 (current: ${process.version})`);
  process.exit(1);
}

import { Command } from 'commander';
import { setQuiet } from './util/log.js';
import { registerInit } from './commands/init.js';
import { registerApply } from './commands/apply.js';
import { registerStatus } from './commands/status.js';
import { registerDoctor } from './commands/doctor.js';
import { registerPull } from './commands/pull.js';
import { registerPush } from './commands/push.js';
import { registerSync } from './commands/sync.js';
import { registerSecret } from './commands/secret.js';

const program = new Command();

program
  .name('claude-env')
  .description('Sync ~/.claude/ config across environments via Git + SOPS')
  .version('0.1.0')
  .option('-q, --quiet', 'Suppress informational output')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.quiet) setQuiet(true);
  });

registerInit(program);
registerApply(program);
registerStatus(program);
registerDoctor(program);
registerPull(program);
registerPush(program);
registerSync(program);
registerSecret(program);

await program.parseAsync();
