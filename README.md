# SenseGap open source

The parts of [SenseGap](https://sensegap.com) that touch your site or decide whether a bot is real. MIT licensed.

- **A directory of AI crawlers, AI agents and other bots**: who runs each one, why it visits, its user-agent pattern, its robots.txt token and how to prove it's real.
- **Bot verification**: checks a visitor against the IP ranges operators publish, or with reverse DNS confirmed by a forward lookup. The verdict is `verified`, `unverified` or `spoofed`, with the evidence.
- **The collectors** that report bot visits to SenseGap: a Cloudflare Worker, a WordPress plugin and a Next.js / Node middleware. Read them to see exactly what leaves your site.

The dashboard, the ingest service and the insights are not in this repository.

## What's inside

| Path | Package | What it does |
|---|---|---|
| [`packages/bots`](packages/bots) | `@sensegap/bots` | The bot directory, official IP range lists, AI products that send people to sites, a robots.txt parser |
| [`packages/verify`](packages/verify) | `@sensegap/verify` | IP and CIDR matching, reverse DNS over HTTPS, request classification |
| [`packages/protocol`](packages/protocol) | `@sensegap/protocol` | The wire format between a collector and SenseGap, and `shouldSend()`, which decides which requests are sent at all |
| [`packages/node`](packages/node) | `@sensegap/node` | Next.js proxy, Express middleware and the `sensegap-logs` CLI for old access logs |
| [`collectors/cloudflare`](collectors/cloudflare) | | The Cloudflare Worker collector (Tail Worker or route Worker) |
| [`collectors/wordpress`](collectors/wordpress) | | The WordPress plugin (PHP) |

## Use the bot list

The packages ship as TypeScript source. Use a runtime or bundler that reads `.ts` files: Node 24 with type stripping, Bun, Deno or esbuild.

```ts
import { matchBot } from "@sensegap/bots";

const { bot, unknownBot } = matchBot({
  userAgent: request.headers.get("user-agent"),
  signatureAgent: request.headers.get("signature-agent"),
});

if (bot) console.log(bot.name, bot.operator, bot.category); // "GPTBot" "OpenAI" "ai_training"
```

Build robots.txt rules for AI training crawlers only:

```ts
import { BOTS, robotsTokenFor } from "@sensegap/bots";

const rules = BOTS
  .filter((b) => b.category === "ai_training")
  .map(robotsTokenFor)
  .filter((t) => t !== null)
  .map((t) => `User-agent: ${t}\nDisallow: /`)
  .join("\n\n");
```

## Verify a bot before you trust it

Blocking by user agent is safe. Allowing by user agent isn't: anyone can send a request that says Googlebot.

```ts
import { fetchRangeSnapshot, RangeIndex, DohResolver, CachingResolver, classifyRequest } from "@sensegap/verify";

const ranges = new RangeIndex(await fetchRangeSnapshot());
const dns = new CachingResolver(new DohResolver());

const result = await classifyRequest(
  { ip: "66.249.66.1", userAgent: "Googlebot/2.1 (+http://www.google.com/bot.html)" },
  { ranges, dns },
);
result.verification; // "verified" | "unverified" | "spoofed"
result.evidence;     // "IP in google-common"
```

## Bot categories

| Category | Meaning |
|---|---|
| `ai_user` | Fetches a page right now because someone asked an assistant |
| `ai_search` | Builds the index AI answers are drawn from |
| `ai_training` | Collects content that may be used to train models |
| `ai_agent` | Browses and acts on a person's behalf |
| `search` | Classic search engine crawlers |
| `seo` | SEO and marketing tool crawlers |
| `preview` | Chat and social apps fetching a link preview |
| `monitoring` | Uptime and performance checks |
| `other` | Known bots that fit none of the above |

## What the collectors send

For each request from a bot, or from a person who clicked a link in an AI answer: time, method, URL, status, IP address, user agent, referrer, `Signature-Agent` header, network (ASN) and country. Plain human visits never leave your site. The filter is `shouldSend()` in [`packages/protocol`](packages/protocol/src/index.ts).

## Develop

```bash
pnpm install
pnpm test          # unit tests
pnpm typecheck
pnpm check:live    # checks every official IP list and a few real bots over the network
pnpm build         # builds dist/: the Cloudflare collector bundle, the Node package and the WordPress plugin
php collectors/wordpress/test/collector-test.php
```

## Contributing

Spotted a bot we don't know, or a wrong verdict? [Open an issue](../../issues/new/choose). See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE). Copyright (c) 2026 SenseGap.
