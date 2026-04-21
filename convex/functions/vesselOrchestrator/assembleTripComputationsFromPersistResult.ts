/**
 * Builds timeline trip computations from arrays-only trip rows and persisted
 * lifecycle handoffs.
 */

import type {
  TripComputation,
  VesselTripPersistResult,
} from "domain/vesselOrchestration/shared";
import type { RunUpdateVesselTripsOutput } from "domain/vesselOrchestration/updateVesselTrips";

/**
 * Builds one `TripComputation` per completed fact and per vessel in current
 * pending messages, with active-trip fallback rows for continuity.
 */
export const assembleTripComputationsFromPersistResult = (
  tripRows: RunUpdateVesselTripsOutput,
  tripPersistResult: VesselTripPersistResult
): TripComputation[] => {
  const completedComputations: TripComputation[] =
    tripPersistResult.completedFacts.map((fact) => ({
      branch: "completed",
      vesselAbbrev: fact.tripToComplete.VesselAbbrev,
      events: fact.events,
      existingTrip: fact.existingTrip,
      completedTrip: fact.tripToComplete,
      activeTrip: fact.scheduleTrip,
      scheduleTrip: fact.scheduleTrip,
    }));

  const currentActualByVessel = new Map(
    tripPersistResult.currentBranch.pendingActualMessages.map((message) => [
      message.vesselAbbrev,
      message,
    ])
  );
  const currentPredictedByVessel = new Map(
    tripPersistResult.currentBranch.pendingPredictedMessages.map((message) => [
      message.vesselAbbrev,
      message,
    ])
  );
  const activeByVessel = new Map(
    tripRows.activeTrips.map((trip) => [trip.VesselAbbrev, trip] as const)
  );

  const currentVessels = new Set<string>([
    ...currentActualByVessel.keys(),
    ...currentPredictedByVessel.keys(),
    ...activeByVessel.keys(),
  ]);

  const currentComputations: TripComputation[] = [...currentVessels].flatMap(
    (vesselAbbrev) => {
      const actualMessage = currentActualByVessel.get(vesselAbbrev);
      const predictedMessage = currentPredictedByVessel.get(vesselAbbrev);
      const activeTrip =
        activeByVessel.get(vesselAbbrev) ??
        actualMessage?.scheduleTrip ??
        predictedMessage?.scheduleTrip;

      if (activeTrip === undefined) {
        // Skip vessels that have no usable row in either branch input.
        return [];
      }

      return [
        {
          branch: "current" as const,
          vesselAbbrev,
          events: actualMessage?.events,
          existingTrip: predictedMessage?.existingTrip,
          activeTrip,
          scheduleTrip:
            actualMessage?.scheduleTrip ??
            predictedMessage?.scheduleTrip ??
            activeTrip,
        },
      ];
    }
  );

  return [...completedComputations, ...currentComputations];
};

