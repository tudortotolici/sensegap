import { describe, expect, it } from "vitest";
import { matchBot, uaProductName } from "@sensegap/bots";

describe("uaProductName", () => {
  it("names unknown bots from their user agent", () => {
    expect(uaProductName("mcpbeat/0.1 (+https://mcpbeat.com/bot/; liveness check)")).toBe("mcpbeat");
    expect(uaProductName("Mozilla/5.0 (compatible; AgentTrustBot/1.0; +https://agenttru.st/crawler)")).toBe("AgentTrustBot");
    expect(uaProductName("python-httpx/0.28.1")).toBe("python-httpx");
    expect(uaProductName("Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36")).toBeNull();
    expect(uaProductName("")).toBeNull();
  });
  it("knows Exa", () => {
    expect(matchBot({ userAgent: "Mozilla/5.0 (compatible; ExaSearchBot/1.0; +https://crawler.exa.ai/)" }).bot?.id).toBe("exasearchbot");
  });
});
