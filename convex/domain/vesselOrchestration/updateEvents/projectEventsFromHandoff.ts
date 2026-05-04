/**
 * Event projection from a persisted trip handoff merged with same-update
 * prediction branches. Prefer `updateEvents` in `updateEvents.ts` when the
 * input is a `VesselTripUpdate`; use this module when the handoff is already
 * built (e.g. focused tests).
 */

import type { ConvexVesselTripWithML } from "functions/vesselTrips/schemas";
import { buildDockWritesFromTripHandoff } from "./buildDockWritesFromTripHandoff";
import { buildCompletedHandoffKey } from "./completedHandoffKey";
import type { RunUpdateVesselEventsOutput } from "./contracts";
import type {
  PersistedTripEventHandoff,
  PredictedTripEventHandoff,
} from "./handoffTypes";

/**
 * Runs merge plus dock-write assembly for one orchestrator tick when the
 * persisted handoff is already materialized.
 *
 * @param handoff - Output of `eventHandoffFromTripUpdate`
 * @param predictedTripEventHandoffs - Event-owned enriched-trip branches
 *   aligned with this handoff
 * @param pingStartedAt - Epoch ms used when stamping event rows for this tick
 * @returns Sparse `eventsActual` and `eventsPredicted` payloads for
 *   persistence
 */
export const projectEventsFromHandoff = (
  handoff: PersistedTripEventHandoff,
  predictedTripEventHandoffs: ReadonlyArray<PredictedTripEventHandoff>,
  pingStartedAt: number
): RunUpdateVesselEventsOutput => {
  const handoffWithPredictions = applyPredictedTripEventHandoffs(
    handoff,
    predictedTripEventHandoffs
  );
  const eventWrites = buildDockWritesFromTripHandoff({
    ...handoffWithPredictions,
    pingStartedAt,
  });
  return {
    actualEvents: eventWrites.actualDockWrites,
    predictedEvents: eventWrites.predictedDockWriteBatches,
  };
};

/**
 * Merges ML-enriched trips from the prediction pass into the in-memory handoff
 * so projected dock writes match model outputs (`activeVesselTripWithMl` on
 * completed facts, `finalProposed` on current-branch intents).
 *
 * @param handoff - Facts from `eventHandoffFromTripUpdate` before ML overlay
 * @param predictedTripEventHandoffs - Per-branch enriched trips built by
 *   event assembly
 * @returns Handoff with ML fields attached where branch keys match
 */
const applyPredictedTripEventHandoffs = (
  handoff: PersistedTripEventHandoff,
  predictedTripEventHandoffs: ReadonlyArray<PredictedTripEventHandoff>
): PersistedTripEventHandoff => {
  const completedByHandoffKey = new Map(
    predictedTripEventHandoffs
      .filter(
        (
          branchHandoff
        ): branchHandoff is Extract<
          PredictedTripEventHandoff,
          { branch: "completed" }
        > => branchHandoff.branch === "completed"
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
    predictedTripEventHandoffs
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
 * @param predictedTripEventHandoffs - Branch rows from event assembly
 * @returns Map from vessel abbrev to enriched trip for `branch === "current"`
 */
const buildCurrentPredictedTripsByVessel = (
  predictedTripEventHandoffs: ReadonlyArray<PredictedTripEventHandoff>
): Map<string, ConvexVesselTripWithML> => {
  const map = new Map<string, ConvexVesselTripWithML>();
  for (const branchHandoff of predictedTripEventHandoffs) {
    if (branchHandoff.branch === "current") {
      map.set(branchHandoff.vesselAbbrev, branchHandoff.finalPredictedTrip);
    }
  }
  return map;
};
