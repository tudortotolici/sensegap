/**
 * Live check against the real published lists and real DNS.
 * Run: pnpm check:live
 */
import { IP_LISTS } from "../../bots/src/index.ts";
import { classifyRequest } from "../src/classify.ts";
import { DohResolver } from "../src/dns.ts";
import { fetchRangeSnapshot, RangeIndex } from "../src/ranges.ts";

const snapshot = await fetchRangeSnapshot();
console.log("IP lists:");
for (const id of Object.keys(IP_LISTS)) {
  const n = snapshot.lists[id]?.length;
  console.log(`  ${n ? "ok " : "ERR"} ${id.padEnd(30)} ${n ?? snapshot.errors[id]}`);
}

const ranges = new RangeIndex(snapshot);
const dns = new DohResolver();

// One address from inside each list, plus known fakes.
const firstV4 = (id: string) => snapshot.lists[id]?.find((c) => !c.includes(":"))?.split("/")[0] ?? "0.0.0.0";
const cases = [
  { label: "Googlebot, real IP", ip: firstV4("google-common"), ua: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" },
  { label: "Googlebot, fake IP", ip: "185.220.101.4", ua: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" },
  { label: "GPTBot, real IP", ip: firstV4("openai-gptbot"), ua: "Mozilla/5.0; compatible; GPTBot/1.2; +https://openai.com/gptbot" },
  { label: "GPTBot, fake IP", ip: "8.8.8.8", ua: "Mozilla/5.0; compatible; GPTBot/1.2; +https://openai.com/gptbot" },
  { label: "PerplexityBot, real IP", ip: firstV4("perplexity-bot"), ua: "Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)" },
  { label: "Bingbot via rDNS", ip: "157.55.39.1", ua: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)" },
  { label: "ClaudeBot", ip: "160.79.104.10", ua: "Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)" },
];

console.log("\nClassification:");
for (const c of cases) {
  const r = await classifyRequest({ ip: c.ip, userAgent: c.ua }, { ranges, dns });
  console.log(`  ${c.label.padEnd(24)} ${c.ip.padEnd(16)} → ${String(r.verification).padEnd(10)} ${r.evidence ?? ""}`);
}
