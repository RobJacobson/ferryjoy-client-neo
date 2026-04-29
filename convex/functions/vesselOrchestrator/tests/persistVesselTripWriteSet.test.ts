import { describe, expect, it } from "bun:test";
import type { ActionCtx } from "_generated/server";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";
import {
  persistActiveVesselTrip,
  persistCompletedVesselTrip,
} from "../pipeline/updateVesselTrip";

const ms = (iso: string) => new Date(iso).getTime();

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
  LeftDockActual: ms("2026-03-13T05:29:38-07:00"),
  ArrivedCurrActual: ms("2026-03-13T04:33:00-07:00"),
  ArrivedNextActual: undefined,
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

describe("split trip persistence helpers", () => {
  it("persists one completed row", async () => {
    const completedChe = makeTrip("CHE");
    const mutationCalls: unknown[] = [];
    const ctx = {
      runMutation: async (_mutation: unknown, args: unknown) => {
        mutationCalls.push(args);
        return null;
      },
    } as unknown as ActionCtx;

    await persistCompletedVesselTrip(ctx, completedChe);

    expect(mutationCalls).toHaveLength(1);
    expect(mutationCalls[0]).toEqual({ completedTrip: completedChe });
  });

  it("persists one active row", async () => {
    const activeTac = makeTrip("TAC");
    const mutationCalls: unknown[] = [];
    const ctx = {
      runMutation: async (_mutation: unknown, args: unknown) => {
        mutationCalls.push(args);
        return null;
      },
    } as unknown as ActionCtx;

    await persistActiveVesselTrip(ctx, activeTac);

    expect(mutationCalls).toHaveLength(1);
    expect(mutationCalls[0]).toEqual({ activeTrip: activeTac });
  });
});
