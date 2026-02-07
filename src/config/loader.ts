import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { CONFIG_FILE, LOCAL_CONFIG_FILE } from '../util/paths.js';
import type { ClaudeEnvConfig, LocalConfig } from './types.js';

export async function loadMainConfig(): Promise<ClaudeEnvConfig | null> {
  if (!existsSync(CONFIG_FILE)) return null;
  const content = await readFile(CONFIG_FILE, 'utf-8');
  const parsed = parseYaml(content);
  if (!parsed || typeof parsed !== 'object') return {};
  return parsed as ClaudeEnvConfig;
}

export async function loadLocalConfig(): Promise<LocalConfig | null> {
  if (!existsSync(LOCAL_CONFIG_FILE)) return null;
  const content = await readFile(LOCAL_CONFIG_FILE, 'utf-8');
  const parsed = parseYaml(content);
  if (!parsed || typeof parsed !== 'object') return {};
  return parsed as LocalConfig;
}
