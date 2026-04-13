import { describe, expect, it } from "bun:test";
import {
  buildPhysicalActualEventKey,
  generateTripKey,
} from "../physicalTripIdentity";

describe("generateTripKey", () => {
  it("formats a vessel tick timestamp with a space separator and trailing Z", () => {
    expect(generateTripKey("CAT", Date.parse("2026-04-12T18:21:55.000Z"))).toBe(
      "CAT 2026-04-12 18:21:55Z"
    );
  });

  it("truncates sub-second input to the containing whole second", () => {
    expect(generateTripKey("ISS", Date.parse("2026-04-12T18:21:55.499Z"))).toBe(
      "ISS 2026-04-12 18:21:55Z"
    );
    expect(generateTripKey("ISS", Date.parse("2026-04-12T18:21:55.500Z"))).toBe(
      "ISS 2026-04-12 18:21:55Z"
    );
  });
});

describe("buildPhysicalActualEventKey", () => {
  it("builds a deterministic physical actual-event key from the trip key", () => {
    expect(
      buildPhysicalActualEventKey("CAT 2026-04-12 18:21:55Z", "dep-dock")
    ).toBe("CAT 2026-04-12 18:21:55Z--dep-dock");
  });
});
