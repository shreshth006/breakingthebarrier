import type { RememberedPageCommand } from "../shared/messages";
import type { PreferencesSchema } from "../storage/schema";

export type RememberedPageDecision = "inactive" | "detect" | "start";

export function decideRememberedPageAction(
  preferences: PreferencesSchema,
  origin: string,
  permissionGranted: boolean,
  command: RememberedPageCommand,
): RememberedPageDecision {
  const policy = preferences.sites[origin]?.policy;
  if (
    !preferences.globalEnabled ||
    !preferences.languages.ja.enabled ||
    !permissionGranted ||
    policy === undefined ||
    policy === "disabled"
  ) {
    return "inactive";
  }
  if (command === "start" || policy === "always") {
    return "start";
  }
  return "detect";
}
