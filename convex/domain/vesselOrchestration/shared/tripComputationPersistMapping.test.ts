/**
 * Tests for {@link currentPredictedMessageFromComputation} parity after Phase B
 * (no `tripCore.gates` on Stage C).
 */

import { describe, expect, it } from "bun:test";
import { generateTripKey } from "shared/physicalTripIdentity";
import { currentPredictedMessageFromComputation } from "./tripComputationPersistMapping";

const ms = (iso: string) => new Date(iso).getTime();

describe("currentPredictedMessageFromComputation", () => {
  it("returns null for synthetic fallback merge (no events, no existingTrip)", () => {
    const trip = {
      VesselAbbrev: "TAC",
      TripKey: generateTripKey("TAC", ms("2026-03-13T05:00:00-07:00")),
      ScheduleKey: "TAC--2026-03-13--05:15--P52-BBI",
    } as never;

    expect(
      currentPredictedMessageFromComputation({
        vesselAbbrev: "TAC",
        branch: "current",
        activeTrip: trip,
        tripCore: { withFinalSchedule: trip },
      })
    ).toBeNull();
  });

  it("returns a message when existingTrip is present", () => {
    const trip = {
      VesselAbbrev: "TAC",
      TripKey: generateTripKey("TAC", ms("2026-03-13T05:00:00-07:00")),
      ScheduleKey: "TAC--2026-03-13--05:15--P52-BBI",
    } as never;

    const msg = currentPredictedMessageFromComputation({
      vesselAbbrev: "TAC",
      branch: "current",
      existingTrip: trip,
      activeTrip: trip,
      tripCore: { withFinalSchedule: trip },
    });
    expect(msg).not.toBeNull();
    expect(msg?.vesselAbbrev).toBe("TAC");
  });
});
