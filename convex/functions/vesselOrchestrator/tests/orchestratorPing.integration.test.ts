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
import * as updateVesselPredictionsModule from "domain/vesselOrchestration/updateVesselPredictions";
import * as updateTimelineModule from "domain/vesselOrchestration/updateTimeline";
import * as updateVesselTripModule from "domain/vesselOrchestration/updateVesselTrip";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";
import type { VesselLocation as WsfVesselLocation } from "ws-dottie/wsf-vessels/core";
import { updateVesselOrchestrator } from "../action";

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
  activeTrips: [],
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
  ArriveDest: undefined,
  TripStart: ms("2026-03-13T04:33:00-07:00"),
  AtDock: false,
  AtDockDuration: undefined,
  ScheduledDeparture: ms("2026-03-13T05:30:00-07:00"),
  LeftDock: ms("2026-03-13T05:29:38-07:00"),
  TripDelay: undefined,
  Eta: undefined,
  TripEnd: undefined,
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: ms("2026-03-13T06:28:45-07:00"),
  PrevScheduledDeparture: ms("2026-03-12T19:30:00-07:00"),
  PrevLeftDock: ms("2026-03-12T19:34:26-07:00"),
  NextScheduleKey: undefined,
  NextScheduledDeparture: undefined,
  EndTime: undefined,
  StartTime: ms("2026-03-13T04:33:00-07:00"),
  AtDockActual: ms("2026-03-13T04:33:00-07:00"),
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

  it("calls persistPerVesselOrchestratorWrites after locations when trip stage returns writes", async () => {
    spyOn(adapters, "fetchRawWsfVesselLocations").mockResolvedValue([
      makeRawLocation(),
    ]);

    const tripSpy = spyOn(updateVesselTripModule, "updateVesselTrip").mockResolvedValue(
      {
        vesselAbbrev: "CHE",
        existingActiveTrip: undefined,
        activeVesselTripUpdate: makeTrip("CHE"),
      }
    );
    const predictionSpy = spyOn(
      updateVesselPredictionsModule,
      "updateVesselPredictions"
    ).mockResolvedValue({
      predictionRows: [],
      mlTimelineOverlays: [],
    });
    const timelineSpy = spyOn(updateTimelineModule, "updateTimeline").mockReturnValue({
      actualEvents: [],
      predictedEvents: [],
    });

    const mutationCalls: unknown[] = [];
    let runQueryCallCount = 0;
    const ctx = {
      runQuery: async () => {
        runQueryCallCount += 1;
        if (runQueryCallCount === 1) {
          return {
            vesselsIdentity: orchestratorSnapshot.vesselsIdentity.slice(0, 1),
            terminalsIdentity: orchestratorSnapshot.terminalsIdentity,
            activeTrips: [],
          };
        }
        return [];
      },
      runMutation: async (_mutation: unknown, args: unknown) => {
        mutationCalls.push(args);
        return mutationCalls.length === 1 ? [makeNormalizedCheLocation()] : null;
      },
    } as unknown as ActionCtx;

    await (
      updateVesselOrchestrator as unknown as { _handler: InternalActionHandler }
    )._handler(ctx, {});

    expect(tripSpy).toHaveBeenCalledTimes(1);
    expect(predictionSpy).toHaveBeenCalledTimes(1);
    expect(timelineSpy).toHaveBeenCalledTimes(1);

    expect(mutationCalls).toHaveLength(2);
    const persistArgs = mutationCalls[1] as {
      vesselAbbrev: string;
      predictionRows: unknown[];
      actualEvents: unknown[];
      predictedEvents: unknown[];
    };
    expect(persistArgs.vesselAbbrev).toBe("CHE");
    expect(persistArgs.predictionRows).toEqual([]);
    expect(persistArgs.actualEvents).toEqual([]);
    expect(persistArgs.predictedEvents).toEqual([]);
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
    let runQueryCallCount = 0;
    const ctx = {
      runQuery: async () => {
        runQueryCallCount += 1;
        if (runQueryCallCount === 1) {
          return {
            vesselsIdentity: orchestratorSnapshot.vesselsIdentity.slice(0, 1),
            terminalsIdentity: orchestratorSnapshot.terminalsIdentity,
            activeTrips: [],
          };
        }
        return [];
      },
      runMutation: async (_mutation: unknown, args: unknown) => {
        mutationCalls.push(args);
        return [];
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
      makeRawLocation({ VesselID: 2, VesselName: "Chelan", VesselAbbrev: "CHE" }),
      makeRawLocation({
        VesselID: 3,
        VesselName: "Tacoma",
        TimeStamp: new Date("2026-03-31T12:00:05-07:00"),
      }),
    ]);

    spyOn(updateVesselTripModule, "updateVesselTrip").mockImplementation(
      async (input) => {
        if (input.vesselLocation.VesselAbbrev === "CHE") {
          throw new Error("simulated CHE branch failure");
        }
        return {
          vesselAbbrev: "TAC",
          existingActiveTrip: undefined,
          activeVesselTripUpdate: makeTrip("TAC"),
        };
      }
    );
    spyOn(updateVesselPredictionsModule, "updateVesselPredictions").mockResolvedValue({
      predictionRows: [],
      mlTimelineOverlays: [],
    });
    spyOn(updateTimelineModule, "updateTimeline").mockReturnValue({
      actualEvents: [],
      predictedEvents: [],
    });

    const consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});

    const mutationCalls: unknown[] = [];
    let runQueryCallCount = 0;
    const ctx = {
      runQuery: async () => {
        runQueryCallCount += 1;
        if (runQueryCallCount === 1) {
          return orchestratorSnapshot;
        }
        return [];
      },
      runMutation: async (_mutation: unknown, args: unknown) => {
        mutationCalls.push(args);
        if (mutationCalls.length === 1) {
          return [
            makeNormalizedCheLocation(),
            makeNormalizedTacLocation(),
          ];
        }
        return null;
      },
    } as unknown as ActionCtx;

    await (
      updateVesselOrchestrator as unknown as { _handler: InternalActionHandler }
    )._handler(ctx, {});

    expect(mutationCalls.length).toBe(2);
    const persistArgs = mutationCalls[1] as { vesselAbbrev: string };
    expect(persistArgs.vesselAbbrev).toBe("TAC");

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
