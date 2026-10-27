import { describe, expect, it } from "vitest";
import { validateBatch } from "@sensegap/protocol";
import { buildEvent } from "../src/event.ts";

const base = {
  ts: 1_761_400_000_000,
  method: "GET",
  url: "https://example.com/subiect/x",
  cf: { asn: 15169, country: "US" },
  status: 200,
};

describe("buildEvent", () => {
  it("sends bots, with IP, ASN and country", () => {
    const e = buildEvent({ ...base, headers: { "cf-connecting-ip": "66.249.66.1", "user-agent": "Googlebot/2.1" } });
    expect(e).toMatchObject({ ip: "66.249.66.1", ua: "Googlebot/2.1", asn: 15169, country: "US", status: 200 });
  });

  it("keeps plain human traffic on the site", () => {
    const e = buildEvent({ ...base, headers: { "cf-connecting-ip": "1.2.3.4", "user-agent": "Mozilla/5.0 (Macintosh) Chrome/141.0 Safari/537.36" } });
    expect(e).toBeNull();
  });

  it("sends humans that came from an AI product", () => {
    const e = buildEvent({
      ...base,
      headers: new Headers({ "cf-connecting-ip": "1.2.3.4", "user-agent": "Mozilla/5.0 Chrome/141.0", referer: "https://perplexity.ai/search" }),
    });
    expect(e?.referer).toBe("https://perplexity.ai/search");
  });

  it("ignores Cloudflare internal paths and requests without an IP", () => {
    expect(buildEvent({ ...base, url: "https://example.com/cdn-cgi/rum", headers: { "cf-connecting-ip": "1.2.3.4", "user-agent": "curl/8" } })).toBeNull();
    expect(buildEvent({ ...base, headers: { "user-agent": "Googlebot/2.1" } })).toBeNull();
  });

  it("treats redacted header values as missing", () => {
    const e = buildEvent({ ...base, headers: { "cf-connecting-ip": "66.249.66.1", "user-agent": "Googlebot/2.1", "signature-agent": "REDACTED" } });
    expect(e?.signatureAgent).toBeNull();
  });
});

describe("validateBatch", () => {
  it("accepts a well-formed batch and rejects junk", () => {
    expect(validateBatch({ v: 1, source: "cf-tail", events: [] })).toBeNull();
    expect(validateBatch(null)).not.toBeNull();
    expect(validateBatch({ v: 2, events: [] })).toBe("unsupported version");
    expect(validateBatch({ v: 1, events: [{ ts: "x" }] })).toContain("ts");
  });
});
