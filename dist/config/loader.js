import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { CONFIG_FILE, LOCAL_CONFIG_FILE } from '../util/paths.js';
export async function loadMainConfig() {
    if (!existsSync(CONFIG_FILE))
        return null;
    const content = await readFile(CONFIG_FILE, 'utf-8');
    const parsed = parseYaml(content);
    if (!parsed || typeof parsed !== 'object')
        return {};
    return parsed;
}
export async function loadLocalConfig() {
    if (!existsSync(LOCAL_CONFIG_FILE))
        return null;
    const content = await readFile(LOCAL_CONFIG_FILE, 'utf-8');
    const parsed = parseYaml(content);
    if (!parsed || typeof parsed !== 'object')
        return {};
    return parsed;
}
//# sourceMappingURL=loader.js.map