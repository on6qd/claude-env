import { git, isClean, hasRemote, ensureSshRemote } from '../util/git.js';
import { pullAction } from './pull.js';
import { applyAction } from './apply.js';
import { info, success, warn } from '../util/log.js';
const MANAGED_FILES = [
    'claude-env.yaml',
    '.gitignore',
    '.sops.yaml',
    'secrets.enc.yaml',
    'settings.local.example.yaml',
];
export function registerSync(program) {
    program
        .command('sync')
        .description('Pull latest config from remote, then apply to ~/.claude.json')
        .option('--dry-run', 'Preview changes without writing')
        .action(async (opts) => {
        // 1. Pull from remote if configured
        if (await hasRemote()) {
            await pullAction();
        }
        else {
            warn('No remote configured — skipping pull.');
        }
        // 2. Apply resolved config
        info('');
        await applyAction({ dryRun: opts.dryRun });
        if (opts.dryRun)
            return;
        // 3. Commit managed files if anything changed
        if (!(await isClean())) {
            try {
                for (const file of MANAGED_FILES) {
                    try {
                        await git('add', file);
                    }
                    catch { /* file may not exist */ }
                }
                await git('commit', '-m', 'claude-env sync');
                success('Committed changes');
            }
            catch (e) {
                warn(`Auto-commit failed: ${e instanceof Error ? e.message : e}`);
            }
        }
        // 4. Push if remote is configured
        if (await hasRemote()) {
            const converted = await ensureSshRemote();
            if (converted)
                success(`Switched remote to SSH: ${converted}`);
            try {
                await git('push', '-u', 'origin', 'HEAD');
                success('Pushed to remote');
            }
            catch (e) {
                warn(`Push failed (will retry next time): ${e instanceof Error ? e.message : e}`);
            }
        }
    });
}
//# sourceMappingURL=sync.js.map