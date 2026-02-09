import type { Platform } from '../util/platform.js';
/**
 * A value that is either a plain T or a per-platform map.
 * Platform maps are detected by checking if any key is darwin/win32/linux.
 */
export type PlatformValue<T> = T | Partial<Record<Platform, T>>;
export interface McpServerDefinition {
    enabled?: PlatformValue<boolean>;
    command?: PlatformValue<string>;
    args?: PlatformValue<string[]>;
    env?: PlatformValue<Record<string, string>>;
    [key: string]: unknown;
}
export interface ClaudeEnvConfig {
    variables?: Record<string, PlatformValue<string>>;
    mcp_servers?: Record<string, McpServerDefinition>;
}
export interface LocalConfig {
    variables?: Record<string, PlatformValue<string>>;
    mcp_servers?: Record<string, Partial<McpServerDefinition>>;
}
export interface ResolvedMcpServer {
    name: string;
    enabled: boolean;
    command: string;
    args: string[];
    env: Record<string, string>;
    passthrough: Record<string, unknown>;
}
export interface ResolvedConfig {
    platform: Platform;
    variables: Record<string, string>;
    servers: ResolvedMcpServer[];
    skippedServers: string[];
}
