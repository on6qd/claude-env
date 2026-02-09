import { Command } from 'commander';
export interface ApplyOptions {
    dryRun?: boolean;
}
export declare function applyAction(opts?: ApplyOptions): Promise<void>;
export declare function registerApply(program: Command): void;
