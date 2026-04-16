import { describe, expect, it } from "bun:test";
import type { ProcessVesselTripsOptions } from "domain/vesselTrips";
import { computeShouldRunPredictionFallback } from "domain/vesselTrips";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { TickActiveTrip } from "functions/vesselTrips/schemas";
import { runVesselOrchestratorTick } from "../runVesselOrchestratorTick";
import type { VesselOrchestratorTickDeps } from "../types";

const emptyTickEventWrites = {
  actualDockWrites: [] as never[],
  predictedDockWriteBatches: [] as never[],
};

const baseTripResult = {
  tickStartedAt: 0,
  tickEventWrites: emptyTickEventWrites,
};

const makeLocation = (
  overrides: Partial<ConvexVesselLocation> = {}
): ConvexVesselLocation => ({
  VesselID: 2,
  VesselName: "Chelan",
  VesselAbbrev: "CHE",
  DepartingTerminalID: 1,
  DepartingTerminalName: "Anacortes",
  DepartingTerminalAbbrev: "ANA",
  ArrivingTerminalID: 15,
  ArrivingTerminalName: "Orcas Island",
  ArrivingTerminalAbbrev: "ORI",
  Latitude: 48,
  Longitude: -122,
  Speed: 0,
  Heading: 0,
  InService: true,
  AtDock: true,
  LeftDock: undefined,
  Eta: undefined,
  ScheduledDeparture: undefined,
  RouteAbbrev: "ana-sj",
  VesselPositionNum: 1,
  TimeStamp: new Date("2026-03-13T03:08:47-07:00").getTime(),
  ScheduleKey: undefined,
  DepartingDistance: 0,
  ArrivingDistance: undefined,
  ...overrides,
});

describe("runVesselOrchestratorTick", () => {
  const passengerAbbrevs = new Set(["ANA", "ORI"]);
  const tickStartedAt = new Date("2026-06-01T12:00:02Z").getTime();

  it("isolates location branch failure from trip branch success", async () => {
    const deps: VesselOrchestratorTickDeps = {
      persistLocations: async () => {
        throw new Error("bulk upsert failed");
      },
      processVesselTrips: async () => ({
        ...baseTripResult,
        tickStartedAt,
      }),
      applyTickEventWrites: async () => {},
    };

    const result = await runVesselOrchestratorTick(
      {
        convexLocations: [makeLocation()],
        passengerTerminalAbbrevs: passengerAbbrevs,
        tickStartedAt,
        activeTrips: [],
      },
      deps
    );

    expect(result.locationsSuccess).toBe(false);
    expect(result.tripsSuccess).toBe(true);
    expect(result.errors?.locations?.message).toBe("bulk upsert failed");
    expect(result.errors?.trips).toBeUndefined();
  });

  it("isolates trip branch failure from location branch success", async () => {
    const deps: VesselOrchestratorTickDeps = {
      persistLocations: async () => {},
      processVesselTrips: async () => {
        throw new Error("trip pipeline failed");
      },
      applyTickEventWrites: async () => {},
    };

    const result = await runVesselOrchestratorTick(
      {
        convexLocations: [makeLocation()],
        passengerTerminalAbbrevs: passengerAbbrevs,
        tickStartedAt,
        activeTrips: [],
      },
      deps
    );

    expect(result.locationsSuccess).toBe(true);
    expect(result.tripsSuccess).toBe(false);
    expect(result.errors?.trips?.message).toBe("trip pipeline failed");
    expect(result.errors?.locations).toBeUndefined();
  });

  it("runs applyTickEventWrites after processVesselTrips resolves", async () => {
    const order: string[] = [];
    const deps: VesselOrchestratorTickDeps = {
      persistLocations: async () => {},
      processVesselTrips: async () => {
        order.push("processVesselTrips");
        return { ...baseTripResult, tickStartedAt };
      },
      applyTickEventWrites: async () => {
        order.push("applyTickEventWrites");
      },
    };

    await runVesselOrchestratorTick(
      {
        convexLocations: [makeLocation()],
        passengerTerminalAbbrevs: passengerAbbrevs,
        tickStartedAt,
        activeTrips: [],
      },
      deps
    );

    expect(order).toEqual(["processVesselTrips", "applyTickEventWrites"]);
  });

  it("passes only trip-eligible locations to processVesselTrips", async () => {
    let received: ConvexVesselLocation[] = [];
    const ineligible = makeLocation({
      DepartingTerminalAbbrev: "EAH",
      ArrivingTerminalAbbrev: "EAH",
    });
    const eligible = makeLocation();

    const deps: VesselOrchestratorTickDeps = {
      persistLocations: async () => {},
      processVesselTrips: async (locations) => {
        received = [...locations];
        return { ...baseTripResult, tickStartedAt };
      },
      applyTickEventWrites: async () => {},
    };

    await runVesselOrchestratorTick(
      {
        convexLocations: [ineligible, eligible],
        passengerTerminalAbbrevs: passengerAbbrevs,
        tickStartedAt,
        activeTrips: [],
      },
      deps
    );

    expect(received).toHaveLength(1);
    expect(received[0]?.DepartingTerminalAbbrev).toBe("ANA");
  });

  it("passes shouldRunPredictionFallback from computeShouldRunPredictionFallback", async () => {
    let optionsSeen: ProcessVesselTripsOptions | undefined;
    const deps: VesselOrchestratorTickDeps = {
      persistLocations: async () => {},
      processVesselTrips: async (_l, _t, _a, options) => {
        optionsSeen = options;
        return { ...baseTripResult, tickStartedAt };
      },
      applyTickEventWrites: async () => {},
    };

    await runVesselOrchestratorTick(
      {
        convexLocations: [makeLocation()],
        passengerTerminalAbbrevs: passengerAbbrevs,
        tickStartedAt,
        activeTrips: [],
      },
      deps
    );

    expect(optionsSeen?.shouldRunPredictionFallback).toBe(
      computeShouldRunPredictionFallback(tickStartedAt)
    );
  });

  it("omits errors when both branches succeed", async () => {
    const deps: VesselOrchestratorTickDeps = {
      persistLocations: async () => {},
      processVesselTrips: async () => ({
        ...baseTripResult,
        tickStartedAt,
      }),
      applyTickEventWrites: async () => {},
    };

    const result = await runVesselOrchestratorTick(
      {
        convexLocations: [makeLocation()],
        passengerTerminalAbbrevs: passengerAbbrevs,
        tickStartedAt,
        activeTrips: [] as TickActiveTrip[],
      },
      deps
    );

    expect(result.locationsSuccess).toBe(true);
    expect(result.tripsSuccess).toBe(true);
    expect(result.errors).toBeUndefined();
  });
});
