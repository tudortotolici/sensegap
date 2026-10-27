import { CHECK_PATH, DEFAULT_INGEST_URL, INGEST_PATH, MAX_EVENTS_PER_BATCH, shouldSend } from "@sensegap/protocol";

// Local copies of the wire types, so the published .d.ts files don't point at private packages.
/** One request as sent to SenseGap. */
export interface SenseGapEvent {
  ts: number;
  method: string;
  url: string;
  status: number | null;
  ip: string;
  ua: string | null;
  referer: string | null;
  signatureAgent: string | null;
  asn: number | null;
  country: string | null;
  bytes?: number | null;
  ms?: number | null;
}
type IngestEvent = SenseGapEvent;
type IngestSource = "node" | "logs";

export interface SenseGapOptions {
  /** Site key from SenseGap → Install & settings. Defaults to the SENSEGAP_KEY environment variable. */
  key?: string;
  /** Defaults to https://ingest.sensegap.com/v1/events (or SENSEGAP_INGEST_URL). */
  ingestUrl?: string;
  /** How long events wait before they are sent together. Default 5000 ms. 0 sends right away. */
  flushIntervalMs?: number;
  /** Send as soon as this many events are waiting. Default 200. */
  maxBatch?: number;
  /** Log send errors to the console. Default true. */
  logErrors?: boolean;
}

/** Headers as Fetch `Headers` or Node's `IncomingHttpHeaders`. */
export type HeaderBag = Headers | Record<string, string | string[] | undefined>;

export interface RequestInfo {
  method: string;
  /** Absolute URL, including the query string (utm_source tells AI visits apart). */
  url: string;
  headers: HeaderBag;
  /** Client IP when you know it. Otherwise read from cf-connecting-ip, x-real-ip or x-forwarded-for. */
  ip?: string | null;
  status?: number | null;
  /** Response time in ms. */
  ms?: number | null;
  bytes?: number | null;
  ts?: number;
}

export interface SenseGap {
  /** Records one request. Cheap: does nothing for plain human visits. */
  record(req: RequestInfo): void;
  /** Sends everything waiting now. */
  flush(): Promise<void>;
  /** Asks SenseGap which site the key belongs to. Throws when the key is wrong. */
  check(): Promise<string>;
}

const env = (name: string): string | undefined => (typeof process !== "undefined" ? process.env?.[name] : undefined);

export function header(h: HeaderBag, name: string): string | null {
  if (typeof (h as Headers).get === "function") return (h as Headers).get(name);
  const v = (h as Record<string, string | string[] | undefined>)[name.toLowerCase()];
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

/** First public-facing address: CDN header, then proxy headers. */
export function clientIp(h: HeaderBag): string | null {
  const direct = header(h, "cf-connecting-ip") ?? header(h, "x-real-ip");
  if (direct) return direct.trim();
  const fwd = header(h, "x-forwarded-for");
  return fwd ? fwd.split(",")[0]!.trim() || null : null;
}

/** Turns a request into an event, or null when SenseGap doesn't report on it. */
export function toEvent(req: RequestInfo, now = Date.now()): IngestEvent | null {
  const ip = req.ip ?? clientIp(req.headers);
  if (!ip) return null;
  const e: IngestEvent = {
    ts: req.ts ?? now,
    method: req.method.toUpperCase(),
    url: req.url,
    status: req.status ?? null,
    ip: ip.replace(/^::ffff:/, ""),
    ua: header(req.headers, "user-agent"),
    referer: header(req.headers, "referer"),
    signatureAgent: header(req.headers, "signature-agent"),
    asn: null,
    country: header(req.headers, "cf-ipcountry") ?? header(req.headers, "x-vercel-ip-country"),
    bytes: req.bytes ?? null,
    ms: req.ms ?? null,
  };
  return shouldSend(e) ? e : null;
}

export function resolveOptions(o: SenseGapOptions) {
  const ingestUrl = o.ingestUrl ?? env("SENSEGAP_INGEST_URL") ?? DEFAULT_INGEST_URL;
  return {
    key: o.key ?? env("SENSEGAP_KEY") ?? "",
    ingestUrl,
    checkUrl: ingestUrl.replace(INGEST_PATH, CHECK_PATH),
    flushIntervalMs: o.flushIntervalMs ?? 5000,
    maxBatch: Math.min(o.maxBatch ?? 200, MAX_EVENTS_PER_BATCH),
    logErrors: o.logErrors ?? true,
  };
}

export async function sendBatch(opts: { key: string; ingestUrl: string }, source: IngestSource, events: IngestEvent[], upload?: string): Promise<{ accepted: number; duplicate?: number }> {
  const batch = { v: 1, source, events, ...(upload ? { upload } : {}) };
  const res = await fetch(opts.ingestUrl, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${opts.key}` },
    body: JSON.stringify(batch),
  });
  if (!res.ok) throw new Error(`SenseGap ingest answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as { accepted: number; duplicate?: number };
}

export async function checkKey(opts: { key: string; checkUrl: string }, source: string): Promise<string> {
  if (!opts.key) throw new Error("SenseGap: no site key. Set SENSEGAP_KEY or pass { key }.");
  const res = await fetch(`${opts.checkUrl}?source=${source}`, { headers: { authorization: `Bearer ${opts.key}` } });
  const body = (await res.json().catch(() => ({}))) as { site?: string; error?: string };
  if (!res.ok || !body.site) throw new Error(`SenseGap: ${body.error ?? `key check failed (${res.status})`}`);
  return body.site;
}

/** A collector that batches events in memory. For long-running servers (Express, Fastify, plain Node). */
export function createSenseGap(options: SenseGapOptions = {}, source: IngestSource = "node"): SenseGap {
  const o = resolveOptions(options);
  let queue: IngestEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let warned = false;

  const flush = async () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!queue.length || !o.key) return;
    const events = queue;
    queue = [];
    try {
      await sendBatch(o, source, events);
    } catch (err) {
      if (o.logErrors) console.error(String(err));
    }
  };

  return {
    record(req) {
      if (!o.key) {
        if (!warned && o.logErrors) console.warn("SenseGap: no site key (SENSEGAP_KEY), nothing is sent.");
        warned = true;
        return;
      }
      let e: IngestEvent | null = null;
      try {
        e = toEvent(req);
      } catch {
        return; // never break the app over analytics
      }
      if (!e) return;
      queue.push(e);
      if (queue.length >= o.maxBatch || o.flushIntervalMs === 0) void flush();
      else if (!timer) {
        timer = setTimeout(() => void flush(), o.flushIntervalMs);
        (timer as { unref?: () => void }).unref?.();
      }
    },
    flush,
    check: () => checkKey(o, source),
  };
}
