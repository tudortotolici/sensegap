import { describe, expect, it } from "vitest";
import { BOTS, IP_LISTS, matchBot } from "@sensegap/bots";
import { classifyRequest } from "../src/classify.ts";
import type { DnsResolver } from "../src/dns.ts";
import { RangeIndex, parsePrefixList } from "../src/ranges.ts";

const ranges = new RangeIndex({
  lists: {
    "google-common": ["66.249.64.0/27", "2001:4860:4801:10::/64"],
    "openai-gptbot": ["20.15.240.64/28"],
    "openai-chatgpt-user": ["23.98.142.176/28"],
  },
});

const fakeDns = (ptrs: Record<string, string[]>, fwd: Record<string, string[]>): DnsResolver => ({
  ptr: async (name) => ptrs[name] ?? [],
  addresses: async (host) => fwd[host] ?? [],
});

const UA = {
  googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  gptbot: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)",
  chatgptUser: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot",
  claudebot: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
  chrome: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  curl: "curl/8.7.1",
};

describe("bot directory", () => {
  it("has unique ids", () => {
    const ids = BOTS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("only references IP lists that exist", () => {
    for (const b of BOTS) for (const l of b.verify?.ipLists ?? []) expect(IP_LISTS[l], `${b.id} → ${l}`).toBeDefined();
  });
  it("matches specific bots before broad ones", () => {
    expect(matchBot({ userAgent: UA.chatgptUser }).bot?.id).toBe("chatgpt-user");
    expect(matchBot({ userAgent: "Googlebot-Image/1.0" }).bot?.id).toBe("googlebot");
    expect(matchBot({ userAgent: "Mozilla/5.0 (compatible; Google-InspectionTool/1.0;)" }).bot?.id).toBe("google-inspectiontool");
    expect(matchBot({ userAgent: UA.chrome, signatureAgent: '"https://chatgpt.com"' }).bot?.id).toBe("chatgpt-agent");
  });
  it("flags unknown automated clients", () => {
    expect(matchBot({ userAgent: UA.curl })).toEqual({ bot: null, unknownBot: true });
    expect(matchBot({ userAgent: "" }).unknownBot).toBe(true);
    expect(matchBot({ userAgent: UA.chrome }).unknownBot).toBe(false);
    expect(matchBot({ userAgent: "SenseGapTest/0.1 (+https://sensegap.com)" }).unknownBot).toBe(true);
  });
});

describe("classifyRequest", () => {
  it("verifies a bot by published IP list", async () => {
    const r = await classifyRequest({ ip: "66.249.64.5", userAgent: UA.googlebot }, { ranges });
    expect(r).toMatchObject({ kind: "bot", category: "search", verification: "verified", method: "ip_list" });
  });

  it("verifies IPv6", async () => {
    const r = await classifyRequest({ ip: "2001:4860:4801:10::99", userAgent: UA.googlebot }, { ranges });
    expect(r.verification).toBe("verified");
  });

  it("marks a fake GPTBot as spoofed", async () => {
    const r = await classifyRequest({ ip: "185.220.101.4", userAgent: UA.gptbot }, { ranges });
    expect(r).toMatchObject({ verification: "spoofed", category: "ai_training" });
  });

  it("falls back to reverse DNS for Google", async () => {
    const dns = fakeDns(
      { "9.0.249.66.in-addr.arpa": ["crawl-66-249-0-9.googlebot.com"] },
      { "crawl-66-249-0-9.googlebot.com": ["66.249.0.9"] },
    );
    const r = await classifyRequest({ ip: "66.249.0.9", userAgent: UA.googlebot }, { ranges, dns });
    expect(r).toMatchObject({ verification: "verified", method: "rdns" });
  });

  it("catches reverse DNS that does not resolve back", async () => {
    const dns = fakeDns(
      { "4.101.220.185.in-addr.arpa": ["crawl.googlebot.com"] },
      { "crawl.googlebot.com": ["66.249.0.1"] },
    );
    const r = await classifyRequest({ ip: "185.220.101.4", userAgent: UA.googlebot }, { ranges, dns });
    expect(r.verification).toBe("spoofed");
  });

  it("never puts the IP or a foreign hostname in the evidence", async () => {
    const ok = await classifyRequest({ ip: "66.249.0.9", userAgent: UA.googlebot }, {
      ranges,
      dns: fakeDns({ "9.0.249.66.in-addr.arpa": ["crawl-66-249-0-9.googlebot.com"] }, { "crawl-66-249-0-9.googlebot.com": ["66.249.0.9"] }),
    });
    expect(ok.evidence).toBe("rDNS crawl-66-249-0-9.googlebot.com, forward lookup matches");

    const back = await classifyRequest({ ip: "185.220.101.4", userAgent: UA.googlebot }, {
      ranges,
      dns: fakeDns({ "4.101.220.185.in-addr.arpa": ["crawl.googlebot.com"] }, { "crawl.googlebot.com": ["66.249.0.1"] }),
    });
    expect(back.evidence).toBe("rDNS crawl.googlebot.com does not resolve back to this IP");

    const foreign = await classifyRequest({ ip: "203.0.113.7", userAgent: UA.googlebot }, {
      ranges,
      dns: fakeDns({ "7.113.0.203.in-addr.arpa": ["203-0-113-7.isp.example.net"] }, {}),
    });
    expect(foreign.verification).toBe("spoofed");
    for (const r of [ok, back, foreign]) {
      expect(r.evidence).not.toMatch(/185\.220\.101\.4|203\.0\.113\.7|isp\.example/);
    }
  });

  it("leaves bots without a published method unverified", async () => {
    const r = await classifyRequest({ ip: "160.79.104.10", userAgent: UA.claudebot }, { ranges });
    expect(r).toMatchObject({ verification: "unverified", category: "ai_training" });
  });

  it("does not call a bot spoofed when lists failed to load", async () => {
    const empty = new RangeIndex({ lists: {} });
    const r = await classifyRequest({ ip: "185.220.101.4", userAgent: UA.gptbot }, { ranges: empty });
    expect(r.verification).toBe("unverified");
  });

  it("detects humans sent by AI", async () => {
    const a = await classifyRequest({ ip: "1.2.3.4", userAgent: UA.chrome, referer: "https://chatgpt.com/" }, { ranges });
    expect(a).toMatchObject({ kind: "human", aiReferrer: { id: "chatgpt" } });
    const b = await classifyRequest({ ip: "1.2.3.4", userAgent: UA.chrome, url: "https://x.com/p?utm_source=chatgpt.com" }, { ranges });
    expect(b.aiReferrer?.id).toBe("chatgpt");
    const c = await classifyRequest({ ip: "1.2.3.4", userAgent: UA.chrome, referer: "https://www.google.com/" }, { ranges });
    expect(c).toMatchObject({ kind: "human", aiReferrer: null });
  });

  it("reports unknown bots", async () => {
    const r = await classifyRequest({ ip: "1.2.3.4", userAgent: UA.curl }, { ranges });
    expect(r.kind).toBe("unknown_bot");
  });
});

describe("parsePrefixList", () => {
  it("reads both IPv4 and IPv6 prefixes and skips junk", () => {
    expect(parsePrefixList({ prefixes: [{ ipv4Prefix: "1.2.3.0/24" }, { ipv6Prefix: "2001:db8::/32" }, { ipv4Prefix: "bad" }] })).toEqual([
      "1.2.3.0/24",
      "2001:db8::/32",
    ]);
  });
});
