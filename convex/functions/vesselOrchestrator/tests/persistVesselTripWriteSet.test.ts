import { describe, expect, it, spyOn } from "bun:test";
import * as vesselTripWrites from "functions/vesselTrips/mutations";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";
import {
  type PerVesselTripPersistInput,
  persistVesselTripWrites,
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

describe("persistVesselTripWrites", () => {
  it("writes active only with no leave-dock follow-up", async () => {
    const existingTac = makeTrip("TAC", { AtDock: false });
    const updatedTac = makeTrip("TAC", {
      AtDock: true,
      LeftDockActual: undefined,
      TimeStamp: ms("2026-03-13T06:40:00-07:00"),
    });
    const input: PerVesselTripPersistInput = {
      vesselAbbrev: "TAC",
      existingActiveTrip: existingTac,
      activeVesselTrip: updatedTac,
      completedVesselTrip: undefined,
    };
    const writeActive = spyOn(
      vesselTripWrites,
      "writeActiveVesselTripInDb"
    ).mockResolvedValue(undefined);
    const rollover = spyOn(
      vesselTripWrites,
      "rolloverCompletedAndActiveInDb"
    ).mockResolvedValue(undefined);
    const setDepart = spyOn(
      vesselTripWrites,
      "setDepartNextActualsForMostRecentCompletedTripInDb"
    ).mockResolvedValue({ updated: true });

    await persistVesselTripWrites({} as never, input);

    expect(writeActive).toHaveBeenCalledWith({} as never, updatedTac);
    expect(rollover).toHaveBeenCalledTimes(0);
    expect(setDepart).toHaveBeenCalledTimes(0);

    writeActive.mockRestore();
    rollover.mockRestore();
    setDepart.mockRestore();
  });

  it("writes active only and runs leave-dock follow-up", async () => {
    const existingTac = makeTrip("TAC", { AtDock: true });
    const updatedTac = makeTrip("TAC", {
      AtDock: false,
      LeftDockActual: ms("2026-03-13T06:40:00-07:00"),
      TimeStamp: ms("2026-03-13T06:40:00-07:00"),
    });
    const input: PerVesselTripPersistInput = {
      vesselAbbrev: "TAC",
      existingActiveTrip: existingTac,
      activeVesselTrip: updatedTac,
      completedVesselTrip: undefined,
    };

    const writeActive = spyOn(
      vesselTripWrites,
      "writeActiveVesselTripInDb"
    ).mockResolvedValue(undefined);
    const rollover = spyOn(
      vesselTripWrites,
      "rolloverCompletedAndActiveInDb"
    ).mockResolvedValue(undefined);
    const setDepart = spyOn(
      vesselTripWrites,
      "setDepartNextActualsForMostRecentCompletedTripInDb"
    ).mockResolvedValue({ updated: true });

    await persistVesselTripWrites({} as never, input);

    expect(writeActive).toHaveBeenCalledTimes(1);
    expect(rollover).toHaveBeenCalledTimes(0);
    expect(setDepart).toHaveBeenCalledWith(
      {} as never,
      "TAC",
      updatedTac.LeftDockActual
    );

    writeActive.mockRestore();
    rollover.mockRestore();
    setDepart.mockRestore();
  });

  it("rollover when completed and active are both present", async () => {
    const existingChe = makeTrip("CHE", { AtDock: false });
    const completedChe = makeTrip("CHE", {
      TripEnd: ms("2026-03-13T06:45:00-07:00"),
      ArrivedNextActual: ms("2026-03-13T06:45:00-07:00"),
      ArriveDest: ms("2026-03-13T06:45:00-07:00"),
    });
    const replacementChe = makeTrip("CHE", {
      TripKey: generateTripKey("CHE", ms("2026-03-13T06:46:00-07:00")),
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: "LOP",
      ScheduleKey: "CHE--2026-03-13--06:50--ORI-LOP",
      AtDock: true,
      LeftDock: undefined,
      LeftDockActual: undefined,
      ArrivedCurrActual: ms("2026-03-13T06:46:00-07:00"),
      ArrivedNextActual: undefined,
    });
    const input: PerVesselTripPersistInput = {
      vesselAbbrev: "CHE",
      existingActiveTrip: existingChe,
      activeVesselTrip: replacementChe,
      completedVesselTrip: completedChe,
    };

    const writeActive = spyOn(
      vesselTripWrites,
      "writeActiveVesselTripInDb"
    ).mockResolvedValue(undefined);
    const rollover = spyOn(
      vesselTripWrites,
      "rolloverCompletedAndActiveInDb"
    ).mockResolvedValue(undefined);
    const setDepart = spyOn(
      vesselTripWrites,
      "setDepartNextActualsForMostRecentCompletedTripInDb"
    ).mockResolvedValue({ updated: true });

    await persistVesselTripWrites({} as never, input);

    expect(rollover).toHaveBeenCalledWith(
      {} as never,
      completedChe,
      replacementChe
    );
    expect(writeActive).toHaveBeenCalledTimes(0);
    expect(setDepart).toHaveBeenCalledTimes(0);

    writeActive.mockRestore();
    rollover.mockRestore();
    setDepart.mockRestore();
  });
});
