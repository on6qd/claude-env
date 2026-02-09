import { detectPlatform } from '../util/platform.js';
import { decryptSecrets } from '../util/sops.js';
import { warn } from '../util/log.js';
const PLATFORM_KEYS = new Set(['darwin', 'win32', 'linux']);
function isPlatformMap(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return false;
    return Object.keys(value).some((k) => PLATFORM_KEYS.has(k));
}
export function resolvePlatformValue(value, platform) {
    if (isPlatformMap(value)) {
        return value[platform];
    }
    return value;
}
export function expandVariables(input, variables, secrets, platform) {
    return input.replace(/\$\{([^}]+)\}/g, (_match, expr) => {
        // Built-in variables
        if (expr === 'HOME')
            return process.env.HOME ?? process.env.USERPROFILE ?? '';
        if (expr === 'PLATFORM')
            return platform;
        // Secret reference
        if (expr.startsWith('secret:')) {
            const key = expr.slice('secret:'.length);
            if (key in secrets)
                return secrets[key];
            warn(`Unresolved secret: ${key}`);
            return `\${${expr}}`;
        }
        // Explicit env reference: ${env:VARNAME}
        if (expr.startsWith('env:')) {
            const envKey = expr.slice('env:'.length);
            if (envKey in process.env)
                return process.env[envKey];
            warn(`Unresolved env variable: ${envKey}`);
            return `\${${expr}}`;
        }
        // User-defined variables
        if (expr in variables)
            return variables[expr];
        // Environment variable fallback (prefer explicit ${env:VARNAME} syntax)
        if (expr in process.env) {
            warn(`"\${${expr}}" resolved via env fallback — use "\${env:${expr}}" for explicit env access`);
            return process.env[expr];
        }
        warn(`Unresolved variable: ${expr}`);
        return `\${${expr}}`;
    });
}
function expandRecord(record, variables, secrets, platform) {
    const result = {};
    for (const [k, v] of Object.entries(record)) {
        result[k] = expandVariables(v, variables, secrets, platform);
    }
    return result;
}
function expandArray(arr, variables, secrets, platform) {
    return arr.map((item) => expandVariables(item, variables, secrets, platform));
}
const KNOWN_SERVER_KEYS = new Set(['enabled', 'command', 'args', 'env']);
export async function resolveConfig(main, local) {
    const platform = detectPlatform();
    main = main ?? {};
    local = local ?? {};
    // 1. Resolve variables from main (platform-collapse)
    const variables = {};
    if (main.variables) {
        for (const [key, val] of Object.entries(main.variables)) {
            const resolved = resolvePlatformValue(val, platform);
            if (resolved !== undefined)
                variables[key] = resolved;
        }
    }
    // 2. Override with local variables
    if (local.variables) {
        for (const [key, val] of Object.entries(local.variables)) {
            const resolved = resolvePlatformValue(val, platform);
            if (resolved !== undefined)
                variables[key] = resolved;
        }
    }
    // 3. Decrypt secrets (only error if actually referenced)
    let secrets = {};
    let secretsError = null;
    try {
        secrets = await decryptSecrets();
    }
    catch (e) {
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
    const mergedServers = {};
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
            }
            else {
                mergedServers[name] = { ...def };
            }
        }
    }
    // 6. Resolve each server
    const servers = [];
    const skippedServers = [];
    for (const [name, def] of Object.entries(mergedServers)) {
        const enabled = resolvePlatformValue(def.enabled, platform) ?? true;
        const command = resolvePlatformValue(def.command, platform);
        const args = resolvePlatformValue(def.args, platform) ?? [];
        const envMap = resolvePlatformValue(def.env, platform) ?? {};
        if (!command) {
            skippedServers.push(name);
            continue;
        }
        // Collect passthrough fields
        const passthrough = {};
        for (const [k, v] of Object.entries(def)) {
            if (!KNOWN_SERVER_KEYS.has(k)) {
                passthrough[k] = resolvePlatformValue(v, platform);
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
//# sourceMappingURL=resolver.js.map