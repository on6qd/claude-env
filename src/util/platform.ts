export type Platform = 'darwin' | 'win32' | 'linux';

const KNOWN_PLATFORMS: ReadonlySet<string> = new Set(['darwin', 'win32', 'linux']);

export function detectPlatform(): Platform {
  const p = process.platform;
  if (KNOWN_PLATFORMS.has(p)) return p as Platform;
  // WSL reports 'linux'
  throw new Error(`Unsupported platform: ${p}`);
}
