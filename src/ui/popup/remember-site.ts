export type RememberSiteResult =
  | "remembered"
  | "permission-denied"
  | "save-failed"
  | "forgotten"
  | "forget-failed";

export interface RememberSiteDependencies {
  requestPermission(): Promise<boolean>;
  savePolicy(remember: boolean): Promise<boolean>;
  removePermission(): Promise<boolean>;
  markExplanationSeen(): Promise<void>;
}

export async function changeRememberedSite(
  remember: boolean,
  dependencies: RememberSiteDependencies,
): Promise<RememberSiteResult> {
  if (!remember) {
    return (await dependencies.savePolicy(false))
      ? "forgotten"
      : "forget-failed";
  }
  if (!(await dependencies.requestPermission())) {
    await dependencies.markExplanationSeen();
    return "permission-denied";
  }
  if (await dependencies.savePolicy(true)) {
    return "remembered";
  }
  await dependencies.removePermission();
  return "save-failed";
}
