/**
 * robots.txt parsing and evaluation, following RFC 9309:
 * - a bot obeys the group(s) naming its product token, else the "*" group(s), else everything is allowed;
 * - the longest matching rule wins; on a tie, Allow wins;
 * - "*" matches any characters and a trailing "$" anchors the end.
 */
import type { BotDef } from "./types.ts";

export interface RobotsRule {
  allow: boolean;
  pattern: string;
}

export interface RobotsGroup {
  agents: string[]; // lowercased
  rules: RobotsRule[];
}

export interface RobotsFile {
  groups: RobotsGroup[];
  sitemaps: string[];
}

export function parseRobots(text: string): RobotsFile {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;

  for (const raw of text.split(/\r\n|\r|\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (field === "allow" || field === "disallow") {
      lastWasAgent = false;
      if (!current) continue; // rules before any user-agent are ignored
      if (field === "disallow" && value === "") continue; // empty Disallow allows everything
      current.rules.push({ allow: field === "allow", pattern: value });
    } else if (field === "sitemap") {
      sitemaps.push(value);
    } else {
      lastWasAgent = false;
    }
  }
  return { groups, sitemaps };
}

function patternToRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp("^" + body + (anchored ? "$" : ""));
}

/** Rules that apply to `token`, or null when nothing in the file applies to it. */
export function rulesFor(robots: RobotsFile, token: string | null): RobotsRule[] | null {
  const t = token?.toLowerCase();
  const named = t ? robots.groups.filter((g) => g.agents.includes(t)) : [];
  const chosen = named.length > 0 ? named : robots.groups.filter((g) => g.agents.includes("*"));
  return chosen.length > 0 ? chosen.flatMap((g) => g.rules) : null;
}

export interface RobotsDecision {
  allowed: boolean;
  /** The rule that decided, or null when no rule matched (allowed by default). */
  rule: RobotsRule | null;
  /** "named" when a group names the bot, "wildcard" when only "*" applies, "none" otherwise. */
  matchedGroup: "named" | "wildcard" | "none";
}

export function checkRobots(robots: RobotsFile, token: string | null, path: string): RobotsDecision {
  const t = token?.toLowerCase();
  const matchedGroup = t && robots.groups.some((g) => g.agents.includes(t)) ? "named" : robots.groups.some((g) => g.agents.includes("*")) ? "wildcard" : "none";
  const rules = rulesFor(robots, token) ?? [];
  let best: RobotsRule | null = null;
  for (const r of rules) {
    if (!patternToRegex(r.pattern).test(path)) continue;
    if (!best || r.pattern.length > best.pattern.length || (r.pattern.length === best.pattern.length && r.allow && !best.allow)) best = r;
  }
  return { allowed: best ? best.allow : true, rule: best, matchedGroup };
}

/** The product token a bot looks for in robots.txt, or null when it doesn't read robots.txt by name. */
export function robotsTokenFor(bot: Pick<BotDef, "name" | "robotsToken">): string | null {
  if (bot.robotsToken) return bot.robotsToken;
  return /^[A-Za-z0-9_-]+$/.test(bot.name) ? bot.name : null;
}
