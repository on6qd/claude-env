import { Command } from 'commander';
import { pullAction } from './pull.js';

export function registerSync(program: Command): void {
  program
    .command('sync')
    .description('Sync config from remote (shorthand for pull)')
    .action(pullAction);
}
