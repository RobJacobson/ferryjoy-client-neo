/**
 * Covers pure event-order schedule resolvers used by vesselTimeline and
 * vesselTrips.
 */

import { describe, expect, it } from "bun:test";
import {
  findDockedDepartureEvent,
  findNextDepartureAfterBoundaryEvent,
  findNextDepartureEvent,
  getSegmentKeyFromBoundaryKey,
} from "../segmentResolvers";

describe("findDockedDepartureEvent", () => {
  it("keeps a delayed sailing attached to the current dock interval", () => {
    const departureEvent = findDockedDepartureEvent(
      [
        makeEvent({
          Key: "trip-1--arv-dock",
          TerminalAbbrev: "CLI",
          EventType: "arv-dock",
          ScheduledDeparture: ms("2026-03-13T09:30:00-07:00"),
          EventScheduledTime: ms("2026-03-13T10:35:00-07:00"),
        }),
        makeEvent({
          Key: "trip-2--dep-dock",
          TerminalAbbrev: "CLI",
          EventType: "dep-dock",
          ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
          EventScheduledTime: ms("2026-03-13T11:00:00-07:00"),
        }),
        makeEvent({
          Key: "trip-3--dep-dock",
          TerminalAbbrev: "CLI",
          EventType: "dep-dock",
          ScheduledDeparture: ms("2026-03-13T12:30:00-07:00"),
          EventScheduledTime: ms("2026-03-13T12:30:00-07:00"),
        }),
      ],
      "CLI"
    );

    expect(departureEvent?.Key).toBe("trip-2--dep-dock");
  });

  it("falls back to the upcoming departure when no prior arrival exists", () => {
    const departureEvent = findDockedDepartureEvent(
      [
        makeEvent({
          Key: "trip-1--dep-dock",
          TerminalAbbrev: "ORI",
          EventType: "dep-dock",
          ScheduledDeparture: ms("2026-03-13T07:00:00-07:00"),
          EventScheduledTime: ms("2026-03-13T07:00:00-07:00"),
        }),
      ],
      "ORI"
    );

    expect(departureEvent?.Key).toBe("trip-1--dep-dock");
  });

  it("returns null when the final arrival has no owning departure after it", () => {
    const departureEvent = findDockedDepartureEvent(
      [
        makeEvent({
          Key: "trip-1--arv-dock",
          TerminalAbbrev: "VAI",
          EventType: "arv-dock",
          ScheduledDeparture: ms("2026-03-13T19:00:00-07:00"),
          EventScheduledTime: ms("2026-03-13T19:30:00-07:00"),
        }),
      ],
      "VAI"
    );

    expect(departureEvent).toBeNull();
  });

  it("returns null when multiple same-terminal dock intervals exist", () => {
    const departureEvent = findDockedDepartureEvent(
      [
        makeEvent({
          Key: "trip-1--dep-dock",
          TerminalAbbrev: "ORI",
          EventType: "dep-dock",
          ScheduledDeparture: ms("2026-03-13T07:00:00-07:00"),
          EventScheduledTime: ms("2026-03-13T07:00:00-07:00"),
        }),
        makeEvent({
          Key: "trip-1--arv-dock",
          TerminalAbbrev: "LOP",
          EventType: "arv-dock",
          ScheduledDeparture: ms("2026-03-13T07:00:00-07:00"),
          EventScheduledTime: ms("2026-03-13T07:25:00-07:00"),
        }),
        makeEvent({
          Key: "trip-2--dep-dock",
          TerminalAbbrev: "ANA",
          EventType: "dep-dock",
          ScheduledDeparture: ms("2026-03-13T08:00:00-07:00"),
          EventScheduledTime: ms("2026-03-13T08:00:00-07:00"),
        }),
        makeEvent({
          Key: "trip-2--arv-dock",
          TerminalAbbrev: "ORI",
          EventType: "arv-dock",
          ScheduledDeparture: ms("2026-03-13T08:00:00-07:00"),
          EventScheduledTime: ms("2026-03-13T08:25:00-07:00"),
        }),
        makeEvent({
          Key: "trip-3--dep-dock",
          TerminalAbbrev: "ORI",
          EventType: "dep-dock",
          ScheduledDeparture: ms("2026-03-13T09:00:00-07:00"),
          EventScheduledTime: ms("2026-03-13T09:00:00-07:00"),
        }),
      ],
      "ORI"
    );

    expect(departureEvent).toBeNull();
  });
});

describe("findNextDepartureAfterBoundaryEvent", () => {
  it("returns the next trip's departure after an arrival boundary", () => {
    const nextDeparture = findNextDepartureAfterBoundaryEvent(
      [
        makeEvent({
          Key: "trip-1--arv-dock",
          TerminalAbbrev: "VAI",
          EventType: "arv-dock",
          ScheduledDeparture: ms("2026-03-13T19:00:00-07:00"),
          EventScheduledTime: ms("2026-03-13T19:30:00-07:00"),
        }),
        makeEvent({
          Key: "trip-2--dep-dock",
          TerminalAbbrev: "VAI",
          EventType: "dep-dock",
          ScheduledDeparture: ms("2026-03-13T20:15:00-07:00"),
          EventScheduledTime: ms("2026-03-13T20:15:00-07:00"),
        }),
      ],
      makeEvent({
        Key: "trip-1--arv-dock",
        TerminalAbbrev: "VAI",
        EventType: "arv-dock",
        ScheduledDeparture: ms("2026-03-13T19:00:00-07:00"),
        EventScheduledTime: ms("2026-03-13T19:30:00-07:00"),
      })
    );

    expect(nextDeparture?.Key).toBe("trip-2--dep-dock");
  });

  it("returns null when there is no later departure", () => {
    const nextDeparture = findNextDepartureAfterBoundaryEvent(
      [
        makeEvent({
          Key: "trip-1--arv-dock",
          TerminalAbbrev: "VAI",
          EventType: "arv-dock",
          ScheduledDeparture: ms("2026-03-13T19:00:00-07:00"),
          EventScheduledTime: ms("2026-03-13T19:30:00-07:00"),
        }),
      ],
      makeEvent({
        Key: "trip-1--arv-dock",
        TerminalAbbrev: "VAI",
        EventType: "arv-dock",
        ScheduledDeparture: ms("2026-03-13T19:00:00-07:00"),
        EventScheduledTime: ms("2026-03-13T19:30:00-07:00"),
      })
    );

    expect(nextDeparture).toBeNull();
  });
});

describe("findNextDepartureEvent", () => {
  it("chooses the earliest same-terminal departure after a prior departure", () => {
    const nextDeparture = findNextDepartureEvent(
      [
        makeEvent({
          Key: "trip-1--dep-dock",
          TerminalAbbrev: "CLI",
          EventType: "dep-dock",
          ScheduledDeparture: ms("2026-03-13T09:00:00-07:00"),
          EventScheduledTime: ms("2026-03-13T09:00:00-07:00"),
        }),
        makeEvent({
          Key: "trip-2--dep-dock",
          TerminalAbbrev: "CLI",
          EventType: "dep-dock",
          ScheduledDeparture: ms("2026-03-13T10:00:00-07:00"),
          EventScheduledTime: ms("2026-03-13T10:00:00-07:00"),
        }),
        makeEvent({
          Key: "trip-3--dep-dock",
          TerminalAbbrev: "CLI",
          EventType: "dep-dock",
          ScheduledDeparture: ms("2026-03-13T11:30:00-07:00"),
          EventScheduledTime: ms("2026-03-13T11:30:00-07:00"),
        }),
      ],
      {
        terminalAbbrev: "CLI",
        afterTime: ms("2026-03-13T09:00:00-07:00"),
      }
    );

    expect(nextDeparture?.Key).toBe("trip-2--dep-dock");
  });
});

describe("getSegmentKeyFromBoundaryKey", () => {
  it("strips the boundary suffix to recover the stable trip key", () => {
    expect(getSegmentKeyFromBoundaryKey("trip-2--arv-dock")).toBe("trip-2");
  });
});

const ms = (iso: string) => new Date(iso).getTime();

const makeEvent = (
  overrides: Partial<{
    Key: string;
    VesselAbbrev: string;
    SailingDay: string;
    TerminalAbbrev: string;
    NextTerminalAbbrev: string;
    ScheduledDeparture: number;
    EventType: "dep-dock" | "arv-dock";
    EventScheduledTime?: number;
  }>
) => ({
  Key: "trip-1--dep-dock",
  VesselAbbrev: "CHE",
  SailingDay: "2026-03-13",
  TerminalAbbrev: "ANA",
  NextTerminalAbbrev: "ORI",
  ScheduledDeparture: ms("2026-03-13T05:30:00-07:00"),
  EventType: "dep-dock" as const,
  EventScheduledTime: ms("2026-03-13T05:30:00-07:00"),
  ...overrides,
});
