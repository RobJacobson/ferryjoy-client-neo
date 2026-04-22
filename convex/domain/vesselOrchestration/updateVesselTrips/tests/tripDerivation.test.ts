import { describe, expect, it } from "bun:test";
import {
  deriveTripInputs,
  getDockDepartureState,
} from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/tripDerivation";
import { resolveDebouncedPhysicalBoundaries } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/physicalDockSeaDebounce";
import {
  makeLocation,
  makeTrip,
  ms,
} from "../tripFields/tests/testHelpers";

describe("tripDerivation", () => {
  it("derives schedule-facing trip inputs from the prepared location", () => {
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

    const derived = deriveTripInputs(undefined, preparedLocation);

    expect(derived.currentArrivingTerminalAbbrev).toBe("VAI");
    expect(derived.currentScheduledDeparture).toBe(
      ms("2026-04-04T18:45:00-07:00")
    );
    expect(derived.startScheduleKey).toBe("CAT--2026-04-04--18:45--SOU-VAI");
    expect(derived.startSailingDay).toBe("2026-04-04");
    expect(derived.continuingScheduleKey).toBe(
      "CAT--2026-04-04--18:45--SOU-VAI"
    );
    expect(derived.previousCompletedTrip).toBeUndefined();
  });

  it("keeps prior completed-trip context only when the persisted trip has lifecycle evidence", () => {
    const existingTrip = makeTrip({
      LeftDock: ms("2026-03-13T11:02:00-07:00"),
      LeftDockActual: ms("2026-03-13T11:02:00-07:00"),
    });

    const derived = deriveTripInputs(existingTrip, makeLocation());

    expect(derived.previousCompletedTrip).toBe(existingTrip);
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

    const physicalBoundaries = resolveDebouncedPhysicalBoundaries(
      existingTrip,
      currLocation
    );
    const departureState = getDockDepartureState(
      existingTrip,
      currLocation,
      physicalBoundaries
    );

    expect(departureState.leftDockTime).toBeUndefined();
    expect(departureState.didJustLeaveDock).toBe(false);
  });
});
