/**
 * Flattens {@link VesselTripsComputeBundle} into {@link TripComputation} rows for
 * timeline projection and persist-gate filtering (`buildTimelineTripComputationsForRun`).
 * Lives in **updateTimeline** because consumers are downstream of trip-table compute.
 */

import type { CompletedTripBoundaryFact } from "domain/vesselOrchestration/shared";
import type {
  ActiveTripsBranch,
  TripComputation,
  VesselTripsComputeBundle,
} from "domain/vesselOrchestration/updateVesselTrips";

const completedTripComputationsFromHandoffs = (
  completedHandoffs: ReadonlyArray<CompletedTripBoundaryFact>
): TripComputation[] =>
  completedHandoffs.map((handoff) => ({
    vesselAbbrev: handoff.tripToComplete.VesselAbbrev,
    branch: "completed",
    events: handoff.events,
    existingTrip: handoff.existingTrip,
    completedTrip: handoff.tripToComplete,
    activeTrip: handoff.newTripCore.withFinalSchedule,
    tripCore: handoff.newTripCore,
  }));

const currentTripComputationsFromBranch = (
  current: ActiveTripsBranch
): TripComputation[] => {
  const actualByVessel = new Map(
    current.pendingActualMessages.map(
      (message) => [message.vesselAbbrev, message] as const
    )
  );
  const predictedByVessel = new Map(
    current.pendingPredictedMessages.map(
      (message) => [message.vesselAbbrev, message] as const
    )
  );
  const activeByVessel = new Map(
    current.activeUpserts.map((trip) => [trip.VesselAbbrev, trip] as const)
  );

  const vesselAbbrevs = new Set<string>([
    ...actualByVessel.keys(),
    ...predictedByVessel.keys(),
    ...activeByVessel.keys(),
  ]);

  return [...vesselAbbrevs].flatMap((vesselAbbrev) => {
    const actualMessage = actualByVessel.get(vesselAbbrev);
    const predictedMessage = predictedByVessel.get(vesselAbbrev);
    const activeTrip =
      activeByVessel.get(vesselAbbrev) ??
      actualMessage?.tripCore.withFinalSchedule ??
      predictedMessage?.tripCore.withFinalSchedule;

    if (activeTrip === undefined) {
      return [];
    }

    return [
      {
        vesselAbbrev,
        branch: "current" as const,
        events: actualMessage?.events,
        existingTrip: predictedMessage?.existingTrip,
        activeTrip,
        tripCore: actualMessage?.tripCore ??
          predictedMessage?.tripCore ?? {
            withFinalSchedule: activeTrip,
          },
      },
    ];
  });
};

/**
 * One {@link TripComputation} per completed handoff plus per-vessel merged rows
 * for the active branch (actual / predicted / upsert sources).
 */
export const assembleTripComputationsFromBundle = (
  bundle: VesselTripsComputeBundle
): TripComputation[] => [
  ...completedTripComputationsFromHandoffs(bundle.completedHandoffs),
  ...currentTripComputationsFromBranch(bundle.current),
];
