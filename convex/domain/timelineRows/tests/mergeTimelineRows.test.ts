/**
 * Covers merge of scheduled, actual, and predicted boundary rows for timeline
 * display.
 */

import { describe, expect, it } from "bun:test";
import { mergeTimelineRows } from "domain/timelineRows";
import type { ConvexActualDockEvent } from "../../../domain/events/actual/schemas";
import type { ConvexPredictedDockEvent } from "../../../domain/events/predicted/schemas";
import type { ConvexScheduledDockEvent } from "../../../domain/events/scheduled/schemas";
import { resolveActiveTimelineInterval } from "../../../shared/activeTimelineInterval";
import { buildPhysicalActualEventKey } from "../../../shared/physicalTripIdentity";
import { getSegmentKeyFromBoundaryKey } from "../scheduledSegmentResolvers";

const at = (hours: number, minutes: number, day = 25) =>
  Date.UTC(2026, 2, day, hours, minutes);

describe("mergeTimelineRows", () => {
  it("merges sparse actual and predicted overlays onto ordered events", () => {
    const events = mergeTimelineRows({
      scheduledEvents: [
        makeScheduledEvent({
          Key: "trip-1--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 0),
        }),
        makeScheduledEvent({
          Key: "trip-1--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "BBI",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 35),
        }),
      ],
      actualEvents: [
        makeActualEvent({
          Key: "trip-1--dep-dock",
          EventActualTime: at(8, 4),
        }),
      ],
      predictedEvents: [
        makePredictedEvent({
          Key: "trip-1--arv-dock",
          EventPredictedTime: at(8, 40),
        }),
      ],
    });

    expect(events.map((event) => event.Key)).toEqual([
      "trip-1--dep-dock",
      "trip-1--arv-dock",
    ]);
    expect(events[0]).toMatchObject({
      SegmentKey: "trip-1",
      EventActualTime: at(8, 4),
    });
    expect(events[1]).toMatchObject({
      SegmentKey: "trip-1",
      EventPredictedTime: at(8, 40),
    });
  });

  it("reattaches wrong-key arrival actuals using segment dep and next dep at arrival terminal", () => {
    const events = mergeTimelineRows({
      scheduledEvents: [
        makeScheduledEvent({
          Key: "a--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "VAI",
          ScheduledDeparture: at(13, 55),
          EventScheduledTime: at(13, 55),
          NextTerminalAbbrev: "FAU",
        }),
        makeScheduledEvent({
          Key: "a--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "FAU",
          ScheduledDeparture: at(13, 55),
          EventScheduledTime: at(14, 10),
          NextTerminalAbbrev: "FAU",
        }),
        makeScheduledEvent({
          Key: "leg-b--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "FAU",
          ScheduledDeparture: at(14, 20),
          EventScheduledTime: at(14, 20),
          NextTerminalAbbrev: "VAI",
        }),
        makeScheduledEvent({
          Key: "leg-b--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "VAI",
          ScheduledDeparture: at(14, 20),
          EventScheduledTime: at(16, 35),
          NextTerminalAbbrev: "VAI",
        }),
        makeScheduledEvent({
          Key: "c--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "VAI",
          ScheduledDeparture: at(17, 10),
          EventScheduledTime: at(17, 10),
          NextTerminalAbbrev: "FAU",
        }),
      ],
      actualEvents: [
        makeActualEvent({
          Key: "orphan--arv-dock",
          TerminalAbbrev: "VAI",
          ScheduledDeparture: at(14, 20),
          EventActualTime: at(14, 41),
        }),
      ],
      predictedEvents: [],
    });

    const legBArv = events.find((event) => event.Key === "leg-b--arv-dock");
    expect(legBArv?.EventActualTime).toBe(at(14, 41));
    const cDepIndex = events.findIndex((event) => event.Key === "c--dep-dock");
    const legBArvIndex = events.findIndex(
      (event) => event.Key === "leg-b--arv-dock"
    );
    expect(legBArvIndex).toBeLessThan(cDepIndex);
  });

  it("keeps exact-match arrivals ahead of heuristic reassignment", () => {
    const events = mergeTimelineRows({
      scheduledEvents: [
        makeScheduledEvent({
          Key: "sea-1--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(17, 30),
          EventScheduledTime: at(18, 30),
        }),
        makeScheduledEvent({
          Key: "sea-2--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(19, 55),
          EventScheduledTime: at(20, 55),
        }),
      ],
      actualEvents: [
        makeActualEvent({
          Key: "sea-2--arv-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(19, 55),
          EventActualTime: at(20, 57),
        }),
        makeActualEvent({
          Key: "orphan-early--arv-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(18, 40),
          EventActualTime: at(19, 49),
        }),
      ],
      predictedEvents: [],
    });

    expect(
      events.find((event) => event.Key === "sea-1--arv-dock")
    ).toMatchObject({
      EventActualTime: at(19, 49),
    });
    expect(
      events.find((event) => event.Key === "sea-2--arv-dock")
    ).toMatchObject({
      EventActualTime: at(20, 57),
    });
  });

  it("does not heuristic-attach physical-only arrival actuals (no ScheduleKey)", () => {
    const events = mergeTimelineRows({
      scheduledEvents: [
        makeScheduledEvent({
          Key: "leg-1--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(17, 30),
          EventScheduledTime: at(18, 30),
        }),
      ],
      actualEvents: [
        makeActualEvent({
          Key: "physical-only--arv-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(17, 30),
          EventActualTime: at(18, 40),
          ScheduleKey: undefined,
        }),
      ],
      predictedEvents: [],
    });

    expect(
      events.find((event) => event.Key === "leg-1--arv-dock")?.EventActualTime
    ).toBeUndefined();
  });

  it("reattaches a missing arrival from the next unused same-terminal actual before the next equivalent row", () => {
    const events = mergeTimelineRows({
      scheduledEvents: [
        makeScheduledEvent({
          Key: "leg-1--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(17, 30),
          EventScheduledTime: at(18, 30),
        }),
        makeScheduledEvent({
          Key: "leg-2--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(19, 55),
          EventScheduledTime: at(20, 55),
        }),
      ],
      actualEvents: [
        makeActualEvent({
          Key: "replacement-1--arv-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(18, 40),
          EventActualTime: at(19, 49),
        }),
      ],
      predictedEvents: [],
    });

    expect(
      events.find((event) => event.Key === "leg-1--arv-dock")
    ).toMatchObject({
      EventActualTime: at(19, 49),
    });
    expect(
      events.find((event) => event.Key === "leg-2--arv-dock")?.EventActualTime
    ).toBeUndefined();
  });

  it("leaves an arrival blank when the candidate actual crosses the next equivalent arrival slot", () => {
    const events = mergeTimelineRows({
      scheduledEvents: [
        makeScheduledEvent({
          Key: "leg-1--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(17, 30),
          EventScheduledTime: at(18, 30),
        }),
        makeScheduledEvent({
          Key: "leg-2--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(19, 55),
          EventScheduledTime: at(20, 55),
        }),
      ],
      actualEvents: [
        makeActualEvent({
          Key: "replacement-late--arv-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(18, 40),
          EventActualTime: at(21, 23),
        }),
      ],
      predictedEvents: [],
    });

    expect(
      events.find((event) => event.Key === "leg-1--arv-dock")?.EventActualTime
    ).toBeUndefined();
    expect(
      events.find((event) => event.Key === "leg-2--arv-dock")
    ).toMatchObject({
      EventActualTime: at(21, 23),
    });
  });

  it("consumes multiple same-terminal arrival actuals in order without reuse", () => {
    const events = mergeTimelineRows({
      scheduledEvents: [
        makeScheduledEvent({
          Key: "leg-1--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "BRE",
          ScheduledDeparture: at(18, 45),
          EventScheduledTime: at(19, 45),
        }),
        makeScheduledEvent({
          Key: "leg-2--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "BRE",
          ScheduledDeparture: at(21, 5),
          EventScheduledTime: at(22, 5),
        }),
      ],
      actualEvents: [
        makeActualEvent({
          Key: "replacement-1--arv-dock",
          TerminalAbbrev: "BRE",
          ScheduledDeparture: at(19, 50),
          EventActualTime: at(21, 5),
        }),
        makeActualEvent({
          Key: "replacement-2--arv-dock",
          TerminalAbbrev: "BRE",
          ScheduledDeparture: at(22, 30),
          EventActualTime: at(23, 49),
        }),
      ],
      predictedEvents: [],
    });

    expect(
      events.find((event) => event.Key === "leg-1--arv-dock")
    ).toMatchObject({
      EventActualTime: at(21, 5),
    });
    expect(
      events.find((event) => event.Key === "leg-2--arv-dock")
    ).toMatchObject({
      EventActualTime: at(23, 49),
    });
  });

  it("ignores arrival actuals from different terminals and leaves departure behavior unchanged", () => {
    const events = mergeTimelineRows({
      scheduledEvents: [
        makeScheduledEvent({
          Key: "leg-1--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(18, 45),
          EventScheduledTime: at(18, 45),
        }),
        makeScheduledEvent({
          Key: "leg-1--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "BRE",
          ScheduledDeparture: at(18, 45),
          EventScheduledTime: at(19, 45),
        }),
      ],
      actualEvents: [
        makeActualEvent({
          Key: "leg-1--dep-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(18, 45),
          EventActualTime: at(20, 6),
        }),
        makeActualEvent({
          Key: "replacement-sea--arv-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(19, 50),
          EventActualTime: at(21, 5),
        }),
      ],
      predictedEvents: [],
    });

    expect(
      events.find((event) => event.Key === "leg-1--dep-dock")
    ).toMatchObject({
      EventActualTime: at(20, 6),
    });
    expect(
      events.find((event) => event.Key === "leg-1--arv-dock")?.EventActualTime
    ).toBeUndefined();
  });

  it("KIT characterization: poisoned future dep actual advances backbone ownership", () => {
    const events = mergeTimelineRows({
      scheduledEvents: [
        makeScheduledEvent({
          Key: "kit-1110--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "VAI",
          ScheduledDeparture: at(18, 10),
          EventScheduledTime: at(18, 10),
        }),
        makeScheduledEvent({
          Key: "kit-1110--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "FAU",
          ScheduledDeparture: at(18, 10),
          EventScheduledTime: at(18, 30),
        }),
        makeScheduledEvent({
          Key: "kit-1140--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "FAU",
          ScheduledDeparture: at(18, 40),
          EventScheduledTime: at(18, 40),
        }),
        makeScheduledEvent({
          Key: "kit-1140--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "SOU",
          ScheduledDeparture: at(18, 40),
          EventScheduledTime: at(19, 10),
        }),
      ],
      actualEvents: [
        makeActualEvent({
          Key: "kit-1110--dep-dock",
          TerminalAbbrev: "VAI",
          ScheduledDeparture: at(18, 10),
          EventActualTime: at(18, 12),
        }),
        makeActualEvent({
          Key: "kit-1140--dep-dock",
          TerminalAbbrev: "FAU",
          ScheduledDeparture: at(18, 40),
          EventActualTime: at(16, 58),
        }),
      ],
      predictedEvents: [],
    });

    expect(
      events.find((event) => event.Key === "kit-1140--dep-dock")
    ).toMatchObject({
      EventActualTime: at(16, 58),
    });
    expect(resolveActiveTimelineInterval(events)).toEqual({
      kind: "at-sea",
      startEventKey: "kit-1140--dep-dock",
      endEventKey: "kit-1140--arv-dock",
    });
  });

  it("ISS characterization: cancelled departure slot remains blank while replacement arrival reattaches", () => {
    const events = mergeTimelineRows({
      scheduledEvents: [
        makeScheduledEvent({
          Key: "iss-1830--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(17, 30),
          EventScheduledTime: at(18, 30),
        }),
        makeScheduledEvent({
          Key: "iss-1845--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(18, 45),
          EventScheduledTime: at(18, 45),
        }),
        makeScheduledEvent({
          Key: "iss-1945--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "BRE",
          ScheduledDeparture: at(18, 45),
          EventScheduledTime: at(19, 45),
        }),
      ],
      actualEvents: [
        makeActualEvent({
          Key: "replacement-iss--arv-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(18, 40),
          EventActualTime: at(18, 49),
        }),
      ],
      predictedEvents: [],
    });

    expect(
      events.find((event) => event.Key === "iss-1830--arv-dock")
    ).toMatchObject({
      EventActualTime: at(18, 49),
    });
    expect(
      events.find((event) => event.Key === "iss-1845--dep-dock")
        ?.EventActualTime
    ).toBeUndefined();
  });
});

describe("resolveActiveTimelineInterval", () => {
  it("uses the opening dock interval when no actual events exist", () => {
    const events = mergeTimelineRows({
      scheduledEvents: [
        makeScheduledEvent({
          Key: "trip-2--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "CLI",
          ScheduledDeparture: at(11, 0),
          EventScheduledTime: at(11, 0),
        }),
        makeScheduledEvent({
          Key: "trip-2--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "MUK",
          ScheduledDeparture: at(11, 0),
          EventScheduledTime: at(11, 35),
        }),
      ],
      actualEvents: [],
      predictedEvents: [],
    });

    expect(resolveActiveTimelineInterval(events)).toEqual({
      kind: "at-dock",
      startEventKey: null,
      endEventKey: "trip-2--dep-dock",
    });
  });

  it("returns the sea interval after the latest actual departure", () => {
    const events = mergeTimelineRows({
      scheduledEvents: [
        makeScheduledEvent({
          Key: "trip-1--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 0),
        }),
        makeScheduledEvent({
          Key: "trip-1--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "BBI",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 35),
        }),
      ],
      actualEvents: [
        makeActualEvent({
          Key: "trip-1--dep-dock",
          EventActualTime: at(8, 4),
        }),
      ],
      predictedEvents: [],
    });

    expect(resolveActiveTimelineInterval(events)).toEqual({
      kind: "at-sea",
      startEventKey: "trip-1--dep-dock",
      endEventKey: "trip-1--arv-dock",
    });
  });

  it("advances to the sea interval when departure occurrence is known but time is unknown", () => {
    const events = mergeTimelineRows({
      scheduledEvents: [
        makeScheduledEvent({
          Key: "trip-1--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 0),
        }),
        makeScheduledEvent({
          Key: "trip-1--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "BBI",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 35),
        }),
      ],
      actualEvents: [
        makeActualEvent({
          Key: "trip-1--dep-dock",
          EventOccurred: true,
          EventActualTime: undefined,
        }),
      ],
      predictedEvents: [],
    });

    expect(resolveActiveTimelineInterval(events)).toEqual({
      kind: "at-sea",
      startEventKey: "trip-1--dep-dock",
      endEventKey: "trip-1--arv-dock",
    });
  });

  it("returns the dock interval after the latest actual arrival", () => {
    const events = mergeTimelineRows({
      scheduledEvents: [
        makeScheduledEvent({
          Key: "trip-1--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "FAU",
          ScheduledDeparture: at(19, 0),
          EventScheduledTime: at(19, 0),
        }),
        makeScheduledEvent({
          Key: "trip-1--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "VAI",
          ScheduledDeparture: at(19, 0),
          EventScheduledTime: at(19, 30),
        }),
        makeScheduledEvent({
          Key: "trip-2--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "VAI",
          ScheduledDeparture: at(20, 15),
          EventScheduledTime: at(20, 15),
        }),
      ],
      actualEvents: [
        makeActualEvent({
          Key: "trip-1--arv-dock",
          TerminalAbbrev: "VAI",
          ScheduledDeparture: at(19, 0),
          EventActualTime: at(19, 41),
        }),
      ],
      predictedEvents: [],
    });

    expect(resolveActiveTimelineInterval(events)).toEqual({
      kind: "at-dock",
      startEventKey: "trip-1--arv-dock",
      endEventKey: "trip-2--dep-dock",
    });
  });

  it("returns the terminal-tail dock interval after the day's last actual arrival", () => {
    const events = mergeTimelineRows({
      scheduledEvents: [
        makeScheduledEvent({
          Key: "trip-1--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "FAU",
          ScheduledDeparture: at(19, 0),
          EventScheduledTime: at(19, 0),
        }),
        makeScheduledEvent({
          Key: "trip-1--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "VAI",
          ScheduledDeparture: at(19, 0),
          EventScheduledTime: at(19, 30),
        }),
      ],
      actualEvents: [
        makeActualEvent({
          Key: "trip-1--arv-dock",
          TerminalAbbrev: "VAI",
          ScheduledDeparture: at(19, 0),
          EventActualTime: at(19, 36),
        }),
      ],
      predictedEvents: [],
    });

    expect(resolveActiveTimelineInterval(events)).toEqual({
      kind: "at-dock",
      startEventKey: "trip-1--arv-dock",
      endEventKey: null,
    });
  });

  it("ignores predicted times when determining ownership", () => {
    const events = mergeTimelineRows({
      scheduledEvents: [
        makeScheduledEvent({
          Key: "trip-1--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "ORI",
          ScheduledDeparture: at(15, 20),
          EventScheduledTime: at(15, 20),
        }),
        makeScheduledEvent({
          Key: "trip-1--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "SHI",
          ScheduledDeparture: at(15, 20),
          EventScheduledTime: at(15, 45),
        }),
      ],
      actualEvents: [],
      predictedEvents: [
        makePredictedEvent({
          Key: "trip-1--dep-dock",
          ScheduledDeparture: at(15, 20),
          TerminalAbbrev: "ORI",
          EventPredictedTime: at(15, 10),
        }),
      ],
    });

    expect(resolveActiveTimelineInterval(events)).toEqual({
      kind: "at-dock",
      startEventKey: null,
      endEventKey: "trip-1--dep-dock",
    });
  });

  it("treats legacy actual-time rows as occurred even without EventOccurred", () => {
    const events = mergeTimelineRows({
      scheduledEvents: [
        makeScheduledEvent({
          Key: "trip-1--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "ORI",
          ScheduledDeparture: at(15, 20),
          EventScheduledTime: at(15, 20),
        }),
        makeScheduledEvent({
          Key: "trip-1--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "SHI",
          ScheduledDeparture: at(15, 20),
          EventScheduledTime: at(15, 45),
        }),
      ],
      actualEvents: [
        makeActualEvent({
          Key: "trip-1--dep-dock",
          EventOccurred: undefined,
          EventActualTime: at(15, 24),
        }),
      ],
      predictedEvents: [],
    });

    expect(resolveActiveTimelineInterval(events)).toEqual({
      kind: "at-sea",
      startEventKey: "trip-1--dep-dock",
      endEventKey: "trip-1--arv-dock",
    });
  });

  it("returns null when the latest actual boundary has no matching interval", () => {
    const events = mergeTimelineRows({
      scheduledEvents: [
        makeScheduledEvent({
          Key: "trip-1--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(23, 50),
          EventScheduledTime: at(23, 50),
        }),
      ],
      actualEvents: [
        makeActualEvent({
          Key: "trip-1--dep-dock",
          ScheduledDeparture: at(23, 50),
          EventActualTime: at(23, 55),
        }),
      ],
      predictedEvents: [],
    });

    expect(resolveActiveTimelineInterval(events)).toBeNull();
  });
});

const makeScheduledEvent = (
  overrides: Partial<ConvexScheduledDockEvent> & { SegmentKey?: never }
): ConvexScheduledDockEvent => ({
  Key: "trip-1--dep-dock",
  VesselAbbrev: "WEN",
  SailingDay: "2026-03-25",
  UpdatedAt: at(6, 0),
  ScheduledDeparture: at(8, 0),
  TerminalAbbrev: "P52",
  NextTerminalAbbrev: "BBI",
  EventType: "dep-dock",
  EventScheduledTime: at(8, 0),
  IsLastArrivalOfSailingDay: false,
  ...overrides,
});

const makeActualEvent = (
  overrides: Partial<ConvexActualDockEvent> & { Key?: string }
): ConvexActualDockEvent => {
  const legacyBoundary = overrides.Key ?? "trip-1--dep-dock";
  const merged = {
    VesselAbbrev: "WEN" as const,
    SailingDay: "2026-03-25" as const,
    UpdatedAt: at(6, 0),
    ScheduledDeparture: at(8, 0),
    TerminalAbbrev: "P52",
    EventOccurred: true as const,
    EventActualTime: at(8, 2) as number | undefined,
    ...overrides,
  };
  const eventType =
    merged.EventType ??
    (legacyBoundary.includes("arv-dock") ? "arv-dock" : "dep-dock");
  const segment =
    "ScheduleKey" in overrides
      ? overrides.ScheduleKey
      : getSegmentKeyFromBoundaryKey(legacyBoundary);
  const tripKey =
    merged.TripKey ?? `TST 2026-03-25 12:00:00Z ${segment ?? "trip-1"}`;
  const EventKey =
    merged.EventKey ?? buildPhysicalActualEventKey(tripKey, eventType);

  return {
    ...merged,
    EventKey,
    TripKey: tripKey,
    ScheduleKey: segment,
    EventType: eventType,
  };
};

const makePredictedEvent = (
  overrides: Partial<ConvexPredictedDockEvent>
): ConvexPredictedDockEvent => ({
  Key: "trip-1--dep-dock",
  VesselAbbrev: "WEN",
  SailingDay: "2026-03-25",
  UpdatedAt: at(6, 0),
  ScheduledDeparture: at(8, 0),
  TerminalAbbrev: "P52",
  EventPredictedTime: at(8, 5),
  PredictionType: "AtDockDepartCurr",
  PredictionSource: "ml",
  ...overrides,
});
