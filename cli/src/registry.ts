/** Load addresses from monad-crypto/protocols CSV (mainnet or testnet). */

export type RegistryRow = {
  name: string;
  contract: string;
  address: string;
  categories: string;
};

export async function fetchRegistryCsv(url: string): Promise<RegistryRow[]> {
  const res = await fetch(url, {
    headers: { "user-agent": "twincheck/1.0" },
  });
  if (!res.ok) throw new Error(`Registry fetch failed ${res.status}: ${url}`);
  const text = await res.text();
  return parseRegistryCsv(text);
}

export function parseRegistryCsv(text: string): RegistryRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const rows: RegistryRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    // CSV is simple enough: name,ctype,csubtype,contract,address,all_categories
    // Categories may contain commas without quotes rarely — take first 5 splits carefully.
    const parts = splitCsvLine(lines[i]);
    if (parts.length < 5) continue;
    const address = parts[4].trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) continue;
    rows.push({
      name: parts[0].trim(),
      contract: parts[3].trim(),
      address,
      categories: parts.slice(5).join(",").trim(),
    });
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (c === "," && !inQ) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

/** Unique addresses, preserving first-seen protocol name. */
export function uniqueAddresses(
  rows: RegistryRow[],
): { address: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const r of rows) {
    const a = r.address.toLowerCase();
    if (!seen.has(a)) seen.set(a, `${r.name}/${r.contract}`);
  }
  return [...seen.entries()].map(([address, label]) => ({ address, label }));
}
