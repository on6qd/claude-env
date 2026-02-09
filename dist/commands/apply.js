import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { loadMainConfig, loadLocalConfig } from '../config/loader.js';
import { resolveConfig } from '../config/resolver.js';
import { CLAUDE_JSON } from '../util/paths.js';
import { info, success, die } from '../util/log.js';
function buildMcpEntry(server) {
    const entry = {
        type: 'stdio',
        command: server.command,
        args: server.args,
    };
    if (Object.keys(server.env).length > 0) {
        entry.env = server.env;
    }
    // Spread passthrough fields (e.g. custom keys the user added)
    for (const [k, v] of Object.entries(server.passthrough)) {
        entry[k] = v;
    }
    return entry;
}
function printSummary(resolved) {
    const enabled = resolved.servers.filter((s) => s.enabled);
    const disabled = resolved.servers.filter((s) => !s.enabled);
    if (enabled.length > 0) {
        info('MCP Servers applied:');
        for (const s of enabled) {
            info(`  + ${s.name}  (${s.command})`);
        }
    }
    if (disabled.length > 0) {
        info('MCP Servers removed (disabled):');
        for (const s of disabled) {
            info(`  - ${s.name}`);
        }
    }
    if (resolved.skippedServers.length > 0) {
        info('Skipped (no command for platform):');
        for (const name of resolved.skippedServers) {
            info(`  ~ ${name}`);
        }
    }
}
export async function applyAction(opts) {
    const dryRun = opts?.dryRun ?? false;
    // 1. Resolve config
    const main = await loadMainConfig();
    const local = await loadLocalConfig();
    if (!main) {
        die('No claude-env.yaml found. Run "claude-env init" first.');
    }
    let resolved;
    try {
        resolved = await resolveConfig(main, local);
    }
    catch (e) {
        die(`Config resolution failed: ${e instanceof Error ? e.message : e}`);
    }
    // 2. Read existing ~/.claude.json (or start fresh)
    let claudeJson = {};
    if (existsSync(CLAUDE_JSON)) {
        try {
            const raw = await readFile(CLAUDE_JSON, 'utf-8');
            claudeJson = JSON.parse(raw);
        }
        catch (e) {
            die(`Failed to parse ${CLAUDE_JSON}: ${e instanceof Error ? e.message : e}`);
        }
    }
    // 3. Get or create mcpServers object
    const existing = (claudeJson.mcpServers ?? {});
    // Build set of server names managed by claude-env (all defined, enabled or not)
    const managedNames = new Set();
    for (const server of resolved.servers) {
        managedNames.add(server.name);
    }
    // Start with existing servers NOT managed by claude-env
    const merged = {};
    for (const [name, value] of Object.entries(existing)) {
        if (!managedNames.has(name)) {
            merged[name] = value;
        }
    }
    // Add enabled servers from claude-env
    for (const server of resolved.servers) {
        if (server.enabled) {
            merged[server.name] = buildMcpEntry(server);
        }
        // Disabled servers: intentionally not added (removed if they existed)
    }
    claudeJson.mcpServers = merged;
    // 4. Dry-run: show what would happen, then exit
    if (dryRun) {
        info('[dry-run] Would write to ' + CLAUDE_JSON + ':\n');
        printSummary(resolved);
        return;
    }
    // 5. Write ~/.claude.json
    await writeFile(CLAUDE_JSON, JSON.stringify(claudeJson, null, 2) + '\n', 'utf-8');
    success(`Wrote ${CLAUDE_JSON}`);
    printSummary(resolved);
}
export function registerApply(program) {
    program
        .command('apply')
        .description('Resolve config and write MCP servers to ~/.claude.json')
        .option('--dry-run', 'Preview changes without writing')
        .action(async (opts) => {
        await applyAction({ dryRun: opts.dryRun });
    });
}
//# sourceMappingURL=apply.js.map