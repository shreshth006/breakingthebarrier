import { describe, expect, it } from "vitest";
import { LruCache } from "../../src/shared/lru";

describe("LruCache", () => {
  it("refreshes reads and evicts the least recently used entry", () => {
    const cache = new LruCache<string, number>(2);
    cache.set("first", 1);
    cache.set("second", 2);
    expect(cache.get("first")).toBe(1);
    cache.set("third", 3);
    expect(cache.get("second")).toBeUndefined();
    expect(cache.get("first")).toBe(1);
    expect(cache.get("third")).toBe(3);
  });
});
