import { describe, expect, it } from "vitest";
import { checkRobots, getBot, parseRobots, robotsTokenFor } from "@sensegap/bots";

const file = parseRobots(`
# comment
User-agent: *
Disallow: /admin/
Allow: /admin/public
Disallow: /*.pdf$
Disallow:

User-agent: GPTBot
User-agent: CCBot
Disallow: /

User-agent: Googlebot
Allow: /
Disallow: /search

Sitemap: https://example.com/sitemap.xml
`);

describe("robots.txt", () => {
  it("parses groups that share several user-agent lines", () => {
    expect(file.groups).toHaveLength(3);
    expect(file.groups[1]!.agents).toEqual(["gptbot", "ccbot"]);
    expect(file.sitemaps).toEqual(["https://example.com/sitemap.xml"]);
  });
  it("applies the named group, not the wildcard one", () => {
    expect(checkRobots(file, "GPTBot", "/anything")).toMatchObject({ allowed: false, matchedGroup: "named" });
    expect(checkRobots(file, "ccbot", "/")).toMatchObject({ allowed: false });
    expect(checkRobots(file, "Googlebot", "/admin/x").allowed).toBe(true);
    expect(checkRobots(file, "Googlebot", "/search?q=1").allowed).toBe(false);
  });
  it("falls back to * and uses the longest match, Allow winning ties", () => {
    expect(checkRobots(file, "ClaudeBot", "/admin/secret")).toMatchObject({ allowed: false, matchedGroup: "wildcard" });
    expect(checkRobots(file, "ClaudeBot", "/admin/public/page").allowed).toBe(true);
    expect(checkRobots(file, "ClaudeBot", "/blog").allowed).toBe(true);
    const tie = parseRobots("User-agent: *\nDisallow: /a\nAllow: /a");
    expect(checkRobots(tie, "x", "/a").allowed).toBe(true);
  });
  it("supports * and $", () => {
    expect(checkRobots(file, "ClaudeBot", "/files/report.pdf").allowed).toBe(false);
    expect(checkRobots(file, "ClaudeBot", "/files/report.pdf?x=1").allowed).toBe(true);
  });
  it("allows everything when nothing applies", () => {
    expect(checkRobots(parseRobots(""), "GPTBot", "/x")).toMatchObject({ allowed: true, matchedGroup: "none" });
    expect(checkRobots(parseRobots("User-agent: Bingbot\nDisallow: /"), "GPTBot", "/x").allowed).toBe(true);
  });
  it("knows which token each bot reads", () => {
    expect(robotsTokenFor(getBot("gptbot")!)).toBe("GPTBot");
    expect(robotsTokenFor(getBot("chatgpt-agent")!)).toBeNull();
  });
});
