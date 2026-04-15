/**
 * Tests for trip timestamp helpers (Stage 5 — canonical fields vs legacy mirrors).
 */

import { describe, expect, it } from "bun:test";
import type { VesselTrip } from "@/types";
import {
  getBestArrivalTime,
  getBestDepartureTime,
  getCoverageEndTime,
  getDestinationArrivalOrCoverageClose,
  getOriginArrivalActual,
  getTripListKeyTimeMs,
  hasTripCoverageEnded,
} from "./tripTimeHelpers";

const d = (ms: number) => new Date(ms);

describe("getCoverageEndTime", () => {
  it("prefers EndTime over TripEnd", () => {
    expect(
      getCoverageEndTime({
        EndTime: d(100),
        TripEnd: d(200),
      } as VesselTrip)
    ).toEqual(d(100));
  });
});

describe("hasTripCoverageEnded", () => {
  it("is true when EndTime is set", () => {
    expect(hasTripCoverageEnded({ EndTime: d(1) } as VesselTrip)).toBeTrue();
  });

  it("is true when only TripEnd is set", () => {
    expect(hasTripCoverageEnded({ TripEnd: d(1) } as VesselTrip)).toBeTrue();
  });

  it("is false when neither is set", () => {
    expect(hasTripCoverageEnded({} as VesselTrip)).toBeFalse();
  });
});

describe("getTripListKeyTimeMs", () => {
  it("prefers StartTime over legacy TripStart", () => {
    expect(
      getTripListKeyTimeMs({
        StartTime: d(100),
        TripStart: d(200),
      } as VesselTrip)
    ).toBe(100);
  });
});

describe("getBestDepartureTime", () => {
  it("prefers DepartOriginActual over raw LeftDock", () => {
    const t = {
      DepartOriginActual: d(300),
      LeftDock: d(400),
    } as VesselTrip;
    expect(getBestDepartureTime(undefined, t)).toEqual(d(300));
  });
});

describe("getDestinationArrivalOrCoverageClose", () => {
  it("prefers ArriveDestDockActual over EndTime", () => {
    const t = {
      ArriveDestDockActual: d(500),
      EndTime: d(600),
    } as VesselTrip;
    expect(getDestinationArrivalOrCoverageClose(t)).toEqual(d(500));
  });
});

describe("getOriginArrivalActual", () => {
  it("falls back to TripStart when canonical is absent", () => {
    expect(getOriginArrivalActual({ TripStart: d(50) } as VesselTrip)).toEqual(
      d(50)
    );
  });
});

describe("getBestArrivalTime", () => {
  it("prefers ArriveDestDockActual over EndTime", () => {
    const t = {
      ArriveDestDockActual: d(500),
      EndTime: d(600),
    } as VesselTrip;
    expect(getBestArrivalTime(undefined, t)).toEqual(d(500));
  });
});
