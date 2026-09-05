import { normalizeOrigin, originMatchPattern } from "../shared/origins";

export interface CurrentSite {
  readonly origin: string;
  readonly host: string;
}

export async function getCurrentSite(): Promise<CurrentSite | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const origin = normalizeOrigin(tab?.url ?? "");
  if (origin === null) {
    return null;
  }
  return { origin, host: new URL(origin).host };
}

export function requestSitePermission(origin: string): Promise<boolean> {
  return chrome.permissions.request({ origins: [originMatchPattern(origin)] });
}

export function removeSitePermission(origin: string): Promise<boolean> {
  return chrome.permissions.remove({ origins: [originMatchPattern(origin)] });
}
