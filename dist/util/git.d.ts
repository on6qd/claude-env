export interface GitResult {
    stdout: string;
    stderr: string;
}
export declare function git(...args: string[]): Promise<GitResult>;
export declare function isGitRepo(): Promise<boolean>;
export declare function hasRemote(): Promise<boolean>;
export declare function isClean(): Promise<boolean>;
export declare function getRemoteUrl(name?: string): Promise<string | null>;
/** Convert an HTTPS git URL to SSH format. Returns null if not HTTPS. */
export declare function httpsToSsh(url: string): string | null;
/**
 * If origin is an HTTPS URL, switch it to SSH.
 * Returns the new URL if converted, null if already SSH or no remote.
 */
export declare function ensureSshRemote(name?: string): Promise<string | null>;
