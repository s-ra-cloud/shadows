import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the heavy module graph that hunterRoutes drags in; we only need safeLookup.
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(),
}));
vi.mock("../db", () => ({ db: {} }));
vi.mock("../storage", () => ({ storage: {} }));

import { lookup as dnsLookup } from "node:dns/promises";
import { safeLookup } from "../hunterRoutes";

const mockedLookup = vi.mocked(dnsLookup);

function callSafeLookup(hostname: string, opts: unknown) {
  return new Promise<{ err: Error | null; address: unknown; family?: number }>((resolve) => {
    safeLookup(hostname, opts, (err, address, family) => resolve({ err, address, family }));
  });
}

describe("safeLookup (check-url DNS validation)", () => {
  beforeEach(() => {
    mockedLookup.mockReset();
  });

  it("returns a single address string when options.all is not set", async () => {
    mockedLookup.mockResolvedValue([{ address: "207.241.224.2", family: 4 }] as any);
    const { err, address, family } = await callSafeLookup("archive.org", {});
    expect(err).toBeNull();
    expect(address).toBe("207.241.224.2");
    expect(family).toBe(4);
  });

  it("returns an ARRAY of { address, family } when options.all is true (regression: 'Invalid IP address: undefined')", async () => {
    mockedLookup.mockResolvedValue([
      { address: "207.241.224.2", family: 4 },
      { address: "2620:0:9c0::2", family: 6 },
    ] as any);
    const { err, address } = await callSafeLookup("archive.org", { all: true });
    expect(err).toBeNull();
    expect(Array.isArray(address)).toBe(true);
    const arr = address as { address: string; family: number }[];
    expect(arr).toEqual([
      { address: "207.241.224.2", family: 4 },
      { address: "2620:0:9c0::2", family: 6 },
    ]);
  });

  it("rejects hosts that resolve to a private address in both callback shapes", async () => {
    mockedLookup.mockResolvedValue([{ address: "10.0.0.5", family: 4 }] as any);
    for (const opts of [{}, { all: true }]) {
      const { err } = await callSafeLookup("evil.example", opts);
      expect(err?.message).toMatch(/private or internal address/);
    }
  });

  it("handles IP literals without DNS, honouring the all option", async () => {
    const single = await callSafeLookup("207.241.224.2", {});
    expect(single.err).toBeNull();
    expect(single.address).toBe("207.241.224.2");

    const all = await callSafeLookup("207.241.224.2", { all: true });
    expect(all.err).toBeNull();
    expect(all.address).toEqual([{ address: "207.241.224.2", family: 4 }]);
    expect(mockedLookup).not.toHaveBeenCalled();
  });

  it("errors when DNS returns no addresses", async () => {
    mockedLookup.mockResolvedValue([] as any);
    const { err } = await callSafeLookup("nowhere.example", {});
    expect(err?.message).toMatch(/No addresses found/);
  });
});
