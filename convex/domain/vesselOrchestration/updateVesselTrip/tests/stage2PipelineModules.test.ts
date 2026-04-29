/**
 * Focused tests for Stage 2 pipeline modules (local fixtures only; do not import
 * `tripFields/tests/testHelpers` so this suite stays independent of that folder).
 */

import { describe, expect, it } from "bun:test";
import type { ConvexScheduledDockEvent } from "functions/events/eventsScheduled/schemas";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";
import type { UpdateVesselTripDbAccess } from "../types";
import { buildActiveTrip } from "../buildActiveTrip";
import { completeTrip } from "../completeTrip";
import { didLeaveDock, isNewTrip, leftDockTimeForUpdate } from "../lifecycleSignals";
import { applyScheduleForActiveTrip } from "../scheduleForActiveTrip";

const ms = (iso: string): number => new Date(iso).getTime();

const makeLocation = (
  overrides: Partial<ConvexVesselLocation> = {}
): ConvexVesselLocation => ({
  VesselID: 1,
  VesselName: "Chelan",
  VesselAbbrev: "CHE",
  DepartingTerminalID: 1,
  DepartingTerminalName: "Clinton",
  DepartingTerminalAbbrev: "CLI",
  ArrivingTerminalID: 2,
  ArrivingTerminalName: "Mukilteo",
  ArrivingTerminalAbbrev: "MUK",
  Latitude: 47.98,
  Longitude: -122.35,
  Speed: 0,
  Heading: 0,
  InService: true,
  AtDock: true,
  LeftDock: undefined,
  Eta: undefined,
  ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
  RouteAbbrev: "muk-cl",
  VesselPositionNum: 1,
  TimeStamp: ms("2026-03-13T11:08:00-07:00"),
  ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
  DepartingDistance: 0,
  ArrivingDistance: undefined,
  ...overrides,
  AtDockObserved: overrides.AtDockObserved ?? true,
});

const makeTrip = (
  overrides: Partial<ConvexVesselTrip> = {}
): ConvexVesselTrip => ({
  VesselAbbrev: "CHE",
  DepartingTerminalAbbrev: "CLI",
  ArrivingTerminalAbbrev: "MUK",
  RouteAbbrev: "muk-cl",
  TripKey: generateTripKey("CHE", ms("2026-03-13T11:08:00-07:00")),
  ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
  SailingDay: "2026-03-13",
  PrevTerminalAbbrev: "MUK",
  ArriveDest: undefined,
  AtDockActual: ms("2026-03-13T10:30:00-07:00"),
  TripStart: ms("2026-03-13T10:30:00-07:00"),
  AtDock: true,
  AtDockDuration: undefined,
  ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
  LeftDock: undefined,
  LeftDockActual: undefined,
  TripDelay: undefined,
  Eta: undefined,
  NextScheduleKey: undefined,
  NextScheduledDeparture: undefined,
  TripEnd: undefined,
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: ms("2026-03-13T11:08:00-07:00"),
  PrevScheduledDeparture: ms("2026-03-13T09:30:00-07:00"),
  PrevLeftDock: ms("2026-03-13T09:34:00-07:00"),
  ...overrides,
});

const makeDepartureEvent = (
  overrides: Partial<ConvexScheduledDockEvent> = {}
): ConvexScheduledDockEvent => ({
  Key: "CHE--2026-03-13--07:00--ORI-LOP--dep-dock",
  VesselAbbrev: "CHE",
  SailingDay: "2026-03-13",
  UpdatedAt: 1,
  ScheduledDeparture: ms("2026-03-13T07:00:00-07:00"),
  TerminalAbbrev: "ORI",
  NextTerminalAbbrev: "LOP",
  EventType: "dep-dock",
  ...overrides,
});

const makeDbAccess = (options: {
  terminalIdentityByAbbrev?: Record<string, TerminalIdentity | null>;
  scheduledDepartureByKey?: Record<string, ConvexScheduledDockEvent | null>;
  scheduledDockEventsBySailingDay?: Record<string, ConvexScheduledDockEvent[]>;
  throwOnAnyCall?: boolean;
  /** Fails if `getScheduledDepartureEvent` or `getScheduledDockEvents` run. */
  forbidScheduledEventReads?: boolean;
} = {}): {
  dbAccess: UpdateVesselTripDbAccess;
  counters: {
    getTerminalIdentity: number;
    getScheduledDepartureEvent: number;
    getScheduledDockEvents: number;
  };
} => {
  const counters = {
    getTerminalIdentity: 0,
    getScheduledDepartureEvent: 0,
    getScheduledDockEvents: 0,
  };

  const failIfGuarded = (name: keyof typeof counters) => {
    if (options.throwOnAnyCall) {
      throw new Error(`${name} should not be called`);
    }
  };

  const defaultTerminal = (terminalAbbrev: string): TerminalIdentity => ({
    TerminalID: 1,
    TerminalName: terminalAbbrev,
    TerminalAbbrev: terminalAbbrev,
    IsPassengerTerminal: true,
    Latitude: 47,
    Longitude: -122,
    UpdatedAt: 1,
  });

  const dbAccess: UpdateVesselTripDbAccess = {
    getTerminalIdentity: async (terminalAbbrev) => {
      counters.getTerminalIdentity += 1;
      failIfGuarded("getTerminalIdentity");
      const terminal = options.terminalIdentityByAbbrev?.[terminalAbbrev];
      return terminal === undefined ? defaultTerminal(terminalAbbrev) : terminal;
    },
    getScheduledDepartureEvent: async (scheduleKey) => {
      counters.getScheduledDepartureEvent += 1;
      if (options.forbidScheduledEventReads) {
        throw new Error("getScheduledDepartureEvent should not be called");
      }
      failIfGuarded("getScheduledDepartureEvent");
      if (options.scheduledDepartureByKey?.[scheduleKey] !== undefined) {
        return options.scheduledDepartureByKey[scheduleKey] ?? null;
      }
      const boundaryKey = `${scheduleKey}--dep-dock`;
      return options.scheduledDepartureByKey?.[boundaryKey] ?? null;
    },
    getScheduledDockEvents: async (_vesselAbbrev, sailingDay) => {
      counters.getScheduledDockEvents += 1;
      if (options.forbidScheduledEventReads) {
        throw new Error("getScheduledDockEvents should not be called");
      }
      failIfGuarded("getScheduledDockEvents");
      return options.scheduledDockEventsBySailingDay?.[sailingDay] ?? [];
    },
  };

  return { dbAccess, counters };
};

describe("stage-2 pipeline modules", () => {
  it("reports lifecycle transitions and left-dock precedence", () => {
    const previousTrip = makeTrip({
      DepartingTerminalAbbrev: "ANA",
      AtDock: true,
      LeftDock: undefined,
      LeftDockActual: undefined,
    });
    const location = makeLocation({
      DepartingTerminalAbbrev: "ORI",
      AtDockObserved: false,
      LeftDock: ms("2026-03-13T06:33:00-07:00"),
      TimeStamp: ms("2026-03-13T06:33:05-07:00"),
    });

    expect(isNewTrip(previousTrip, location)).toBe(true);
    expect(didLeaveDock(previousTrip, location)).toBe(true);
    expect(leftDockTimeForUpdate(previousTrip, location)).toBe(location.LeftDock);
  });

  it("builds completed trip closeout fields and durations on completion", () => {
    const previousTrip = makeTrip({
      ArrivingTerminalAbbrev: undefined,
      StartTime: ms("2026-03-13T04:33:00-07:00"),
      TripStart: ms("2026-03-13T04:33:00-07:00"),
      LeftDock: ms("2026-03-13T05:29:38-07:00"),
      LeftDockActual: undefined,
    });
    const location = makeLocation({
      DepartingTerminalAbbrev: "ORI",
      TimeStamp: ms("2026-03-13T06:29:56-07:00"),
    });

    const completedTrip = completeTrip(previousTrip, location);

    expect(completedTrip.EndTime).toBe(location.TimeStamp);
    expect(completedTrip.TripEnd).toBe(location.TimeStamp);
    expect(completedTrip.ArrivedNextActual).toBe(location.TimeStamp);
    expect(completedTrip.ArriveDest).toBe(location.TimeStamp);
    expect(completedTrip.ArrivingTerminalAbbrev).toBe("ORI");
    expect(completedTrip.AtSeaDuration).toBe(60.3);
    expect(completedTrip.TotalDuration).toBe(116.9);
  });

  it("keeps first-seen active trip arrival fields unset", () => {
    const location = makeLocation({
      AtDockObserved: true,
      TimeStamp: ms("2026-03-13T06:40:00-07:00"),
    });

    const activeTrip = buildActiveTrip({
      previousTrip: undefined,
      completedTrip: undefined,
      location,
      isNewTrip: false,
    });

    expect(activeTrip.TripKey).toBeString();
    expect(activeTrip.StartTime).toBe(location.TimeStamp);
    expect(activeTrip.TripStart).toBe(location.TimeStamp);
    expect(activeTrip.ArrivedCurrActual).toBeUndefined();
    expect(activeTrip.AtDockActual).toBeUndefined();
  });

  it("stamps LeftDockActual from LeftDock on dock-to-sea transition", () => {
    const previousTrip = makeTrip({
      AtDock: true,
      LeftDock: undefined,
      LeftDockActual: undefined,
    });
    const location = makeLocation({
      DepartingTerminalAbbrev: previousTrip.DepartingTerminalAbbrev,
      ArrivingTerminalAbbrev: previousTrip.ArrivingTerminalAbbrev,
      ScheduledDeparture: previousTrip.ScheduledDeparture,
      ScheduleKey: previousTrip.ScheduleKey,
      AtDockObserved: false,
      LeftDock: ms("2026-03-13T06:33:00-07:00"),
      TimeStamp: ms("2026-03-13T06:33:05-07:00"),
    });

    const activeTrip = buildActiveTrip({
      previousTrip,
      completedTrip: undefined,
      location,
      isNewTrip: false,
    });

    expect(activeTrip.AtDock).toBe(false);
    expect(activeTrip.LeftDockActual).toBe(location.LeftDock);
  });

  it("does not read DB for continuing incomplete WSF schedule fields", async () => {
    const previousTrip = makeTrip({
      ArrivingTerminalAbbrev: undefined,
      ScheduledDeparture: undefined,
      ScheduleKey: undefined,
    });
    const location = makeLocation({
      DepartingTerminalAbbrev: previousTrip.DepartingTerminalAbbrev,
      ArrivingTerminalAbbrev: undefined,
      ScheduledDeparture: undefined,
      ScheduleKey: undefined,
      AtDockObserved: previousTrip.AtDock,
      LeftDock: previousTrip.LeftDock,
      Eta: ms("2026-03-13T06:52:00-07:00"),
      TimeStamp: ms("2026-03-13T06:31:45-07:00"),
    });
    const activeTrip = buildActiveTrip({
      previousTrip,
      completedTrip: undefined,
      location,
      isNewTrip: false,
    });
    const { dbAccess, counters } = makeDbAccess({ throwOnAnyCall: true });

    const scheduledTrip = await applyScheduleForActiveTrip({
      activeTrip,
      previousTrip,
      completedTrip: undefined,
      location,
      isNewTrip: false,
      dbAccess,
    });

    expect(scheduledTrip.ScheduleKey).toBe(activeTrip.ScheduleKey);
    expect(counters.getTerminalIdentity).toBe(0);
    expect(counters.getScheduledDepartureEvent).toBe(0);
    expect(counters.getScheduledDockEvents).toBe(0);
  });

  it("infers schedule for replacement trip with incomplete WSF", async () => {
    const previousTrip = makeTrip({
      DepartingTerminalAbbrev: "ANA",
      ArrivingTerminalAbbrev: undefined,
      NextScheduleKey: "CHE--2026-03-13--07:00--ORI-LOP",
    });
    const location = makeLocation({
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: undefined,
      ScheduledDeparture: undefined,
      ScheduleKey: undefined,
      TimeStamp: ms("2026-03-13T06:47:00-07:00"),
    });
    const activeTrip = buildActiveTrip({
      previousTrip,
      completedTrip: undefined,
      location,
      isNewTrip: true,
    });
    const primaryDeparture = makeDepartureEvent({
      Key: "CHE--2026-03-13--07:00--ORI-LOP--dep-dock",
      ScheduledDeparture: ms("2026-03-13T07:00:00-07:00"),
      TerminalAbbrev: "ORI",
      NextTerminalAbbrev: "LOP",
      SailingDay: "2026-03-13",
    });
    const nextDeparture = makeDepartureEvent({
      Key: "CHE--2026-03-13--08:00--LOP-SHW--dep-dock",
      ScheduledDeparture: ms("2026-03-13T08:00:00-07:00"),
      TerminalAbbrev: "LOP",
      NextTerminalAbbrev: "SHW",
      SailingDay: "2026-03-13",
    });
    const { dbAccess, counters } = makeDbAccess({
      scheduledDepartureByKey: {
        "CHE--2026-03-13--07:00--ORI-LOP": primaryDeparture,
      },
      scheduledDockEventsBySailingDay: {
        "2026-03-13": [primaryDeparture, nextDeparture],
      },
    });

    const scheduledTrip = await applyScheduleForActiveTrip({
      activeTrip,
      previousTrip,
      completedTrip: undefined,
      location,
      isNewTrip: true,
      dbAccess,
    });

    expect(scheduledTrip.ArrivingTerminalAbbrev).toBe("LOP");
    expect(scheduledTrip.ScheduledDeparture).toBe(primaryDeparture.ScheduledDeparture);
    expect(scheduledTrip.ScheduleKey).toBe("CHE--2026-03-13--07:00--ORI-LOP");
    expect(scheduledTrip.SailingDay).toBe("2026-03-13");
    expect(scheduledTrip.NextScheduleKey).toBe("CHE--2026-03-13--08:00--LOP-SHW");
    expect(scheduledTrip.NextScheduledDeparture).toBe(
      nextDeparture.ScheduledDeparture
    );
    expect(counters.getTerminalIdentity).toBe(1);
    expect(counters.getScheduledDepartureEvent).toBeGreaterThan(0);
    expect(counters.getScheduledDockEvents).toBeGreaterThan(0);
  });

  it(
    "skips schedule inference when terminal identity is null for replacement incomplete WSF",
    async () => {
      const previousTrip = makeTrip({
        DepartingTerminalAbbrev: "ANA",
        ArrivingTerminalAbbrev: undefined,
        NextScheduleKey: "CHE--2026-03-13--07:00--ORI-LOP",
      });
      const location = makeLocation({
        DepartingTerminalAbbrev: "ORI",
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
        ScheduleKey: undefined,
        TimeStamp: ms("2026-03-13T06:47:00-07:00"),
        InService: true,
      });
      const activeTrip = buildActiveTrip({
        previousTrip,
        completedTrip: undefined,
        location,
        isNewTrip: true,
      });
      const { dbAccess, counters } = makeDbAccess({
        terminalIdentityByAbbrev: { ORI: null },
        forbidScheduledEventReads: true,
      });

      const scheduledTrip = await applyScheduleForActiveTrip({
        activeTrip,
        previousTrip,
        completedTrip: undefined,
        location,
        isNewTrip: true,
        dbAccess,
      });

      expect(scheduledTrip).toEqual(activeTrip);
      expect(counters.getTerminalIdentity).toBe(1);
      expect(counters.getScheduledDepartureEvent).toBe(0);
      expect(counters.getScheduledDockEvents).toBe(0);
    }
  );
});
