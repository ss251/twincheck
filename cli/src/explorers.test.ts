import { describe, expect, test } from "bun:test";
import {
  backoffMs,
  classifyScanResponse,
  classifyVisionResponse,
  evidenceHashPayload,
  fetchWithRetry,
  hasProbeError,
  isRetryableStatus,
  type DualResult,
} from "./explorers";

describe("classifyVisionResponse", () => {
  test("exact_match is verified", () => {
    const r = classifyVisionResponse(200, { match: "exact_match" });
    expect(r).toEqual({ ok: true, error: false, signal: "exact_match" });
  });

  test("partial/runtime match is verified", () => {
    expect(classifyVisionResponse(200, { match: "partial_match" }).ok).toBe(true);
    expect(classifyVisionResponse(200, { runtimeMatch: "match" }).ok).toBe(true);
  });

  test("404 is a GENUINE unverified, not an error", () => {
    const r = classifyVisionResponse(404, null);
    expect(r).toEqual({ ok: false, error: false, signal: "unverified" });
  });

  test("null match on 200 is genuine unverified", () => {
    const r = classifyVisionResponse(200, { match: null });
    expect(r).toEqual({ ok: false, error: false, signal: "unverified" });
  });

  test("5xx is an ERROR, never unverified", () => {
    const r = classifyVisionResponse(503, null);
    expect(r.error).toBe(true);
    expect(r.ok).toBe(false);
    expect(r.signal).toBe("http_503");
  });

  test("429 rate limit is an ERROR", () => {
    expect(classifyVisionResponse(429, null).error).toBe(true);
  });

  test("non-object body on 200 is an ERROR", () => {
    expect(classifyVisionResponse(200, null).error).toBe(true);
    expect(classifyVisionResponse(200, null).signal).toBe("bad_json");
  });

  test("schema-invalid and unknown match values are indeterminate", () => {
    for (const body of [
      {},
      [],
      { match: true },
      { match: "full_match" },
      { match: "null" },
      { match: "exact_match", runtimeMatch: "unexpected" },
    ]) {
      const r = classifyVisionResponse(200, body);
      expect(r.ok).toBe(false);
      expect(r.error).toBe(true);
    }
  });
});

describe("classifyScanResponse", () => {
  test("meta Verified is verified", () => {
    const html = `<meta content="Contract: Verified — deployed" />`;
    const r = classifyScanResponse(200, html);
    expect(r).toEqual({ ok: true, error: false, signal: "verified" });
  });

  test("meta Unverified is GENUINE unverified", () => {
    const html = `<meta content="Contract: Unverified — deployed" />`;
    const r = classifyScanResponse(200, html);
    expect(r).toEqual({ ok: false, error: false, signal: "unverified" });
  });

  test("Verify-and-Publish CTA is genuine unverified", () => {
    const html = `Verify and Publish your contract ... the contract creator`;
    const r = classifyScanResponse(200, html);
    expect(r).toEqual({ ok: false, error: false, signal: "unverified_cta" });
  });

  test("unparseable page is an ERROR, never unverified", () => {
    const r = classifyScanResponse(200, "<html>Checking your browser…</html>");
    expect(r.error).toBe(true);
    expect(r.signal).toBe("unparseable_page");
  });

  test("5xx / 429 / 403 statuses are ERRORS", () => {
    for (const s of [500, 502, 503, 429, 403]) {
      const r = classifyScanResponse(s, "");
      expect(r.error).toBe(true);
      expect(r.signal).toBe(`http_${s}`);
    }
  });
});

describe("retry policy", () => {
  test("retryable statuses", () => {
    for (const s of [
      408, 429, 500, 501, 502, 503, 504, 520, 521, 522, 523, 524, 599,
    ]) {
      expect(isRetryableStatus(s)).toBe(true);
    }
    for (const s of [200, 301, 400, 403, 404, 600]) {
      expect(isRetryableStatus(s)).toBe(false);
    }
  });

  test("backoff grows exponentially with bounded jitter", () => {
    expect(backoffMs(1, 0)).toBe(400);
    expect(backoffMs(2, 0)).toBe(800);
    expect(backoffMs(1, 0.999)).toBeLessThan(400 + 250);
    expect(backoffMs(1, 0.5)).toBeGreaterThan(400);
  });

  test("response body failures stay inside the retry boundary", async () => {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return {
        status: 200,
        ok: true,
        text: async () => {
          if (calls === 1) throw new TypeError("stream reset");
          return "complete";
        },
      } as Response;
    }) as unknown as typeof fetch;
    try {
      const result = await fetchWithRetry("https://example.invalid", {});
      expect(calls).toBe(2);
      expect(result.body).toBe("complete");
      expect(result.failSignal).toBe("");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

const baseResult: DualResult = {
  address: "0xAbC0000000000000000000000000000000000001",
  scanOK: false,
  visionOK: true,
  scanError: false,
  visionError: false,
  scanSignal: "unverified",
  visionSignal: "exact_match",
  scanUrl: "https://monadscan.com/address/0xabc",
  visionUrl: "sourcify://143/0xabc",
  checkedAt: "2026-07-20T00:00:00.000Z",
};

describe("hasProbeError", () => {
  test("false when both probes are determinate", () => {
    expect(hasProbeError(baseResult)).toBe(false);
  });
  test("true when either side errored", () => {
    expect(hasProbeError({ ...baseResult, scanError: true })).toBe(true);
    expect(hasProbeError({ ...baseResult, visionError: true })).toBe(true);
  });
});

describe("evidenceHashPayload", () => {
  test("is deterministic and lowercases the address", () => {
    const p = evidenceHashPayload(baseResult);
    expect(p).toContain(baseResult.address.toLowerCase());
    expect(p).toBe(evidenceHashPayload({ ...baseResult }));
  });
});
