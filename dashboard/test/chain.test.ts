import { describe, expect, test } from "bun:test";
import type { Address, Hex } from "viem";
import { reconcileFeedEvents, type PulseEvent } from "../src/chain";

const target = "0xAbC0000000000000000000000000000000000001" as Address;

function event(key: string, blockNumber: bigint): PulseEvent {
  return {
    key,
    kind: "Watched",
    target,
    tx: `0x${key.padStart(64, "0")}` as Hex,
    blockNumber,
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
