/**
 * Flattens {@link VesselTripsComputeBundle} into {@link TripComputation} rows for
 * timeline projection and persist-gate filtering (`buildTimelineTripComputationsForRun`).
 * Lives in **updateTimeline** because consumers are downstream of trip-table compute.
 */

import type {
  ActiveTripsBranch,
  CompletedTripBoundaryFact,
  TripComputation,
  VesselTripsComputeBundle,
} from "domain/vesselOrchestration/shared";

const completedTripComputationsFromHandoffs = (
  completedHandoffs: ReadonlyArray<CompletedTripBoundaryFact>
): TripComputation[] =>
  completedHandoffs.map((handoff) => ({
    vesselAbbrev: handoff.tripToComplete.VesselAbbrev,
    branch: "completed",
    events: handoff.events,
    existingTrip: handoff.existingTrip,
    completedTrip: handoff.tripToComplete,
    activeTrip: handoff.scheduleTrip,
    scheduleTrip: handoff.scheduleTrip,
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
      actualMessage?.scheduleTrip ??
      predictedMessage?.scheduleTrip;

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
        scheduleTrip:
          actualMessage?.scheduleTrip ??
          predictedMessage?.scheduleTrip ??
          activeTrip,
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
