import { describe, expect, test } from "bun:test";
import {
  dualReport,
  dualReportExitCode,
  type DualReportDependencies,
  type DualReportOutcome,
} from "./index";
import type { DualResult } from "./explorers";
import type { TwinConfig } from "./config";
import {
  encodeAbiParameters,
  encodeEventTopics,
  type Address,
  type Hex,
} from "viem";
import { twinAbi } from "./abi";

const verified: DualResult = {
  address: "0xabc0000000000000000000000000000000000001",
  scanOK: true,
  visionOK: true,
  scanError: false,
  visionError: false,
  scanSignal: "verified",
  visionSignal: "exact_match",
  scanUrl: "https://monadscan.com/address/0xabc",
  visionUrl: "sourcify://143/0xabc",
  checkedAt: "2026-07-20T00:00:00.000Z",
};

const target = verified.address as Address;
const contract = "0x1111111111111111111111111111111111111111" as Address;
const txHash = `0x${"11".repeat(32)}` as Hex;
const evidenceHash = `0x${"22".repeat(32)}` as Hex;
const cfg: TwinConfig = {
  probeChainId: 143,
  scanBase: "https://monadscan.com",
  visionSourcifyBase: "https://example.invalid",
  rpcUrl: "https://example.invalid",
  chainId: 10143,
  keyA: `0x${"01".repeat(32)}` as Hex,
  keyB: `0x${"02".repeat(32)}` as Hex,
  twin: contract,
  explorerBase: "https://example.invalid",
  registryCsvUrl: "https://example.invalid/registry.csv",
};

const watchedCard = [
  true,
  true,
  true,
  true,
  true,
  1n,
  evidenceHash,
] as const;

function settlementLog(evidence: Hex) {
  return {
    address: contract,
    topics: encodeEventTopics({
      abi: twinAbi,
      eventName: "DualStatusSettled",
      args: { target },
    }) as unknown as readonly Hex[],
    data: encodeAbiParameters(
      [
        { type: "bool" },
        { type: "bool" },
        { type: "bool" },
        { type: "bytes32" },
        { type: "uint64" },
      ],
      [true, true, true, evidence, 1n],
    ),
  };
}

function outcome(overrides: Partial<DualReportOutcome> = {}): DualReportOutcome {
  return {
    rA: verified,
    rB: verified,
    reportedA: true,
    reportedB: true,
    settledThisRun: true,
    cardSettled: true,
    cardDualOK: true,
    ...overrides,
  };
}

describe("dualReportExitCode", () => {
  test("uses current agreement instead of a stale successful card", () => {
    const disagreeing = { ...verified, visionOK: false };
    expect(
      dualReportExitCode(
        outcome({ rB: disagreeing, settledThisRun: false, cardDualOK: true }),
      ),
    ).toBe(1);
  });

  test("returns success only for a proven current dual settlement", () => {
    expect(dualReportExitCode(outcome())).toBe(0);
    expect(dualReportExitCode(outcome({ settledThisRun: false }))).toBe(1);
    const unverified = { ...verified, scanOK: false, visionOK: false };
    expect(dualReportExitCode(outcome({ rA: unverified, rB: unverified }))).toBe(1);
    expect(dualReportExitCode(outcome({ rB: unverified }))).toBe(1);
  });

  test("returns indeterminate when either principal refused to report", () => {
    expect(dualReportExitCode(outcome({ reportedA: false }))).toBe(2);
    expect(dualReportExitCode(outcome({ reportedB: false }))).toBe(2);
    expect(
      dualReportExitCode(outcome({ reportedA: false, reportedB: false })),
    ).toBe(2);
  });
});

describe("dualReport", () => {
  test("recognizes a settlement emitted by principal A", async () => {
    const probes = [verified, verified];
    const receipts = [
      { hash: txHash, receipt: { logs: [settlementLog(evidenceHash)] } },
      { hash: txHash, receipt: { logs: [] } },
    ];
    const deps: DualReportDependencies = {
      readCard: async () => watchedCard,
      watchBatch: async () => txHash,
      probeDual: async () => probes.shift()!,
      reportOne: async () => receipts.shift()!,
    };

    const out = await dualReport(cfg, target, deps);

    expect(out.settledThisRun).toBe(true);
    expect(dualReportExitCode(out)).toBe(0);
  });

  test("returns an outcome when both probes are indeterminate", async () => {
    const indeterminate = {
      ...verified,
      scanOK: false,
      scanError: true,
      scanSignal: "http_524",
    };
    const probes = [indeterminate, indeterminate];
    const deps: DualReportDependencies = {
      readCard: async () => watchedCard,
      watchBatch: async () => txHash,
      probeDual: async () => probes.shift()!,
      reportOne: async () => {
        throw new Error("reportOne must not be called");
      },
    };

    const out = await dualReport(cfg, target, deps);

    expect(out.reportedA).toBe(false);
    expect(out.reportedB).toBe(false);
    expect(dualReportExitCode(out)).toBe(2);
  });
});
