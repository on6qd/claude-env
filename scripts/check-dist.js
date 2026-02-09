import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distIndex = join(__dirname, "..", "dist", "index.js");

if (!existsSync(distIndex)) {
  // dist/ is missing — check if tsc is available to build it
  try {
    execFileSync("tsc", ["--version"], { stdio: "ignore" });
  } catch {
    console.error(`
╔══════════════════════════════════════════════════════════════════╗
║                  claude-env — install failed                    ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  The compiled dist/ folder is missing and the TypeScript        ║
║  compiler (tsc) was not found on your system.                   ║
║                                                                 ║
║  Fix: install TypeScript first, then retry:                     ║
║                                                                 ║
║    npm install -g typescript                                    ║
║    npm install -g on6qd/claude-env                              ║
║                                                                 ║
╚══════════════════════════════════════════════════════════════════╝
`);
    process.exit(1);
  }
}
