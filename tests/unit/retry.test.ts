import { describe, expect, it, vi } from "vitest";
import { runWithOneRetry } from "../../src/processor/retry";

describe("bounded retry", () => {
  it("returns the first successful attempt without retrying", async () => {
    const operation = vi.fn().mockResolvedValue("ready");

    await expect(runWithOneRetry(operation)).resolves.toBe("ready");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("retries once after a failure", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("worker exited"))
      .mockResolvedValueOnce("recovered");

    await expect(runWithOneRetry(operation)).resolves.toBe("recovered");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("surfaces the second failure without a third attempt", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("first failure"))
      .mockRejectedValueOnce(new Error("second failure"));

    await expect(runWithOneRetry(operation)).rejects.toThrow("second failure");
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
