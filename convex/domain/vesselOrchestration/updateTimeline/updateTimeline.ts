/**
 * Same-ping timeline projection from Stage C/D handoffs.
 */

import type { MlTimelineOverlay } from "domain/vesselOrchestration/shared";
import { buildCompletedHandoffKey } from "domain/vesselOrchestration/shared";
import type { PersistedTripTimelineHandoff } from "domain/vesselOrchestration/shared/pingHandshake/types";
import type { ConvexVesselTripWithML } from "functions/vesselTrips/schemas";
import { buildDockWritesFromTripHandoff } from "./buildDockWritesFromTripHandoff";
import type {
  RunUpdateVesselTimelineFromAssemblyInput,
  RunUpdateVesselTimelineOutput,
} from "./contracts";
import { timelineHandoffFromTripUpdate } from "./timelineHandoffFromTripUpdate";

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
 * Folder-private timeline projection from a pre-built handoff plus ML overlay.
 *
 * Exposed via relative import for tests that exercise lower-level handoff
 * gating semantics directly.
 *
 * @param handoff - Pre-built timeline handoff (typically from `timelineHandoffFromTripUpdate`)
 * @param mlTimelineOverlays - ML overlays from `updateVesselPredictions`
 * @param pingStartedAt - Ping start tick used to stamp event rows
 * @returns Actual and predicted timeline event writes for persistence
 */
export const projectTimelineFromHandoff = (
  handoff: PersistedTripTimelineHandoff,
  mlTimelineOverlays: ReadonlyArray<MlTimelineOverlay>,
  pingStartedAt: number
): RunUpdateVesselTimelineOutput => {
  const handoffWithMl = applyMlOverlays(handoff, mlTimelineOverlays);
  const timelineWrites = buildDockWritesFromTripHandoff({
    ...handoffWithMl,
    pingStartedAt,
  });
  return {
    actualEvents: timelineWrites.actualDockWrites,
    predictedEvents: timelineWrites.predictedDockWriteBatches,
  };
};

/**
 * Canonical timeline concern entrypoint for orchestrator callers.
 *
 * @param input - Ping start time, upstream trip update, and ML overlays
 * @returns Actual and predicted timeline event writes for persistence
 */
export const updateTimeline = (
  input: RunUpdateVesselTimelineFromAssemblyInput
): RunUpdateVesselTimelineOutput =>
  projectTimelineFromHandoff(
    timelineHandoffFromTripUpdate(input.tripUpdate),
    input.mlTimelineOverlays,
    input.pingStartedAt
  );
