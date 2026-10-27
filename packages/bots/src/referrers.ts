/** AI products that send human visitors to websites. */
export interface AiReferrer {
  id: string;
  name: string;
  hosts: string[];
}

export const AI_REFERRERS: AiReferrer[] = [
  { id: "chatgpt", name: "ChatGPT", hosts: ["chatgpt.com", "chat.openai.com"] },
  { id: "perplexity", name: "Perplexity", hosts: ["perplexity.ai", "www.perplexity.ai"] },
  { id: "claude", name: "Claude", hosts: ["claude.ai"] },
  { id: "gemini", name: "Gemini", hosts: ["gemini.google.com", "bard.google.com"] },
  { id: "copilot", name: "Microsoft Copilot", hosts: ["copilot.microsoft.com", "copilot.cloud.microsoft"] },
  { id: "meta-ai", name: "Meta AI", hosts: ["meta.ai", "www.meta.ai"] },
  { id: "deepseek", name: "DeepSeek", hosts: ["chat.deepseek.com"] },
  { id: "grok", name: "Grok", hosts: ["grok.com"] },
  { id: "mistral", name: "Le Chat", hosts: ["chat.mistral.ai"] },
  { id: "you", name: "You.com", hosts: ["you.com"] },
  { id: "poe", name: "Poe", hosts: ["poe.com"] },
];

const byHost = new Map<string, AiReferrer>();
for (const r of AI_REFERRERS) for (const h of r.hosts) byHost.set(h, r);
const byUtm = new Map<string, AiReferrer>();
for (const r of AI_REFERRERS) for (const h of r.hosts) byUtm.set(h, r);
byUtm.set("chatgpt", AI_REFERRERS[0]!);

function hostOf(value: string): string | null {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Detects a human visit sent by an AI product,
 * from the Referer header or a utm_source parameter (ChatGPT adds utm_source=chatgpt.com).
 */
export function matchAiReferrer(referer: string | null | undefined, pageUrl?: string | null): AiReferrer | null {
  if (referer) {
    const host = hostOf(referer);
    if (host) {
      const hit = byHost.get(host) ?? byHost.get(host.replace(/^www\./, ""));
      if (hit) return hit;
    }
  }
  if (pageUrl) {
    try {
      const utm = new URL(pageUrl).searchParams.get("utm_source")?.toLowerCase();
      if (utm) return byUtm.get(utm) ?? null;
    } catch {
      /* ignore bad URLs */
    }
  }
  return null;
}
