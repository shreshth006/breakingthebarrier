export function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.hostname.length === 0
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function originMatchPattern(origin: string): string {
  const normalized = normalizeOrigin(origin);
  if (normalized === null) {
    throw new Error("Site access requires an HTTP(S) origin");
  }
  return `${normalized}/*`;
}
