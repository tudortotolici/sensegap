import { shouldSend, type IngestEvent } from "@sensegap/protocol";

type HeaderSource = Headers | Record<string, string>;

function header(h: HeaderSource, name: string): string | null {
  if (h instanceof Headers) return h.get(name);
  const v = h[name] ?? h[name.toLowerCase()];
  return v === undefined || v === "REDACTED" ? null : v;
}

interface CfProps {
  asn?: number;
  country?: string;
}

/** Builds an event from the parts every Cloudflare request has. Returns null when it should not be sent. */
export function buildEvent(input: {
  ts: number;
  method: string;
  url: string;
  headers: HeaderSource;
  cf?: CfProps | null;
  status: number | null;
}): IngestEvent | null {
  const ip = header(input.headers, "cf-connecting-ip") ?? header(input.headers, "x-real-ip");
  if (!ip) return null;
  const event: IngestEvent = {
    ts: input.ts,
    method: input.method,
    url: input.url,
    status: input.status,
    ip,
    ua: header(input.headers, "user-agent"),
    referer: header(input.headers, "referer"),
    signatureAgent: header(input.headers, "signature-agent"),
    asn: typeof input.cf?.asn === "number" ? input.cf.asn : null,
    country: typeof input.cf?.country === "string" ? input.cf.country : null,
  };
  return shouldSend(event) ? event : null;
}
