import type { Platform } from '../util/platform.js';
import type { PlatformValue, ClaudeEnvConfig, LocalConfig, ResolvedConfig } from './types.js';
export declare function resolvePlatformValue<T>(value: PlatformValue<T>, platform: Platform): T | undefined;
export declare function expandVariables(input: string, variables: Record<string, string>, secrets: Record<string, string>, platform: Platform): string;
export declare function resolveConfig(main: ClaudeEnvConfig | null, local: LocalConfig | null): Promise<ResolvedConfig>;
