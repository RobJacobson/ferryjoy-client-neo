/**
 * Tests for query enrichment of stored trips with `eventsPredicted` joins.
 */

import { describe, expect, it } from "bun:test";
import type { DataModel } from "_generated/dataModel";
import type { GenericQueryCtx } from "convex/server";
import { enrichTripsWithPredictions } from "domain/vesselTrips/read/enrichTripsWithPredictions";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

const ms = (iso: string) => new Date(iso).getTime();

const makeCtx = (): Pick<GenericQueryCtx<DataModel>, "db"> =>
  ({
    db: {
      query: () => ({
        withIndex: () => ({
          collect: async () => [],
        }),
      }),
    },
  }) as unknown as Pick<GenericQueryCtx<DataModel>, "db">;

const makeTrip = (): ConvexVesselTrip => ({
  VesselAbbrev: "CHE",
  DepartingTerminalAbbrev: "SOU",
  ArrivingTerminalAbbrev: "VAI",
  RouteAbbrev: "f-v-s",
  TripKey: "CHE--2026-03-13--05:30--SOU-VAI",
  ScheduleKey: "CHE--2026-03-13--05:30--SOU-VAI",
  SailingDay: "2026-03-13",
  PrevTerminalAbbrev: "FAU",
  ArrivedCurrActual: ms("2026-03-13T09:30:00-07:00"),
  ArrivedNextActual: ms("2026-03-13T11:05:00-07:00"),
  StartTime: ms("2026-03-13T07:00:00-07:00"),
  EndTime: ms("2026-03-13T13:00:00-07:00"),
  ArriveDest: ms("2026-03-13T11:10:00-07:00"),
  AtDockActual: ms("2026-03-13T09:30:00-07:00"),
  TripStart: ms("2026-03-13T09:35:00-07:00"),
  AtDock: true,
  AtDockDuration: 35,
  ScheduledDeparture: ms("2026-03-13T10:00:00-07:00"),
  LeftDock: ms("2026-03-13T10:15:00-07:00"),
  LeftDockActual: ms("2026-03-13T10:05:00-07:00"),
  TripDelay: 5,
  Eta: ms("2026-03-13T11:15:00-07:00"),
  TripEnd: ms("2026-03-13T11:20:00-07:00"),
  AtSeaDuration: 60,
  TotalDuration: 95,
  InService: true,
  TimeStamp: ms("2026-03-13T09:00:00-07:00"),
  PrevScheduledDeparture: ms("2026-03-13T08:00:00-07:00"),
  PrevLeftDock: ms("2026-03-13T07:20:00-07:00"),
  NextScheduleKey: "CHE--2026-03-13--07:00--VAI-ORI",
  NextScheduledDeparture: ms("2026-03-13T11:15:00-07:00"),
});

describe("enrichTripsWithPredictions", () => {
  it("preserves canonical timestamp fields when enriching query trips", async () => {
    const trip = makeTrip();
    const [enriched] = await enrichTripsWithPredictions(makeCtx(), [
      trip,
    ]);

    expect(enriched.ArrivedCurrActual).toBe(trip.ArrivedCurrActual);
    expect(enriched.ArrivedNextActual).toBe(trip.ArrivedNextActual);
    expect(enriched.LeftDockActual).toBe(trip.LeftDockActual);
    expect(enriched.StartTime).toBe(trip.StartTime);
    expect(enriched.EndTime).toBe(trip.EndTime);
  });
});
