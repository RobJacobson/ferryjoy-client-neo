/**
 * Snapshot-backed {@link ScheduledSegmentLookup} parity with plain map callbacks.
 */

import { describe, expect, it } from "bun:test";
import type { ConvexScheduledDockEvent } from "domain/events/scheduled";
import { createScheduledSegmentLookupFromSnapshot } from "../createScheduledSegmentLookupFromSnapshot";
import { scheduleSnapshotCompositeKey } from "../scheduleSnapshotCompositeKey";
import type { ScheduleSnapshot } from "../scheduleSnapshotTypes";

describe("createScheduledSegmentLookupFromSnapshot", () => {
  it("matches direct map lookup semantics for departures and same-day bundles", () => {
    const dep: ConvexScheduledDockEvent = {
      Key: "k1",
      VesselAbbrev: "CHE",
      SailingDay: "2026-03-13",
      UpdatedAt: 1,
      ScheduledDeparture: 2,
      TerminalAbbrev: "CLI",
      NextTerminalAbbrev: "MUK",
      EventType: "dep-dock",
    };
    const sameDay: ConvexScheduledDockEvent[] = [dep];
    const snapshot: ScheduleSnapshot = {
      departuresBySegmentKey: { segA: dep },
      sameDayEventsByCompositeKey: {
        [scheduleSnapshotCompositeKey("CHE", "2026-03-13")]: sameDay,
      },
    };

    const fromSnapshot = createScheduledSegmentLookupFromSnapshot(snapshot);
    const fromMaps: ReturnType<
      typeof createScheduledSegmentLookupFromSnapshot
    > = {
      getScheduledDepartureEventBySegmentKey: (sk) =>
        snapshot.departuresBySegmentKey[sk] ?? null,
      getScheduledDockEventsForSailingDay: (args) =>
        snapshot.sameDayEventsByCompositeKey[
          scheduleSnapshotCompositeKey(args.vesselAbbrev, args.sailingDay)
        ] ?? [],
    };

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
        vesselAbbrev: "ZZZ",
        sailingDay: "2026-03-13",
      })
    ).toEqual([]);

    expect(fromSnapshot.getScheduledDepartureEventBySegmentKey("segA")).toEqual(
      fromMaps.getScheduledDepartureEventBySegmentKey("segA")
    );
    expect(
      fromSnapshot.getScheduledDockEventsForSailingDay({
        vesselAbbrev: "CHE",
        sailingDay: "2026-03-13",
      })
    ).toEqual(
      fromMaps.getScheduledDockEventsForSailingDay({
        vesselAbbrev: "CHE",
        sailingDay: "2026-03-13",
      })
    );
  });
});
