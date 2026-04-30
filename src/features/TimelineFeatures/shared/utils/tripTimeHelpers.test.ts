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
  it("returns TripEnd when present", () => {
    expect(
      getCoverageEndTime({
        TripEnd: d(100),
      } as VesselTrip)
    ).toEqual(d(100));
  });
});

describe("hasTripCoverageEnded", () => {
  it("is true when TripEnd is set", () => {
    expect(hasTripCoverageEnded({ TripEnd: d(1) } as VesselTrip)).toBeTrue();
  });

  it("is false when neither is set", () => {
    expect(hasTripCoverageEnded({} as VesselTrip)).toBeFalse();
  });
});

describe("getTripListKeyTimeMs", () => {
  it("uses TripStart when present", () => {
    expect(
      getTripListKeyTimeMs({
        TripStart: d(100),
      } as VesselTrip)
    ).toBe(100);
  });
});

describe("getBestDepartureTime", () => {
  it("prefers LeftDockActual over raw LeftDock", () => {
    const t = {
      LeftDockActual: d(300),
      LeftDock: d(400),
    } as VesselTrip;
    expect(getBestDepartureTime(undefined, t)).toEqual(d(300));
  });
});

describe("getDestinationArrivalOrCoverageClose", () => {
  it("returns TripEnd", () => {
    const t = {
      TripEnd: d(500),
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
  it("prefers TripEnd", () => {
    const t = {
      TripEnd: d(500),
    } as VesselTrip;
    expect(getBestArrivalTime(undefined, t)).toEqual(d(500));
  });
});
