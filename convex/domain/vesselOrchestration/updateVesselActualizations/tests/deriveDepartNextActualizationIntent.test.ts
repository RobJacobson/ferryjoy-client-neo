import { describe, expect, it } from "bun:test";
import type { VesselTripUpdate } from "domain/vesselOrchestration/updateVesselTrip";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";
import { deriveDepartNextActualizationIntent } from "../deriveDepartNextActualizationIntent";

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
  LeftDockActual: ms("2026-03-13T05:29:38.909-07:00"),
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

const makeTripUpdate = (
  overrides: Partial<VesselTripUpdate> = {}
): VesselTripUpdate => ({
  vesselAbbrev: "TAC",
  existingActiveTrip: makeTrip("TAC", {
    AtDock: true,
    LeftDock: undefined,
    LeftDockActual: undefined,
  }),
  activeVesselTripUpdate: makeTrip("TAC", {
    AtDock: false,
    LeftDockActual: ms("2026-03-13T06:40:00.789-07:00"),
  }),
  completedVesselTripUpdate: undefined,
  ...overrides,
});

describe("deriveDepartNextActualizationIntent", () => {
  it("returns intent for leave-dock transitions with schedule key", () => {
    const result = deriveDepartNextActualizationIntent(makeTripUpdate());

    expect(result).toEqual({
      vesselAbbrev: "TAC",
      depBoundaryKey: "TAC--2026-03-13--05:30--ANA-ORI--dep-dock",
      actualDepartMs: ms("2026-03-13T06:40:00.000-07:00"),
    });
  });

  it("returns null when transition is not didJustLeaveDock", () => {
    const result = deriveDepartNextActualizationIntent(
      makeTripUpdate({
        existingActiveTrip: makeTrip("TAC", { AtDock: false }),
      })
    );

    expect(result).toBeNull();
  });

  it("returns null when LeftDockActual is missing", () => {
    const result = deriveDepartNextActualizationIntent(
      makeTripUpdate({
        activeVesselTripUpdate: makeTrip("TAC", {
          AtDock: false,
          LeftDockActual: undefined,
        }),
      })
    );

    expect(result).toBeNull();
  });

  it("returns null when ScheduleKey is missing", () => {
    const result = deriveDepartNextActualizationIntent(
      makeTripUpdate({
        activeVesselTripUpdate: makeTrip("TAC", {
          AtDock: false,
          ScheduleKey: undefined,
        }),
      })
    );

    expect(result).toBeNull();
  });
});
