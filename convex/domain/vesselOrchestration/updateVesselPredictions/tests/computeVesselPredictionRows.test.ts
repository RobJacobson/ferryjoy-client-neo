import { describe, expect, it } from "bun:test";
import { updateVesselPredictions } from "domain/vesselOrchestration/updateVesselPredictions";
import type { ConvexVesselTripWithPredictions } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";

const ms = (iso: string) => new Date(iso).getTime();

const makeTrip = (
  overrides: Partial<ConvexVesselTripWithPredictions> = {}
): ConvexVesselTripWithPredictions => ({
  VesselAbbrev: "CHE",
  DepartingTerminalAbbrev: "ORI",
  ArrivingTerminalAbbrev: "LOP",
  RouteAbbrev: "ana-sj",
  TripKey: generateTripKey("CHE", ms("2026-03-13T09:00:00-07:00")),
  ScheduleKey: "CHE--2026-03-13--09:30--ORI-LOP",
  SailingDay: "2026-03-13",
  PrevTerminalAbbrev: "SHI",
  TripStart: ms("2026-03-13T09:00:00-07:00"),
  TripEnd: undefined,
  AtDock: true,
  AtDockDuration: 10,
  ScheduledDeparture: ms("2026-03-13T09:30:00-07:00"),
  LeftDock: undefined,
  LeftDockActual: undefined,
  TripDelay: 4,
  Eta: undefined,
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: ms("2026-03-13T09:10:00-07:00"),
  PrevScheduledDeparture: ms("2026-03-13T08:10:00-07:00"),
  PrevLeftDock: ms("2026-03-13T08:12:00-07:00"),
  NextScheduleKey: "CHE--2026-03-13--10:15--LOP-ANA",
  NextScheduledDeparture: ms("2026-03-13T10:15:00-07:00"),
  AtDockDepartCurr: undefined,
  AtDockArriveNext: undefined,
  AtDockDepartNext: undefined,
  AtSeaArriveNext: undefined,
  AtSeaDepartNext: undefined,
  ...overrides,
});

const richContext = {
  productionModelsByPair: {
    "ORI->LOP": {
      "at-dock-depart-curr": {
        featureKeys: [],
        coefficients: [],
        intercept: 3,
        testMetrics: { mae: 1, stdDev: 1 },
      },
      "at-dock-arrive-next": {
        featureKeys: [],
        coefficients: [],
        intercept: 20,
        testMetrics: { mae: 1, stdDev: 1 },
      },
      "at-dock-depart-next": {
        featureKeys: [],
        coefficients: [],
        intercept: 45,
        testMetrics: { mae: 1, stdDev: 1 },
      },
    },
  },
};

describe("updateVesselPredictions", () => {
  it("computes prediction rows and timeline ML handoffs from active trips", async () => {
    const trip = makeTrip();

    const output = await updateVesselPredictions({
      tripUpdate: {
        vesselAbbrev: trip.VesselAbbrev,
        existingActiveTrip: undefined,
        activeVesselTripUpdate: trip,
        completedVesselTripUpdate: undefined,
      },
      predictionContext: richContext,
    });

    expect(output.mlTimelineOverlays).toHaveLength(1);
    expect(output.predictionRows).toHaveLength(3);
    expect(
      output.mlTimelineOverlays[0]?.finalPredictedTrip?.AtDockDepartCurr
        ?.PredTime
    ).toBe(ms("2026-03-13T09:33:00-07:00"));
  });

  it("computes completed-handoff replacement predictions from the replacement trip", async () => {
    const trip = makeTrip();
    const completedTrip = makeTrip({
      LeftDockActual: ms("2026-03-13T09:31:00-07:00"),
      TripEnd: ms("2026-03-13T10:05:00-07:00"),
    });
    const replacementTrip = makeTrip({
      TripKey: generateTripKey("CHE", ms("2026-03-13T10:06:00-07:00")),
      ScheduleKey: "CHE--2026-03-13--10:10--ORI-LOP",
      AtDock: true,
      LeftDockActual: undefined,
    });

    const output = await updateVesselPredictions({
      tripUpdate: {
        vesselAbbrev: trip.VesselAbbrev,
        existingActiveTrip: trip,
        activeVesselTripUpdate: replacementTrip,
        completedVesselTripUpdate: completedTrip,
      },
      predictionContext: richContext,
    });

    expect(output.mlTimelineOverlays).toHaveLength(2);
    const completedOverlay = output.mlTimelineOverlays.find(
      (entry) => entry.branch === "completed"
    );
    const currentOverlay = output.mlTimelineOverlays.find(
      (entry) => entry.branch === "current"
    );
    expect(completedOverlay?.completedHandoffKey).toBe(
      `${completedTrip.VesselAbbrev}::${completedTrip.ScheduleKey}`
    );
    expect(completedOverlay?.finalPredictedTrip).toBeDefined();
    expect(currentOverlay?.finalPredictedTrip).toBeDefined();
  });

  it("returns no prediction rows when the preload has no models", async () => {
    const trip = makeTrip();

    const output = await updateVesselPredictions({
      tripUpdate: {
        vesselAbbrev: trip.VesselAbbrev,
        existingActiveTrip: undefined,
        activeVesselTripUpdate: trip,
        completedVesselTripUpdate: undefined,
      },
      predictionContext: {},
    });

    expect(output.predictionRows).toEqual([]);
    expect(output.mlTimelineOverlays[0]?.finalPredictedTrip).toEqual(trip);
  });
});
