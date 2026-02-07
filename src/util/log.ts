let quiet = false;

export function setQuiet(value: boolean): void {
  quiet = value;
}

export function info(msg: string): void {
  if (!quiet) console.log(msg);
}

export function success(msg: string): void {
  if (!quiet) console.log(`✓ ${msg}`);
}

export function warn(msg: string): void {
  console.warn(`⚠ ${msg}`);
}

export function error(msg: string): void {
  console.error(`✗ ${msg}`);
}

export function die(msg: string, code = 1): never {
  error(msg);
  process.exit(code);
}
