import { describe, expect, test } from "bun:test";
import {
  encodeAbiParameters,
  encodeEventTopics,
  type Address,
  type Hex,
} from "viem";
import { twinAbi } from "./abi";
import { hasMatchingSettlement, hashDualEvidence } from "./client";

const contract = "0x1111111111111111111111111111111111111111" as Address;
const target = "0x2222222222222222222222222222222222222222" as Address;
const evidenceA = `0x${"aa".repeat(32)}` as Hex;
const evidenceB = `0x${"bb".repeat(32)}` as Hex;
const combined = hashDualEvidence(evidenceA, evidenceB);

function settlementLog(overrides: {
  address?: Address;
  target?: Address;
  scanOK?: boolean;
  visionOK?: boolean;
  evidenceHash?: Hex;
} = {}) {
  const scanOK = overrides.scanOK ?? true;
  const visionOK = overrides.visionOK ?? true;
  return {
    address: overrides.address ?? contract,
    topics: encodeEventTopics({
      abi: twinAbi,
      eventName: "DualStatusSettled",
      args: { target: overrides.target ?? target },
    }) as unknown as readonly Hex[],
    data: encodeAbiParameters(
      [
        { type: "bool" },
        { type: "bool" },
        { type: "bool" },
        { type: "bytes32" },
        { type: "uint64" },
      ],
      [
        scanOK,
        visionOK,
        scanOK && visionOK,
        overrides.evidenceHash ?? combined,
        1n,
      ],
    ),
  };
}

describe("hasMatchingSettlement", () => {
  test("accepts only the exact contract, target, bits, and combined evidence", () => {
    expect(
      hasMatchingSettlement(
        [settlementLog()],
        contract,
        target,
        true,
        true,
        combined,
      ),
    ).toBe(true);

    const other = "0x3333333333333333333333333333333333333333" as Address;
    const wrongEvidence = `0x${"cc".repeat(32)}` as Hex;
    for (const log of [
      settlementLog({ address: other }),
      settlementLog({ target: other }),
      settlementLog({ scanOK: false }),
      settlementLog({ evidenceHash: wrongEvidence }),
    ]) {
      expect(
        hasMatchingSettlement([log], contract, target, true, true, combined),
      ).toBe(false);
    }
  });

  test("rejects a receipt without a settlement event", () => {
    expect(hasMatchingSettlement([], contract, target, true, true, combined)).toBe(
      false,
    );
  });
});
