/**
 * DNS over HTTPS, so verification also works inside Cloudflare Workers,
 * which cannot open raw DNS sockets.
 */
export interface DnsResolver {
  ptr(name: string): Promise<string[]>;
  addresses(host: string): Promise<string[]>;
}

type DohAnswer = { type: number; data: string };

export class DohResolver implements DnsResolver {
  private readonly endpoint: string;
  private readonly fetchFn: typeof fetch;

  constructor(endpoint = "https://cloudflare-dns.com/dns-query", fetchFn?: typeof fetch) {
    this.endpoint = endpoint;
    // Never store the global fetch as a method: Workers throw "Illegal invocation" when it is called with another `this`.
    this.fetchFn = fetchFn ?? ((input, init) => fetch(input, init));
  }

  private async query(name: string, type: "PTR" | "A" | "AAAA"): Promise<DohAnswer[]> {
    const url = `${this.endpoint}?name=${encodeURIComponent(name)}&type=${type}`;
    const res = await this.fetchFn(url, { headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`DoH HTTP ${res.status}`);
    const body = (await res.json()) as { Answer?: DohAnswer[] };
    return body.Answer ?? [];
  }

  async ptr(name: string): Promise<string[]> {
    const answers = await this.query(name, "PTR");
    return answers.filter((a) => a.type === 12).map((a) => a.data.replace(/\.$/, "").toLowerCase());
  }

  async addresses(host: string): Promise<string[]> {
    const [a, aaaa] = await Promise.all([this.query(host, "A"), this.query(host, "AAAA")]);
    return [...a.filter((x) => x.type === 1), ...aaaa.filter((x) => x.type === 28)].map((x) => x.data);
  }
}

/** Remembers answers (and in-flight lookups) so each IP is resolved once. */
export class CachingResolver implements DnsResolver {
  private readonly inner: DnsResolver;
  private readonly ptrCache = new Map<string, Promise<string[]>>();
  private readonly addrCache = new Map<string, Promise<string[]>>();

  constructor(inner: DnsResolver) {
    this.inner = inner;
  }

  ptr(name: string): Promise<string[]> {
    let p = this.ptrCache.get(name);
    if (!p) this.ptrCache.set(name, (p = this.inner.ptr(name)));
    return p;
  }

  addresses(host: string): Promise<string[]> {
    let p = this.addrCache.get(host);
    if (!p) this.addrCache.set(host, (p = this.inner.addresses(host)));
    return p;
  }
}
