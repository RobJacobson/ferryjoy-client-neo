/**
 * Covers normalized boundary-event derivation helpers.
 */

import { describe, expect, it } from "bun:test";
import {
  buildActualDockEventFromWrite,
  buildActualDockEvents,
  type TripContextForActualRow,
} from "domain/events/actual";
import { buildScheduledDockEvents } from "domain/events/scheduled";
import type { DockBoundaryEventRecord } from "domain/events/scheduled/types";
import { buildPhysicalActualEventKey } from "shared/physicalTripIdentity";

const at = (hours: number, minutes: number) =>
  Date.UTC(2026, 2, 25, hours, minutes);

describe("buildScheduledDockEvents", () => {
  it("marks only the final arrival of the sailing day", () => {
    const rows = buildScheduledDockEvents(
      [
        makeBoundaryEventRecord({
          SegmentKey: "trip-1",
          Key: "trip-1--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "BBI",
          EventScheduledTime: at(12, 20),
        }),
        makeBoundaryEventRecord({
          SegmentKey: "trip-1",
          Key: "trip-1--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "P52",
          EventScheduledTime: at(12, 55),
        }),
        makeBoundaryEventRecord({
          SegmentKey: "trip-2",
          Key: "trip-2--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(13, 30),
          EventScheduledTime: at(13, 30),
        }),
        makeBoundaryEventRecord({
          SegmentKey: "trip-2",
          Key: "trip-2--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "BBI",
          ScheduledDeparture: at(13, 30),
          EventScheduledTime: at(14, 5),
        }),
      ],
      at(15, 0)
    );

    expect(
      rows.map((row) => [row.Key, row.IsLastArrivalOfSailingDay ?? false])
    ).toEqual([
      ["trip-1--dep-dock", false],
      ["trip-1--arv-dock", false],
      ["trip-2--dep-dock", false],
      ["trip-2--arv-dock", true],
    ]);
  });
});

describe("buildActualDockEvents", () => {
  const tripMap = (): Map<string, TripContextForActualRow> => {
    const tripKey = "WEN 2026-03-25 19:20:00Z";
    return new Map([["trip-1", { TripKey: tripKey }]]);
  };

  it("keeps occurrence-only rows without inventing an actual time", () => {
    const tk = "WEN 2026-03-25 19:20:00Z";
    const rows = buildActualDockEvents(
      [
        makeBoundaryEventRecord({
          SegmentKey: "trip-1",
          Key: "trip-1--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "BBI",
          EventOccurred: true,
          EventActualTime: undefined,
        }),
      ],
      at(15, 0),
      tripMap()
    );

    expect(rows).toEqual([
      expect.objectContaining({
        EventKey: buildPhysicalActualEventKey(tk, "dep-dock"),
        TripKey: tk,
        EventType: "dep-dock",
        EventOccurred: true,
        EventActualTime: undefined,
      }),
    ]);
  });

  it("normalizes exact actual times as confirmed occurrence", () => {
    const tk = "WEN 2026-03-25 19:20:00Z";
    const [row] = buildActualDockEvents(
      [
        makeBoundaryEventRecord({
          SegmentKey: "trip-1",
          Key: "trip-1--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "BBI",
          EventOccurred: undefined,
          EventActualTime: at(12, 24),
        }),
      ],
      at(15, 0),
      tripMap()
    );

    expect(row).toMatchObject({
      EventKey: buildPhysicalActualEventKey(tk, "dep-dock"),
      EventOccurred: true,
      EventActualTime: at(12, 24),
    });
  });
});

describe("buildActualDockEventFromWrite", () => {
  it("derives SailingDay and ScheduledDeparture from EventActualTime when omitted", () => {
    const row = buildActualDockEventFromWrite(
      {
        TripKey: "WEN 2026-03-25 19:20:00Z",
        VesselAbbrev: "WEN",
        TerminalAbbrev: "BBI",
        EventType: "dep-dock",
        EventOccurred: true,
        EventActualTime: at(12, 22),
      },
      at(15, 0)
    );

    expect(row.SailingDay).toBe("2026-03-25");
    expect(row.ScheduledDeparture).toBe(at(12, 22));
  });
});

const makeBoundaryEventRecord = (
  overrides: Partial<DockBoundaryEventRecord>
): DockBoundaryEventRecord => ({
  SegmentKey: "trip-1",
  Key: "trip-1--dep-dock",
  VesselAbbrev: "WEN",
  SailingDay: "2026-03-25",
  ScheduledDeparture: at(12, 20),
  TerminalAbbrev: "BBI",
  EventType: "dep-dock",
  EventScheduledTime: at(12, 20),
  EventOccurred: undefined,
  EventPredictedTime: undefined,
  EventActualTime: undefined,
  ...overrides,
});
