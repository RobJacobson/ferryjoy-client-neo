import { describe, expect, it } from "bun:test";
import { findDockedDepartureEvent } from "./queries";

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
      "CLI",
      ms("2026-03-13T11:08:00-07:00")
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
      "ORI",
      ms("2026-03-13T06:29:56-07:00")
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
      "VAI",
      ms("2026-03-13T19:58:00-07:00")
    );

    expect(departureEvent).toBeNull();
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
