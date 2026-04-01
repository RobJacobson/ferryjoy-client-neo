/**
 * Covers client-side semantic segment reconstruction from merged boundary
 * events.
 */

import { describe, expect, it } from "bun:test";
import type { MergedTimelineBoundaryEvent } from "@/types";
import { buildSegmentsFromBoundaryEvents } from "../buildSegmentsFromBoundaryEvents";

const at = (hours: number, minutes: number) =>
  new Date(Date.UTC(2026, 2, 25, hours, minutes));

describe("buildSegmentsFromBoundaryEvents", () => {
  it("builds placeholder, sea, dock, and terminal-tail segments client-side", () => {
    const segments = buildSegmentsFromBoundaryEvents(
      [
        makeEvent({
          Key: "dep-1",
          EventType: "dep-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(12, 20),
          EventScheduledTime: at(12, 20),
        }),
        makeEvent({
          Key: "arv-1",
          EventType: "arv-dock",
          TerminalAbbrev: "BBI",
          ScheduledDeparture: at(12, 20),
          EventScheduledTime: at(12, 55),
        }),
        makeEvent({
          Key: "dep-2",
          EventType: "dep-dock",
          TerminalAbbrev: "BBI",
          ScheduledDeparture: at(13, 10),
          EventScheduledTime: at(13, 10),
        }),
        makeEvent({
          Key: "arv-2",
          EventType: "arv-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(13, 10),
          EventScheduledTime: at(13, 45),
        }),
      ],
      (terminalAbbrev) => terminalAbbrev
    );

    expect(segments.map((segment) => segment.kind)).toEqual([
      "dock",
      "sea",
      "dock",
      "sea",
      "dock",
    ]);
    expect(segments[0]?.placeholderReason).toBe("start-of-day");
    expect(segments[4]?.isTerminal).toBeTrue();
  });
});

const makeEvent = (
  overrides: Partial<MergedTimelineBoundaryEvent>
): MergedTimelineBoundaryEvent => ({
  Key: "event-key",
  VesselAbbrev: "WEN",
  SailingDay: "2026-03-25",
  ScheduledDeparture: at(12, 20),
  TerminalAbbrev: "P52",
  EventType: "dep-dock",
  EventScheduledTime: at(12, 20),
  EventPredictedTime: undefined,
  EventActualTime: undefined,
  ...overrides,
});
