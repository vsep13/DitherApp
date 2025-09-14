// Placeholder to keep path import stable (no-op; could be extended)
export function encode(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

