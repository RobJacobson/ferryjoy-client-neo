/**
 * Unit tests for vessel-location updates queries.
 */

import { describe, expect, it } from "bun:test";
import { readAllVesselLocationUpdates } from "functions/vesselLocationsUpdates/queries";

describe("vesselLocationsUpdates getAllVesselUpdateTimeStampsInternal", () => {
  it("returns metadata-stripped update rows", async () => {
    const rows = await readAllVesselLocationUpdates({
      query: () => ({
        collect: async () => [
          {
            _id: "row-1",
            _creationTime: 1,
            VesselAbbrev: "CHE",
            TimeStamp: 100,
          },
        ],
      }),
    });

    expect(rows).toEqual([{ VesselAbbrev: "CHE", TimeStamp: 100 }]);
  });
});
