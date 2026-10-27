import { resolveOptions, sendBatch, toEvent, type SenseGapOptions } from "./core";

// Minimal shapes of NextRequest / NextFetchEvent, so this file doesn't import Next.js.
interface ProxyRequest { method: string; url: string; headers: Headers }
interface ProxyEvent { waitUntil(p: Promise<unknown>): void }
type ProxyResult = Response | null | undefined | void;
type Proxy<R extends ProxyRequest, E extends ProxyEvent> = (req: R, event: E) => ProxyResult | Promise<ProxyResult>;

/**
 * Wraps (or is) your Next.js proxy. Sends after the response, through `event.waitUntil`,
 * so it works on Vercel, Node servers and Cloudflare alike.
 *
 *   // proxy.ts
 *   import { withSenseGap } from "@sensegap/node/next";
 *   export const proxy = withSenseGap();            // or withSenseGap(yourProxy)
 *   export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
 */
export function withSenseGap<R extends ProxyRequest, E extends ProxyEvent>(handler?: Proxy<R, E>, options: SenseGapOptions = {}) {
  const o = resolveOptions(options);
  let warned = false;
  return async function proxy(req: R, event: E): Promise<ProxyResult> {
    const start = Date.now();
    const res = handler ? await handler(req, event) : undefined;
    try {
      if (!o.key) {
        if (!warned && o.logErrors) console.warn("SenseGap: no site key (SENSEGAP_KEY), nothing is sent.");
        warned = true;
      } else {
        // The page itself is rendered after the proxy, so its status is only known when the proxy answers.
        const e = toEvent({ ts: start, method: req.method, url: req.url, headers: req.headers, status: res ? res.status : null });
        if (e) {
          event.waitUntil(
            sendBatch(o, "node", [e]).catch((err) => {
              if (o.logErrors) console.error(String(err));
            }),
          );
        }
      }
    } catch {
      /* never break the site over analytics */
    }
    return res;
  };
}

export type { SenseGapOptions };
