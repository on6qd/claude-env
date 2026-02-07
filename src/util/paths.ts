import { homedir } from 'node:os';
import { join } from 'node:path';

const HOME = homedir();

export const CLAUDE_DIR = join(HOME, '.claude');
export const CLAUDE_JSON = join(HOME, '.claude.json');
export const CONFIG_FILE = join(CLAUDE_DIR, 'claude-env.yaml');
export const LOCAL_CONFIG_FILE = join(CLAUDE_DIR, 'settings.local.yaml');
export const SECRETS_FILE = join(CLAUDE_DIR, 'secrets.enc.yaml');
export const AGE_KEY_FILE = join(HOME, '.claude-env-key.txt');
