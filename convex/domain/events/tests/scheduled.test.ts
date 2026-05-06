/**
 * Focused tests for flat scheduled dock-event reload helpers.
 */

import { describe, expect, it } from "bun:test";
import type { ConvexScheduledDockEvent } from "functions/events/eventsScheduled/schemas";
import {
  buildScheduledDockEvents,
  type DockBoundaryEventRecord,
  inferScheduledSegmentFromDepartureEvent,
} from "../scheduled";

describe("buildScheduledDockEvents", () => {
  it("fills next terminal and marks the last arrival of the sailing day", () => {
    const rows = buildScheduledDockEvents(
      [
        boundary({
          SegmentKey: "WEN--2026-03-25--08:00--P52-BBI",
          Key: "WEN--2026-03-25--08:00--P52-BBI--dep-dock",
          TerminalAbbrev: "P52",
          EventType: "dep-dock",
          EventScheduledTime: 1000,
        }),
        boundary({
          SegmentKey: "WEN--2026-03-25--08:00--P52-BBI",
          Key: "WEN--2026-03-25--08:00--P52-BBI--arv-dock",
          TerminalAbbrev: "BBI",
          EventType: "arv-dock",
          EventScheduledTime: 2000,
        }),
      ],
      99
    );

    expect(rows[0]).toMatchObject({
      Key: "WEN--2026-03-25--08:00--P52-BBI--dep-dock",
      NextTerminalAbbrev: "BBI",
      IsLastArrivalOfSailingDay: false,
    });
    expect(rows[1]).toMatchObject({
      Key: "WEN--2026-03-25--08:00--P52-BBI--arv-dock",
      NextTerminalAbbrev: "BBI",
      IsLastArrivalOfSailingDay: true,
    });
  });
});

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

/**
 * Builds an in-memory scheduled boundary fixture.
 *
 * @param overrides - Boundary field overrides
 * @returns Dock boundary record fixture
 */
const boundary = (
  overrides: Partial<DockBoundaryEventRecord> = {}
): DockBoundaryEventRecord => ({
  SegmentKey: "WEN--2026-03-25--08:00--P52-BBI",
  Key: "WEN--2026-03-25--08:00--P52-BBI--dep-dock",
  VesselAbbrev: "WEN",
  SailingDay: "2026-03-25",
  ScheduledDeparture: 1000,
  TerminalAbbrev: "P52",
  EventType: "dep-dock",
  EventScheduledTime: 1000,
  ...overrides,
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
