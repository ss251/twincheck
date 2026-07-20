/**
 * Live dual-explorer probes — ZERO MOCKS.
 * - MonadVision path: BlockVision Sourcify API (match field)
 * - Monadscan path: public HTML meta "Contract: Verified|Unverified"
 *
 * Every probe outcome carries an `error` flag that separates two very
 * different worlds:
 *   error=false, ok=false → the explorer genuinely says "unverified"
 *   error=true            → we could not get a trustworthy answer
 *                           (timeout, 429, 5xx, network failure, layout drift)
 * Error-class outcomes must NEVER be attested on-chain as "unverified".
 */

export type ProbeOutcome = {
  /** True when the explorer says the source is verified. */
  ok: boolean;
  /**
   * True when the probe result is indeterminate (transport failure, rate
   * limit, server error, unparseable page). `ok` is meaningless when set.
   */
  error: boolean;
  signal: string;
};

export type DualResult = {
  address: string;
  scanOK: boolean;
  visionOK: boolean;
  scanError: boolean;
  visionError: boolean;
  scanSignal: string;
  visionSignal: string;
  scanUrl: string;
  visionUrl: string;
  checkedAt: string;
};

export const PROBE_TIMEOUT_MS = 8000;
export const PROBE_MAX_ATTEMPTS = 3;

export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status < 600);
}

/** Exponential backoff with jitter: 400ms, 800ms (+0–250ms jitter). */
export function backoffMs(attempt: number, jitter = Math.random()): number {
  return 400 * 2 ** (attempt - 1) + Math.floor(jitter * 250);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch with per-attempt timeout and retry on transient failures.
 * Returns the terminal Response, or a transport-level failure signal.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
): Promise<{ res: Response | null; body: string | null; failSignal: string }> {
  let failSignal = "network_error";
  for (let attempt = 1; attempt <= PROBE_MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) await sleep(backoffMs(attempt - 1));
    try {
      const res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      if (isRetryableStatus(res.status)) {
        failSignal = `http_${res.status}`;
        continue;
      }
      const body = await res.text();
      return { res, body, failSignal: "" };
    } catch (e) {
      failSignal =
        e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")
          ? "timeout"
          : "network_error";
    }
  }
  return { res: null, body: null, failSignal };
}

/**
 * Classify a Sourcify-API response. Pure — unit-testable.
 * 404 from Sourcify means "no match found" → a genuine unverified signal.
 */
export function classifyVisionResponse(
  status: number,
  body: unknown,
): ProbeOutcome {
  if (status === 404) return { ok: false, error: false, signal: "unverified" };
  if (status < 200 || status >= 300) {
    return { ok: false, error: true, signal: `http_${status}` };
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: true, signal: "bad_json" };
  }
  const b = body as Record<string, unknown>;
  const fields = ["match", "runtimeMatch"].filter((key) =>
    Object.prototype.hasOwnProperty.call(b, key),
  );
  if (fields.length === 0) {
    return { ok: false, error: true, signal: "bad_schema" };
  }
  const recognized = new Set(["exact_match", "match", "partial_match"]);
  let verifiedSignal: string | null = null;
  for (const field of fields) {
    const value = b[field];
    if (value === null) continue;
    if (typeof value !== "string") {
      return { ok: false, error: true, signal: "bad_schema" };
    }
    if (!recognized.has(value)) {
      return { ok: false, error: true, signal: "unknown_match" };
    }
    verifiedSignal ??= value;
  }
  return verifiedSignal
    ? { ok: true, error: false, signal: verifiedSignal }
    : { ok: false, error: false, signal: "unverified" };
}

/**
 * Classify a Monadscan (etherscan-family) address page. Pure — unit-testable.
 * A page we cannot parse is an ERROR (layout drift / challenge page), never
 * a genuine "unverified" — attesting on it would be dishonest.
 */
export function classifyScanResponse(status: number, html: string): ProbeOutcome {
  if (status < 200 || status >= 300) {
    return { ok: false, error: true, signal: `http_${status}` };
  }
  const meta =
    html.match(/content="Contract:\s*(Verified|Unverified)[^"]*"/i) ||
    html.match(/name="Description"\s+content="Contract:\s*(Verified|Unverified)/i);
  if (meta) {
    const s = meta[1].toLowerCase();
    return { ok: s === "verified", error: false, signal: s };
  }
  if (/Source Code Verified/i.test(html) || /Exact Match/i.test(html)) {
    return { ok: true, error: false, signal: "source_code_verified" };
  }
  if (/Verify and Publish/i.test(html) && /contract creator/i.test(html)) {
    return { ok: false, error: false, signal: "unverified_cta" };
  }
  return { ok: false, error: true, signal: "unparseable_page" };
}

export async function probeVision(
  address: string,
  chainId: number,
  base: string,
): Promise<ProbeOutcome> {
  const url = `${base.replace(/\/$/, "")}/${chainId}/${address}`;
  const { res, body, failSignal } = await fetchWithRetry(url, {
    headers: { accept: "application/json", "user-agent": "twincheck/1.0" },
  });
  if (!res) return { ok: false, error: true, signal: failSignal };
  if (res.status === 404) return { ok: false, error: false, signal: "unverified" };
  if (!res.ok) return { ok: false, error: true, signal: `http_${res.status}` };
  let parsed: unknown;
  try {
    parsed = JSON.parse(body ?? "");
  } catch {
    return { ok: false, error: true, signal: "bad_json" };
  }
  return classifyVisionResponse(res.status, parsed);
}

export async function probeScan(
  address: string,
  scanBase: string,
): Promise<ProbeOutcome> {
  const url = `${scanBase.replace(/\/$/, "")}/address/${address}`;
  const { res, body, failSignal } = await fetchWithRetry(url, {
    headers: {
      accept: "text/html",
      "user-agent":
        "Mozilla/5.0 (compatible; TwinCheck/1.0; +https://github.com/monad-crypto/protocols/issues/369)",
    },
  });
  if (!res) return { ok: false, error: true, signal: failSignal };
  return classifyScanResponse(res.status, res.ok ? body ?? "" : "");
}

export async function probeDual(
  address: string,
  opts: {
    probeChainId: number;
    scanBase: string;
    visionSourcifyBase: string;
  },
): Promise<DualResult> {
  const [scan, vision] = await Promise.all([
    probeScan(address, opts.scanBase),
    probeVision(address, opts.probeChainId, opts.visionSourcifyBase),
  ]);
  const checkedAt = new Date().toISOString();
  return {
    address,
    scanOK: scan.ok,
    visionOK: vision.ok,
    scanError: scan.error,
    visionError: vision.error,
    scanSignal: scan.signal,
    visionSignal: vision.signal,
    scanUrl: `${opts.scanBase.replace(/\/$/, "")}/address/${address}`,
    visionUrl: `sourcify://${opts.probeChainId}/${address}`,
    checkedAt,
  };
}

/** True when either explorer probe was indeterminate — unsafe to attest. */
export function hasProbeError(r: DualResult): boolean {
  return r.scanError || r.visionError;
}

export function evidenceHashPayload(r: DualResult): string {
  return JSON.stringify({
    address: r.address.toLowerCase(),
    scanOK: r.scanOK,
    visionOK: r.visionOK,
    scanSignal: r.scanSignal,
    visionSignal: r.visionSignal,
    checkedAt: r.checkedAt,
  });
}
