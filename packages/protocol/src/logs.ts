import type { IngestEvent } from "./index.ts";

/**
 * nginx / Apache "combined" log format, the default on both:
 *   1.2.3.4 - - [10/Oct/2026:13:55:36 +0200] "GET /path?x=1 HTTP/1.1" 200 2326 "https://ref/" "UA"
 * Also accepts "common" format (no referer / UA) and extra fields after the UA (e.g. request time).
 */
const LINE =
  /^(\S+) \S+ \S+ \[(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})\] "(\S+) (\S+)(?: [^"]*)?" (\d{3}|-) (\d+|-)(?: "((?:[^"\\]|\\.)*)" "((?:[^"\\]|\\.)*)")?/;

const MONTHS: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

const unescape = (s: string) => s.replace(/\\(.)/g, "$1");
const dash = (s: string | undefined) => (!s || s === "-" ? null : unescape(s));

/** Parses one access-log line into an event for `domain`. Returns null for lines it can't read. */
export function parseLogLine(line: string, domain: string): IngestEvent | null {
  const m = LINE.exec(line);
  if (!m) return null;
  const [, ip, dd, mon, yyyy, hh, mi, ss, tz, method, target, status, bytes, referer, ua] = m;
  const month = MONTHS[mon!];
  if (month === undefined) return null;
  const sign = tz![0] === "-" ? -1 : 1;
  const offsetMin = sign * (Number(tz!.slice(1, 3)) * 60 + Number(tz!.slice(3, 5)));
  const ts = Date.UTC(Number(yyyy), month, Number(dd), Number(hh), Number(mi), Number(ss)) - offsetMin * 60_000;
  if (!Number.isFinite(ts)) return null;

  // Proxies log absolute URLs; normal requests log a path.
  let url: string;
  if (/^https?:\/\//i.test(target!)) url = target!;
  else if (target!.startsWith("/")) url = `https://${domain}${target}`;
  else return null;

  return {
    ts,
    method: method!.slice(0, 16),
    url,
    status: status === "-" ? null : Number(status),
    ip: ip!,
    ua: dash(ua),
    referer: dash(referer),
    signatureAgent: null,
    asn: null,
    country: null,
    bytes: bytes === "-" ? null : Number(bytes),
  };
}
