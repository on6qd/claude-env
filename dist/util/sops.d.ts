export declare function checkSopsBinaries(): Promise<{
    sops: boolean;
    age: boolean;
}>;
export declare function decryptSecrets(): Promise<Record<string, string>>;
/**
 * Encrypt YAML plaintext to a file without ever writing plaintext to the
 * destination. Uses a temp file in the OS temp directory (outside the repo)
 * and cleans up on failure.
 */
export declare function encryptYamlToFile(plaintext: string, destPath: string): Promise<void>;
export declare function editSecrets(): Promise<void>;
export declare function setSecret(key: string, value: string): Promise<void>;
export declare function getAgePublicKey(): Promise<string | null>;
export declare function listSecretKeys(): Promise<string[]>;
