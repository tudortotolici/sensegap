/**
 * Official IP range lists published by bot operators.
 * All use the same JSON shape: { prefixes: [{ ipv4Prefix } | { ipv6Prefix }] }.
 * Last checked: 2026-10-25.
 */
export const IP_LISTS: Record<string, string> = {
  "google-common": "https://developers.google.com/static/search/apis/ipranges/googlebot.json",
  "google-special": "https://developers.google.com/static/search/apis/ipranges/special-crawlers.json",
  "google-user-triggered": "https://developers.google.com/static/search/apis/ipranges/user-triggered-fetchers.json",
  "google-user-triggered-google": "https://developers.google.com/static/search/apis/ipranges/user-triggered-fetchers-google.json",
  bingbot: "https://www.bing.com/toolbox/bingbot.json",
  "openai-gptbot": "https://openai.com/gptbot.json",
  "openai-searchbot": "https://openai.com/searchbot.json",
  "openai-chatgpt-user": "https://openai.com/chatgpt-user.json",
  "perplexity-bot": "https://www.perplexity.com/perplexitybot.json",
  "perplexity-user": "https://www.perplexity.com/perplexity-user.json",
  applebot: "https://search.developer.apple.com/applebot.json",
  duckduckbot: "https://duckduckgo.com/duckduckbot.json",
  duckassistbot: "https://duckduckgo.com/duckassistbot.json",
  ccbot: "https://index.commoncrawl.org/ccbot.json",
  "mistral-user": "https://mistral.ai/mistralai-user-ips.json",
};
