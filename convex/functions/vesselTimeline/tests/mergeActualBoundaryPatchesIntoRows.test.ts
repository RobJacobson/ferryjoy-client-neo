/**
 * Tests merging sparse actual-boundary patches into base `eventsActual` rows.
 */

import { describe, expect, it } from "bun:test";
import { buildBoundaryKey } from "../../../shared/keys";
import type {
  ConvexActualBoundaryEvent,
  ConvexActualBoundaryPatch,
} from "../../eventsActual/schemas";
import { mergeActualBoundaryPatchesIntoRows } from "../mergeActualBoundaryPatchesIntoRows";

const updatedAt = 1_700_000_000_000;

describe("mergeActualBoundaryPatchesIntoRows", () => {
  it("creates a row when no base row exists for the patch key", () => {
    const patch: ConvexActualBoundaryPatch = {
      SegmentKey: "TOK--2026-03-13--08:35--P52-BBI",
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
        Key: buildBoundaryKey(patch.SegmentKey, patch.EventType),
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
    const key = buildBoundaryKey("TOK--2026-03-13--08:35--P52-BBI", "dep-dock");
    const base: ConvexActualBoundaryEvent[] = [
      {
        Key: key,
        VesselAbbrev: "TOK",
        SailingDay: "2026-03-13",
        UpdatedAt: updatedAt - 1,
        ScheduledDeparture: 1000,
        TerminalAbbrev: "P52",
        EventOccurred: true,
        EventActualTime: 2222,
      },
    ];
    const patch: ConvexActualBoundaryPatch = {
      SegmentKey: "TOK--2026-03-13--08:35--P52-BBI",
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
    const key = buildBoundaryKey("TOK--2026-03-13--08:35--P52-BBI", "dep-dock");
    const base: ConvexActualBoundaryEvent[] = [
      {
        Key: key,
        VesselAbbrev: "TOK",
        SailingDay: "2026-03-13",
        UpdatedAt: updatedAt - 1,
        ScheduledDeparture: 1000,
        TerminalAbbrev: "P52",
        EventOccurred: true,
        EventActualTime: 2222,
      },
    ];
    const patch: ConvexActualBoundaryPatch = {
      SegmentKey: "TOK--2026-03-13--08:35--P52-BBI",
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
        Key: "a",
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

  it("dedupes by Key; later patches overwrite earlier ones for the same key", () => {
    const segmentKey = "TOK--2026-03-13--08:35--P52-BBI";
    const first: ConvexActualBoundaryPatch = {
      SegmentKey: segmentKey,
      VesselAbbrev: "TOK",
      SailingDay: "2026-03-13",
      ScheduledDeparture: 1000,
      TerminalAbbrev: "P52",
      EventType: "dep-dock",
      EventOccurred: true,
      EventActualTime: 111,
    };
    const second: ConvexActualBoundaryPatch = {
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
});
