/**
 * Tests for {@link vesselTripPredictionProposalsFromMlTrip}.
 */

import { describe, expect, it } from "bun:test";
import { vesselTripPredictionProposalsFromMlTrip } from "domain/vesselOrchestration/updateVesselPredictions";
import type { ConvexVesselTripWithML } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";

const ms = (iso: string) => new Date(iso).getTime();

const baseTrip = (): ConvexVesselTripWithML => ({
  VesselAbbrev: "CHE",
  TripKey: generateTripKey("CHE", ms("2026-03-13T04:33:00-07:00")),
  DepartingTerminalAbbrev: "ANA",
  ArrivingTerminalAbbrev: "ORI",
  RouteAbbrev: "ana-sj",
  ScheduleKey: "CHE--sk",
  SailingDay: "2026-03-13",
  PrevTerminalAbbrev: "ORI",
  TripStart: ms("2026-03-13T04:33:00-07:00"),
  AtDock: true,
  ScheduledDeparture: ms("2026-03-13T05:30:00-07:00"),
  LeftDock: ms("2026-03-13T05:29:38-07:00"),
  InService: true,
  TimeStamp: ms("2026-03-13T06:28:45-07:00"),
});

describe("vesselTripPredictionProposalsFromMlTrip", () => {
  it("emits one proposal per defined prediction field", () => {
    const pred = {
      PredTime: 1,
      MinTime: 0,
      MaxTime: 2,
      MAE: 0.1,
      StdDev: 0.2,
    };
    const trip: ConvexVesselTripWithML = {
      ...baseTrip(),
      AtDockDepartCurr: pred,
      AtSeaDepartNext: pred,
    };

    const proposals = vesselTripPredictionProposalsFromMlTrip(trip);
    expect(proposals).toHaveLength(2);
    const types = proposals.map((p) => p.PredictionType);
    expect(types.sort()).toEqual(["AtDockDepartCurr", "AtSeaDepartNext"]);
    expect(proposals.every((p) => p.VesselAbbrev === "CHE")).toBe(true);
    expect(proposals.every((p) => p.TripKey === trip.TripKey)).toBe(true);
  });

  it("returns empty when no ML fields are present", () => {
    expect(vesselTripPredictionProposalsFromMlTrip(baseTrip())).toEqual([]);
  });
});
