import { describe, expect, it } from "vitest";
import { FrameSessionStore } from "../../src/background/frame-sessions";
import type { SessionStorageArea } from "../../src/background/frame-sessions";
import {
  ACTIVE_FRAME_SESSION_STORAGE_KEY,
  REMEMBERED_FRAME_SESSION_STORAGE_KEY,
} from "../../src/shared/config";

class MemorySessionStorage implements SessionStorageArea {
  readonly values: Record<string, unknown>;

  constructor(values: Record<string, unknown> = {}) {
    this.values = { ...values };
  }

  get(key: string): Promise<Record<string, unknown>> {
    return Promise.resolve({ [key]: this.values[key] });
  }

  set(items: Record<string, unknown>): Promise<void> {
    Object.assign(this.values, items);
    return Promise.resolve();
  }
}

describe("ephemeral frame sessions", () => {
  it("serializes active-tab changes and filters invalid recovery entries", async () => {
    const storage = new MemorySessionStorage({
      [ACTIVE_FRAME_SESSION_STORAGE_KEY]: [1, -1, 1.5, "2"],
    });
    const sessions = new FrameSessionStore(storage);

    expect(await sessions.setActive(2, true)).toBe(2);
    expect(await sessions.setActive(1, false)).toBe(1);
    expect(storage.values[ACTIVE_FRAME_SESSION_STORAGE_KEY]).toEqual([2]);
  });

  it("stores origins without paths and takes only revoked-origin frames", async () => {
    const storage = new MemorySessionStorage({
      [REMEMBERED_FRAME_SESSION_STORAGE_KEY]: [
        { tabId: 8, origin: "https://invalid.example/path" },
        { tabId: "9", origin: "https://example.com" },
      ],
    });
    const sessions = new FrameSessionStore(storage);

    await sessions.setRemembered(1, "https://example.com");
    await sessions.setRemembered(2, "https://other.example");
    expect(
      await sessions.takeRemembered(new Set(["https://example.com"])),
    ).toEqual([1]);
    expect(storage.values[REMEMBERED_FRAME_SESSION_STORAGE_KEY]).toEqual([
      { tabId: 2, origin: "https://other.example" },
    ]);
    expect(
      await sessions.takeDisallowedRemembered(
        new Set(["https://allowed.example"]),
      ),
    ).toEqual([2]);
    expect(storage.values[REMEMBERED_FRAME_SESSION_STORAGE_KEY]).toEqual([]);
  });

  it("rejects non-canonical remembered origins", async () => {
    const sessions = new FrameSessionStore(new MemorySessionStorage());
    await expect(
      sessions.setRemembered(1, "https://example.com/private"),
    ).rejects.toThrow("canonical origin");
  });
});
