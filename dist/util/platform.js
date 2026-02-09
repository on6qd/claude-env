const KNOWN_PLATFORMS = new Set(['darwin', 'win32', 'linux']);
export function detectPlatform() {
    const p = process.platform;
    if (KNOWN_PLATFORMS.has(p))
        return p;
    // WSL reports 'linux'
    throw new Error(`Unsupported platform: ${p}`);
}
//# sourceMappingURL=platform.js.map