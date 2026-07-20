import { expect, test } from "bun:test";
import { getProbeConfig } from "./config";

test("probe config does not require signing or contract credentials", () => {
  const names = ["PRIVATE_KEY", "PRINCIPAL_B_PRIVATE_KEY", "TWINCHECK"] as const;
  const previous = new Map(names.map((name) => [name, process.env[name]]));
  for (const name of names) process.env[name] = "";

  try {
    const config = getProbeConfig();
    expect(config.probeChainId).toBeNumber();
    expect(config.scanBase).toStartWith("http");
    expect(config.visionSourcifyBase).toStartWith("http");
  } finally {
    for (const name of names) {
      const value = previous.get(name);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
