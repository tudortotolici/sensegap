# @sensegap/node

See which AI bots read your site, from your own Next.js or Node server.
Only bot requests and visits sent by AI products (ChatGPT, Perplexity, …) leave your server. Plain human traffic is filtered out before anything is sent.

Get a site key in SenseGap → **Install & settings** → Next.js / Node, then set it as `SENSEGAP_KEY`.

## Next.js (16+, `proxy.ts`)

```ts
// proxy.ts (next to app/)
import { withSenseGap } from "@sensegap/node/next";

export const proxy = withSenseGap();           // or withSenseGap(yourExistingProxy)
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
```

On Next.js 15 and earlier, name the file `middleware.ts` and `export const middleware = withSenseGap();`.

## Express / Connect

```ts
import express from "express";
import { senseGap } from "@sensegap/node";

const app = express();
app.use(senseGap());
```

## Anything else

```ts
import { createSenseGap } from "@sensegap/node";
const sg = createSenseGap();
sg.record({ method, url, headers, ip, status, ms });
```

## Import old access logs

```bash
SENSEGAP_KEY=sg_live_... npx sensegap-logs /var/log/nginx/access.log*
```

nginx and Apache combined format, `.gz` files included. The last 90 days are imported; days already imported are skipped.
