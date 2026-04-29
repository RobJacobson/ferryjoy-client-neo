import { describe, expect, it } from "bun:test";
import type { ConvexScheduledDockEvent } from "functions/events/eventsScheduled/schemas";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";
import type { UpdateVesselTripDbAccess } from "../types";
import { updateVesselTrip } from "../updateVesselTrip";

const ms = (iso: string): number => new Date(iso).getTime();

const makeLocation = (
  overrides: Partial<ConvexVesselLocation> = {}
): ConvexVesselLocation => ({
  VesselID: 1,
  VesselAbbrev: "CHE",
  VesselName: "Chelan",
  DepartingTerminalID: 10,
  Speed: 15,
  Heading: 90,
  Latitude: 47.0,
  Longitude: -122.0,
  DepartingTerminalName: "Anacortes",
  DepartingTerminalAbbrev: "ANA",
  ArrivingTerminalID: 20,
  ArrivingTerminalName: "Orcas",
  ArrivingTerminalAbbrev: "ORI",
  AtDock: false,
  LeftDock: ms("2026-03-13T05:29:38-07:00"),
  Eta: undefined,
  ScheduledDeparture: ms("2026-03-13T05:30:00-07:00"),
  VesselPositionNum: 1,
  InService: true,
  TimeStamp: ms("2026-03-13T06:28:45-07:00"),
  RouteAbbrev: "ana-sj",
  ScheduleKey: "CHE--2026-03-13--05:30--ANA-ORI",
  DepartingDistance: 0,
  ArrivingDistance: undefined,
  ...overrides,
  AtDockObserved: overrides.AtDockObserved ?? false,
});

const makeTrip = (
  overrides: Partial<ConvexVesselTrip> = {}
): ConvexVesselTrip => ({
  VesselAbbrev: "CHE",
  DepartingTerminalAbbrev: "ANA",
  ArrivingTerminalAbbrev: "ORI",
  RouteAbbrev: "ana-sj",
  TripKey: generateTripKey("CHE", ms("2026-03-13T04:33:00-07:00")),
  ScheduleKey: "CHE--2026-03-13--05:30--ANA-ORI",
  SailingDay: "2026-03-13",
  PrevTerminalAbbrev: "ORI",
  ArriveDest: undefined,
  ArrivedCurrActual: ms("2026-03-13T04:33:00-07:00"),
  ArrivedNextActual: undefined,
  StartTime: ms("2026-03-13T04:33:00-07:00"),
  EndTime: undefined,
  AtDockActual: ms("2026-03-13T04:33:00-07:00"),
  TripStart: ms("2026-03-13T04:33:00-07:00"),
  AtDock: false,
  AtDockDuration: undefined,
  ScheduledDeparture: ms("2026-03-13T05:30:00-07:00"),
  LeftDock: ms("2026-03-13T05:29:38-07:00"),
  LeftDockActual: ms("2026-03-13T05:29:38-07:00"),
  TripDelay: undefined,
  Eta: undefined,
  TripEnd: undefined,
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: ms("2026-03-13T06:28:45-07:00"),
  PrevScheduledDeparture: ms("2026-03-12T19:30:00-07:00"),
  PrevLeftDock: ms("2026-03-12T19:34:26-07:00"),
  NextScheduleKey: "CHE--2026-03-13--07:00--ORI-LOP",
  NextScheduledDeparture: ms("2026-03-13T07:00:00-07:00"),
  ...overrides,
});

const makeDbAccess = (options: {
  terminalIdentityByAbbrev?: Record<string, TerminalIdentity | null>;
  scheduledDepartureByKey?: Record<string, ConvexScheduledDockEvent | null>;
  scheduledDockEventsBySailingDay?: Record<string, ConvexScheduledDockEvent[]>;
  throwOnAnyCall?: boolean;
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
    getTerminalIdentity: async (terminalAbbrev: string) => {
      counters.getTerminalIdentity += 1;
      failIfGuarded("getTerminalIdentity");
      const terminal = options.terminalIdentityByAbbrev?.[terminalAbbrev];
      return terminal === undefined ? defaultTerminal(terminalAbbrev) : terminal;
    },
    getScheduledDepartureEvent: async (scheduleKey: string) => {
      counters.getScheduledDepartureEvent += 1;
      failIfGuarded("getScheduledDepartureEvent");
      if (options.scheduledDepartureByKey?.[scheduleKey] !== undefined) {
        return options.scheduledDepartureByKey[scheduleKey] ?? null;
      }
      const boundaryKey = `${scheduleKey}--dep-dock`;
      return options.scheduledDepartureByKey?.[boundaryKey] ?? null;
    },
    getScheduledDockEvents: async (_vesselAbbrev: string, sailingDay: string) => {
      counters.getScheduledDockEvents += 1;
      failIfGuarded("getScheduledDockEvents");
      return options.scheduledDockEventsBySailingDay?.[sailingDay] ?? [];
    },
  };

  return { dbAccess, counters };
};

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

describe("updateVesselTrip", () => {
  it("creates a first-seen active trip without ArrivedCurrActual", async () => {
    const location = makeLocation({
      AtDockObserved: true,
      TimeStamp: ms("2026-03-13T06:40:00-07:00"),
    });
    const { dbAccess } = makeDbAccess({ throwOnAnyCall: true });

    const result = await updateVesselTrip(location, undefined, dbAccess);

    expect(result).not.toBeNull();
    expect(result?.completedVesselTripUpdate).toBeUndefined();
    expect(result?.activeVesselTripUpdate.TripKey).toBeString();
    expect(result?.activeVesselTripUpdate.StartTime).toBe(location.TimeStamp);
    expect(result?.activeVesselTripUpdate.TripStart).toBe(location.TimeStamp);
    expect(result?.activeVesselTripUpdate.ArrivedCurrActual).toBeUndefined();
  });

  it("returns null for continuing timestamp-only churn", async () => {
    const existingTrip = makeTrip({
      TimeStamp: ms("2026-03-13T06:28:45-07:00"),
      AtDockDuration: 56.6,
      TripDelay: -0.4,
    });
    const location = makeLocation({
      DepartingTerminalAbbrev: existingTrip.DepartingTerminalAbbrev,
      ArrivingTerminalAbbrev: existingTrip.ArrivingTerminalAbbrev,
      ScheduledDeparture: existingTrip.ScheduledDeparture,
      ScheduleKey: existingTrip.ScheduleKey,
      InService: existingTrip.InService,
      AtDockObserved: existingTrip.AtDock,
      LeftDock: existingTrip.LeftDock,
      Eta: existingTrip.Eta,
      TimeStamp: ms("2026-03-13T06:35:00-07:00"),
    });
    const { dbAccess } = makeDbAccess({ throwOnAnyCall: true });

    const result = await updateVesselTrip(location, existingTrip, dbAccess);
    expect(result).toBeNull();
  });

  it("returns an active update for continuing ETA change", async () => {
    const existingTrip = makeTrip({
      Eta: ms("2026-03-13T06:50:00-07:00"),
    });
    const location = makeLocation({
      DepartingTerminalAbbrev: existingTrip.DepartingTerminalAbbrev,
      ArrivingTerminalAbbrev: existingTrip.ArrivingTerminalAbbrev,
      ScheduledDeparture: existingTrip.ScheduledDeparture,
      ScheduleKey: existingTrip.ScheduleKey,
      InService: existingTrip.InService,
      AtDockObserved: existingTrip.AtDock,
      LeftDock: existingTrip.LeftDock,
      Eta: ms("2026-03-13T06:52:00-07:00"),
      TimeStamp: ms("2026-03-13T06:29:45-07:00"),
    });
    const { dbAccess } = makeDbAccess({ throwOnAnyCall: true });

    const result = await updateVesselTrip(location, existingTrip, dbAccess);

    expect(result?.activeVesselTripUpdate.Eta).toBe(location.Eta);
    expect(result?.completedVesselTripUpdate).toBeUndefined();
  });

  it("stamps LeftDockActual from LeftDock on dock-to-sea transition", async () => {
    const existingTrip = makeTrip({
      AtDock: true,
      LeftDock: undefined,
      LeftDockActual: undefined,
    });
    const location = makeLocation({
      DepartingTerminalAbbrev: existingTrip.DepartingTerminalAbbrev,
      ArrivingTerminalAbbrev: existingTrip.ArrivingTerminalAbbrev,
      ScheduledDeparture: existingTrip.ScheduledDeparture,
      ScheduleKey: existingTrip.ScheduleKey,
      AtDockObserved: false,
      LeftDock: ms("2026-03-13T06:33:00-07:00"),
      TimeStamp: ms("2026-03-13T06:33:05-07:00"),
    });
    const { dbAccess } = makeDbAccess({ throwOnAnyCall: true });

    const result = await updateVesselTrip(location, existingTrip, dbAccess);

    expect(result?.completedVesselTripUpdate).toBeUndefined();
    expect(result?.activeVesselTripUpdate.AtDock).toBe(false);
    expect(result?.activeVesselTripUpdate.LeftDockActual).toBe(location.LeftDock);
  });

  it("falls back LeftDockActual to TimeStamp when LeftDock is missing", async () => {
    const existingTrip = makeTrip({
      AtDock: true,
      LeftDock: undefined,
      LeftDockActual: undefined,
    });
    const location = makeLocation({
      DepartingTerminalAbbrev: existingTrip.DepartingTerminalAbbrev,
      ArrivingTerminalAbbrev: existingTrip.ArrivingTerminalAbbrev,
      ScheduledDeparture: existingTrip.ScheduledDeparture,
      ScheduleKey: existingTrip.ScheduleKey,
      AtDockObserved: false,
      LeftDock: undefined,
      TimeStamp: ms("2026-03-13T06:34:05-07:00"),
    });
    const { dbAccess } = makeDbAccess({ throwOnAnyCall: true });

    const result = await updateVesselTrip(location, existingTrip, dbAccess);
    expect(result?.activeVesselTripUpdate.LeftDockActual).toBe(location.TimeStamp);
  });

  it("completes previous trip and starts replacement on terminal change", async () => {
    const completionTime = ms("2026-03-13T06:45:00-07:00");
    const existingTrip = makeTrip({
      ArrivingTerminalAbbrev: undefined,
    });
    const location = makeLocation({
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: "LOP",
      AtDockObserved: true,
      TimeStamp: completionTime,
    });
    const { dbAccess } = makeDbAccess();

    const result = await updateVesselTrip(location, existingTrip, dbAccess);

    expect(result?.completedVesselTripUpdate).toBeDefined();
    expect(result?.activeVesselTripUpdate).toBeDefined();
    expect(result?.completedVesselTripUpdate?.EndTime).toBe(completionTime);
    expect(result?.completedVesselTripUpdate?.TripEnd).toBe(completionTime);
    expect(result?.completedVesselTripUpdate?.ArrivedNextActual).toBe(
      completionTime
    );
    expect(result?.completedVesselTripUpdate?.ArriveDest).toBe(completionTime);
    expect(result?.completedVesselTripUpdate?.ArrivingTerminalAbbrev).toBe("ORI");
    expect(result?.activeVesselTripUpdate.DepartingTerminalAbbrev).toBe("ORI");
    expect(result?.activeVesselTripUpdate.TripKey).not.toBe(existingTrip.TripKey);
    expect(result?.activeVesselTripUpdate.ArrivedCurrActual).toBe(completionTime);
  });

  it("trusts terminal change even when AtDockObserved is false", async () => {
    const existingTrip = makeTrip();
    const location = makeLocation({
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: "LOP",
      AtDockObserved: false,
      TimeStamp: ms("2026-03-13T06:46:00-07:00"),
    });
    const { dbAccess } = makeDbAccess();

    const result = await updateVesselTrip(location, existingTrip, dbAccess);

    expect(result?.completedVesselTripUpdate).toBeDefined();
    expect(result?.activeVesselTripUpdate.DepartingTerminalAbbrev).toBe("ORI");
  });

  it("does not schedule-read for continuing incomplete WSF fields", async () => {
    const existingTrip = makeTrip({
      ArrivingTerminalAbbrev: undefined,
      ScheduledDeparture: undefined,
      ScheduleKey: undefined,
      Eta: ms("2026-03-13T06:50:00-07:00"),
    });
    const location = makeLocation({
      DepartingTerminalAbbrev: existingTrip.DepartingTerminalAbbrev,
      ArrivingTerminalAbbrev: undefined,
      ScheduledDeparture: undefined,
      ScheduleKey: undefined,
      AtDockObserved: existingTrip.AtDock,
      LeftDock: existingTrip.LeftDock,
      Eta: ms("2026-03-13T06:52:00-07:00"),
      TimeStamp: ms("2026-03-13T06:31:45-07:00"),
    });
    const { dbAccess, counters } = makeDbAccess({ throwOnAnyCall: true });

    const result = await updateVesselTrip(location, existingTrip, dbAccess);

    expect(result).not.toBeNull();
    expect(counters.getTerminalIdentity).toBe(0);
    expect(counters.getScheduledDepartureEvent).toBe(0);
    expect(counters.getScheduledDockEvents).toBe(0);
  });

  it("may infer schedule fields for replacement trip with incomplete WSF", async () => {
    const existingTrip = makeTrip({
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

    const result = await updateVesselTrip(location, existingTrip, dbAccess);

    expect(result?.activeVesselTripUpdate.ArrivingTerminalAbbrev).toBe("LOP");
    expect(result?.activeVesselTripUpdate.ScheduledDeparture).toBe(
      primaryDeparture.ScheduledDeparture
    );
    expect(result?.activeVesselTripUpdate.ScheduleKey).toBe(
      "CHE--2026-03-13--07:00--ORI-LOP"
    );
    expect(result?.activeVesselTripUpdate.SailingDay).toBe("2026-03-13");
    expect(result?.activeVesselTripUpdate.NextScheduleKey).toBe(
      "CHE--2026-03-13--08:00--LOP-SHW"
    );
    expect(result?.activeVesselTripUpdate.NextScheduledDeparture).toBe(
      nextDeparture.ScheduledDeparture
    );
    expect(counters.getTerminalIdentity).toBe(1);
    expect(counters.getScheduledDepartureEvent).toBeGreaterThan(0);
    expect(counters.getScheduledDockEvents).toBeGreaterThan(0);
  });

  it("skips schedule lookup for out-of-service replacement trips", async () => {
    const existingTrip = makeTrip();
    const location = makeLocation({
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: undefined,
      ScheduledDeparture: undefined,
      ScheduleKey: undefined,
      InService: false,
      TimeStamp: ms("2026-03-13T06:48:00-07:00"),
    });
    const { dbAccess, counters } = makeDbAccess({ throwOnAnyCall: true });

    const result = await updateVesselTrip(location, existingTrip, dbAccess);

    expect(result?.completedVesselTripUpdate).toBeDefined();
    expect(result?.activeVesselTripUpdate).toBeDefined();
    expect(counters.getTerminalIdentity).toBe(0);
    expect(counters.getScheduledDepartureEvent).toBe(0);
    expect(counters.getScheduledDockEvents).toBe(0);
  });

  it("skips scheduled-event reads for non-passenger replacement trips", async () => {
    const existingTrip = makeTrip();
    const location = makeLocation({
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: undefined,
      ScheduledDeparture: undefined,
      ScheduleKey: undefined,
      TimeStamp: ms("2026-03-13T06:49:00-07:00"),
    });
    const { dbAccess, counters } = makeDbAccess({
      terminalIdentityByAbbrev: {
        ORI: {
          TerminalID: 2,
          TerminalName: "Orcas",
          TerminalAbbrev: "ORI",
          IsPassengerTerminal: false,
          Latitude: 48,
          Longitude: -122,
          UpdatedAt: 1,
        },
      },
    });

    const result = await updateVesselTrip(location, existingTrip, dbAccess);

    expect(result?.completedVesselTripUpdate).toBeDefined();
    expect(result?.activeVesselTripUpdate).toBeDefined();
    expect(counters.getTerminalIdentity).toBe(1);
    expect(counters.getScheduledDepartureEvent).toBe(0);
    expect(counters.getScheduledDockEvents).toBe(0);
  });
});
