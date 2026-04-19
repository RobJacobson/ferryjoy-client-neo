/**
 * Stage A trips runner: adapt the legacy trip bundle into the canonical public
 * trips contract without changing lifecycle behavior.
 */

import {
  buildVesselTripTickWriteSetFromBundle,
  createScheduledSegmentLookupFromSnapshot,
} from "domain/vesselOrchestration/shared";
import type {
  ExistingActiveTripRow,
  RunUpdateVesselTripsInput,
  RunUpdateVesselTripsOutput,
  TripComputation,
  VesselTripRow,
} from "./contracts";
import { computeVesselTripsWithClock } from "./processTick/computeVesselTripsWithClock";
import { createDefaultProcessVesselTripsDeps } from "./processTick/defaultProcessVesselTripsDeps";

type CompletedTripComputationSource = {
  existingTrip: ExistingActiveTripRow;
  tripToComplete: VesselTripRow;
  newTripCore: {
    withFinalSchedule: NonNullable<TripComputation["activeTrip"]>;
  };
};

type CurrentTripComputationSource = {
  activeUpserts: ReadonlyArray<
    NonNullable<TripComputation["tripCore"]["withFinalSchedule"]>
  >;
  pendingActualMessages: ReadonlyArray<{
    events: NonNullable<TripComputation["events"]>;
    tripCore: {
      withFinalSchedule: NonNullable<
        TripComputation["tripCore"]["withFinalSchedule"]
      >;
    };
    vesselAbbrev: string;
  }>;
  pendingPredictedMessages: ReadonlyArray<{
    existingTrip?: ExistingActiveTripRow;
    tripCore: {
      withFinalSchedule: NonNullable<
        TripComputation["tripCore"]["withFinalSchedule"]
      >;
    };
    vesselAbbrev: string;
  }>;
};

const completedTripComputationsFromBundle = (
  completedHandoffs: ReadonlyArray<CompletedTripComputationSource>
): TripComputation[] =>
  completedHandoffs.map((handoff) => ({
    vesselAbbrev: handoff.tripToComplete.VesselAbbrev,
    branch: "completed",
    existingTrip: handoff.existingTrip,
    completedTrip: handoff.tripToComplete,
    activeTrip: handoff.newTripCore.withFinalSchedule,
    tripCore: {
      withFinalSchedule: handoff.newTripCore.withFinalSchedule,
    },
  }));

const currentTripComputationsFromBundle = (
  current: CurrentTripComputationSource
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
        tripCore: {
          withFinalSchedule: activeTrip,
        },
      },
    ];
  });
};

const tripComputationsFromBundle = (
  bundle: Awaited<
    ReturnType<typeof computeVesselTripsWithClock>
  >["tripsCompute"]
): TripComputation[] => [
  ...completedTripComputationsFromBundle(bundle.completedHandoffs),
  ...currentTripComputationsFromBundle(bundle.current),
];

/**
 * Stage A canonical public runner for the trips concern.
 *
 * This is a thin wrapper over the legacy compute pipeline. It freezes the
 * public contract while preserving the existing internal lifecycle flow.
 */
export const runUpdateVesselTrips = async (
  input: RunUpdateVesselTripsInput
): Promise<RunUpdateVesselTripsOutput> => {
  const tripDeps = createDefaultProcessVesselTripsDeps(
    createScheduledSegmentLookupFromSnapshot(input.scheduleContext)
  );
  const { tripsCompute } = await computeVesselTripsWithClock(
    {
      convexLocations: input.vesselLocations,
      activeTrips: input.existingActiveTrips,
    },
    tripDeps,
    { tickStartedAt: input.tickStartedAt }
  );
  const writeSet = buildVesselTripTickWriteSetFromBundle(tripsCompute);

  return {
    activeTrips: [
      ...writeSet.attemptedHandoffs.map((handoff) => handoff.newTrip),
      ...writeSet.activeTripRows,
    ],
    completedTrips: writeSet.attemptedHandoffs.map(
      (handoff) => handoff.completedTrip
    ),
    tripComputations: tripComputationsFromBundle(tripsCompute),
  };
};
