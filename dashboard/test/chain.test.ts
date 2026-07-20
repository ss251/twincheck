import { describe, expect, test } from "bun:test";
import {
  encodeAbiParameters,
  encodeEventTopics,
  getAddress,
  type Address,
  type Hex,
  type Log,
} from "viem";
import {
  classifyPendingReports,
  comparePulseEventsNewestFirst,
  decodeFeedLog,
  pulseEvent,
  reconcileFeedEvents,
  reconcileFeedHead,
  scanLogsForward,
  type PulseEvent,
} from "../src/chain";

const target = "0xabc0000000000000000000000000000000000001" as Address;

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

describe("reconcileFeedHead", () => {
  test("rewinds a frontier beyond the head and invalidates the overlap", () => {
    const retained = event("1", 800n);
    const overlapping = event("2", 850n);
    const future = event("3", 950n);
    const result = reconcileFeedHead(
      [retained, overlapping, future],
      1_000n,
      900n,
      700n,
      64n,
    );

    expect(result.frontier).toBe(900n);
    expect(result.rescanFrom).toBe(837n);
    expect(result.events.map((item) => item.key)).toEqual(["1"]);
  });

  test("clears cached history when the head precedes deployment", () => {
    const result = reconcileFeedHead(
      [event("1", 800n)],
      1_000n,
      600n,
      700n,
      64n,
    );

    expect(result).toEqual({
      frontier: 699n,
      events: [],
      rescanFrom: null,
    });
  });

  test("leaves a frontier at or below the head unchanged", () => {
    const existing = [event("1", 800n)];
    const result = reconcileFeedHead(existing, 850n, 900n, 700n, 64n);

    expect(result).toEqual({
      frontier: 850n,
      events: existing,
      rescanFrom: null,
    });
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

describe("scanLogsForward", () => {
  test("stops before a failed page and resumes without a gap", async () => {
    const attempts = new Map<bigint, number>();
    const getLogs = async ({ fromBlock }: { fromBlock: bigint }): Promise<Log[]> => {
      const attempt = (attempts.get(fromBlock) ?? 0) + 1;
      attempts.set(fromBlock, attempt);
      if (fromBlock === 1_100n && attempt === 1) throw new Error("temporary RPC failure");
      return [{ blockNumber: fromBlock } as Log];
    };

    const first = await scanLogsForward({
      address: target,
      from: 1_000n,
      to: 1_299n,
      concurrency: 3,
      getLogs,
    });
    expect(first.failed).toBe(true);
    expect(first.scannedTo).toBe(1_099n);
    expect(first.logs.map((log) => log.blockNumber)).toEqual([1_000n]);

    const resumed = await scanLogsForward({
      address: target,
      from: first.scannedTo + 1n,
      to: 1_299n,
      concurrency: 2,
      getLogs,
    });
    expect(resumed.failed).toBe(false);
    expect(resumed.scannedTo).toBe(1_299n);
    expect(resumed.logs.map((log) => log.blockNumber)).toEqual([1_100n, 1_200n]);
    expect(attempts.get(1_200n)).toBe(2);
  });
});

describe("decodeFeedLog", () => {
  test("decodes a pulse into a stable feed event", () => {
    const tx = `0x${"12".repeat(32)}` as Hex;
    const log = {
      address: target,
      blockNumber: 1_234n,
      transactionHash: tx,
      logIndex: 7,
      topics: encodeEventTopics({
        abi: [pulseEvent],
        eventName: "DualStatusPulse",
        args: { target },
      }),
      data: encodeAbiParameters(
        [
          { type: "bool" },
          { type: "bool" },
          { type: "bool" },
          { type: "bool" },
          { type: "bool" },
          { type: "uint64" },
        ],
        [false, false, true, true, true, 1_700_000_000n],
      ),
    } as Log;

    expect(decodeFeedLog(log)).toEqual({
      key: `${tx}:7`,
      kind: "Pulse",
      target: getAddress(target),
      prevScanOK: false,
      prevVisionOK: false,
      scanOK: true,
      visionOK: true,
      dualOK: true,
      at: 1_700_000_000,
      tx,
      blockNumber: 1_234n,
      logIndex: 7,
    });
  });

  test("ignores unrelated logs", () => {
    expect(
      decodeFeedLog({
        topics: [`0x${"ff".repeat(32)}`],
        data: "0x",
      } as Log),
    ).toBeNull();
  });
});
