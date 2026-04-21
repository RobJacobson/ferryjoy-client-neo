/**
 * Snapshot-backed {@link ScheduledSegmentTables} shape and sailing-day narrowing.
 */

import { describe, expect, it } from "bun:test";
import type { ConvexScheduledDockEvent } from "domain/events/scheduled";
import { getScheduledDockEventsForVesselAndSailingDay } from "../../scheduleContinuity/getScheduledDockEventsForVesselAndSailingDay";
import { createScheduledSegmentTablesFromSnapshot } from "../createScheduledSegmentTablesFromSnapshot";
import type { ScheduleSnapshot } from "../scheduleSnapshotTypes";

describe("createScheduledSegmentTablesFromSnapshot", () => {
  it("narrows a multi-day snapshot to one sailing day for departures and same-vessel reads", () => {
    const dep: ConvexScheduledDockEvent = {
      Key: "segA--dep-dock",
      VesselAbbrev: "CHE",
      SailingDay: "2026-03-13",
      UpdatedAt: 1,
      ScheduledDeparture: 2,
      TerminalAbbrev: "CLI",
      NextTerminalAbbrev: "MUK",
      EventType: "dep-dock",
    };
    const arv: ConvexScheduledDockEvent = {
      ...dep,
      Key: "segA--arv-dock",
      EventType: "arv-dock",
    };
    const nextDay: ConvexScheduledDockEvent = {
      ...dep,
      Key: "segB--dep-dock",
      SailingDay: "2026-03-14",
    };
    const march13: ConvexScheduledDockEvent[] = [dep, arv];
    const snapshot: ScheduleSnapshot = {
      scheduledDockEventsByVesselAbbrev: {
        CHE: [...march13, nextDay],
      },
    };

    const mar13 = createScheduledSegmentTablesFromSnapshot(
      snapshot,
      "2026-03-13"
    );

    expect(mar13.scheduledDepartureBySegmentKey.segA).toEqual(dep);
    expect(mar13.scheduledDepartureBySegmentKey.segB).toBeUndefined();
    expect(mar13.scheduledDepartureBySegmentKey.missing).toBeUndefined();
    expect(mar13.scheduledDockEventsByVesselAbbrev.CHE).toEqual(march13);
    expect(mar13.sailingDay).toBe("2026-03-13");
    expect(
      getScheduledDockEventsForVesselAndSailingDay(mar13, "CHE", "2026-03-14")
    ).toEqual([]);
    expect(
      getScheduledDockEventsForVesselAndSailingDay(mar13, "ZZZ", "2026-03-13")
    ).toEqual([]);

    const mar14 = createScheduledSegmentTablesFromSnapshot(
      snapshot,
      "2026-03-14"
    );

    expect(mar14.scheduledDepartureBySegmentKey.segB).toEqual(nextDay);
    expect(mar14.scheduledDockEventsByVesselAbbrev.CHE).toEqual([nextDay]);
  });
});
