/**
 * Timeline projection from a persisted trip handoff merged with same-update
 * prediction branches. Prefer `updateTimeline` in `updateTimeline.ts` when the
 * input is a `VesselTripUpdate`; use this module when the handoff is already
 * built (e.g. focused tests).
 */

import type { ConvexVesselTripWithML } from "functions/vesselTrips/schemas";
import { buildDockWritesFromTripHandoff } from "./buildDockWritesFromTripHandoff";
import { buildCompletedHandoffKey } from "./completedHandoffKey";
import type { RunUpdateVesselTimelineOutput } from "./contracts";
import type {
  PersistedTripTimelineHandoff,
  PredictedTripTimelineHandoff,
} from "./handoffTypes";

/**
 * Runs merge plus dock-write assembly for one orchestrator tick when the
 * persisted handoff is already materialized.
 *
 * @param handoff - Output of `timelineHandoffFromTripUpdate`
 * @param predictedTripTimelineHandoffs - Branches from
 *   `getVesselTripPredictionsFromTripUpdate`, aligned with this handoff
 * @param pingStartedAt - Epoch ms used when stamping timeline rows for this tick
 * @returns Sparse `eventsActual` and `eventsPredicted` payloads for
 *   persistence
 */
export const projectTimelineFromHandoff = (
  handoff: PersistedTripTimelineHandoff,
  predictedTripTimelineHandoffs: ReadonlyArray<PredictedTripTimelineHandoff>,
  pingStartedAt: number
): RunUpdateVesselTimelineOutput => {
  const handoffWithPredictions = applyPredictedTripTimelineHandoffs(
    handoff,
    predictedTripTimelineHandoffs
  );
  const timelineWrites = buildDockWritesFromTripHandoff({
    ...handoffWithPredictions,
    pingStartedAt,
  });
  return {
    actualEvents: timelineWrites.actualDockWrites,
    predictedEvents: timelineWrites.predictedDockWriteBatches,
  };
};

/**
 * Merges ML-enriched trips from the prediction pass into the in-memory handoff
 * so projected dock writes match model outputs (`activeVesselTripWithMl` on
 * completed facts, `finalProposed` on current-branch intents).
 *
 * @param handoff - Facts from `timelineHandoffFromTripUpdate` before ML overlay
 * @param predictedTripTimelineHandoffs - Per-branch enriched trips from the
 *   prediction pass
 * @returns Handoff with ML fields attached where branch keys match
 */
const applyPredictedTripTimelineHandoffs = (
  handoff: PersistedTripTimelineHandoff,
  predictedTripTimelineHandoffs: ReadonlyArray<PredictedTripTimelineHandoff>
): PersistedTripTimelineHandoff => {
  const completedByHandoffKey = new Map(
    predictedTripTimelineHandoffs
      .filter(
        (
          branchHandoff
        ): branchHandoff is PredictedTripTimelineHandoff & {
          branch: "completed";
          completedHandoffKey: string;
          finalPredictedTrip: ConvexVesselTripWithML;
        } =>
          branchHandoff.branch === "completed" &&
          branchHandoff.completedHandoffKey !== undefined &&
          branchHandoff.finalPredictedTrip !== undefined
      )
      .map(
        (branchHandoff) =>
          [
            branchHandoff.completedHandoffKey,
            branchHandoff.finalPredictedTrip,
          ] as const
      )
  );
  const currentPredictedByVessel = buildCurrentPredictedTripsByVessel(
    predictedTripTimelineHandoffs
  );

  return {
    completedTripFacts: handoff.completedTripFacts.map((fact) => {
      const activeVesselTripWithMl = completedByHandoffKey.get(
        buildCompletedHandoffKey(
          fact.completedVesselTrip.VesselAbbrev,
          fact.completedVesselTrip,
          fact.activeVesselTrip
        )
      );
      return {
        ...fact,
        activeVesselTripWithMl,
      };
    }),
    currentBranch: {
      successfulVesselAbbrev: handoff.currentBranch.successfulVesselAbbrev,
      pendingActualWrite:
        handoff.currentBranch.pendingActualWrite === undefined
          ? undefined
          : {
              ...handoff.currentBranch.pendingActualWrite,
              finalProposed: currentPredictedByVessel.get(
                handoff.currentBranch.pendingActualWrite.vesselAbbrev
              ),
            },
      pendingPredictedWrite:
        handoff.currentBranch.pendingPredictedWrite === undefined
          ? undefined
          : {
              ...handoff.currentBranch.pendingPredictedWrite,
              finalProposed: currentPredictedByVessel.get(
                handoff.currentBranch.pendingPredictedWrite.vesselAbbrev
              ),
            },
    },
  };
};

/**
 * Indexes current-branch prediction handoffs by vessel so dock intents resolve
 * `finalProposed` without a second scan.
 *
 * @param predictedTripTimelineHandoffs - Branch rows from the prediction pass
 * @returns Map from vessel abbrev to enriched trip for `branch === "current"`
 */
const buildCurrentPredictedTripsByVessel = (
  predictedTripTimelineHandoffs: ReadonlyArray<PredictedTripTimelineHandoff>
): Map<string, ConvexVesselTripWithML> => {
  const map = new Map<string, ConvexVesselTripWithML>();
  for (const branchHandoff of predictedTripTimelineHandoffs) {
    if (
      branchHandoff.branch === "current" &&
      branchHandoff.finalPredictedTrip !== undefined
    ) {
      map.set(branchHandoff.vesselAbbrev, branchHandoff.finalPredictedTrip);
    }
  }
  return map;
};
