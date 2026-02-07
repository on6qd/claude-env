# claude-env

TypeScript ESM CLI that syncs `~/.claude/` configuration across environments via Git + SOPS (age encryption).

## Build & Run

```bash
npm run build    # tsc → dist/
npm run dev      # tsx src/index.ts (no compile step)
```

Requires Node >= 18. On this machine Node 22 lives at the default PATH location.

## Code Conventions

- **ESM with `.js` extensions** on all relative imports (required by `module: Node16`)
- **Commands** live in `src/commands/` and export a `registerXxx(program)` function; register them in `src/index.ts`
- **Subprocesses**: always `execFile`, never `exec` (avoid shell injection)
- **Errors**: `die(msg)` for fatal (prints + `process.exit`), `warn(msg)` for non-fatal — both from `src/util/log.js`
- **Naming**: types `PascalCase`, functions `camelCase`, constants `SCREAMING_SNAKE`
- **Imports**: use `import type` for type-only imports

## Architecture

```
src/
  commands/   # CLI commands (init, apply, status, doctor, pull, push, sync, secret)
  config/     # types.ts, loader.ts, resolver.ts — config loading & resolution
  util/       # log.ts, paths.ts, platform.ts, git.ts, sops.ts — shared helpers
  index.ts    # Entry point, registers commands with Commander
```

**Config resolution flow** (`resolver.ts`):

1. Load `claude-env.yaml` (main) + `settings.local.yaml` (local overrides, gitignored)
2. Detect platform (`darwin | linux | win32`)
3. Collapse `PlatformValue<T>` maps to current platform
4. Merge local variables/servers over main (local wins)
5. Decrypt `secrets.enc.yaml` only if `${secret:KEY}` references exist
6. Single-pass variable expansion (definition order): built-ins (`${HOME}`, `${PLATFORM}`), secrets (`${secret:X}`), user variables, then env fallback
7. Resolve MCP servers: platform-collapse fields, expand variables in command/args/env, collect passthrough fields

## Key Constraints

- **Single-pass variable expansion** — variables cannot reference other variables defined after them
- **Platform map detection** — a value is treated as a platform map if it is an object with only `darwin`/`linux`/`win32` keys; keep this heuristic in mind when adding fields
- **Age key** (`~/.claude-env-key.txt`) lives outside the repo and must be shared out-of-band
- `apply` is display-only in v0.1 — does not yet patch `~/.claude.json`

## Tests

No test framework is configured yet.
