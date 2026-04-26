/**
 * Same-ping timeline projection from Stage C/D handoffs.
 */

import type { MlTimelineOverlay } from "domain/vesselOrchestration/shared";
import type { PersistedTripTimelineHandoff } from "domain/vesselOrchestration/shared/pingHandshake/types";
import type {
  ConvexVesselTrip,
  ConvexVesselTripWithML,
} from "functions/vesselTrips/schemas";
import { buildDockWritesFromTripHandoff } from "./buildDockWritesFromTripHandoff";
import type {
  RunUpdateVesselTimelineFromAssemblyInput,
  RunUpdateVesselTimelineOutput,
} from "./contracts";

/**
 * Builds the stable key for matching completed handoff facts to completed
 * branch ML overlays.
 *
 * @param vesselAbbrev - Vessel abbreviation for the completed handoff
 * @param completedTrip - Completed trip row from persistence output
 * @param activeTrip - Replacement schedule trip row from persistence output
 * @returns Stable vessel+schedule identity key
 */
const buildCompletedHandoffKey = (
  vesselAbbrev: string,
  completedTrip: ConvexVesselTrip | undefined,
  activeTrip: ConvexVesselTrip | undefined
): string => {
  const scheduleIdentity =
    completedTrip?.ScheduleKey ??
    completedTrip?.TripKey ??
    activeTrip?.ScheduleKey ??
    activeTrip?.TripKey ??
    "";
  return `${vesselAbbrev}::${scheduleIdentity}`;
};

const buildCurrentMlByVessel = (
  mlTimelineOverlays: ReadonlyArray<MlTimelineOverlay>
): Map<string, ConvexVesselTripWithML> => {
  const map = new Map<string, ConvexVesselTripWithML>();
  for (const overlay of mlTimelineOverlays) {
    if (
      overlay.branch === "current" &&
      overlay.finalPredictedTrip !== undefined
    ) {
      map.set(overlay.vesselAbbrev, overlay.finalPredictedTrip);
    }
  }
  return map;
};

/**
 * Applies same-ping ML overlay rows onto persisted trip handoff rows.
 *
 * @param handoff - Trip persistence output before timeline dock writes
 * @param mlTimelineOverlays - ML overlay from predictions stage
 * @returns Handoff with `newTrip` / `finalProposed` fields populated
 */
const applyMlOverlays = (
  handoff: PersistedTripTimelineHandoff,
  mlTimelineOverlays: ReadonlyArray<MlTimelineOverlay>
): PersistedTripTimelineHandoff => {
  const completedMlByKey = new Map(
    mlTimelineOverlays
      .filter(
        (
          overlay
        ): overlay is MlTimelineOverlay & {
          branch: "completed";
          completedHandoffKey: string;
          finalPredictedTrip: ConvexVesselTripWithML;
        } =>
          overlay.branch === "completed" &&
          overlay.completedHandoffKey !== undefined &&
          overlay.finalPredictedTrip !== undefined
      )
      .map(
        (overlay) =>
          [overlay.completedHandoffKey, overlay.finalPredictedTrip] as const
      )
  );
  const currentMlByVessel = buildCurrentMlByVessel(mlTimelineOverlays);

  return {
    completedTripFacts: handoff.completedTripFacts.map((fact) => {
      const newTrip = completedMlByKey.get(
        buildCompletedHandoffKey(
          fact.tripToComplete.VesselAbbrev,
          fact.tripToComplete,
          fact.scheduleTrip
        )
      );
      return {
        ...fact,
        newTrip,
      };
    }),
    currentBranch: {
      successfulVesselAbbrev: handoff.currentBranch.successfulVesselAbbrev,
      pendingActualWrite:
        handoff.currentBranch.pendingActualWrite === undefined
          ? undefined
          : {
              ...handoff.currentBranch.pendingActualWrite,
              finalProposed: currentMlByVessel.get(
                handoff.currentBranch.pendingActualWrite.vesselAbbrev
              ),
            },
      pendingPredictedWrite:
        handoff.currentBranch.pendingPredictedWrite === undefined
          ? undefined
          : {
              ...handoff.currentBranch.pendingPredictedWrite,
              finalProposed: currentMlByVessel.get(
                handoff.currentBranch.pendingPredictedWrite.vesselAbbrev
              ),
            },
    },
  };
};

/**
 * Canonical timeline concern entrypoint for orchestrator callers.
 *
 * @param input - Ping start time plus persisted trip handoff and ML overlays
 * @returns Actual and predicted timeline event writes for persistence
 */
export const updateTimeline = (
  input: RunUpdateVesselTimelineFromAssemblyInput
): RunUpdateVesselTimelineOutput => {
  const handoffWithMl = applyMlOverlays(
    input.tripHandoffForTimeline,
    input.mlTimelineOverlays
  );
  const timelineWrites = buildDockWritesFromTripHandoff({
    ...handoffWithMl,
    pingStartedAt: input.pingStartedAt,
  });
  return {
    actualEvents: timelineWrites.actualDockWrites,
    predictedEvents: timelineWrites.predictedDockWriteBatches,
  };
};
