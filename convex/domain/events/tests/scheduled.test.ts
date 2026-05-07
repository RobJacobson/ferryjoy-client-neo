/**
 * Focused tests for scheduled dock-event continuity helpers.
 */

import { describe, expect, it } from "bun:test";
import {
  findNextDepartureEvent,
  inferScheduledSegmentFromDepartureEvent,
  type ConvexScheduledDockEvent,
} from "../scheduled";

describe("inferScheduledSegmentFromDepartureEvent", () => {
  it("returns segment continuity with the next departure linkage", () => {
    const departure = scheduledRow({
      Key: "WEN--2026-03-25--08:00--P52-BBI--dep-dock",
      TerminalAbbrev: "P52",
      NextTerminalAbbrev: "BBI",
      ScheduledDeparture: 1000,
      EventScheduledTime: 1000,
    });
    const nextDeparture = scheduledRow({
      Key: "WEN--2026-03-25--09:00--BBI-P52--dep-dock",
      TerminalAbbrev: "BBI",
      NextTerminalAbbrev: "P52",
      ScheduledDeparture: 3000,
      EventScheduledTime: 3000,
    });

    expect(
      inferScheduledSegmentFromDepartureEvent(departure, [
        departure,
        nextDeparture,
      ])
    ).toEqual({
      Key: "WEN--2026-03-25--08:00--P52-BBI",
      SailingDay: "2026-03-25",
      DepartingTerminalAbbrev: "P52",
      ArrivingTerminalAbbrev: "BBI",
      DepartingTime: 1000,
      NextKey: "WEN--2026-03-25--09:00--BBI-P52",
      NextDepartingTime: 3000,
    });
  });
});

describe("findNextDepartureEvent", () => {
  it("returns the earliest later departure for the requested terminal", () => {
    const expected = scheduledRow({
      Key: "WEN--2026-03-25--10:00--BBI-P52--dep-dock",
      TerminalAbbrev: "BBI",
      ScheduledDeparture: 2000,
      EventScheduledTime: 2000,
    });

    expect(
      findNextDepartureEvent(
        [
          scheduledRow({
            Key: "WEN--2026-03-25--09:00--P52-BBI--dep-dock",
            TerminalAbbrev: "P52",
            ScheduledDeparture: 1500,
            EventScheduledTime: 1500,
          }),
          scheduledRow({
            Key: "WEN--2026-03-25--11:00--BBI-P52--dep-dock",
            TerminalAbbrev: "BBI",
            ScheduledDeparture: 3000,
            EventScheduledTime: 3000,
          }),
          scheduledRow({
            Key: "WEN--2026-03-25--09:30--BBI-P52--arv-dock",
            TerminalAbbrev: "BBI",
            EventType: "arv-dock",
            ScheduledDeparture: 1750,
            EventScheduledTime: 1750,
          }),
          expected,
        ],
        {
          terminalAbbrev: "BBI",
          afterTime: 1000,
        }
      )
    ).toEqual(expected);
  });
});

/**
 * Builds a persisted scheduled row fixture.
 *
 * @param overrides - Scheduled row overrides
 * @returns Convex scheduled dock row fixture
 */
const scheduledRow = (
  overrides: Partial<ConvexScheduledDockEvent> = {}
): ConvexScheduledDockEvent => ({
  Key: "WEN--2026-03-25--08:00--P52-BBI--dep-dock",
  VesselAbbrev: "WEN",
  SailingDay: "2026-03-25",
  UpdatedAt: 1,
  ScheduledDeparture: 1000,
  TerminalAbbrev: "P52",
  NextTerminalAbbrev: "BBI",
  EventType: "dep-dock",
  EventScheduledTime: 1000,
  ...overrides,
});
