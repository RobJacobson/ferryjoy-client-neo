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
const completedHandoffKey = (
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

const finalProposedByVesselFromMlOverlays = (
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
 * Matching uses vessel + completed-trip schedule identity, not object identity
 * between pings.
 *
 * @param handoff - Trip persistence output before timeline dock writes
 * @param mlTimelineOverlays - ML overlay from predictions stage
 * @returns Handoff with `newTrip` / `finalProposed` fields merged from overlays
 */
export const mergeMlOverlayIntoTripHandoffForTimeline = (
  handoff: PersistedTripTimelineHandoff,
  mlTimelineOverlays: ReadonlyArray<MlTimelineOverlay>
): PersistedTripTimelineHandoff => {
  const mlFactsByKey = new Map(
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
          [
            overlay.completedHandoffKey,
            overlay.finalPredictedTrip,
          ] as const
      )
  );
  const mlByVessel = finalProposedByVesselFromMlOverlays(mlTimelineOverlays);

  return {
    completedFacts: handoff.completedFacts.map((fact) => {
      const newTrip = mlFactsByKey.get(
        completedHandoffKey(
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
      successfulVessels: handoff.currentBranch.successfulVessels,
      pendingActualMessages: handoff.currentBranch.pendingActualMessages.map(
        (m) => ({
          ...m,
          finalProposed: mlByVessel.get(m.vesselAbbrev),
        })
      ),
      pendingPredictedMessages:
        handoff.currentBranch.pendingPredictedMessages.map((m) => ({
          ...m,
          finalProposed: mlByVessel.get(m.vesselAbbrev),
        })),
    },
  };
};

/**
 * Timeline assembly helper for callers that already have completed/current trip
 * handoff rows.
 */
export const updateTimelineFromAssembly = (
  input: RunUpdateVesselTimelineFromAssemblyInput
): RunUpdateVesselTimelineOutput => {
  const merged = mergeMlOverlayIntoTripHandoffForTimeline(
    input.tripHandoffForTimeline,
    input.mlTimelineOverlays
  );
  const tl = buildDockWritesFromTripHandoff({
    ...merged,
    pingStartedAt: input.pingStartedAt,
  });
  return {
    actualEvents: tl.actualDockWrites,
    predictedEvents: tl.predictedDockWriteBatches,
  };
};
