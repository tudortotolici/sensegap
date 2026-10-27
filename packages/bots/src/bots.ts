import type { BotDef } from "./types.ts";

const GOOGLE_RDNS = ["googlebot.com", "google.com", "googleusercontent.com"];

/**
 * The bot directory. Order matters: the first match wins,
 * so more specific patterns come before broader ones.
 */
export const BOTS: BotDef[] = [
  // ── OpenAI ─────────────────────────────────────────────
  {
    id: "chatgpt-agent",
    name: "ChatGPT agent",
    operator: "OpenAI",
    category: "ai_agent",
    signatureAgentMatch: /^"?https:\/\/chatgpt\.com"?$/i,
    verify: { signatureAgent: "https://chatgpt.com" },
  },
  { id: "chatgpt-user", name: "ChatGPT-User", operator: "OpenAI", category: "ai_user", ua: /ChatGPT-User/i, verify: { ipLists: ["openai-chatgpt-user"] }, docs: "https://platform.openai.com/docs/bots" },
  { id: "oai-searchbot", name: "OAI-SearchBot", operator: "OpenAI", category: "ai_search", ua: /OAI-SearchBot/i, verify: { ipLists: ["openai-searchbot"] }, docs: "https://platform.openai.com/docs/bots" },
  { id: "gptbot", name: "GPTBot", operator: "OpenAI", category: "ai_training", ua: /GPTBot/i, verify: { ipLists: ["openai-gptbot"] }, docs: "https://platform.openai.com/docs/bots" },

  // ── Anthropic (no published IP ranges as of 2026-10) ───
  { id: "claude-user", name: "Claude-User", operator: "Anthropic", category: "ai_user", ua: /Claude-User/i, docs: "https://support.claude.com/en/articles/8896518" },
  { id: "claude-searchbot", name: "Claude-SearchBot", operator: "Anthropic", category: "ai_search", ua: /Claude-SearchBot/i, docs: "https://support.claude.com/en/articles/8896518" },
  { id: "claudebot", name: "ClaudeBot", operator: "Anthropic", category: "ai_training", ua: /ClaudeBot/i, docs: "https://support.claude.com/en/articles/8896518" },
  { id: "anthropic-legacy", name: "anthropic-ai / Claude-Web", operator: "Anthropic", category: "ai_training", ua: /anthropic-ai|Claude-Web/i },

  // ── Perplexity ─────────────────────────────────────────
  { id: "perplexity-user", name: "Perplexity-User", operator: "Perplexity", category: "ai_user", ua: /Perplexity-User/i, verify: { ipLists: ["perplexity-user"] }, docs: "https://docs.perplexity.ai/guides/bots" },
  { id: "perplexitybot", name: "PerplexityBot", operator: "Perplexity", category: "ai_search", ua: /PerplexityBot/i, verify: { ipLists: ["perplexity-bot"] }, docs: "https://docs.perplexity.ai/guides/bots" },

  // ── Google ─────────────────────────────────────────────
  { id: "google-notebooklm", name: "Google-NotebookLM", operator: "Google", category: "ai_user", ua: /Google-NotebookLM/i, verify: { ipLists: ["google-user-triggered", "google-user-triggered-google"], rdnsSuffixes: GOOGLE_RDNS } },
  { id: "google-cloudvertexbot", name: "Google-CloudVertexBot", operator: "Google", category: "ai_search", ua: /Google-CloudVertexBot/i, verify: { ipLists: ["google-special"], rdnsSuffixes: GOOGLE_RDNS } },
  { id: "google-inspectiontool", name: "Google-InspectionTool", operator: "Google", category: "seo", ua: /Google-InspectionTool/i, verify: { ipLists: ["google-common"], rdnsSuffixes: GOOGLE_RDNS } },
  { id: "googleother", name: "GoogleOther", operator: "Google", category: "other", ua: /GoogleOther/i, verify: { ipLists: ["google-common"], rdnsSuffixes: GOOGLE_RDNS } },
  { id: "adsbot-google", name: "AdsBot-Google", operator: "Google", category: "other", ua: /AdsBot-Google|Mediapartners-Google/i, verify: { ipLists: ["google-special"], rdnsSuffixes: GOOGLE_RDNS } },
  { id: "storebot-google", name: "Storebot-Google", operator: "Google", category: "search", ua: /Storebot-Google/i, verify: { ipLists: ["google-common"], rdnsSuffixes: GOOGLE_RDNS } },
  { id: "google-user-fetch", name: "Google user-triggered fetcher", operator: "Google", category: "other", ua: /FeedFetcher-Google|Google-Read-Aloud|Google-Site-Verification|GoogleProducer/i, verify: { ipLists: ["google-user-triggered", "google-user-triggered-google"], rdnsSuffixes: GOOGLE_RDNS } },
  { id: "googlebot", name: "Googlebot", operator: "Google", category: "search", ua: /Googlebot/i, verify: { ipLists: ["google-common"], rdnsSuffixes: GOOGLE_RDNS }, docs: "https://developers.google.com/crawling/docs/crawlers-fetchers/verify-google-requests" },

  // ── Microsoft ──────────────────────────────────────────
  { id: "bingbot", name: "Bingbot", operator: "Microsoft", category: "search", ua: /bingbot|BingPreview|adidxbot/i, verify: { ipLists: ["bingbot"], rdnsSuffixes: ["search.msn.com"] } },

  // ── Apple ──────────────────────────────────────────────
  { id: "applebot", name: "Applebot", operator: "Apple", category: "search", ua: /Applebot/i, verify: { ipLists: ["applebot"], rdnsSuffixes: ["applebot.apple.com"] }, docs: "https://support.apple.com/en-us/119829" },

  // ── DuckDuckGo ─────────────────────────────────────────
  { id: "duckassistbot", name: "DuckAssistBot", operator: "DuckDuckGo", category: "ai_search", ua: /DuckAssistBot/i, verify: { ipLists: ["duckassistbot"] } },
  { id: "duckduckbot", name: "DuckDuckBot", operator: "DuckDuckGo", category: "search", ua: /DuckDuckBot/i, verify: { ipLists: ["duckduckbot"] } },

  // ── Other AI companies ─────────────────────────────────
  { id: "mistralai-user", name: "MistralAI-User", operator: "Mistral AI", category: "ai_user", ua: /MistralAI-User/i, verify: { ipLists: ["mistral-user"] } },
  { id: "ccbot", name: "CCBot", operator: "Common Crawl", category: "ai_training", ua: /CCBot/i, verify: { ipLists: ["ccbot"] } },
  { id: "meta-externalfetcher", name: "Meta-ExternalFetcher", operator: "Meta", category: "ai_user", ua: /meta-externalfetcher/i },
  { id: "meta-externalagent", name: "Meta-ExternalAgent", operator: "Meta", category: "ai_training", ua: /meta-externalagent/i },
  { id: "facebookbot", name: "FacebookBot", operator: "Meta", category: "ai_training", ua: /FacebookBot/i },
  { id: "bytespider", name: "Bytespider", operator: "ByteDance", category: "ai_training", ua: /Bytespider/i },
  { id: "amazonbot", name: "Amazonbot", operator: "Amazon", category: "ai_search", ua: /Amazonbot/i, verify: { rdnsSuffixes: ["crawl.amazonbot.amazon"] } },
  { id: "cohere", name: "cohere-ai", operator: "Cohere", category: "ai_training", ua: /cohere-ai|cohere-training-data-crawler/i },
  { id: "youbot", name: "YouBot", operator: "You.com", category: "ai_search", ua: /YouBot/i },
  { id: "exasearchbot", name: "ExaSearchBot", operator: "Exa", category: "ai_search", ua: /ExaSearchBot|ExaBot/i, docs: "https://crawler.exa.ai/" },
  { id: "ai2bot", name: "AI2Bot", operator: "Allen Institute for AI", category: "ai_training", ua: /AI2Bot/i },
  { id: "diffbot", name: "Diffbot", operator: "Diffbot", category: "ai_training", ua: /Diffbot/i },
  { id: "timpibot", name: "Timpibot", operator: "Timpi", category: "ai_training", ua: /Timpibot/i },
  { id: "imagesiftbot", name: "ImagesiftBot", operator: "Hive", category: "ai_training", ua: /ImagesiftBot/i },
  { id: "omgili", name: "Omgilibot", operator: "Webz.io", category: "ai_training", ua: /omgili/i },
  { id: "pangubot", name: "PanguBot", operator: "Huawei", category: "ai_training", ua: /PanguBot/i },

  // ── Other search engines ───────────────────────────────
  { id: "yandexbot", name: "YandexBot", operator: "Yandex", category: "search", ua: /YandexBot|YandexImages|YandexMobileBot/i, verify: { rdnsSuffixes: ["yandex.ru", "yandex.net", "yandex.com"] } },
  { id: "baiduspider", name: "Baiduspider", operator: "Baidu", category: "search", ua: /Baiduspider/i, verify: { rdnsSuffixes: ["baidu.com", "baidu.jp"] } },
  { id: "petalbot", name: "PetalBot", operator: "Huawei", category: "search", ua: /PetalBot/i, verify: { rdnsSuffixes: ["petalsearch.com"] } },

  // ── SEO tools ──────────────────────────────────────────
  { id: "ahrefsbot", name: "AhrefsBot", operator: "Ahrefs", category: "seo", ua: /AhrefsBot|AhrefsSiteAudit/i, verify: { rdnsSuffixes: ["ahrefs.com", "ahrefs.net"] } },
  { id: "semrushbot", name: "SemrushBot", operator: "Semrush", category: "seo", ua: /SemrushBot|SiteAuditBot/i, verify: { rdnsSuffixes: ["semrush.com"] } },
  { id: "mj12bot", name: "MJ12bot", operator: "Majestic", category: "seo", ua: /MJ12bot/i },
  { id: "dotbot", name: "DotBot", operator: "Moz", category: "seo", ua: /DotBot|rogerbot/i },
  { id: "dataforseobot", name: "DataForSeoBot", operator: "DataForSEO", category: "seo", ua: /DataForSeoBot/i },
  { id: "screaming-frog", name: "Screaming Frog", operator: "Screaming Frog", category: "seo", ua: /Screaming Frog/i },

  // ── Link previews ──────────────────────────────────────
  { id: "facebookexternalhit", name: "facebookexternalhit", operator: "Meta", category: "preview", ua: /facebookexternalhit|facebookcatalog/i },
  { id: "twitterbot", name: "Twitterbot", operator: "X", category: "preview", ua: /Twitterbot/i },
  { id: "linkedinbot", name: "LinkedInBot", operator: "LinkedIn", category: "preview", ua: /LinkedInBot/i },
  { id: "slackbot", name: "Slackbot", operator: "Slack", category: "preview", ua: /Slackbot/i },
  { id: "discordbot", name: "Discordbot", operator: "Discord", category: "preview", ua: /Discordbot/i },
  { id: "whatsapp", name: "WhatsApp", operator: "Meta", category: "preview", ua: /WhatsApp/i },
  { id: "telegrambot", name: "TelegramBot", operator: "Telegram", category: "preview", ua: /TelegramBot/i },

  // ── Monitoring ─────────────────────────────────────────
  { id: "uptime-monitors", name: "Uptime monitor", operator: "Various", category: "monitoring", ua: /UptimeRobot|Pingdom|StatusCake|Better Uptime|Site24x7/i },
];
