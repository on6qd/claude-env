import type { Platform } from '../util/platform.js';
import type {
  PlatformValue,
  ClaudeEnvConfig,
  LocalConfig,
  McpServerDefinition,
  ResolvedMcpServer,
  ResolvedConfig,
} from './types.js';
import { detectPlatform } from '../util/platform.js';
import { decryptSecrets } from '../util/sops.js';
import { warn } from '../util/log.js';

const PLATFORM_KEYS: ReadonlySet<string> = new Set(['darwin', 'win32', 'linux']);

function isPlatformMap(value: unknown): value is Partial<Record<Platform, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.keys(value).some((k) => PLATFORM_KEYS.has(k));
}

export function resolvePlatformValue<T>(value: PlatformValue<T>, platform: Platform): T | undefined {
  if (isPlatformMap(value)) {
    return (value as Partial<Record<Platform, T>>)[platform];
  }
  return value as T;
}

export function expandVariables(
  input: string,
  variables: Record<string, string>,
  secrets: Record<string, string>,
  platform: Platform,
): string {
  return input.replace(/\$\{([^}]+)\}/g, (_match, expr: string) => {
    // Built-in variables
    if (expr === 'HOME') return process.env.HOME ?? process.env.USERPROFILE ?? '';
    if (expr === 'PLATFORM') return platform;

    // Secret reference
    if (expr.startsWith('secret:')) {
      const key = expr.slice('secret:'.length);
      if (key in secrets) return secrets[key];
      warn(`Unresolved secret: ${key}`);
      return `\${${expr}}`;
    }

    // Explicit env reference: ${env:VARNAME}
    if (expr.startsWith('env:')) {
      const envKey = expr.slice('env:'.length);
      if (envKey in process.env) return process.env[envKey]!;
      warn(`Unresolved env variable: ${envKey}`);
      return `\${${expr}}`;
    }

    // User-defined variables
    if (expr in variables) return variables[expr];

    // Environment variable fallback (prefer explicit ${env:VARNAME} syntax)
    if (expr in process.env) {
      warn(`"\${${expr}}" resolved via env fallback — use "\${env:${expr}}" for explicit env access`);
      return process.env[expr]!;
    }

    warn(`Unresolved variable: ${expr}`);
    return `\${${expr}}`;
  });
}

function expandRecord(
  record: Record<string, string>,
  variables: Record<string, string>,
  secrets: Record<string, string>,
  platform: Platform,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(record)) {
    result[k] = expandVariables(v, variables, secrets, platform);
  }
  return result;
}

function expandArray(
  arr: string[],
  variables: Record<string, string>,
  secrets: Record<string, string>,
  platform: Platform,
): string[] {
  return arr.map((item) => expandVariables(item, variables, secrets, platform));
}

const KNOWN_SERVER_KEYS: ReadonlySet<string> = new Set(['enabled', 'command', 'args', 'env']);

export async function resolveConfig(
  main: ClaudeEnvConfig | null,
  local: LocalConfig | null,
): Promise<ResolvedConfig> {
  const platform = detectPlatform();
  main = main ?? {};
  local = local ?? {};

  // 1. Resolve variables from main (platform-collapse)
  const variables: Record<string, string> = {};
  if (main.variables) {
    for (const [key, val] of Object.entries(main.variables)) {
      const resolved = resolvePlatformValue(val, platform);
      if (resolved !== undefined) variables[key] = resolved;
    }
  }

  // 2. Override with local variables
  if (local.variables) {
    for (const [key, val] of Object.entries(local.variables)) {
      const resolved = resolvePlatformValue(val, platform);
      if (resolved !== undefined) variables[key] = resolved;
    }
  }

  // 3. Decrypt secrets (only error if actually referenced)
  let secrets: Record<string, string> = {};
  let secretsError: Error | null = null;
  try {
    secrets = await decryptSecrets();
  } catch (e) {
    secretsError = e instanceof Error ? e : new Error(String(e));
  }

  // Check if any secret is referenced
  const allValues = Object.values(variables).join('\n');
  const mainYaml = JSON.stringify(main.mcp_servers ?? {});
  const localYaml = JSON.stringify(local.mcp_servers ?? {});
  const combinedText = allValues + mainYaml + localYaml;
  if (secretsError && combinedText.includes('${secret:')) {
    throw secretsError;
  }

  // 4. Expand variables in variable values (single-pass, definition order)
  for (const key of Object.keys(variables)) {
    variables[key] = expandVariables(variables[key], variables, secrets, platform);
  }

  // 5. Merge server definitions: main + local deep-merge per-server
  const mergedServers: Record<string, McpServerDefinition> = {};
  if (main.mcp_servers) {
    for (const [name, def] of Object.entries(main.mcp_servers)) {
      mergedServers[name] = { ...def };
    }
  }
  if (local.mcp_servers) {
    for (const [name, def] of Object.entries(local.mcp_servers)) {
      if (name in mergedServers) {
        // Deep-merge: local fields override per-field
        mergedServers[name] = { ...mergedServers[name], ...def };
      } else {
        mergedServers[name] = { ...def };
      }
    }
  }

  // 6. Resolve each server
  const servers: ResolvedMcpServer[] = [];
  const skippedServers: string[] = [];

  for (const [name, def] of Object.entries(mergedServers)) {
    const enabled = resolvePlatformValue(def.enabled as PlatformValue<boolean>, platform) ?? true;
    const command = resolvePlatformValue(def.command as PlatformValue<string>, platform);
    const args = resolvePlatformValue(def.args as PlatformValue<string[]>, platform) ?? [];
    const envMap = resolvePlatformValue(def.env as PlatformValue<Record<string, string>>, platform) ?? {};

    if (!command) {
      skippedServers.push(name);
      continue;
    }

    // Collect passthrough fields
    const passthrough: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(def)) {
      if (!KNOWN_SERVER_KEYS.has(k)) {
        passthrough[k] = resolvePlatformValue(v as PlatformValue<unknown>, platform);
      }
    }

    servers.push({
      name,
      enabled,
      command: expandVariables(command, variables, secrets, platform),
      args: expandArray(args, variables, secrets, platform),
      env: expandRecord(envMap, variables, secrets, platform),
      passthrough,
    });
  }

  return { platform, variables, servers, skippedServers };
}
