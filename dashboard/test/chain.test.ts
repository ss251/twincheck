import { describe, expect, test } from "bun:test";
import type { Address, Hex } from "viem";
import {
  classifyPendingReports,
  comparePulseEventsNewestFirst,
  reconcileFeedEvents,
  type PulseEvent,
} from "../src/chain";

const target = "0xAbC0000000000000000000000000000000000001" as Address;

function event(key: string, blockNumber: bigint, logIndex = 0): PulseEvent {
  return {
    key,
    kind: "Watched",
    target,
    tx: `0x${key.padStart(64, "0")}` as Hex,
    blockNumber,
    logIndex,
  };
}

describe("reconcileFeedEvents", () => {
  test("replaces orphaned events inside a rescanned block range", () => {
    const retained = event("1", 90n);
    const orphaned = event("2", 100n);
    const replacement = event("3", 100n);
    const result = reconcileFeedEvents(
      [retained, orphaned],
      [replacement],
      96n,
      110n,
    );

    expect(result.map((item) => item.key).sort()).toEqual(["1", "3"]);
  });

  test("preserves events beyond a partially rescanned interval", () => {
    const covered = event("1", 100n);
    const unscanned = event("2", 150n);
    const result = reconcileFeedEvents([covered, unscanned], [], 96n, 120n);

    expect(result.map((item) => item.key)).toEqual(["2"]);
  });
});

describe("classifyPendingReports", () => {
  const missing = { scanOK: false, visionOK: false, exists: false };
  const verified = { scanOK: true, visionOK: true, exists: true };

  test("classifies missing, disagreeing, and stale matching reports", () => {
    expect(classifyPendingReports(missing, missing)).toBe("both");
    expect(classifyPendingReports(missing, verified)).toBe("A");
    expect(classifyPendingReports(verified, missing)).toBe("B");
    expect(
      classifyPendingReports(verified, { ...verified, visionOK: false }),
    ).toBe("disagree");
    expect(classifyPendingReports(verified, verified)).toBe("stale");
  });
});

describe("comparePulseEventsNewestFirst", () => {
  test("orders by block then log index descending", () => {
    const olderBlock = event("1", 99n, 9);
    const earlyLog = event("2", 100n, 5);
    const lateLog = event("3", 100n, 6);

    expect(
      [earlyLog, olderBlock, lateLog]
        .sort(comparePulseEventsNewestFirst)
        .map((item) => item.key),
    ).toEqual(["3", "2", "1"]);
  });
});
