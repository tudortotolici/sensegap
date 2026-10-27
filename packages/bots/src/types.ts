/** Why a bot visits. Drives every report in SenseGap. */
export type BotCategory =
  | "ai_training" // collects content that may train models (GPTBot, ClaudeBot, CCBot)
  | "ai_search" // builds an index for AI answers (OAI-SearchBot, PerplexityBot)
  | "ai_user" // fetches a page right now because a person asked an AI (ChatGPT-User, Claude-User)
  | "ai_agent" // browses and acts on behalf of a person (ChatGPT agent)
  | "search" // classic search engines (Googlebot, Bingbot)
  | "seo" // SEO and marketing tools (AhrefsBot, SemrushBot)
  | "preview" // link previews in chat and social apps (Slackbot, Twitterbot)
  | "monitoring" // uptime and performance checks
  | "other";

/** How a visit claiming to be this bot can be proven genuine. */
export interface BotVerification {
  /** Ids of published IP range lists (see IP_LISTS). */
  ipLists?: string[];
  /** Hostname suffixes accepted by reverse DNS, confirmed by a forward lookup. */
  rdnsSuffixes?: string[];
  /** Expected value of the Signature-Agent header (Web Bot Auth, RFC 9421). */
  signatureAgent?: string;
}

export interface BotDef {
  id: string;
  name: string;
  operator: string;
  category: BotCategory;
  /** Matched against the User-Agent header. */
  ua?: RegExp;
  /** For agents that use a normal browser UA: matched against the Signature-Agent header. */
  signatureAgentMatch?: RegExp;
  verify?: BotVerification;
  /** Token to use in robots.txt, when it differs from the name. */
  robotsToken?: string;
  docs?: string;
}
