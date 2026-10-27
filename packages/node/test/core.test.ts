import { afterEach, describe, expect, it, vi } from "vitest";
import { clientIp, createSenseGap, toEvent } from "../src/core";
import { withSenseGap } from "../src/next";

const GPTBOT = "Mozilla/5.0; compatible; GPTBot/1.2; +https://openai.com/gptbot";
const CHROME = "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/141.0 Safari/537.36";

afterEach(() => vi.unstubAllGlobals());

describe("toEvent", () => {
  it("keeps bots and AI visits, drops plain humans", () => {
    expect(toEvent({ method: "get", url: "https://x.com/a", headers: { "user-agent": GPTBOT }, ip: "1.2.3.4" })).toMatchObject({ method: "GET", ip: "1.2.3.4" });
    expect(toEvent({ method: "GET", url: "https://x.com/a", headers: { "user-agent": CHROME }, ip: "1.2.3.4" })).toBeNull();
    expect(toEvent({ method: "GET", url: "https://x.com/a?utm_source=chatgpt.com", headers: { "user-agent": CHROME }, ip: "1.2.3.4" })).not.toBeNull();
  });

  it("reads the client IP from proxy headers", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
    expect(clientIp({ "cf-connecting-ip": "8.8.8.8", "x-forwarded-for": "1.1.1.1" })).toBe("8.8.8.8");
    expect(toEvent({ method: "GET", url: "https://x.com/", headers: { "user-agent": GPTBOT } })).toBeNull();
    expect(toEvent({ method: "GET", url: "https://x.com/", headers: { "user-agent": GPTBOT }, ip: "::ffff:1.2.3.4" })!.ip).toBe("1.2.3.4");
  });
});

describe("createSenseGap", () => {
  it("batches and sends with the key", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ accepted: 2 })));
    vi.stubGlobal("fetch", fetchMock);
    const sg = createSenseGap({ key: "sg_live_test", ingestUrl: "https://ingest.test/v1/events", flushIntervalMs: 60_000 });
    sg.record({ method: "GET", url: "https://x.com/a", headers: { "user-agent": GPTBOT }, ip: "1.2.3.4", status: 200 });
    sg.record({ method: "GET", url: "https://x.com/b", headers: { "user-agent": CHROME }, ip: "1.2.3.4", status: 200 });
    sg.record({ method: "GET", url: "https://x.com/c", headers: { "user-agent": GPTBOT }, ip: "1.2.3.4", status: 404 });
    await sg.flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://ingest.test/v1/events");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer sg_live_test");
    const body = JSON.parse(init.body as string);
    expect(body.source).toBe("node");
    expect(body.events.map((e: { url: string }) => e.url)).toEqual(["https://x.com/a", "https://x.com/c"]);
  });

  it("sends nothing without a key", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const sg = createSenseGap({ key: "", logErrors: false });
    sg.record({ method: "GET", url: "https://x.com/a", headers: { "user-agent": GPTBOT }, ip: "1.2.3.4" });
    await sg.flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("withSenseGap", () => {
  it("passes the proxy result through and sends in waitUntil", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ accepted: 1 })));
    vi.stubGlobal("fetch", fetchMock);
    const waits: Promise<unknown>[] = [];
    const redirect = new Response(null, { status: 308 });
    const proxy = withSenseGap(() => redirect, { key: "k" });
    const req = { method: "GET", url: "https://x.com/old", headers: new Headers({ "user-agent": GPTBOT, "x-forwarded-for": "1.2.3.4" }) };
    expect(await proxy(req, { waitUntil: (p) => waits.push(p) })).toBe(redirect);
    await Promise.all(waits);
    expect(JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string).events[0].status).toBe(308);
  });
});
