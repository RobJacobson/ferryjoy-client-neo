import { describe, expect, it } from "bun:test";
import type { TripEvents } from "domain/vesselOrchestration/updateVesselTrips/lifecycle";
import type { ResolvedCurrentTripFields } from "domain/vesselOrchestration/updateVesselTrips/tripFields/types";
import {
  resolvePhysicalState,
} from "domain/vesselOrchestration/updateVesselTrips/lifecycle";
import { baseTripFromLocation } from "domain/vesselOrchestration/updateVesselTrips/tripBuilders";
import { makeLocation, makeTrip, ms } from "../tripFields/tests/testHelpers";

const locationOnlyTripFieldResolution: ResolvedCurrentTripFields = {
  tripFieldDataSource: "wsf",
};

describe("tripDerivation", () => {
  it("derives schedule-facing trip inputs from the raw location when resolution adds no overrides", () => {
    const preparedLocation = makeLocation({
      VesselAbbrev: "CAT",
      DepartingTerminalAbbrev: "SOU",
      DepartingTerminalName: "Southworth",
      DepartingTerminalID: 20,
      ArrivingTerminalAbbrev: "VAI",
      ArrivingTerminalName: "Vashon Island",
      ArrivingTerminalID: 22,
      ScheduledDeparture: ms("2026-04-04T18:45:00-07:00"),
      ScheduleKey: undefined,
      TimeStamp: ms("2026-04-04T16:56:05-07:00"),
    });

    const derived = baseTripFromLocation(
      preparedLocation,
      undefined,
      false,
      locationOnlyTripFieldResolution,
      continuingEvents()
    );

    expect(derived.ArrivingTerminalAbbrev).toBe("VAI");
    expect(derived.ScheduledDeparture).toBe(
      ms("2026-04-04T18:45:00-07:00")
    );
    expect(derived.ScheduleKey).toBe("CAT--2026-04-04--18:45--SOU-VAI");
    expect(derived.SailingDay).toBe("2026-04-04");
    expect(derived.PrevTerminalAbbrev).toBeUndefined();
  });

  it("prefers resolved current-trip fields over raw location when both are present", () => {
    const rawLocation = makeLocation({
      VesselAbbrev: "CHE",
      DepartingTerminalAbbrev: "CLI",
      ArrivingTerminalAbbrev: undefined,
      ScheduledDeparture: undefined,
      ScheduleKey: undefined,
    });
    const resolved: ResolvedCurrentTripFields = {
      ArrivingTerminalAbbrev: "MUK",
      ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
      ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
      SailingDay: "2026-03-13",
      tripFieldDataSource: "inferred",
      tripFieldInferenceMethod: "next_scheduled_trip",
    };

    const derived = baseTripFromLocation(
      rawLocation,
      undefined,
      false,
      resolved,
      continuingEvents()
    );

    expect(derived.ArrivingTerminalAbbrev).toBe("MUK");
    expect(derived.ScheduledDeparture).toBe(
      ms("2026-03-13T11:00:00-07:00")
    );
    expect(derived.ScheduleKey).toBe("CHE--2026-03-13--11:00--CLI-MUK");
    expect(derived.SailingDay).toBe("2026-03-13");
  });

  it("keeps prior completed-trip context only when the persisted trip has lifecycle evidence", () => {
    const existingTrip = makeTrip({
      LeftDock: ms("2026-03-13T11:02:00-07:00"),
      LeftDockActual: ms("2026-03-13T11:02:00-07:00"),
    });

    const derived = baseTripFromLocation(
      makeLocation(),
      existingTrip,
      true,
      locationOnlyTripFieldResolution,
      continuingEvents()
    );

    expect(derived.PrevLeftDock).toBe(existingTrip.LeftDockActual);
  });

  it("suppresses a contradictory feed-only leave-dock stamp", () => {
    const existingTrip = makeTrip({
      AtDock: false,
      LeftDock: undefined,
      LeftDockActual: undefined,
    });
    const currLocation = makeLocation({
      AtDock: true,
      LeftDock: ms("2026-03-13T11:05:00-07:00"),
      Speed: 0,
      TimeStamp: ms("2026-03-13T11:05:30-07:00"),
    });

    const physicalState = resolvePhysicalState(existingTrip, currLocation);

    expect(physicalState.leftDockTime).toBeUndefined();
    expect(physicalState.didJustLeaveDock).toBe(false);
  });
});

const continuingEvents = (
  overrides: Partial<TripEvents> = {}
): Pick<TripEvents, "didJustLeaveDock" | "leftDockTime"> => ({
  didJustLeaveDock: false,
  leftDockTime: undefined,
  ...overrides,
});
