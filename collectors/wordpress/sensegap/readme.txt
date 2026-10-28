=== SenseGap ===
Contributors: sensegap
Tags: ai, bots, crawlers, analytics, gptbot
Requires at least: 5.8
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 0.2.0
License: MIT
License URI: https://opensource.org/licenses/MIT

See which AI bots read your site: what they read, how often, and which ones are real.

== Description ==

SenseGap shows the AI crawlers and assistants that visit your site (GPTBot, ClaudeBot, PerplexityBot, Googlebot and about 50 more), the pages they read, the errors they hit, and the people AI products send you.

The plugin connects your site to SenseGap (https://sensegap.com), a hosted service where the reports live. The plugin itself is free; SenseGap needs a paid plan, from $9 a month (https://sensegap.com/pricing).

Only bot requests and visits that come from AI products are sent to SenseGap. Plain human traffic is filtered out on your server and never leaves it. IP addresses are used to check that a bot is real, then shortened before they are stored.

== Installation ==

1. In WordPress, go to Plugins → Add New, search for SenseGap, then click Install Now and Activate.
2. Settings → SenseGap: click Connect to SenseGap, sign in and approve. The site key is set up for you.
3. Or paste a site key from sensegap.com and click Save and check key.

== External services ==

This plugin sends data to SenseGap (https://sensegap.com), the service that shows you which AI bots visit your site. Nothing is sent until you connect the plugin, either with Connect to SenseGap or by saving a site key.

* When you click Connect to SenseGap, your browser opens sensegap.com with your site's domain, the address of this settings page and your site's time zone. After you approve, the plugin sends a one-time code to sensegap.com and gets a site key back.
* When you save or connect a key, the plugin asks SenseGap which site the key belongs to.
* After that, for each request from a bot, or from someone who arrived from an AI product, it sends the address, time, response status, user agent, referrer and IP address. Plain human visits and logged-in users are never sent.

Terms of service: https://sensegap.com/terms
Privacy policy: https://sensegap.com/privacy

== Frequently Asked Questions ==

= Do I need a SenseGap account? =
Yes. The plugin collects bot visits and SenseGap turns them into reports. Click Connect to SenseGap on Settings → SenseGap to sign in or create an account.

= What is sent, and when? =
Nothing, until you connect. After that, only requests from bots and visits that come from AI products: the address, time, response status, user agent, referrer and IP address. Logged-in users and plain human visits are never sent. See External services below.

= I use a page cache. =
Cached pages are served without running WordPress, so the plugin can't see bot visits to them. If your site is on Cloudflare, use the Cloudflare install instead: it sees every request.

= Does it slow my site down? =
No visible delay: the plugin looks at each request after the page is built and sends only bot visits, after the page has been handed to the visitor when your server allows it.

== Screenshots ==

1. Settings → SenseGap: connect in one click, or paste a site key.
2. Your weekly SenseGap report: what AI bots and assistants did on your site, including bots that fake their identity.

== Changelog ==

= 0.2.0 =
* Connect to SenseGap: set up the site key in one click.

= 0.1.0 =
* First release.
