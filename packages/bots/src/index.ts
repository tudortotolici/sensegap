export type { BotCategory, BotDef, BotVerification } from "./types.ts";
export { BOTS } from "./bots.ts";
export { IP_LISTS } from "./ip-lists.ts";
export { matchBot, getBot, GENERIC_BOT, uaProductName, type BotMatch, type MatchInput } from "./match.ts";
export { AI_REFERRERS, matchAiReferrer, type AiReferrer } from "./referrers.ts";
export { parseRobots, checkRobots, rulesFor, robotsTokenFor, type RobotsFile, type RobotsGroup, type RobotsRule, type RobotsDecision } from "./robots.ts";
