# claude-env

Sync your `~/.claude/` configuration across machines using Git and SOPS (age encryption). Define MCP servers, variables, and secrets in version-controlled YAML files, then apply the same setup everywhere you use Claude Code.

## Prerequisites

| Dependency | Required | Purpose |
|------------|----------|---------|
| **Node.js >= 18** | Yes | Runtime |
| **git** | Yes | Version control for `~/.claude/` |
| **sops** | No | Encrypt/decrypt secrets |
| **age** | No | Encryption backend for sops |

### Installing dependencies

<details>
<summary><strong>macOS</strong></summary>

```bash
brew install git       # or: xcode-select --install
brew install sops      # optional, for secrets
brew install age       # optional, for secrets
```

</details>

<details>
<summary><strong>Linux (Debian/Ubuntu)</strong></summary>

```bash
sudo apt install git
sudo apt install age                # optional, for secrets
# sops: download from https://github.com/getsops/sops/releases
```

</details>

<details>
<summary><strong>Linux (Fedora/RHEL)</strong></summary>

```bash
sudo dnf install git
# age: download from https://github.com/FiloSottile/age/releases
# sops: download from https://github.com/getsops/sops/releases
```

</details>

<details>
<summary><strong>Windows</strong></summary>

- **git**: Download from https://git-scm.com
- **sops**: Download from https://github.com/getsops/sops/releases
- **age**: Download from https://github.com/FiloSottile/age/releases

</details>

## Installation

```bash
npm install -g on6qd/claude-env
```

## Quick start

```bash
claude-env init
```

The wizard walks you through:

1. Creating `~/.claude/` if it doesn't exist
2. Initializing a git repo (or cloning an existing one)
3. Setting up a remote
4. Generating an age key and `.sops.yaml` (if sops + age are installed)
5. Writing starter config files
6. Making an initial commit

After init, run `claude-env doctor` to verify everything is set up correctly.

## Setting up a second machine

On the new machine:

```bash
npm install -g on6qd/claude-env
claude-env init          # paste the clone URL when prompted
```

Then copy your age key from the first machine:

```bash
# On the original machine, copy ~/.claude-env-key.txt
# On the new machine, paste it to the same path:
#   ~/.claude-env-key.txt
```

The age key file lives outside the repo and must be transferred out-of-band (e.g. via a password manager, airdrop, or secure copy).

## Commands

| Command | Description |
|---------|-------------|
| `claude-env init` | Interactive first-time setup |
| `claude-env apply` | Parse, resolve, and display config (v0.1: validation only) |
| `claude-env status` | Show resolved config for current platform |
| `claude-env doctor` | Run diagnostic checks |
| `claude-env pull` | Pull latest config from remote (rebase) |
| `claude-env push` | Stage, commit, and push config changes |
| `claude-env sync` | Sync config from remote (shorthand for pull) |
| `claude-env secret edit` | Edit secrets file in `$EDITOR` via sops |
| `claude-env secret set <key>` | Set a secret value |
| `claude-env secret list` | List secret keys (not values) |

All commands accept `-q` / `--quiet` to suppress informational output.

## Configuration

claude-env uses three YAML files inside `~/.claude/`:

### `claude-env.yaml` (committed)

Main configuration. Defines variables and MCP servers, optionally per-platform:

```yaml
variables:
  MY_VAR: "value"
  MY_PATH:
    darwin: "/usr/local/bin"
    linux: "/usr/bin"

mcp_servers:
  my-server:
    command: "node"
    args: ["${HOME}/mcp/server.js"]
    env:
      API_KEY: "${secret:MY_API_KEY}"
```

### `settings.local.yaml` (gitignored)

Machine-specific overrides. Same structure as `claude-env.yaml` — local values win on merge:

```yaml
variables:
  MY_VAR: "local-override"

mcp_servers:
  my-server:
    enabled: false
```

### `secrets.enc.yaml` (committed, encrypted)

SOPS-encrypted key-value pairs. Referenced in config as `${secret:KEY}`. Managed with `claude-env secret set` / `claude-env secret edit`.

## Troubleshooting

Run the built-in diagnostic:

```bash
claude-env doctor
```

This checks: Node version, git/sops/age availability, repo status, remote configuration, config file validity, and secret decryption.
