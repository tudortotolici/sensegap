# Contributing

New AI crawlers appear every month, and the people reading their own logs spot them first. Reports and pull requests are welcome.

## Report a missing bot

[Open a "Missing bot" issue](../../issues/new?template=missing-bot.yml) with:

- The full user-agent string, copied from your logs.
- The company that runs it, and what it does if you know.
- A link to the operator's documentation, published IP ranges or reverse DNS domain.

We add a bot only when the operator is known. If there's no official way to verify it, the entry ships without verification rules, and its visits show as unverified, never as fake.

## Add a bot yourself

1. Add an entry to [`packages/bots/src/bots.ts`](packages/bots/src/bots.ts). The list is in match order: put more specific patterns first, so `ChatGPT-User` is never mistaken for `GPTBot`.
2. If the operator publishes IP ranges, add the list to [`packages/bots/src/ip-lists.ts`](packages/bots/src/ip-lists.ts) and reference it in `verify.ipLists`. If it publishes a reverse DNS domain, use `verify.rdnsSuffixes`.
3. Add a test in [`packages/verify/test`](packages/verify/test) with a real user-agent string.
4. Run `pnpm test`, `pnpm typecheck` and `pnpm check:live`.
5. Run `pnpm build` so the WordPress plugin's patterns are regenerated, and commit `collectors/wordpress/sensegap/includes/patterns.php`.

## Report a wrong verdict

Open an issue with the time of the visit, the user agent and the evidence the dashboard showed. Leave out the full IP address if you'd rather not share it: the first three parts are usually enough.

## Security

Please don't open a public issue for a security problem. See [SECURITY.md](SECURITY.md).

## Where changes land

This repository is published from SenseGap's main codebase. We merge pull requests by applying them there, then the next sync brings them back here with your authorship kept in the commit.
