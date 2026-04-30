/**
 * Tests for merging stored trips with preloaded `eventsPredicted` rows.
 */

import { describe, expect, it } from "bun:test";
import { mergeTripsWithPredictions } from "functions/vesselTrips/read";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

const ms = (iso: string) => new Date(iso).getTime();

const makeTrip = (): ConvexVesselTrip => ({
  VesselAbbrev: "CHE",
  DepartingTerminalAbbrev: "SOU",
  ArrivingTerminalAbbrev: "VAI",
  RouteAbbrev: "f-v-s",
  TripKey: "CHE--2026-03-13--05:30--SOU-VAI",
  ScheduleKey: "CHE--2026-03-13--05:30--SOU-VAI",
  SailingDay: "2026-03-13",
  PrevTerminalAbbrev: "FAU",
  TripStart: ms("2026-03-13T09:30:00-07:00"),
  TripEnd: ms("2026-03-13T11:05:00-07:00"),
  AtDock: true,
  AtDockDuration: 35,
  ScheduledDeparture: ms("2026-03-13T10:00:00-07:00"),
  LeftDock: ms("2026-03-13T10:15:00-07:00"),
  LeftDockActual: ms("2026-03-13T10:05:00-07:00"),
  TripDelay: 5,
  Eta: ms("2026-03-13T11:15:00-07:00"),
  AtSeaDuration: 60,
  TotalDuration: 95,
  InService: true,
  TimeStamp: ms("2026-03-13T09:00:00-07:00"),
  PrevScheduledDeparture: ms("2026-03-13T08:00:00-07:00"),
  PrevLeftDock: ms("2026-03-13T07:20:00-07:00"),
  NextScheduleKey: "CHE--2026-03-13--07:00--VAI-ORI",
  NextScheduledDeparture: ms("2026-03-13T11:15:00-07:00"),
});

describe("mergeTripsWithPredictions", () => {
  it("preserves canonical timestamp fields when no predicted rows are present", () => {
    const trip = makeTrip();
    const [enriched] = mergeTripsWithPredictions([trip], new Map());

    expect(enriched.TripStart).toBe(trip.TripStart);
    expect(enriched.TripEnd).toBe(trip.TripEnd);
    expect(enriched.LeftDockActual).toBe(trip.LeftDockActual);
    expect(enriched.TripStart).toBe(trip.TripStart);
    expect(enriched.TripEnd).toBe(trip.TripEnd);
  });
});
