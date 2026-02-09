import type { ClaudeEnvConfig, LocalConfig } from './types.js';
export declare function loadMainConfig(): Promise<ClaudeEnvConfig | null>;
export declare function loadLocalConfig(): Promise<LocalConfig | null>;
