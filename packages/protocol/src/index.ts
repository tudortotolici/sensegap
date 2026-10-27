import { matchAiReferrer, matchBot } from "@sensegap/bots";

/** One HTTP request seen by a collector. */
export interface IngestEvent {
  /** Unix ms. */
  ts: number;
  method: string;
  /** Full URL including query (utm_source matters); the ingest API strips it before storage. */
  url: string;
  status: number | null;
  /** Full client IP. Used for verification, then anonymized; never stored in full. */
  ip: string;
  ua: string | null;
  referer: string | null;
  signatureAgent: string | null;
  asn: number | null;
  country: string | null;
  bytes?: number | null;
  ms?: number | null;
}

export type IngestSource = "cf-tail" | "cf-route" | "node" | "wordpress" | "logs";
export const INGEST_SOURCES: IngestSource[] = ["cf-tail", "cf-route", "node", "wordpress", "logs"];

export interface IngestBatch {
  v: 1;
  source: IngestSource;
  events: IngestEvent[];
  /** Log uploads only: one id per upload, so re-uploading the same days is skipped. */
  upload?: string;
}

/** Answer of GET /v1/check: which site a key belongs to. */
export interface KeyCheck {
  ok: true;
  site: string;
}

export const MAX_EVENTS_PER_BATCH = 1000;
export const INGEST_PATH = "/v1/events";
export const CHECK_PATH = "/v1/check";
export const DEFAULT_INGEST_URL = "https://ingest.sensegap.com/v1/events";

/**
 * Collectors only send what SenseGap reports on: bots (known or not) and humans sent by AI.
 * Plain human traffic never leaves the customer's site.
 */
export function shouldSend(e: Pick<IngestEvent, "url" | "ua" | "referer" | "signatureAgent">): boolean {
  let path = "";
  try {
    path = new URL(e.url).pathname;
  } catch {
    return false;
  }
  if (path.startsWith("/cdn-cgi/")) return false;
  // SenseGap's own fetchers (page titles, robots.txt).
  if (e.ua?.startsWith("SenseGap-")) return false;
  const m = matchBot({ userAgent: e.ua, signatureAgent: e.signatureAgent });
  if (m.bot || m.unknownBot) return true;
  return matchAiReferrer(e.referer, e.url) !== null;
}

/** Validates an untrusted batch. Returns an error message, or null when valid. */
export function validateBatch(body: unknown): string | null {
  const b = body as Partial<IngestBatch> | null;
  if (!b || typeof b !== "object") return "body must be a JSON object";
  if (b.v !== 1) return "unsupported version";
  if (b.source !== undefined && !INGEST_SOURCES.includes(b.source)) return "unknown source";
  if (b.upload !== undefined && (typeof b.upload !== "string" || !/^[\w-]{6,64}$/.test(b.upload))) return "upload must be a short id";
  if (!Array.isArray(b.events)) return "events must be an array";
  if (b.events.length > MAX_EVENTS_PER_BATCH) return `at most ${MAX_EVENTS_PER_BATCH} events per batch`;
  for (const [i, e] of b.events.entries()) {
    if (!e || typeof e !== "object") return `events[${i}] must be an object`;
    if (typeof e.ts !== "number" || !Number.isFinite(e.ts)) return `events[${i}].ts must be a number`;
    if (typeof e.url !== "string" || e.url.length > 4096) return `events[${i}].url must be a string`;
    if (typeof e.ip !== "string" || e.ip.length > 64) return `events[${i}].ip must be a string`;
    if (typeof e.method !== "string" || e.method.length > 16) return `events[${i}].method must be a string`;
  }
  return null;
}

export { parseLogLine } from "./logs.ts";
