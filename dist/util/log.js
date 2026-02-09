let quiet = false;
export function setQuiet(value) {
    quiet = value;
}
export function info(msg) {
    if (!quiet)
        console.log(msg);
}
export function success(msg) {
    if (!quiet)
        console.log(`✓ ${msg}`);
}
export function warn(msg) {
    console.warn(`⚠ ${msg}`);
}
export function error(msg) {
    console.error(`✗ ${msg}`);
}
export function die(msg, code = 1) {
    error(msg);
    process.exit(code);
}
//# sourceMappingURL=log.js.map