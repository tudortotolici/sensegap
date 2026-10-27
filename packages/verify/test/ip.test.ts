import { describe, expect, it } from "vitest";
import { anonymizeIp, cidrContains, formatIp, parseCidr, parseIp, ptrName } from "../src/ip.ts";

describe("parseIp", () => {
  it("parses IPv4", () => {
    expect(parseIp("66.249.66.1")).toEqual({ version: 4, value: 0x42f94201n });
  });
  it("rejects bad input", () => {
    for (const bad of ["", "1.2.3", "256.1.1.1", "1.2.3.4.5", "abc", "1::2::3", "12345::1", "1:2:3:4:5:6:7:8:9"]) {
      expect(parseIp(bad), bad).toBeNull();
    }
  });
  it("parses IPv6 forms", () => {
    expect(formatIp(parseIp("2001:4860:4801:10::1")!)).toBe("2001:4860:4801:10::1");
    expect(formatIp(parseIp("::1")!)).toBe("::1");
    expect(formatIp(parseIp("2001:db8:0:0:1:0:0:1")!)).toBe("2001:db8::1:0:0:1");
    expect(parseIp("::")?.value).toBe(0n);
  });
  it("treats IPv4-mapped IPv6 as IPv4", () => {
    expect(parseIp("::ffff:66.249.66.1")).toEqual(parseIp("66.249.66.1"));
  });
});

describe("cidr", () => {
  it("matches IPv4 ranges", () => {
    const c = parseCidr("66.249.64.0/19")!;
    expect(cidrContains(c, parseIp("66.249.66.1")!)).toBe(true);
    expect(cidrContains(c, parseIp("66.249.96.1")!)).toBe(false);
  });
  it("matches IPv6 ranges", () => {
    const c = parseCidr("2001:4860:4801:10::/64")!;
    expect(cidrContains(c, parseIp("2001:4860:4801:10::abcd")!)).toBe(true);
    expect(cidrContains(c, parseIp("2001:4860:4801:11::1")!)).toBe(false);
  });
  it("never matches across IP versions", () => {
    expect(cidrContains(parseCidr("0.0.0.0/0")!, parseIp("::1")!)).toBe(false);
  });
});

describe("anonymizeIp", () => {
  it("keeps /24 for IPv4 and /48 for IPv6", () => {
    expect(anonymizeIp("203.0.113.77")).toBe("203.0.113.0");
    expect(anonymizeIp("2001:db8:abcd:12:1::5")).toBe("2001:db8:abcd::");
  });
});

describe("ptrName", () => {
  it("builds reverse names", () => {
    expect(ptrName(parseIp("66.249.66.1")!)).toBe("1.66.249.66.in-addr.arpa");
    expect(ptrName(parseIp("2001:db8::1")!)).toBe(
      "1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa",
    );
  });
});
