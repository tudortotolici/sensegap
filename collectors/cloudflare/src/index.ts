import { DEFAULT_INGEST_URL, type IngestBatch, type IngestEvent, type IngestSource } from "@sensegap/protocol";
import { buildEvent } from "./event.ts";

export interface Env {
  /** Optional; defaults to https://ingest.sensegap.com/v1/events. */
  INGEST_URL?: string;
  INGEST_KEY: string;
}

async function send(env: Env, source: IngestSource, events: IngestEvent[]): Promise<void> {
  if (events.length === 0 || !env.INGEST_KEY) return;
  const batch: IngestBatch = { v: 1, source, events };
  const res = await fetch(env.INGEST_URL || DEFAULT_INGEST_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.INGEST_KEY}` },
    body: JSON.stringify(batch),
  });
  if (!res.ok) console.error("sensegap ingest", res.status, await res.text());
}

export default {
  /**
   * Tail mode: Cloudflare hands us finished invocations of the site's own Worker.
   * Nothing here can slow down or break the site.
   */
  async tail(items: TraceItem[], env: Env): Promise<void> {
    const events: IngestEvent[] = [];
    for (const item of items) {
      const info = item.event as TraceItemFetchEventInfo | null;
      if (!info || !("request" in info) || !info.request) continue;
      // URLs and some headers are redacted by default in tail events; we need the real values.
      const req = info.request.getUnredacted();
      const e = buildEvent({
        ts: item.eventTimestamp ?? Date.now(),
        method: req.method,
        url: req.url,
        headers: req.headers,
        cf: req.cf as { asn?: number; country?: string } | undefined,
        status: info.response?.status ?? null,
      });
      if (e) events.push(e);
    }
    await send(env, "cf-tail", events);
  },

  /**
   * Route mode, for sites not running their own Worker: pass the request through untouched,
   * report after the response is on its way. Errors fall back to the origin.
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    ctx.passThroughOnException();
    const response = await fetch(request);
    const e = buildEvent({
      ts: Date.now(),
      method: request.method,
      url: request.url,
      headers: request.headers,
      cf: request.cf as { asn?: number; country?: string } | undefined,
      status: response.status,
    });
    if (e) ctx.waitUntil(send(env, "cf-route", [e]).catch((err) => console.error("sensegap", err)));
    return response;
  },
} satisfies ExportedHandler<Env>;
