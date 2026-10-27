import { matchAiReferrer, matchBot, type AiReferrer, type BotCategory, type BotDef } from "@sensegap/bots";
import type { DnsResolver } from "./dns.ts";
import { parseIp, ptrName, type ParsedIp } from "./ip.ts";
import type { RangeIndex } from "./ranges.ts";

/**
 * verified   — proven genuine (IP list, reverse DNS)
 * unverified — the operator gives no way to prove it, or verification could not run
 * spoofed    — claims to be a known bot but fails every check the operator publishes
 */
export type Verification = "verified" | "unverified" | "spoofed";
export type VerifyMethod = "ip_list" | "rdns" | null;

export type VisitorKind = "bot" | "unknown_bot" | "human";

export interface RequestInfo {
  ip: string;
  userAgent?: string | null;
  referer?: string | null;
  url?: string | null;
  /** Value of the Signature-Agent header (Web Bot Auth), if present. */
  signatureAgent?: string | null;
}

export interface Classification {
  kind: VisitorKind;
  bot: Pick<BotDef, "id" | "name" | "operator"> | null;
  category: BotCategory | null;
  verification: Verification | null;
  method: VerifyMethod;
  /** Detail of what passed or failed, for the Analyst view. */
  evidence: string | null;
  /** For human visits: the AI product that sent them. */
  aiReferrer: Pick<AiReferrer, "id" | "name"> | null;
}

export interface ClassifyDeps {
  ranges: RangeIndex;
  /** Optional: without it, bots that only support reverse DNS stay "unverified". */
  dns?: DnsResolver;
}

// Evidence is stored with the visit, so it never contains the visitor's IP address,
// nor a hostname outside the operator's domains (ISP hostnames often spell out the IP).
async function verifyByRdns(ip: ParsedIp, rawIp: string, suffixes: string[], dns: DnsResolver): Promise<{ ok: boolean; evidence: string }> {
  const hosts = await dns.ptr(ptrName(ip));
  const host = hosts.find((h) => suffixes.some((s) => h === s || h.endsWith("." + s)));
  if (!host) return { ok: false, evidence: hosts.length ? `rDNS host not in ${suffixes.join(", ")}` : "no rDNS record" };
  const addrs = await dns.addresses(host);
  const want = parseIp(rawIp);
  const ok = addrs.some((a) => {
    const p = parseIp(a);
    return p !== null && want !== null && p.version === want.version && p.value === want.value;
  });
  return { ok, evidence: ok ? `rDNS ${host}, forward lookup matches` : `rDNS ${host} does not resolve back to this IP` };
}

export async function classifyRequest(req: RequestInfo, deps: ClassifyDeps): Promise<Classification> {
  const { bot, unknownBot } = matchBot({ userAgent: req.userAgent, signatureAgent: req.signatureAgent });

  if (!bot) {
    const ref = unknownBot ? null : matchAiReferrer(req.referer, req.url);
    return {
      kind: unknownBot ? "unknown_bot" : "human",
      bot: null,
      category: null,
      verification: null,
      method: null,
      evidence: null,
      aiReferrer: ref ? { id: ref.id, name: ref.name } : null,
    };
  }

  const base = {
    kind: "bot" as const,
    bot: { id: bot.id, name: bot.name, operator: bot.operator },
    category: bot.category,
    aiReferrer: null,
  };
  const v = bot.verify;
  const ip = parseIp(req.ip);
  const ipLists = v?.ipLists ?? [];
  const rdns = v?.rdnsSuffixes ?? [];

  if (!ip) return { ...base, verification: "unverified", method: null, evidence: "invalid IP" };
  if (ipLists.length === 0 && rdns.length === 0) {
    const why = v?.signatureAgent ? "Web Bot Auth signature check not implemented yet" : `${bot.operator} publishes no way to verify`;
    return { ...base, verification: "unverified", method: null, evidence: why };
  }

  // 1) Published IP ranges.
  const listHit = deps.ranges.match(ip, ipLists);
  if (listHit) return { ...base, verification: "verified", method: "ip_list", evidence: `IP in ${listHit}` };

  // 2) Reverse DNS, confirmed by a forward lookup.
  if (rdns.length > 0 && deps.dns) {
    try {
      const r = await verifyByRdns(ip, req.ip, rdns, deps.dns);
      if (r.ok) return { ...base, verification: "verified", method: "rdns", evidence: r.evidence };
      return { ...base, verification: "spoofed", method: null, evidence: r.evidence };
    } catch (e) {
      return { ...base, verification: "unverified", method: null, evidence: `DNS error: ${e instanceof Error ? e.message : e}` };
    }
  }

  // Lists exist but did not match, and no DNS check is possible.
  const listsLoaded = ipLists.some((id) => deps.ranges.has(id));
  if (!listsLoaded) return { ...base, verification: "unverified", method: null, evidence: "IP lists not loaded" };
  if (rdns.length > 0) return { ...base, verification: "unverified", method: null, evidence: "IP not in lists; reverse DNS not checked" };
  return { ...base, verification: "spoofed", method: null, evidence: `IP not in ${ipLists.join(", ")}` };
}
