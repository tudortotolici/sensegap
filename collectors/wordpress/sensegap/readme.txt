=== SenseGap ===
Contributors: sensegap
Tags: ai, bots, crawlers, analytics, gptbot
Requires at least: 5.8
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 0.1.0
License: MIT
License URI: https://opensource.org/licenses/MIT

See which AI bots read your site: what they read, how often, and which ones are real.

== Description ==

SenseGap shows the AI crawlers and assistants that visit your site (GPTBot, ClaudeBot, PerplexityBot, Googlebot and about 50 more), the pages they read, the errors they hit, and the people AI products send you.

Only bot requests and visits that come from AI products are sent to SenseGap. Plain human traffic is filtered out on your server and never leaves it. IP addresses are used to check that a bot is real, then shortened before they are stored.

== Installation ==

1. Plugins → Add New → Upload Plugin, choose sensegap-wordpress.zip, then Install and Activate.
2. Settings → SenseGap: paste your site key from sensegap.com and click Save and check key.

== Frequently Asked Questions ==

= I use a page cache. =
Cached pages are served without running WordPress, so the plugin can't see bot visits to them. If your site is on Cloudflare, use the Cloudflare install instead: it sees every request.

= Does it slow my site down? =
No visible delay: the plugin looks at each request after the page is built and sends only bot visits, after the page has been handed to the visitor when your server allows it.

== Changelog ==

= 0.1.0 =
* First release.
