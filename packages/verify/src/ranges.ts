import { IP_LISTS } from "@sensegap/bots";
import { cidrContains, parseCidr, type Cidr, type ParsedIp } from "./ip.ts";

/** Raw CIDR strings per list id. Plain JSON, so it can be cached in KV or D1. */
export type RangeSnapshot = {
  fetchedAt: string;
  lists: Record<string, string[]>;
  errors: Record<string, string>;
};

/** Parses the shared operator format: { prefixes: [{ ipv4Prefix } | { ipv6Prefix }] }. */
export function parsePrefixList(json: unknown): string[] {
  const prefixes = (json as { prefixes?: unknown[] } | null)?.prefixes;
  if (!Array.isArray(prefixes)) throw new Error("missing prefixes[]");
  const out: string[] = [];
  for (const p of prefixes) {
    const rec = p as { ipv4Prefix?: string; ipv6Prefix?: string };
    const v = rec.ipv4Prefix ?? rec.ipv6Prefix;
    if (typeof v === "string" && parseCidr(v)) out.push(v);
  }
  return out;
}

/** Downloads every published list. A failed list is reported, never fatal. */
export async function fetchRangeSnapshot(
  fetchFn: typeof fetch = fetch,
  lists: Record<string, string> = IP_LISTS,
): Promise<RangeSnapshot> {
  const snapshot: RangeSnapshot = { fetchedAt: new Date().toISOString(), lists: {}, errors: {} };
  await Promise.all(
    Object.entries(lists).map(async ([id, url]) => {
      try {
        const res = await fetchFn(url, { headers: { accept: "application/json", "user-agent": "SenseGap-RangeFetcher/0.1 (+https://sensegap.com)" } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const prefixes = parsePrefixList(await res.json());
        if (prefixes.length === 0) throw new Error("empty list");
        snapshot.lists[id] = prefixes;
      } catch (e) {
        snapshot.errors[id] = e instanceof Error ? e.message : String(e);
      }
    }),
  );
  return snapshot;
}

/** Fast lookups over a snapshot. Build once per snapshot, reuse for every request. */
export class RangeIndex {
  private readonly byList = new Map<string, Cidr[]>();

  constructor(snapshot: Pick<RangeSnapshot, "lists">) {
    for (const [id, cidrs] of Object.entries(snapshot.lists)) {
      this.byList.set(id, cidrs.map(parseCidr).filter((c): c is Cidr => c !== null));
    }
  }

  has(listId: string): boolean {
    return this.byList.has(listId);
  }

  /** Returns the id of the first list (among `listIds`) that contains the IP. */
  match(ip: ParsedIp, listIds: string[]): string | null {
    for (const id of listIds) {
      const cidrs = this.byList.get(id);
      if (cidrs?.some((c) => cidrContains(c, ip))) return id;
    }
    return null;
  }
}
