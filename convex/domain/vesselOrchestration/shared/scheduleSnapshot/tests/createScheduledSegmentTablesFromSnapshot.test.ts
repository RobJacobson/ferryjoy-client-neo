/**
 * Snapshot-backed {@link ScheduledSegmentTables} shape and sailing-day narrowing.
 */

import { describe, expect, it } from "bun:test";
import type { ConvexInferredScheduledSegment } from "domain/events/scheduled";
import { getScheduledDeparturesForVesselAndSailingDay } from "../../scheduleContinuity/getScheduledDeparturesForVesselAndSailingDay";
import { createScheduledSegmentTablesFromSnapshot } from "../createScheduledSegmentTablesFromSnapshot";
import type { ScheduleSnapshot } from "../scheduleSnapshotTypes";

describe("createScheduledSegmentTablesFromSnapshot", () => {
  it("returns only the materialized sailing day for departures and segment lookups", () => {
    const segmentA: ConvexInferredScheduledSegment = {
      Key: "segA",
      SailingDay: "2026-03-13",
      DepartingTerminalAbbrev: "CLI",
      ArrivingTerminalAbbrev: "MUK",
      DepartingTime: 2,
      NextKey: "segB",
      NextDepartingTime: 4,
    };
    const nextDaySegment: ConvexInferredScheduledSegment = {
      Key: "segB",
      SailingDay: "2026-03-14",
      DepartingTerminalAbbrev: "MUK",
      ArrivingTerminalAbbrev: "CLI",
      DepartingTime: 10,
    };
    const snapshot: ScheduleSnapshot = {
      SailingDay: "2026-03-13",
      scheduledDepartureBySegmentKey: {
        segA: segmentA,
      },
      scheduledDeparturesByVesselAbbrev: {
        CHE: [
          {
            Key: "segA--dep-dock",
            ScheduledDeparture: 2,
            TerminalAbbrev: "CLI",
          },
        ],
      },
    };

    const mar13 = createScheduledSegmentTablesFromSnapshot(
      snapshot,
      "2026-03-13"
    );

    expect(mar13.scheduledDepartureBySegmentKey.segA).toEqual(segmentA);
    expect(mar13.scheduledDepartureBySegmentKey.segB).toBeUndefined();
    expect(mar13.scheduledDepartureBySegmentKey.missing).toBeUndefined();
    expect(mar13.scheduledDeparturesByVesselAbbrev.CHE).toEqual(
      snapshot.scheduledDeparturesByVesselAbbrev.CHE
    );
    expect(mar13.sailingDay).toBe("2026-03-13");
    expect(
      getScheduledDeparturesForVesselAndSailingDay(mar13, "CHE", "2026-03-14")
    ).toEqual([]);
    expect(
      getScheduledDeparturesForVesselAndSailingDay(mar13, "ZZZ", "2026-03-13")
    ).toEqual([]);

    const mar14Snapshot: ScheduleSnapshot = {
      SailingDay: "2026-03-14",
      scheduledDepartureBySegmentKey: {
        segB: nextDaySegment,
      },
      scheduledDeparturesByVesselAbbrev: {
        CHE: [
          {
            Key: "segB--dep-dock",
            ScheduledDeparture: 10,
            TerminalAbbrev: "MUK",
          },
        ],
      },
    };
    const mar14 = createScheduledSegmentTablesFromSnapshot(
      mar14Snapshot,
      "2026-03-14"
    );

    expect(mar14.scheduledDepartureBySegmentKey.segB).toEqual(nextDaySegment);
    expect(mar14.scheduledDeparturesByVesselAbbrev.CHE).toEqual(
      mar14Snapshot.scheduledDeparturesByVesselAbbrev.CHE
    );
  });
});
