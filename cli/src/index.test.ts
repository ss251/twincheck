import { describe, expect, test } from "bun:test";
import { dualReportExitCode, type DualReportOutcome } from "./index";
import type { DualResult } from "./explorers";

const verified: DualResult = {
  address: "0xAbC0000000000000000000000000000000000001",
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
  });

  test("returns indeterminate when either principal refused to report", () => {
    expect(dualReportExitCode(outcome({ reportedA: false }))).toBe(2);
    expect(dualReportExitCode(outcome({ reportedB: false }))).toBe(2);
  });
});
