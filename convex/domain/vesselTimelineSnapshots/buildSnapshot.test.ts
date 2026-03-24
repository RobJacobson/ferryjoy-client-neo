import { describe, expect, it } from "bun:test";
import type { ConvexVesselTripEvent } from "../../functions/vesselTripEvents/schemas";
import { buildVesselTimelineSnapshot } from "./buildSnapshot";

const at = (hours: number, minutes: number) =>
  Date.UTC(2026, 2, 18, hours, minutes);

describe("buildVesselTimelineSnapshot", () => {
  it("builds semantic segments with a start-of-day placeholder and terminal tail", () => {
    const snapshot = buildVesselTimelineSnapshot({
      VesselAbbrev: "TOK",
      SailingDay: "2026-03-18",
      generatedAt: at(6, 0),
      events: [
        makeEvent({
          Key: "dep-1",
          EventType: "dep-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(8, 0),
          ScheduledTime: at(8, 0),
        }),
        makeEvent({
          Key: "arv-1",
          EventType: "arv-dock",
          TerminalAbbrev: "BBI",
          ScheduledDeparture: at(8, 0),
          ScheduledTime: at(8, 35),
        }),
        makeEvent({
          Key: "dep-2",
          EventType: "dep-dock",
          TerminalAbbrev: "BBI",
          ScheduledDeparture: at(9, 50),
          ScheduledTime: at(9, 50),
        }),
        makeEvent({
          Key: "arv-2",
          EventType: "arv-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(9, 50),
          ScheduledTime: at(10, 25),
        }),
      ],
    });

    expect(snapshot.Segments.map((segment) => segment.kind)).toEqual([
      "dock",
      "sea",
      "dock",
      "sea",
      "dock",
    ]);
    expect(snapshot.Segments[0]?.placeholderReason).toBe("start-of-day");
    expect(snapshot.Segments[0]?.startEvent.IsArrivalPlaceholder).toBeTrue();
    expect(snapshot.Segments[2]?.durationMinutes).toBe(75);
    expect(snapshot.Segments[4]?.isTerminal).toBeTrue();
  });
});

const makeEvent = (
  overrides: Partial<ConvexVesselTripEvent>
): ConvexVesselTripEvent => ({
  Key: "event",
  VesselAbbrev: "TOK",
  SailingDay: "2026-03-18",
  ScheduledDeparture: at(8, 0),
  TerminalAbbrev: "P52",
  EventType: "dep-dock",
  ScheduledTime: at(8, 0),
  PredictedTime: undefined,
  ActualTime: undefined,
  ...overrides,
});
