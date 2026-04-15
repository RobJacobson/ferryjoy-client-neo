import { describe, expect, it } from "bun:test";
import { hydrateStoredTripsWithPredictions } from "./hydrateTripPredictions";
import type { ConvexVesselTripStored } from "./schemas";

const ms = (iso: string) => new Date(iso).getTime();

const makeCtx = () =>
  ({
    db: {
      query: () => ({
        withIndex: () => ({
          collect: async () => [],
        }),
      }),
    },
  }) as any;

const makeTrip = (): ConvexVesselTripStored => ({
  VesselAbbrev: "CHE",
  DepartingTerminalAbbrev: "SOU",
  ArrivingTerminalAbbrev: "VAI",
  RouteAbbrev: "f-v-s",
  TripKey: "CHE--2026-03-13--05:30--SOU-VAI",
  ScheduleKey: "CHE--2026-03-13--05:30--SOU-VAI",
  SailingDay: "2026-03-13",
  PrevTerminalAbbrev: "FAU",
  ArriveOriginDockActual: ms("2026-03-13T09:30:00-07:00"),
  ArriveDestDockActual: ms("2026-03-13T11:05:00-07:00"),
  DepartOriginActual: ms("2026-03-13T10:05:00-07:00"),
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

describe("hydrateStoredTripsWithPredictions", () => {
  it("preserves canonical timestamp fields when hydrating query trips", async () => {
    const trip = makeTrip();
    const [hydrated] = await hydrateStoredTripsWithPredictions(makeCtx(), [
      trip,
    ]);

    expect(hydrated.ArriveOriginDockActual).toBe(trip.ArriveOriginDockActual);
    expect(hydrated.ArriveDestDockActual).toBe(trip.ArriveDestDockActual);
    expect(hydrated.DepartOriginActual).toBe(trip.DepartOriginActual);
    expect(hydrated.StartTime).toBe(trip.StartTime);
    expect(hydrated.EndTime).toBe(trip.EndTime);
  });
});
