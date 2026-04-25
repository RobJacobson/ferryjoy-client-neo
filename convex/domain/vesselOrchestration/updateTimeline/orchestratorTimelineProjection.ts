/**
 * Same-ping timeline projection from Stage C/D handoffs.
 */

import type { MlTimelineOverlay } from "domain/vesselOrchestration/shared";
import type {
  ConvexVesselTrip,
  ConvexVesselTripWithML,
} from "functions/vesselTrips/schemas";
import {
  buildDockWritesFromTripHandoff,
  type TripHandoffForTimeline,
} from "./buildDockWritesFromTripHandoff";
import type {
  RunUpdateVesselTimelineFromAssemblyInput,
  RunUpdateVesselTimelineOutput,
} from "./contracts";

/**
 * Schedule identity for matching completed-handoff facts to prediction-stage
 * `MlTimelineOverlay` rows. Must stay aligned with
 * {@link mlTimelineOverlayMatchKey} (same `ScheduleKey` then `TripKey`
 * fallbacks on completed row, then replacement active row).
 */
const scheduleIdentityForMlMergeKey = (
  completedTrip: ConvexVesselTrip | undefined,
  activeTrip: ConvexVesselTrip | undefined
): string =>
  completedTrip?.ScheduleKey ??
  completedTrip?.TripKey ??
  activeTrip?.ScheduleKey ??
  activeTrip?.TripKey ??
  "";

const timelineMlMergeKeyFromCompletedHandoffParts = (
  vesselAbbrev: string,
  completedTrip: ConvexVesselTrip | undefined,
  activeTrip: ConvexVesselTrip | undefined
): string =>
  `${vesselAbbrev}::${scheduleIdentityForMlMergeKey(completedTrip, activeTrip)}`;

const mlTimelineOverlayMatchKey = (overlay: MlTimelineOverlay): string =>
  timelineMlMergeKeyFromCompletedHandoffParts(
    overlay.vesselAbbrev,
    overlay.completedTrip,
    overlay.activeTrip
  );

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
  handoff: TripHandoffForTimeline,
  mlTimelineOverlays: ReadonlyArray<MlTimelineOverlay>
): TripHandoffForTimeline => {
  const mlFactsByKey = new Map(
    mlTimelineOverlays
      .filter(
        (
          overlay
        ): overlay is MlTimelineOverlay & {
          branch: "completed";
          finalPredictedTrip: ConvexVesselTripWithML;
        } =>
          overlay.branch === "completed" &&
          overlay.finalPredictedTrip !== undefined
      )
      .map(
        (overlay) =>
          [
            mlTimelineOverlayMatchKey(overlay),
            overlay.finalPredictedTrip,
          ] as const
      )
  );
  const mlByVessel = finalProposedByVesselFromMlOverlays(mlTimelineOverlays);

  return {
    completedFacts: handoff.completedFacts.map((fact) => {
      const newTrip = mlFactsByKey.get(
        timelineMlMergeKeyFromCompletedHandoffParts(
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
 * Timeline entrypoint for orchestrator callers that already have
 * completed/current trip handoff rows.
 */
export const runUpdateVesselTimelineFromAssembly = (
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
