/**
 * Covers semantic snapshot construction from normalized vessel timeline events.
 */

import { describe, expect, it } from "bun:test";
import type { ConvexVesselTripEvent } from "../../../functions/vesselTripEvents/schemas";
import { buildVesselTimelineSnapshot } from "../snapshots/buildSnapshot";

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

  it("inserts a broken-seam placeholder when a departure lacks a matching prior arrival", () => {
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
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(9, 50),
          ScheduledTime: at(9, 50),
        }),
        makeEvent({
          Key: "arv-2",
          EventType: "arv-dock",
          TerminalAbbrev: "TAH",
          ScheduledDeparture: at(9, 50),
          ScheduledTime: at(10, 25),
        }),
      ],
    });

    const brokenSeamSegment = snapshot.Segments[2];
    expect(brokenSeamSegment?.kind).toBe("dock");
    expect(brokenSeamSegment?.placeholderReason).toBe("broken-seam");
    expect(brokenSeamSegment?.startEvent.IsArrivalPlaceholder).toBeTrue();
    expect(brokenSeamSegment?.endEvent.Key).toBe("dep-2");
    expect(snapshot.Segments[3]?.kind).toBe("sea");
  });

  it("does not append a terminal-tail segment when the final event is a departure", () => {
    const snapshot = buildVesselTimelineSnapshot({
      VesselAbbrev: "TOK",
      SailingDay: "2026-03-18",
      generatedAt: at(6, 0),
      events: [
        makeEvent({
          Key: "arv-1",
          EventType: "arv-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(7, 30),
          ScheduledTime: at(7, 30),
        }),
        makeEvent({
          Key: "dep-1",
          EventType: "dep-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(8, 0),
          ScheduledTime: at(8, 0),
        }),
      ],
    });

    expect(snapshot.Segments).toHaveLength(1);
    expect(snapshot.Segments[0]?.kind).toBe("dock");
    expect(snapshot.Segments[0]?.isTerminal).toBeUndefined();
  });

  it("falls back to a one-minute duration when segment times are missing or invalid", () => {
    const snapshot = buildVesselTimelineSnapshot({
      VesselAbbrev: "TOK",
      SailingDay: "2026-03-18",
      generatedAt: at(6, 0),
      events: [
        makeEvent({
          Key: "arv-1",
          EventType: "arv-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(7, 30),
          ScheduledTime: undefined,
          ActualTime: undefined,
          PredictedTime: undefined,
        }),
        makeEvent({
          Key: "dep-1",
          EventType: "dep-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(8, 0),
          ScheduledTime: at(8, 0),
        }),
        makeEvent({
          Key: "dep-2",
          EventType: "dep-dock",
          TerminalAbbrev: "BBI",
          ScheduledDeparture: at(9, 0),
          ScheduledTime: at(9, 30),
        }),
        makeEvent({
          Key: "arv-2",
          EventType: "arv-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(9, 0),
          ScheduledTime: at(9, 20),
        }),
      ],
    });

    expect(snapshot.Segments[0]?.kind).toBe("dock");
    expect(snapshot.Segments[0]?.durationMinutes).toBe(1);
    expect(snapshot.Segments[1]?.placeholderReason).toBe("broken-seam");
    expect(snapshot.Segments[2]?.kind).toBe("sea");
    expect(snapshot.Segments[2]?.durationMinutes).toBe(1);
  });

  it("falls back to the terminal abbreviation when no display name is known", () => {
    const snapshot = buildVesselTimelineSnapshot({
      VesselAbbrev: "TOK",
      SailingDay: "2026-03-18",
      generatedAt: at(6, 0),
      events: [
        makeEvent({
          Key: "dep-1",
          EventType: "dep-dock",
          TerminalAbbrev: "ZZZ",
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
      ],
    });

    expect(snapshot.Segments[1]?.startEvent.TerminalDisplayName).toBe("ZZZ");
    expect(snapshot.Segments[1]?.endEvent.TerminalDisplayName).toBe(
      "Bainbridge Is."
    );
  });
});

/**
 * Creates a baseline vessel trip event fixture with optional overrides.
 *
 * @param overrides - Partial event fields to override in the default fixture
 * @returns A valid vessel trip event fixture for snapshot tests
 */
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
