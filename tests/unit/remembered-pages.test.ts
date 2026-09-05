import { describe, expect, it } from "vitest";
import { decideRememberedPageAction } from "../../src/background/remembered-pages";
import { applyPreferencesPatch } from "../../src/storage/preferences";
import { createDefaultPreferences } from "../../src/storage/schema";

const origin = "https://example.com";

function withPolicy(policy: "ask" | "always" | "disabled") {
  return applyPreferencesPatch(createDefaultPreferences(), {
    site: { origin, policy },
  });
}

describe("remembered-page policy decision", () => {
  it("detects first for ask and starts immediately for always", () => {
    expect(
      decideRememberedPageAction(withPolicy("ask"), origin, true, "bootstrap"),
    ).toBe("detect");
    expect(
      decideRememberedPageAction(
        withPolicy("always"),
        origin,
        true,
        "bootstrap",
      ),
    ).toBe("start");
  });

  it("allows a prompt-confirmed ask site to start", () => {
    expect(
      decideRememberedPageAction(withPolicy("ask"), origin, true, "start"),
    ).toBe("start");
  });

  it("stays inactive without permission, enabled language, or enabled policy", () => {
    expect(
      decideRememberedPageAction(withPolicy("ask"), origin, false, "bootstrap"),
    ).toBe("inactive");
    expect(
      decideRememberedPageAction(
        applyPreferencesPatch(withPolicy("ask"), { globalEnabled: false }),
        origin,
        true,
        "bootstrap",
      ),
    ).toBe("inactive");
    expect(
      decideRememberedPageAction(
        applyPreferencesPatch(withPolicy("ask"), { japaneseEnabled: false }),
        origin,
        true,
        "bootstrap",
      ),
    ).toBe("inactive");
    expect(
      decideRememberedPageAction(
        withPolicy("disabled"),
        origin,
        true,
        "bootstrap",
      ),
    ).toBe("inactive");
  });
});
