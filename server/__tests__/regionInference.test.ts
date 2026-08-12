/**
 * Unit tests for the deterministic region inference helper that places
 * hunting-cycle runs and downloaded texts on the world map.
 */
import { describe, it, expect } from "vitest";
import { inferRegion } from "@shared/regionInference";
import { HUNTER_REGIONS } from "@shared/hunterRegions";

describe("inferRegion", () => {
  it("matches each region from its own seed terms", () => {
    for (const region of HUNTER_REGIONS) {
      const inferred = inferRegion(region.terms);
      expect(inferred?.id, `terms for ${region.id}`).toBe(region.id);
    }
  });

  it("matches common free queries", () => {
    expect(inferRegion("Greek mythology Hesiod theogony")?.id).toBe("greece");
    expect(inferRegion("Norse mythology Edda saga")?.id).toBe("norse");
    expect(inferRegion("Epic of Gilgamesh translation")?.id).toBe("mesopotamia");
    expect(inferRegion("Popol Vuh sacred book")?.id).toBe("mesoamerica");
  });

  it("matches via alias vocabulary not present in the seed terms", () => {
    expect(inferRegion("The Iliad by Homer")?.id).toBe("greece");
    expect(inferRegion("Bhagavad Gita Sanskrit epic")?.id).toBe("india");
    expect(inferRegion("stories of Amaterasu")?.id).toBe("japan");
  });

  it("accepts an array of fragments and ignores null entries", () => {
    expect(inferRegion([null, undefined, "Kojiki", "Shinto tales"])?.id).toBe("japan");
  });

  it("returns null when nothing matches", () => {
    expect(inferRegion("completely unrelated grocery list")).toBeNull();
    expect(inferRegion("")).toBeNull();
    expect(inferRegion([null, undefined])).toBeNull();
    // Generic words alone must never produce a match.
    expect(inferRegion("ancient mythology epic oral tradition texts")).toBeNull();
  });

  it("returns null on a tie instead of guessing", () => {
    // One distinctive keyword from each of two regions -> ambiguous.
    expect(inferRegion("Greek and Norse comparative material")).toBeNull();
  });

  it("prefers the region with more distinctive evidence", () => {
    // 'Hindu' appears for both india and southeast-asia; extra Indian
    // keywords must break the tie toward india.
    expect(inferRegion("Hindu Vedic Ramayana")?.id).toBe("india");
  });
});
