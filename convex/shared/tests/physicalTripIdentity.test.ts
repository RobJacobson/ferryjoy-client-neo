import { describe, expect, it } from "bun:test";
import { buildPhysicalActualEventKey } from "../physicalTripIdentity";

describe("buildPhysicalActualEventKey", () => {
  it("builds a deterministic physical actual-event key from the trip key", () => {
    expect(
      buildPhysicalActualEventKey("CAT--2026-04-12--05:30--SOU-VAI", "dep-dock")
    ).toBe("CAT--2026-04-12--05:30--SOU-VAI--dep-dock");
  });
});
