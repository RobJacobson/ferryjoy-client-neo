/**
 * Tests for minimal actual event write normalization.
 */

import { describe, expect, it } from "bun:test";
import {
  buildActualDockEventFromWrite,
  buildActualDockRowsForSailingDayReload,
  type ConvexActualDockWritePersistable,
} from "domain/events/actual";

/**
 * Builds a UTC timestamp fixture.
 *
 * @param hours - UTC hour
 * @param minutes - UTC minute
 * @returns Epoch milliseconds
 */
const at = (hours: number, minutes: number): number =>
  Date.UTC(2026, 2, 25, hours, minutes);

/**
 * Builds a persistable actual dock write fixture.
 *
 * @param overrides - Field overrides for the sparse write
 * @returns Sparse actual dock write
 */
const actualWrite = (
  overrides: Partial<ConvexActualDockWritePersistable> = {}
): ConvexActualDockWritePersistable => ({
  TripKey: "trip-a",
  VesselAbbrev: "WEN",
  ScheduledDeparture: at(12, 20),
  TerminalAbbrev: "P52",
  EventType: "dep-dock",
  EventOccurred: true,
  EventActualTime: at(12, 23),
  ...overrides,
});

describe("buildActualDockEventFromWrite", () => {
  it("derives EventKey and stamps occurrence and UpdatedAt", () => {
    const row = buildActualDockEventFromWrite(actualWrite(), at(15, 0));

    expect(row.EventKey).toBe("trip-a--dep-dock");
    expect(row.EventOccurred).toBe(true);
    expect(row.UpdatedAt).toBe(at(15, 0));
  });

  it("preserves a provided EventKey", () => {
    const row = buildActualDockEventFromWrite(
      actualWrite({ EventKey: "provided-key" }),
      at(15, 0)
    );

    expect(row.EventKey).toBe("provided-key");
  });

  it("derives SailingDay from EventActualTime before ScheduledDeparture", () => {
    const row = buildActualDockEventFromWrite(
      actualWrite({
        SailingDay: undefined,
        ScheduledDeparture: at(9, 0),
        EventActualTime: at(12, 23),
      }),
      at(15, 0)
    );

    expect(row.SailingDay).toBe("2026-03-25");
  });

  it("derives SailingDay from ScheduledDeparture when EventActualTime is omitted", () => {
    const row = buildActualDockEventFromWrite(
      actualWrite({
        SailingDay: undefined,
        ScheduledDeparture: at(12, 20),
        EventActualTime: undefined,
      }),
      at(15, 0)
    );

    expect(row.SailingDay).toBe("2026-03-25");
  });

  it("fills ScheduledDeparture from EventActualTime when omitted", () => {
    const row = buildActualDockEventFromWrite(
      actualWrite({
        ScheduledDeparture: undefined,
        EventActualTime: at(12, 23),
      }),
      at(15, 0)
    );

    expect(row.ScheduledDeparture).toBe(at(12, 23));
  });
});

describe("buildActualDockRowsForSailingDayReload", () => {
  it("preserves physical-only observations from trip rows", () => {
    const result = buildActualDockRowsForSailingDayReload({
      sailingDay: "2026-03-25",
      events: [],
      updatedAt: 42,
      tripBySegmentKey: new Map(),
      activeTripsByVesselAbbrev: new Map(),
      vesselLocations: [],
      physicalOnlyTrips: [
        {
          TripKey: "trip-physical",
          ScheduleKey: undefined,
          VesselAbbrev: "WEN",
          SailingDay: "2026-03-25",
          DepartingTerminalAbbrev: "P52",
          ArrivingTerminalAbbrev: "BBI",
          ScheduledDeparture: at(12, 20),
          LeftDockActual: at(12, 23),
          TripEnd: at(13, 20),
        },
      ],
    });

    expect(result.actualCount).toBe(2);
    expect(result.actualRows.map((row) => row.EventType)).toEqual([
      "dep-dock",
      "arv-dock",
    ]);
    expect(result.actualRows.every((row) => row.UpdatedAt === 42)).toBe(true);
  });
});
