/**
 * Snapshot-backed {@link ScheduledSegmentLookup} parity with plain map callbacks.
 */

import { describe, expect, it } from "bun:test";
import type { ConvexScheduledDockEvent } from "domain/events/scheduled";
import { createScheduledSegmentLookupFromSnapshot } from "../createScheduledSegmentLookupFromSnapshot";
import type { ScheduleSnapshot } from "../scheduleSnapshotTypes";

describe("createScheduledSegmentLookupFromSnapshot", () => {
  it("derives departure and same-day lookups from vessel-grouped snapshot rows", () => {
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
    const sameDay: ConvexScheduledDockEvent[] = [dep, arv];
    const snapshot: ScheduleSnapshot = {
      eventsByVesselAbbrev: {
        CHE: [...sameDay, nextDay],
      },
    };

    const fromSnapshot = createScheduledSegmentLookupFromSnapshot(snapshot);

    expect(fromSnapshot.getScheduledDepartureEventBySegmentKey("segA")).toEqual(
      dep
    );
    expect(
      fromSnapshot.getScheduledDepartureEventBySegmentKey("missing")
    ).toBeNull();
    expect(
      fromSnapshot.getScheduledDockEventsForSailingDay({
        vesselAbbrev: "CHE",
        sailingDay: "2026-03-13",
      })
    ).toEqual(sameDay);
    expect(
      fromSnapshot.getScheduledDockEventsForSailingDay({
        vesselAbbrev: "CHE",
        sailingDay: "2026-03-14",
      })
    ).toEqual([nextDay]);
    expect(
      fromSnapshot.getScheduledDockEventsForSailingDay({
        vesselAbbrev: "ZZZ",
        sailingDay: "2026-03-13",
      })
    ).toEqual([]);
  });
});
