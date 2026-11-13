import { describe, expect, it, vi } from "vitest";
import { createResilientFetch, networkErrorCode } from "@/lib/db-fetch";

// What undici throws: TypeError("fetch failed") with the real error as its cause.
const fetchFailed = (code: string) => Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error(code), { code }) });
const ok = () => new Response("{}", { status: 200 });

describe("database fetch", () => {
  it("finds the real cause behind 'fetch failed'", () => {
    expect(networkErrorCode(fetchFailed("ENOTFOUND"))).toBe("ENOTFOUND");
    expect(networkErrorCode(new Error("plain"))).toBeNull();
  });

  it("retries a failed DNS lookup and succeeds", async () => {
    const impl = vi.fn().mockRejectedValueOnce(fetchFailed("ENOTFOUND")).mockResolvedValueOnce(ok());
    const response = await createResilientFetch(impl, { delaysMs: [0, 0] })("https://db", { method: "POST" });
    expect(response.status).toBe(200);
    expect(impl).toHaveBeenCalledTimes(2);
  });

  it("gives up after the retries and throws the original error", async () => {
    const impl = vi.fn().mockRejectedValue(fetchFailed("EAI_AGAIN"));
    await expect(createResilientFetch(impl, { delaysMs: [0, 0] })("https://db")).rejects.toThrow("fetch failed");
    expect(impl).toHaveBeenCalledTimes(3);
  });

  it("never retries once the request may have reached the database", async () => {
    const reset = vi.fn().mockRejectedValue(fetchFailed("ECONNRESET"));
    await expect(createResilientFetch(reset, { delaysMs: [0, 0] })("https://db")).rejects.toThrow();
    expect(reset).toHaveBeenCalledTimes(1);

    const http = vi.fn().mockResolvedValue(new Response("bad", { status: 400 }));
    expect((await createResilientFetch(http, { delaysMs: [0, 0] })("https://db")).status).toBe(400);
    expect(http).toHaveBeenCalledTimes(1);
  });

  it("logs the cause so the next failure explains itself", async () => {
    const log = vi.fn();
    const impl = vi.fn().mockRejectedValueOnce(fetchFailed("ENOTFOUND")).mockResolvedValueOnce(ok());
    await createResilientFetch(impl, { delaysMs: [0, 0], log })("https://db");
    expect(log).toHaveBeenCalledWith(expect.stringContaining("ENOTFOUND"));
  });
});
