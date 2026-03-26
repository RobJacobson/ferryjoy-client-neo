/**
 * Tests for merging schedule reseeds into the vessel trip event read model.
 */
import { describe, expect, it } from "bun:test";
import type { ConvexVesselTimelineEventRecord } from "../../../functions/vesselTimeline/eventRecordSchemas";
import { mergeSeededVesselTripEvents } from "../events/reseed";

const at = (hours: number, minutes: number) =>
  Date.UTC(2026, 2, 13, hours + 7, minutes);

describe("mergeSeededVesselTripEvents", () => {
  it("preserves actualized past events during reseed", () => {
    const existingEvents = [
      makeEvent({
        Key: "2026-03-13--TOK--1--P52--dep",
        EventType: "dep-dock",
        ScheduledDeparture: at(8, 35),
        ScheduledTime: at(8, 35),
        ActualTime: at(8, 37),
      }),
    ];
    const seededEvents = [
      makeEvent({
        Key: "2026-03-13--TOK--1--P52--dep",
        EventType: "dep-dock",
        ScheduledDeparture: at(8, 35),
        ScheduledTime: at(8, 40),
      }),
    ];

    const mergedEvents = mergeSeededVesselTripEvents({
      existingEvents,
      seededEvents,
      nowTimestamp: at(9, 0),
    });

    expect(mergedEvents).toEqual(existingEvents);
  });

  it("updates future schedule fields while preserving live prediction data", () => {
    const existingEvents = [
      makeEvent({
        Key: "2026-03-13--TOK--2--P52--arv",
        EventType: "arv-dock",
        TerminalAbbrev: "BBI",
        ScheduledDeparture: at(10, 0),
        ScheduledTime: at(10, 35),
        PredictedTime: at(10, 32),
      }),
    ];
    const seededEvents = [
      makeEvent({
        Key: "2026-03-13--TOK--2--P52--arv",
        EventType: "arv-dock",
        TerminalAbbrev: "BBI",
        ScheduledDeparture: at(10, 0),
        ScheduledTime: at(10, 40),
      }),
    ];

    const mergedEvents = mergeSeededVesselTripEvents({
      existingEvents,
      seededEvents,
      nowTimestamp: at(9, 0),
    });

    expect(mergedEvents).toEqual([
      makeEvent({
        Key: "2026-03-13--TOK--2--P52--arv",
        EventType: "arv-dock",
        TerminalAbbrev: "BBI",
        ScheduledDeparture: at(10, 0),
        ScheduledTime: at(10, 40),
        PredictedTime: at(10, 32),
      }),
    ]);
  });

  it("drops obsolete future-only events that disappear from the schedule", () => {
    const existingEvents = [
      makeEvent({
        Key: "2026-03-13--TOK--3--P52--dep",
        EventType: "dep-dock",
        ScheduledDeparture: at(11, 0),
        ScheduledTime: at(11, 0),
      }),
    ];

    const mergedEvents = mergeSeededVesselTripEvents({
      existingEvents,
      seededEvents: [],
      nowTimestamp: at(9, 0),
    });

    expect(mergedEvents).toEqual([]);
  });

  it("keeps obsolete historical events even when they disappear from the schedule", () => {
    const existingEvents = [
      makeEvent({
        Key: "2026-03-13--TOK--4--P52--arv",
        EventType: "arv-dock",
        ScheduledDeparture: at(8, 35),
        ScheduledTime: at(9, 10),
        ActualTime: at(9, 8),
      }),
    ];

    const mergedEvents = mergeSeededVesselTripEvents({
      existingEvents,
      seededEvents: [],
      nowTimestamp: at(9, 30),
    });

    expect(mergedEvents).toEqual(existingEvents);
  });

  it("ignores newly seeded past events that were not part of live history", () => {
    const seededEvents = [
      makeEvent({
        Key: "2026-03-13--TOK--5--P52--dep",
        EventType: "dep-dock",
        ScheduledDeparture: at(8, 35),
        ScheduledTime: at(8, 35),
      }),
    ];

    const mergedEvents = mergeSeededVesselTripEvents({
      existingEvents: [],
      seededEvents,
      nowTimestamp: at(9, 0),
    });

    expect(mergedEvents).toEqual([]);
  });

  it("treats present events as history-owned during reseed", () => {
    const existingEvents = [
      makeEvent({
        Key: "2026-03-13--TOK--6--P52--arv",
        EventType: "arv-dock",
        TerminalAbbrev: "BBI",
        ScheduledDeparture: at(9, 0),
        ScheduledTime: at(9, 20),
        PredictedTime: at(9, 5),
      }),
    ];
    const seededEvents = [
      makeEvent({
        Key: "2026-03-13--TOK--6--P52--arv",
        EventType: "arv-dock",
        TerminalAbbrev: "BBI",
        ScheduledDeparture: at(9, 0),
        ScheduledTime: at(9, 25),
      }),
    ];

    const mergedEvents = mergeSeededVesselTripEvents({
      existingEvents,
      seededEvents,
      nowTimestamp: at(9, 5),
    });

    expect(mergedEvents).toEqual(existingEvents);
  });

  it("can preserve historical rows while deleting obsolete future rows in the same reseed", () => {
    const existingEvents = [
      makeEvent({
        Key: "2026-03-13--TOK--7--P52--dep",
        EventType: "dep-dock",
        ScheduledDeparture: at(8, 35),
        ScheduledTime: at(8, 35),
        ActualTime: at(8, 37),
      }),
      makeEvent({
        Key: "2026-03-13--TOK--8--P52--dep",
        EventType: "dep-dock",
        ScheduledDeparture: at(11, 0),
        ScheduledTime: at(11, 0),
      }),
    ];

    const mergedEvents = mergeSeededVesselTripEvents({
      existingEvents,
      seededEvents: [],
      nowTimestamp: at(9, 0),
    });

    expect(mergedEvents).toEqual(existingEvents.slice(0, 1));
  });
});

/**
 * Creates a baseline vessel trip event fixture with optional overrides.
 *
 * @param overrides - Partial event fields to override in the default fixture
 * @returns A valid vessel trip event fixture for reseed tests
 */
const makeEvent = (
  overrides: Partial<ConvexVesselTimelineEventRecord>
): ConvexVesselTimelineEventRecord => ({
  Key: "2026-03-13--TOK--0--P52--dep",
  VesselAbbrev: "TOK",
  SailingDay: "2026-03-13",
  ScheduledDeparture: at(8, 35),
  TerminalAbbrev: "P52",
  EventType: "dep-dock",
  ScheduledTime: at(8, 35),
  PredictedTime: undefined,
  ActualTime: undefined,
  ...overrides,
});
