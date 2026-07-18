/**
 * Live dual-explorer probes — ZERO MOCKS.
 * - MonadVision path: BlockVision Sourcify API (match field)
 * - Monadscan path: public HTML meta "Contract: Verified|Unverified"
 */

export type DualResult = {
  address: string;
  scanOK: boolean;
  visionOK: boolean;
  scanSignal: string;
  visionSignal: string;
  scanUrl: string;
  visionUrl: string;
  checkedAt: string;
};

export async function probeVision(
  address: string,
  chainId: number,
  base: string,
): Promise<{ ok: boolean; signal: string }> {
  const url = `${base.replace(/\/$/, "")}/${chainId}/${address}`;
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "twincheck/1.0" },
  });
  if (!res.ok) {
    return { ok: false, signal: `http_${res.status}` };
  }
  const body = (await res.json()) as {
    match?: string | null;
    runtimeMatch?: string | null;
  };
  const match = body.match || body.runtimeMatch || null;
  const ok =
    match === "exact_match" ||
    match === "match" ||
    match === "partial_match" ||
    Boolean(match && match !== "null");
  return { ok, signal: match ? String(match) : "unverified" };
}

export async function probeScan(
  address: string,
  scanBase: string,
): Promise<{ ok: boolean; signal: string }> {
  const url = `${scanBase.replace(/\/$/, "")}/address/${address}`;
  const res = await fetch(url, {
    headers: {
      accept: "text/html",
      "user-agent":
        "Mozilla/5.0 (compatible; TwinCheck/1.0; +https://github.com/monad-crypto/protocols/issues/369)",
    },
  });
  if (!res.ok) {
    return { ok: false, signal: `http_${res.status}` };
  }
  const html = await res.text();
  // Etherscan-family explorers expose status in og:description / meta Description
  const meta =
    html.match(
      /content="Contract:\s*(Verified|Unverified)[^"]*"/i,
    ) ||
    html.match(
      /name="Description"\s+content="Contract:\s*(Verified|Unverified)/i,
    );
  if (meta) {
    const status = meta[1].toLowerCase();
    return { ok: status === "verified", signal: status };
  }
  if (/Source Code Verified/i.test(html) || /Exact Match/i.test(html)) {
    return { ok: true, signal: "source_code_verified" };
  }
  if (/Verify and Publish/i.test(html) && /contract creator/i.test(html)) {
    return { ok: false, signal: "unverified_cta" };
  }
  return { ok: false, signal: "unknown" };
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
    scanSignal: scan.signal,
    visionSignal: vision.signal,
    scanUrl: `${opts.scanBase.replace(/\/$/, "")}/address/${address}`,
    visionUrl: `sourcify://${opts.probeChainId}/${address}`,
    checkedAt,
  };
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
