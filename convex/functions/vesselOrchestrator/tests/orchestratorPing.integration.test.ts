/**
 * Integration-style tests for `updateVesselOrchestrator`: verifies stage wiring
 * (locations mutation → optional per-vessel persist) with mocked domain branches.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from "bun:test";
import type { ActionCtx } from "_generated/server";
import * as adapters from "adapters";
import * as updateTimelineModule from "domain/vesselOrchestration/updateTimeline";
import * as updateVesselPredictionsModule from "domain/vesselOrchestration/updateVesselPredictions";
import * as updateVesselTripModule from "domain/vesselOrchestration/updateVesselTrip";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";
import type { VesselLocation as WsfVesselLocation } from "ws-dottie/wsf-vessels/core";
import { updateVesselOrchestrator } from "../actions";

type InternalActionHandler = (
  ctx: ActionCtx,
  args: Record<string, never>
) => Promise<null>;

const ms = (iso: string) => new Date(iso).getTime();

afterEach(() => {
  mock.restore();
});

const orchestratorSnapshot = {
  vesselsIdentity: [
    { VesselID: 2, VesselName: "Chelan", VesselAbbrev: "CHE" },
    { VesselID: 3, VesselName: "Tacoma", VesselAbbrev: "TAC" },
  ],
  terminalsIdentity: [
    {
      TerminalID: 1,
      TerminalName: "Anacortes",
      TerminalAbbrev: "ANA",
      Latitude: 48.507351,
      Longitude: -122.677,
    },
    {
      TerminalID: 15,
      TerminalName: "Orcas Island",
      TerminalAbbrev: "ORI",
      Latitude: 48.597313,
      Longitude: -122.92935,
    },
  ],
};

const makeTrip = (
  vesselAbbrev: string,
  overrides: Partial<ConvexVesselTrip> = {}
): ConvexVesselTrip => ({
  VesselAbbrev: vesselAbbrev,
  DepartingTerminalAbbrev: "ANA",
  ArrivingTerminalAbbrev: "ORI",
  RouteAbbrev: "ana-sj",
  TripKey: generateTripKey(vesselAbbrev, ms("2026-03-13T04:33:00-07:00")),
  ScheduleKey: `${vesselAbbrev}--2026-03-13--05:30--ANA-ORI`,
  SailingDay: "2026-03-13",
  PrevTerminalAbbrev: "ORI",
  TripEnd: undefined,
  TripStart: ms("2026-03-13T04:33:00-07:00"),
  AtDock: false,
  AtDockDuration: undefined,
  ScheduledDeparture: ms("2026-03-13T05:30:00-07:00"),
  LeftDock: ms("2026-03-13T05:29:38-07:00"),
  TripDelay: undefined,
  Eta: undefined,
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: ms("2026-03-13T06:28:45-07:00"),
  PrevScheduledDeparture: ms("2026-03-12T19:30:00-07:00"),
  PrevLeftDock: ms("2026-03-12T19:34:26-07:00"),
  NextScheduleKey: undefined,
  NextScheduledDeparture: undefined,
  ...overrides,
});

const makeRawLocation = (
  overrides: Partial<WsfVesselLocation> = {}
): WsfVesselLocation =>
  ({
    VesselID: 2,
    VesselName: "Chelan",
    DepartingTerminalID: 1,
    DepartingTerminalName: "Anacortes",
    DepartingTerminalAbbrev: "ANA",
    ArrivingTerminalID: 15,
    ArrivingTerminalName: "Orcas Island",
    ArrivingTerminalAbbrev: "ORI",
    Latitude: 48.5,
    Longitude: -122.6,
    Speed: 12,
    Heading: 180,
    InService: true,
    AtDock: false,
    LeftDock: undefined,
    Eta: undefined,
    ScheduledDeparture: new Date("2026-03-13T05:30:00-07:00"),
    OpRouteAbbrev: ["ana-sj"],
    VesselPositionNum: 1,
    TimeStamp: new Date("2026-03-31T12:00:00-07:00"),
    ...overrides,
  }) as unknown as WsfVesselLocation;

describe("updateVesselOrchestrator ping integration", () => {
  beforeEach(() => {
    spyOn(console, "log").mockImplementation(() => {});
  });

  it("persists location then active trip when trip stage returns writes", async () => {
    spyOn(adapters, "fetchRawWsfVesselLocations").mockResolvedValue([
      makeRawLocation(),
    ]);

    const activeTripWithMl = {
      ...makeTrip("CHE"),
      AtDockDepartNext: {
        PredTime: ms("2026-03-13T05:35:00-07:00"),
        MinTime: ms("2026-03-13T05:30:00-07:00"),
        MaxTime: ms("2026-03-13T05:40:00-07:00"),
        MAE: 3,
        StdDev: 2,
      },
    } as unknown as ConvexVesselTrip;

    const tripSpy = spyOn(
      updateVesselTripModule,
      "updateVesselTrip"
    ).mockResolvedValue({
      vesselAbbrev: "CHE",
      existingVesselTrip: undefined,
      activeVesselTrip: activeTripWithMl,
    });
    const predictionSpy = spyOn(
      updateVesselPredictionsModule,
      "updateVesselPredictions"
    ).mockResolvedValue({
      predictionRows: [],
      mlTimelineOverlays: [],
    });
    const timelineSpy = spyOn(
      updateTimelineModule,
      "updateTimeline"
    ).mockReturnValue({
      actualEvents: [],
      predictedEvents: [],
    });

    const mutationCalls: unknown[] = [];
    let runQueryCalls = 0;
    const ctx = {
      runQuery: async () => {
        runQueryCalls += 1;
        if (runQueryCalls === 1) {
          return {
            vesselsIdentity: orchestratorSnapshot.vesselsIdentity.slice(0, 1),
            terminalsIdentity: orchestratorSnapshot.terminalsIdentity,
          };
        }
        return [];
      },
      runMutation: async (_mutation: unknown, args: unknown) => {
        mutationCalls.push(args);
        return mutationCalls.length === 1
          ? {
              changedLocations: [makeNormalizedCheLocation()],
              activeTripsForChanged: [],
            }
          : null;
      },
    } as unknown as ActionCtx;

    await (
      updateVesselOrchestrator as unknown as { _handler: InternalActionHandler }
    )._handler(ctx, {});

    // Identities, then prediction preload query (active trips come from bulk upsert mutation).
    expect(runQueryCalls).toBe(2);
    expect(tripSpy).toHaveBeenCalledTimes(1);
    expect(predictionSpy).toHaveBeenCalledTimes(1);
    expect(timelineSpy).toHaveBeenCalledTimes(1);

    expect(mutationCalls).toHaveLength(2);
    const vesselUpdateArgs = mutationCalls[1] as {
      activeVesselTrip: { VesselAbbrev: string; AtDockDepartNext?: unknown };
    };
    expect(vesselUpdateArgs.activeVesselTrip.VesselAbbrev).toBe("CHE");
    expect(vesselUpdateArgs.activeVesselTrip.AtDockDepartNext).toBeUndefined();
  });

  it("passes updateLeaveDockEventPatch to persist after leave-dock transition", async () => {
    spyOn(adapters, "fetchRawWsfVesselLocations").mockResolvedValue([
      makeRawLocation(),
    ]);

    const existingActiveTrip = makeTrip("CHE", {
      AtDock: true,
      LeftDockActual: undefined,
      LeftDock: undefined,
    });
    spyOn(updateVesselTripModule, "updateVesselTrip").mockResolvedValue({
      vesselAbbrev: "CHE",
      existingVesselTrip: existingActiveTrip,
      activeVesselTrip: makeTrip("CHE", {
        AtDock: false,
        LeftDockActual: ms("2026-03-13T06:40:00.321-07:00"),
      }),
    });
    spyOn(
      updateVesselPredictionsModule,
      "updateVesselPredictions"
    ).mockResolvedValue({
      predictionRows: [],
      mlTimelineOverlays: [],
    });
    spyOn(updateTimelineModule, "updateTimeline").mockReturnValue({
      actualEvents: [],
      predictedEvents: [],
    });

    const mutationCalls: unknown[] = [];
    let runQueryCalls = 0;
    const ctx = {
      runQuery: async () => {
        runQueryCalls += 1;
        if (runQueryCalls === 1) {
          return {
            vesselsIdentity: orchestratorSnapshot.vesselsIdentity.slice(0, 1),
            terminalsIdentity: orchestratorSnapshot.terminalsIdentity,
          };
        }
        return [];
      },
      runMutation: async (_mutation: unknown, args: unknown) => {
        mutationCalls.push(args);
        return mutationCalls.length === 1
          ? {
              changedLocations: [makeNormalizedCheLocation()],
              activeTripsForChanged: [existingActiveTrip],
            }
          : null;
      },
    } as unknown as ActionCtx;

    await (
      updateVesselOrchestrator as unknown as { _handler: InternalActionHandler }
    )._handler(ctx, {});

    expect(runQueryCalls).toBe(2);
    expect(mutationCalls).toHaveLength(2);
    const vesselUpdateArgs = mutationCalls[1] as {
      activeVesselTrip: { VesselAbbrev: string };
      updateLeaveDockEventPatch: {
        vesselAbbrev: string;
        depBoundaryKey: string;
        actualDepartMs: number;
      };
    };
    expect(vesselUpdateArgs.activeVesselTrip.VesselAbbrev).toBe("CHE");
    expect(vesselUpdateArgs.updateLeaveDockEventPatch).toEqual({
      vesselAbbrev: "CHE",
      depBoundaryKey: "CHE--2026-03-13--05:30--ANA-ORI--dep-dock",
      actualDepartMs: ms("2026-03-13T06:40:00.000-07:00"),
    });
  });

  it("skips persist when trip stage returns null", async () => {
    spyOn(adapters, "fetchRawWsfVesselLocations").mockResolvedValue([
      makeRawLocation(),
    ]);

    spyOn(updateVesselTripModule, "updateVesselTrip").mockResolvedValue(null);
    const predictionSpy = spyOn(
      updateVesselPredictionsModule,
      "updateVesselPredictions"
    );
    const timelineSpy = spyOn(updateTimelineModule, "updateTimeline");

    const mutationCalls: unknown[] = [];
    const ctx = {
      runQuery: async () => ({
        vesselsIdentity: orchestratorSnapshot.vesselsIdentity.slice(0, 1),
        terminalsIdentity: orchestratorSnapshot.terminalsIdentity,
      }),
      runMutation: async (_mutation: unknown, args: unknown) => {
        mutationCalls.push(args);
        return { changedLocations: [], activeTripsForChanged: [] };
      },
    } as unknown as ActionCtx;

    await (
      updateVesselOrchestrator as unknown as { _handler: InternalActionHandler }
    )._handler(ctx, {});

    expect(mutationCalls).toHaveLength(1);
    expect(predictionSpy).toHaveBeenCalledTimes(0);
    expect(timelineSpy).toHaveBeenCalledTimes(0);
  });

  it("continues other vessels when one vessel pipeline throws", async () => {
    spyOn(adapters, "fetchRawWsfVesselLocations").mockResolvedValue([
      makeRawLocation({
        VesselID: 2,
        VesselName: "Chelan",
      }),
      makeRawLocation({
        VesselID: 3,
        VesselName: "Tacoma",
        TimeStamp: new Date("2026-03-31T12:00:05-07:00"),
      }),
    ]);

    spyOn(updateVesselTripModule, "updateVesselTrip").mockImplementation(
      async (vesselLocation) => {
        if (vesselLocation.VesselAbbrev === "CHE") {
          throw new Error("simulated CHE branch failure");
        }
        return {
          vesselAbbrev: "TAC",
          existingVesselTrip: undefined,
          activeVesselTrip: makeTrip("TAC"),
        };
      }
    );
    spyOn(
      updateVesselPredictionsModule,
      "updateVesselPredictions"
    ).mockResolvedValue({
      predictionRows: [],
      mlTimelineOverlays: [],
    });
    spyOn(updateTimelineModule, "updateTimeline").mockReturnValue({
      actualEvents: [],
      predictedEvents: [],
    });

    const consoleErrorSpy = spyOn(console, "error").mockImplementation(
      () => {}
    );

    const mutationCalls: unknown[] = [];
    let runQueryCalls = 0;
    const ctx = {
      runQuery: async () => {
        runQueryCalls += 1;
        if (runQueryCalls === 1) {
          return {
            vesselsIdentity: orchestratorSnapshot.vesselsIdentity,
            terminalsIdentity: orchestratorSnapshot.terminalsIdentity,
          };
        }
        return [];
      },
      runMutation: async (_mutation: unknown, args: unknown) => {
        mutationCalls.push(args);
        if (mutationCalls.length === 1) {
          return {
            changedLocations: [
              makeNormalizedCheLocation(),
              makeNormalizedTacLocation(),
            ],
            activeTripsForChanged: [],
          };
        }
        return null;
      },
    } as unknown as ActionCtx;

    await (
      updateVesselOrchestrator as unknown as { _handler: InternalActionHandler }
    )._handler(ctx, {});

    expect(runQueryCalls).toBe(2);
    expect(mutationCalls.length).toBe(2);
    const vesselUpdateArgs = mutationCalls[1] as {
      activeVesselTrip: { VesselAbbrev: string };
    };
    expect(vesselUpdateArgs.activeVesselTrip.VesselAbbrev).toBe("TAC");

    expect(consoleErrorSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    const errorPayload = consoleErrorSpy.mock.calls.find(
      (call) =>
        typeof call[0] === "string" &&
        call[0].includes("per-vessel pipeline failed")
    );
    expect(errorPayload).toBeDefined();
  });
});

/** Convex-shaped location returned from bulk upsert / domain normalization path (minimal fields). */
function makeNormalizedCheLocation(): Record<string, unknown> {
  return {
    VesselID: 2,
    VesselAbbrev: "CHE",
    VesselName: "Chelan",
    DepartingTerminalID: 1,
    Speed: 12,
    Heading: 180,
    Latitude: 48.5,
    Longitude: -122.6,
    DepartingTerminalName: "Anacortes",
    DepartingTerminalAbbrev: "ANA",
    ArrivingTerminalID: 15,
    ArrivingTerminalName: "Orcas",
    ArrivingTerminalAbbrev: "ORI",
    AtDock: false,
    LeftDock: ms("2026-03-13T05:29:38-07:00"),
    Eta: undefined,
    ScheduledDeparture: ms("2026-03-13T05:30:00-07:00"),
    VesselPositionNum: 1,
    InService: true,
    TimeStamp: ms("2026-03-31T12:00:00-07:00"),
    RouteAbbrev: "ana-sj",
    AtDockObserved: false,
    ScheduleKey: "CHE--2026-03-13--05:30--ANA-ORI",
  };
}

function makeNormalizedTacLocation() {
  return {
    ...makeNormalizedCheLocation(),
    VesselID: 3,
    VesselAbbrev: "TAC",
    VesselName: "Tacoma",
    TimeStamp: ms("2026-03-31T12:00:05-07:00"),
    ScheduleKey: "TAC--2026-03-13--05:30--ANA-ORI",
  };
}
