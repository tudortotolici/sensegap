/** IPv4 / IPv6 parsing, CIDR matching and anonymization, with no dependencies. */

export interface ParsedIp {
  version: 4 | 6;
  value: bigint;
}

export interface Cidr {
  version: 4 | 6;
  /** Network address, already masked. */
  network: bigint;
  prefix: number;
}

function parseV4(s: string): bigint | null {
  const parts = s.split(".");
  if (parts.length !== 4) return null;
  let v = 0n;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n > 255) return null;
    v = (v << 8n) | BigInt(n);
  }
  return v;
}

function parseV6(input: string): bigint | null {
  let s = input.toLowerCase();
  const zone = s.indexOf("%");
  if (zone >= 0) s = s.slice(0, zone);
  // Embedded IPv4 tail (::ffff:1.2.3.4) → rewrite as two hex groups.
  const lastColon = s.lastIndexOf(":");
  if (s.includes(".", lastColon)) {
    const v4 = parseV4(s.slice(lastColon + 1));
    if (v4 === null) return null;
    s = s.slice(0, lastColon + 1) + (v4 >> 16n).toString(16) + ":" + (v4 & 0xffffn).toString(16);
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const toGroups = (h: string | undefined) => (h ? h.split(":") : []);
  const head = toGroups(halves[0]);
  const rest = toGroups(halves[1]);
  const total = head.length + rest.length;
  if (halves.length === 1 ? total !== 8 : total > 7) return null;
  const groups = [...head, ...Array(8 - total).fill("0"), ...rest];
  let v = 0n;
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    v = (v << 16n) | BigInt(parseInt(g, 16));
  }
  return v;
}

export function parseIp(s: string): ParsedIp | null {
  const t = s.trim();
  if (t.includes(":")) {
    const v = parseV6(t);
    if (v === null) return null;
    // Treat IPv4-mapped IPv6 (::ffff:a.b.c.d) as IPv4.
    if (v >> 32n === 0xffffn) return { version: 4, value: v & 0xffffffffn };
    return { version: 6, value: v };
  }
  const v = parseV4(t);
  return v === null ? null : { version: 4, value: v };
}

const bits = (version: 4 | 6) => (version === 4 ? 32n : 128n);

export function parseCidr(s: string): Cidr | null {
  const [addr, len] = s.trim().split("/");
  if (!addr) return null;
  const ip = parseIp(addr);
  if (!ip) return null;
  const max = Number(bits(ip.version));
  const prefix = len === undefined ? max : Number(len);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > max) return null;
  const shift = bits(ip.version) - BigInt(prefix);
  return { version: ip.version, network: (ip.value >> shift) << shift, prefix };
}

export function cidrContains(cidr: Cidr, ip: ParsedIp): boolean {
  if (cidr.version !== ip.version) return false;
  const shift = bits(ip.version) - BigInt(cidr.prefix);
  return (ip.value >> shift) << shift === cidr.network;
}

function formatV4(v: bigint): string {
  return [24n, 16n, 8n, 0n].map((s) => ((v >> s) & 0xffn).toString()).join(".");
}

function formatV6(v: bigint): string {
  const groups: string[] = [];
  for (let i = 7n; i >= 0n; i--) groups.push(((v >> (i * 16n)) & 0xffffn).toString(16));
  // Compress the longest run of zero groups.
  let best = -1, bestLen = 0;
  for (let i = 0; i < 8; ) {
    if (groups[i] !== "0") { i++; continue; }
    let j = i;
    while (j < 8 && groups[j] === "0") j++;
    if (j - i > bestLen && j - i > 1) { best = i; bestLen = j - i; }
    i = j;
  }
  if (best < 0) return groups.join(":");
  return groups.slice(0, best).join(":") + "::" + groups.slice(best + bestLen).join(":");
}

export function formatIp(ip: ParsedIp): string {
  return ip.version === 4 ? formatV4(ip.value) : formatV6(ip.value);
}

/** Anonymize an IP for storage: IPv4 → /24, IPv6 → /48. */
export function anonymizeIp(s: string): string | null {
  const ip = parseIp(s);
  if (!ip) return null;
  const keep = ip.version === 4 ? 24n : 48n;
  const shift = bits(ip.version) - keep;
  return formatIp({ version: ip.version, value: (ip.value >> shift) << shift });
}

/** Name used for a reverse DNS (PTR) lookup. */
export function ptrName(ip: ParsedIp): string {
  if (ip.version === 4) {
    return formatV4(ip.value).split(".").reverse().join(".") + ".in-addr.arpa";
  }
  const hex = ip.value.toString(16).padStart(32, "0");
  return hex.split("").reverse().join(".") + ".ip6.arpa";
}
