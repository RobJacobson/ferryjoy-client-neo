/**
 * Tests for the scheduled-trips transform pipeline, prefetch policies, and
 * estimate/link fields.
 */

import { describe, expect, it } from "bun:test";
import type { ConvexScheduledTrip } from "../../../functions/scheduledTrips/schemas";
import { applyPrefetchSchedulePolicies } from "../applyPrefetchSchedulePolicies";
import { buildInitialScheduledTripRow } from "../buildInitialScheduledTripRow";
import { runScheduleTransformPipeline } from "../runScheduleTransformPipeline";

const at = (hours: number, minutes: number) =>
  Date.UTC(2026, 2, 13, hours, minutes);

/**
 * Builds a minimal valid `ConvexScheduledTrip` for pipeline tests.
 *
 * @param overrides - Partial trip fields layered on defaults
 * @returns Full scheduled trip row
 */
const makeTrip = (
  overrides: Partial<ConvexScheduledTrip>
): ConvexScheduledTrip => ({
  VesselAbbrev: "TOK",
  DepartingTerminalAbbrev: "P52",
  ArrivingTerminalAbbrev: "BBI",
  DepartingTime: at(8, 0),
  ArrivingTime: at(8, 35),
  SailingNotes: "",
  Annotations: [],
  RouteID: 1,
  RouteAbbrev: "sea-bi",
  Key: "trip",
  SailingDay: "2026-03-13",
  TripType: "direct",
  ...overrides,
});

describe("applyPrefetchSchedulePolicies", () => {
  it("sets SchedArriveCurr from ArrivingTime on Route 9 when arrival exists", () => {
    const arrival = at(9, 15);
    const trip = makeTrip({
      RouteID: 9,
      RouteAbbrev: "pt-key",
      ArrivingTime: arrival,
      DepartingTerminalAbbrev: "POT",
      ArrivingTerminalAbbrev: "COU",
    });
    const out = applyPrefetchSchedulePolicies(trip);
    expect(out.SchedArriveCurr).toBe(arrival);
  });

  it("leaves SchedArriveCurr unset for non-Route-9 rows", () => {
    const trip = makeTrip({ RouteID: 1, ArrivingTime: at(8, 35) });
    const out = applyPrefetchSchedulePolicies(trip);
    expect(out.SchedArriveCurr).toBeUndefined();
  });
});

describe("buildInitialScheduledTripRow", () => {
  it("applies Route 9 prefetch policy", () => {
    const arrival = at(10, 0);
    const row = buildInitialScheduledTripRow({
      Key: "k1",
      VesselAbbrev: "TOK",
      DepartingTerminalAbbrev: "ANA",
      ArrivingTerminalAbbrev: "LOP",
      DepartingTime: at(9, 0),
      ArrivingTime: arrival,
      SailingNotes: "",
      Annotations: [],
      RouteID: 9,
      RouteAbbrev: "pt-key",
      SailingDay: "2026-03-13",
    });
    expect(row.TripType).toBe("direct");
    expect(row.SchedArriveCurr).toBe(arrival);
  });
});

describe("runScheduleTransformPipeline", () => {
  it("links PrevKey and NextKey on a two-leg same-vessel day", () => {
    const t1 = makeTrip({
      Key: "k-p52-bbi",
      DepartingTerminalAbbrev: "P52",
      ArrivingTerminalAbbrev: "BBI",
      DepartingTime: at(8, 0),
    });
    const t2 = makeTrip({
      Key: "k-bbi-p52",
      DepartingTerminalAbbrev: "BBI",
      ArrivingTerminalAbbrev: "P52",
      DepartingTime: at(10, 0),
    });

    const out = runScheduleTransformPipeline([t1, t2]);
    const leg1 = out.find((t) => t.Key === "k-p52-bbi");
    const leg2 = out.find((t) => t.Key === "k-bbi-p52");

    expect(leg1?.NextKey).toBe("k-bbi-p52");
    expect(leg1?.NextDepartingTime).toBe(at(10, 0));
    expect(leg2?.PrevKey).toBe("k-p52-bbi");
  });

  it("classifies San Juan–style multi-destination departure and backfills indirect arrivals", () => {
    const t0 = at(8, 0);
    const t1 = at(9, 0);
    const trips = runScheduleTransformPipeline([
      makeTrip({
        Key: "FAU-VAI",
        DepartingTerminalAbbrev: "FAU",
        ArrivingTerminalAbbrev: "VAI",
        RouteAbbrev: "f-v-s",
        RouteID: 5,
        DepartingTime: t0,
        ArrivingTime: undefined,
      }),
      makeTrip({
        Key: "FAU-SOU",
        DepartingTerminalAbbrev: "FAU",
        ArrivingTerminalAbbrev: "SOU",
        RouteAbbrev: "f-v-s",
        RouteID: 5,
        DepartingTime: t0,
        ArrivingTime: undefined,
      }),
      makeTrip({
        Key: "VAI-SOU",
        DepartingTerminalAbbrev: "VAI",
        ArrivingTerminalAbbrev: "SOU",
        RouteAbbrev: "f-v-s",
        RouteID: 5,
        DepartingTime: t1,
        ArrivingTime: undefined,
      }),
    ]);

    const indirect = trips.find((t) => t.Key === "FAU-SOU");
    const completion = trips.find((t) => t.Key === "VAI-SOU");

    expect(indirect?.TripType).toBe("indirect");
    expect(completion?.TripType).toBe("direct");
    expect(indirect?.SchedArriveNext).toBe(completion?.SchedArriveNext);
    expect(indirect?.EstArriveNext).toBe(completion?.EstArriveNext);
  });

  it("computes scheduled and estimated next arrival for a direct leg when configured", () => {
    const t = makeTrip({
      Key: "k-direct",
      DepartingTerminalAbbrev: "P52",
      ArrivingTerminalAbbrev: "BBI",
      DepartingTime: at(8, 0),
    });
    const [out] = runScheduleTransformPipeline([t]);
    expect(out.SchedArriveNext).toBeDefined();
    expect(out.EstArriveNext).toBeDefined();
  });
});
