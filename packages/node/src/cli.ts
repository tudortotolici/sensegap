#!/usr/bin/env node
/**
 * Imports nginx / Apache access logs into SenseGap (last 90 days).
 *   SENSEGAP_KEY=sg_live_... npx sensegap-logs /var/log/nginx/access.log*
 */
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import { randomBytes } from "node:crypto";
import { MAX_EVENTS_PER_BATCH, parseLogLine, shouldSend, type IngestEvent } from "@sensegap/protocol";
import { checkKey, resolveOptions, sendBatch } from "./core";

const args = process.argv.slice(2);
const keyArg = args.findIndex((a) => a === "--key");
const key = keyArg >= 0 ? args.splice(keyArg, 2)[1] : undefined;
const files = args.filter((a) => !a.startsWith("-"));

if (!files.length || args.includes("--help")) {
  console.log("Usage: SENSEGAP_KEY=sg_live_... sensegap-logs <access.log> [more files, .gz is fine]");
  process.exit(files.length ? 0 : 1);
}

const o = resolveOptions({ key });
const domain = await checkKey(o, "logs").catch((e: Error) => {
  console.error(e.message);
  process.exit(1);
});
const upload = "up_" + randomBytes(9).toString("hex");
const cutoff = Date.now() - 90 * 86_400_000;
let lines = 0, unreadable = 0, sent = 0, accepted = 0, duplicate = 0;
let batch: IngestEvent[] = [];

const flush = async () => {
  if (!batch.length) return;
  const r = await sendBatch(o, "logs", batch, upload);
  sent += batch.length;
  accepted += r.accepted;
  duplicate += r.duplicate ?? 0;
  batch = [];
  process.stdout.write(`\r${lines.toLocaleString()} lines read, ${sent.toLocaleString()} bot or AI visits sent`);
};

console.log(`Importing into ${domain}`);
for (const file of files) {
  const raw = createReadStream(file);
  const input = file.endsWith(".gz") ? raw.pipe(createGunzip()) : raw;
  for await (const line of createInterface({ input, crlfDelay: Infinity })) {
    if (!line) continue;
    lines++;
    const e = parseLogLine(line, domain);
    if (!e) { unreadable++; continue; }
    if (e.ts < cutoff || !shouldSend(e)) continue;
    batch.push(e);
    if (batch.length >= MAX_EVENTS_PER_BATCH) await flush();
  }
}
await flush();
console.log(`\nDone. ${accepted.toLocaleString()} visits added${duplicate ? `, ${duplicate.toLocaleString()} already counted` : ""}${unreadable ? `, ${unreadable.toLocaleString()} lines not in combined format` : ""}.`);
