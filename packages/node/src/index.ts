import type { IncomingMessage, ServerResponse } from "node:http";
import { createSenseGap, type SenseGap, type SenseGapOptions } from "./core";

export { createSenseGap, toEvent, clientIp, type SenseGap, type SenseGapOptions, type RequestInfo, type HeaderBag } from "./core";

/** Loopback and private ranges: the request came through a proxy on the same network. */
const PRIVATE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|f[cd][0-9a-f]{2}:|::ffff:(127|10|192\.168)\.)/i;

type Req = IncomingMessage & { originalUrl?: string; protocol?: string; ip?: string };

function absoluteUrl(req: Req): string {
  const proto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim() || req.protocol || ((req.socket as { encrypted?: boolean }).encrypted ? "https" : "http");
  const host = (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0]?.trim() || req.headers.host || "localhost";
  return `${proto}://${host}${req.originalUrl ?? req.url ?? "/"}`;
}

/**
 * Express / Connect middleware. Also works as a plain Node `request` listener step.
 *
 *   import { senseGap } from "@sensegap/node";
 *   app.use(senseGap());            // reads SENSEGAP_KEY
 */
export function senseGap(options: SenseGapOptions = {}, collector: SenseGap = createSenseGap(options)) {
  return function senseGapMiddleware(req: Req, res: ServerResponse, next?: (err?: unknown) => void) {
    const start = Date.now();
    res.once("finish", () => {
      // Express sets req.ip from its own "trust proxy" setting; without it, behind nginx that's 127.0.0.1.
      // A private address means a proxy is in front, so the proxy headers are read instead.
      // A bot can't fake a Googlebot IP with its own X-Forwarded-For: headers count only behind a private proxy.
      const socket = req.socket.remoteAddress ?? "";
      const ip = req.ip && !PRIVATE.test(req.ip) ? req.ip : PRIVATE.test(socket) ? null : socket || null;
      collector.record({
        ts: start,
        method: req.method ?? "GET",
        url: absoluteUrl(req),
        headers: req.headers,
        ip,
        status: res.statusCode,
        ms: Date.now() - start,
        bytes: Number(res.getHeader("content-length")) || null,
      });
    });
    next?.();
  };
}
