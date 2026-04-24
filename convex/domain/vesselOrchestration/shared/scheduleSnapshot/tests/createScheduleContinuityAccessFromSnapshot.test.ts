/**
 * Snapshot-backed schedule continuity access and sailing-day narrowing.
 */

import { describe, expect, it } from "bun:test";
import type { ConvexInferredScheduledSegment } from "domain/events/scheduled";
import { getScheduledDeparturesForVesselAndSailingDay } from "../../scheduleContinuity/getScheduledDeparturesForVesselAndSailingDay";
import { createScheduleContinuityAccessFromSnapshot } from "../createScheduleContinuityAccessFromSnapshot";
import type { ScheduleSnapshot } from "../scheduleSnapshotTypes";

describe("createScheduleContinuityAccessFromSnapshot", () => {
  it("returns only the materialized sailing day for departures and segment lookups", async () => {
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

    const mar13 = createScheduleContinuityAccessFromSnapshot(
      snapshot,
      "2026-03-13"
    );

    expect(await mar13.getScheduledSegmentByKey("segA")).toEqual(segmentA);
    expect(await mar13.getScheduledSegmentByKey("segB")).toBeNull();
    expect(await mar13.getScheduledSegmentByKey("missing")).toBeNull();
    expect(
      await mar13.getScheduledDeparturesForVesselAndSailingDay(
        "CHE",
        "2026-03-13"
      )
    ).toEqual(snapshot.scheduledDeparturesByVesselAbbrev.CHE);
    expect(
      await getScheduledDeparturesForVesselAndSailingDay(
        mar13,
        "CHE",
        "2026-03-14"
      )
    ).toEqual([]);
    expect(
      await getScheduledDeparturesForVesselAndSailingDay(
        mar13,
        "ZZZ",
        "2026-03-13"
      )
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
    const mar14 = createScheduleContinuityAccessFromSnapshot(
      mar14Snapshot,
      "2026-03-14"
    );

    expect(await mar14.getScheduledSegmentByKey("segB")).toEqual(
      nextDaySegment
    );
    expect(
      await mar14.getScheduledDeparturesForVesselAndSailingDay(
        "CHE",
        "2026-03-14"
      )
    ).toEqual(mar14Snapshot.scheduledDeparturesByVesselAbbrev.CHE);
  });
});
