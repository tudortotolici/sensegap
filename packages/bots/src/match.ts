import { BOTS } from "./bots.ts";
import type { BotDef } from "./types.ts";

/** Words that suggest an automated client we don't know yet. */
export const GENERIC_BOT =
  /bot\b|bot\/|crawl|spider|scrape|fetch|slurp|python-requests|python-urllib|aiohttp|httpx|curl\/|wget\/|go-http-client|okhttp|java\/|libwww|axios\/|node-fetch|undici|headlesschrome|phantomjs|scrapy|\(\+?https?:\/\/|; \+https?:\/\/|\+https?:\/\//i;

export interface BotMatch {
  bot: BotDef | null;
  /** True when no known bot matched but the UA looks automated. */
  unknownBot: boolean;
}

export interface MatchInput {
  userAgent?: string | null;
  signatureAgent?: string | null;
}

export function matchBot({ userAgent, signatureAgent }: MatchInput): BotMatch {
  const ua = userAgent ?? "";
  if (signatureAgent) {
    for (const bot of BOTS) {
      if (bot.signatureAgentMatch?.test(signatureAgent.trim())) return { bot, unknownBot: false };
    }
  }
  for (const bot of BOTS) {
    if (bot.ua?.test(ua)) return { bot, unknownBot: false };
  }
  return { bot: null, unknownBot: ua === "" || GENERIC_BOT.test(ua) };
}

const GENERIC_TOKENS = /^(mozilla|applewebkit|chrome|safari|gecko|firefox|version|mobile|edg|opr|khtml|like)$/i;

/**
 * Best-effort product name for an unknown client, so reports can say "mcpbeat"
 * instead of "unknown bot". Returns the first "Name/version" token that isn't a browser token.
 */
export function uaProductName(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  for (const m of userAgent.matchAll(/([A-Za-z][\w.-]{1,40})\/v?\d[\w.]*/g)) {
    const name = m[1]!;
    if (!GENERIC_TOKENS.test(name)) return name;
  }
  return null;
}

export function getBot(id: string): BotDef | undefined {
  return BOTS.find((b) => b.id === id);
}
