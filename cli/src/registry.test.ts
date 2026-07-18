import { describe, expect, test } from "bun:test";
import { parseRegistryCsv, uniqueAddresses } from "./registry";

const SAMPLE = `name,ctype,csubtype,contract,address,all_categories
Cycle Network,AI,Abstraction Infrastructure,ZkEVM,0x647e77a1af7c87688b974f20db75ea36c28d033e,AI::Abstraction Infrastructure
Cycle Network,AI,Abstraction Infrastructure,ZkEVMBridge,0xad5ca27d8932114a9457d385fc0b88825c845960,AI::Abstraction Infrastructure
Dup,AI,x,A,0x647e77a1af7c87688b974f20db75ea36c28d033e,AI
`;

describe("parseRegistryCsv", () => {
  test("parses official CSV shape and unique addresses", () => {
    const rows = parseRegistryCsv(SAMPLE);
    expect(rows.length).toBe(3);
    expect(rows[0].address.toLowerCase()).toBe(
      "0x647e77a1af7c87688b974f20db75ea36c28d033e",
    );
    const uniq = uniqueAddresses(rows);
    expect(uniq.length).toBe(2);
    expect(uniq[0].label).toContain("Cycle Network");
  });

  test("skips bad addresses", () => {
    const rows = parseRegistryCsv(
      `name,ctype,csubtype,contract,address,all_categories\nX,a,b,c,notanaddr,d\n`,
    );
    expect(rows.length).toBe(0);
  });
});
