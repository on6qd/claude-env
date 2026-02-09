import { git, hasRemote, ensureSshRemote } from '../util/git.js';
import { success, warn, die } from '../util/log.js';

export async function pullAction(): Promise<void> {
  if (!(await hasRemote())) {
    die('No remote configured. Run: git -C ~/.claude remote add origin <url>');
  }

  // Ensure SSH remote (convert HTTPS → SSH if needed)
  const converted = await ensureSshRemote();
  if (converted) success(`Switched remote to SSH: ${converted}`);

  try {
    await git('pull', '--rebase', '--autostash');
    success('Pulled and rebased successfully');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('CONFLICT') || msg.includes('rebase')) {
      warn('Rebase conflict detected. Aborting rebase.');
      try {
        await git('rebase', '--abort');
      } catch {
        // Already aborted or not in rebase
      }
      die(
        'Merge conflict during pull. Resolve manually:\n' +
          '  cd ~/.claude\n' +
          '  git pull --rebase\n' +
          '  # resolve conflicts\n' +
          '  git rebase --continue',
      );
    }
    die(`Pull failed: ${msg}`);
  }
}
