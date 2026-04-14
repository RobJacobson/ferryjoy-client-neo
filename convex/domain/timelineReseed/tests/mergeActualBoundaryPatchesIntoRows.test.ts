/**
 * Tests merging sparse actual-boundary patches into base `eventsActual` rows.
 */

import { describe, expect, it } from "bun:test";
import type {
  ConvexActualBoundaryEvent,
  ConvexActualBoundaryPatchPersistable,
  ConvexActualBoundaryPatchWithTripKey,
} from "../../../functions/eventsActual/schemas";
import { buildPhysicalActualEventKey } from "../../../shared/physicalTripIdentity";
import { mergeActualBoundaryPatchesIntoRows } from "../mergeActualBoundaryPatchesIntoRows";

const updatedAt = 1_700_000_000_000;

const tripKey = "TOK 2026-03-13 15:35:00Z";
const segment = "TOK--2026-03-13--08:35--P52-BBI";
const eventKeyDep = buildPhysicalActualEventKey(tripKey, "dep-dock");

describe("mergeActualBoundaryPatchesIntoRows", () => {
  it("creates a row when no base row exists for the patch EventKey", () => {
    const patch: ConvexActualBoundaryPatchPersistable = {
      TripKey: tripKey,
      SegmentKey: segment,
      VesselAbbrev: "TOK",
      SailingDay: "2026-03-13",
      ScheduledDeparture: 1000,
      TerminalAbbrev: "P52",
      EventType: "dep-dock",
      EventOccurred: true,
      EventActualTime: undefined,
    };

    const result = mergeActualBoundaryPatchesIntoRows([], [patch], updatedAt);

    expect(result).toEqual([
      {
        EventKey: eventKeyDep,
        TripKey: tripKey,
        EventType: "dep-dock",
        VesselAbbrev: "TOK",
        SailingDay: "2026-03-13",
        UpdatedAt: updatedAt,
        ScheduledDeparture: 1000,
        TerminalAbbrev: "P52",
        EventOccurred: true,
        EventActualTime: undefined,
      },
    ]);
  });

  it("preserves base EventActualTime when the patch omits a timestamp", () => {
    const base: ConvexActualBoundaryEvent[] = [
      {
        EventKey: eventKeyDep,
        TripKey: tripKey,
        ScheduleKey: segment,
        EventType: "dep-dock",
        VesselAbbrev: "TOK",
        SailingDay: "2026-03-13",
        UpdatedAt: updatedAt - 1,
        ScheduledDeparture: 1000,
        TerminalAbbrev: "P52",
        EventOccurred: true,
        EventActualTime: 2222,
      },
    ];
    const patch: ConvexActualBoundaryPatchPersistable = {
      TripKey: tripKey,
      SegmentKey: segment,
      VesselAbbrev: "TOK",
      SailingDay: "2026-03-13",
      ScheduledDeparture: 1000,
      TerminalAbbrev: "P52",
      EventType: "dep-dock",
      EventOccurred: true,
      EventActualTime: undefined,
    };

    const result = mergeActualBoundaryPatchesIntoRows(base, [patch], updatedAt);

    expect(result[0]?.EventActualTime).toBe(2222);
    expect(result[0]?.UpdatedAt).toBe(updatedAt);
  });

  it("keeps EventActualTime from the patch when present", () => {
    const base: ConvexActualBoundaryEvent[] = [
      {
        EventKey: eventKeyDep,
        TripKey: tripKey,
        ScheduleKey: segment,
        EventType: "dep-dock",
        VesselAbbrev: "TOK",
        SailingDay: "2026-03-13",
        UpdatedAt: updatedAt - 1,
        ScheduledDeparture: 1000,
        TerminalAbbrev: "P52",
        EventOccurred: true,
        EventActualTime: 2222,
      },
    ];
    const patch: ConvexActualBoundaryPatchPersistable = {
      TripKey: tripKey,
      SegmentKey: segment,
      VesselAbbrev: "TOK",
      SailingDay: "2026-03-13",
      ScheduledDeparture: 1000,
      TerminalAbbrev: "P52",
      EventType: "dep-dock",
      EventOccurred: true,
      EventActualTime: 9999,
    };

    const result = mergeActualBoundaryPatchesIntoRows(base, [patch], updatedAt);

    expect(result[0]?.EventActualTime).toBe(9999);
  });

  it("returns base rows unchanged when there are no patches", () => {
    const base: ConvexActualBoundaryEvent[] = [
      {
        EventKey: eventKeyDep,
        TripKey: tripKey,
        ScheduleKey: segment,
        EventType: "dep-dock",
        VesselAbbrev: "TOK",
        SailingDay: "2026-03-13",
        UpdatedAt: updatedAt,
        ScheduledDeparture: 1,
        TerminalAbbrev: "P52",
        EventOccurred: true,
        EventActualTime: 5,
      },
    ];

    const result = mergeActualBoundaryPatchesIntoRows(base, [], updatedAt);

    expect(result).toEqual(base);
  });

  it("dedupes by EventKey; later patches overwrite earlier ones for the same key", () => {
    const first: ConvexActualBoundaryPatchPersistable = {
      TripKey: tripKey,
      SegmentKey: segment,
      VesselAbbrev: "TOK",
      SailingDay: "2026-03-13",
      ScheduledDeparture: 1000,
      TerminalAbbrev: "P52",
      EventType: "dep-dock",
      EventOccurred: true,
      EventActualTime: 111,
    };
    const second: ConvexActualBoundaryPatchPersistable = {
      ...first,
      EventActualTime: 222,
    };

    const result = mergeActualBoundaryPatchesIntoRows(
      [],
      [first, second],
      updatedAt
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.EventActualTime).toBe(222);
  });

  it("skips a patch with no anchor when the base row cannot supply one", () => {
    const patch: ConvexActualBoundaryPatchWithTripKey = {
      TripKey: tripKey,
      SegmentKey: segment,
      VesselAbbrev: "TOK",
      TerminalAbbrev: "P52",
      EventType: "dep-dock",
      EventOccurred: true,
    };

    const result = mergeActualBoundaryPatchesIntoRows([], [patch], updatedAt);

    expect(result).toEqual([]);
  });
});
