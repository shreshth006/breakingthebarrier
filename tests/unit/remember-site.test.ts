import { describe, expect, it, vi } from "vitest";
import { changeRememberedSite } from "../../src/ui/popup/remember-site";

function dependencies(overrides: {
  readonly permission?: boolean;
  readonly saved?: boolean;
} = {}) {
  return {
    requestPermission: vi.fn(() =>
      Promise.resolve(overrides.permission ?? true),
    ),
    savePolicy: vi.fn(() => Promise.resolve(overrides.saved ?? true)),
    removePermission: vi.fn(() => Promise.resolve(true)),
    markExplanationSeen: vi.fn(() => Promise.resolve()),
  };
}

describe("remember-site interaction", () => {
  it("requests access before saving remembered policy", async () => {
    const calls: string[] = [];
    const deps = dependencies();
    deps.requestPermission.mockImplementation(() => {
      calls.push("permission");
      return Promise.resolve(true);
    });
    deps.savePolicy.mockImplementation(() => {
      calls.push("policy");
      return Promise.resolve(true);
    });

    expect(await changeRememberedSite(true, deps)).toBe("remembered");
    expect(calls).toEqual(["permission", "policy"]);
    expect(deps.savePolicy).toHaveBeenCalledWith(true);
  });

  it("records a denial without saving policy or repeatedly requesting", async () => {
    const deps = dependencies({ permission: false });

    expect(await changeRememberedSite(true, deps)).toBe("permission-denied");
    expect(deps.markExplanationSeen).toHaveBeenCalledOnce();
    expect(deps.savePolicy).not.toHaveBeenCalled();
    expect(deps.removePermission).not.toHaveBeenCalled();
  });

  it("rolls back a granted permission when registration cannot be saved", async () => {
    const deps = dependencies({ saved: false });

    expect(await changeRememberedSite(true, deps)).toBe("save-failed");
    expect(deps.removePermission).toHaveBeenCalledOnce();
  });

  it("forgets policy without opening another permission prompt", async () => {
    const deps = dependencies();

    expect(await changeRememberedSite(false, deps)).toBe("forgotten");
    expect(deps.requestPermission).not.toHaveBeenCalled();
    expect(deps.savePolicy).toHaveBeenCalledWith(false);
  });
});
