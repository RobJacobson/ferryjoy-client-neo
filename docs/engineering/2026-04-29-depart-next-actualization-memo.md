# Depart-Next Prediction Actualization Engineering Memo

**Date:** 2026-04-29
**Audience:** Engineers or agents working in `convex/functions/vesselOrchestrator`, `convex/domain/vesselOrchestration`, `convex/functions/events/eventsPredicted`, and adjacent prediction/timeline code.
**Scope:** This memo covers the current depart-next actualization behavior, why it is hard to reason about, and the intended direction for a follow-up implementation plan. It intentionally does not cover the broader trip persistence cleanup except where that cleanup affects actualization.

## Summary

Depart-next actualization is the delayed step that fills in the actual departure time for predictions made about a vessel's next leg. During a previous leg, ML may emit `AtDockDepartNext` or `AtSeaDepartNext`. Those predictions are projected into `eventsPredicted` for the next leg's `dep-dock` boundary. When that next leg actually leaves dock, the system should patch those predicted rows with:

- `Actual`: the observed departure time
- `DeltaTotal`: the difference between predicted time and actual time

The concept is sound, but the current implementation is too indirect. It is triggered from trip persistence, implemented in `functions/vesselTrips/mutations.ts`, and finds the target prediction rows by loading the most recent completed trip for the vessel. That makes a prediction-evaluation concern look like a vessel-trip write concern.

The intended direction is to make depart-next actualization a first-class vessel orchestrator pipeline concern, with pure domain logic for detecting an actualization intent and thin DB-level helpers for reading or applying the relevant `eventsPredicted` rows.

## Current Behavior

The current hot path is in `convex/functions/vesselOrchestrator/pipeline/runOrchestratorPing.ts`.

For each changed vessel location, the orchestrator currently runs:

```text
updateVesselTrip
  -> loadPredictionContext
  -> updateVesselPredictions
  -> updateTimeline
  -> persistPerVesselOrchestratorWrites
```

The actualization step is hidden inside `persistPerVesselOrchestratorWrites`, specifically through `persistVesselTripWrites` in:

```text
convex/functions/vesselOrchestrator/pipeline/updateVesselTrip/persist.ts
```

That helper:

1. Strips prediction fields from trip rows before storage.
2. Writes the completed trip and active trip rows.
3. Recomputes current-trip lifecycle events with `currentTripEvents`.
4. If the active row just left dock, calls:

```ts
setDepartNextActualsForMostRecentCompletedTripInDb(
  ctx,
  input.vesselAbbrev,
  activeTrip.LeftDockActual
)
```

That function lives in:

```text
convex/functions/vesselTrips/mutations.ts
```

It:

1. Loads the most recent completed trip for the vessel.
2. Reads that completed trip's `NextScheduleKey`.
3. Builds the next leg `dep-dock` boundary key from `NextScheduleKey`.
4. Calls `actualizeDepartNextMlPredictions` in `functions/events/eventsPredicted/mutations.ts`.
5. Patches `eventsPredicted` rows for:

```text
AtDockDepartNext
AtSeaDepartNext
```

with `Actual` and `DeltaTotal`.

## Why This Is Awkward

The implementation crosses concern boundaries in a way that makes the pipeline harder to understand.

First, trip persistence is not the owner of prediction evaluation data. The rows being changed are `eventsPredicted`, not `activeVesselTrips` or `completedVesselTrips`.

Second, the "most recent completed trip" lookup is indirect. On the leave-dock ping, the active trip that just departed already has the current leg identity. The target prediction boundary is the active trip's own `ScheduleKey` plus `dep-dock`. The previous completed trip's `NextScheduleKey` is an older way to reach the same boundary.

Third, the current placement makes actualization easy to miss. A reader can inspect `runOrchestratorPing`, `updateVesselTrip`, `updateVesselPredictions`, and `updateTimeline` without realizing that a prediction-evaluation side effect happens inside trip persistence.

Fourth, ordering matters. `eventsPredicted` rows are also written through timeline prediction projection. A standalone patch can be fragile if later predicted-row projection rewrites or clears the same boundary key in the same mutation or ping. The implementation plan should explicitly account for this.

## Relevant Signal Model

Recent code introduced `VesselLocations.AtDockObserved` to stabilize noisy dock/sea signals:

```text
convex/domain/vesselOrchestration/updateVesselLocations/addAtDockObserved.ts
```

That logic uses a 2-of-3 vote across:

- raw `AtDock`
- slow speed
- absence or presence of `LeftDock`

The trip pipeline persists `VesselTrips.AtDock` from `AtDockObserved`, not directly from raw WSF `AtDock`. This matters because depart-next actualization should use the same trusted lifecycle basis as trip state.

The new actualization detector should therefore key off the trip update transition:

```text
existingActiveTrip.AtDock === true
activeVesselTripUpdate.AtDock !== true
activeVesselTripUpdate.LeftDockActual !== undefined
```

This uses the stabilized trip phase and avoids reinterpreting raw location signals again.

## Intended Direction

Create depart-next actualization as an explicit orchestrator stage or substage.

Recommended conceptual flow:

```text
updateVesselTrip
  -> deriveDepartNextActualizationIntent
  -> loadPredictionContext
  -> updateVesselPredictions
  -> updateTimeline
  -> persistPerVesselOrchestratorWrites
```

The stage can be placed after `updateVesselTrip` because it depends on the trip lifecycle transition. The final write should be coordinated with predicted-event persistence so actualized `eventsPredicted` rows are not accidentally overwritten by later projection.

The domain code should be pure and obvious, likely under a new folder such as:

```text
convex/domain/vesselOrchestration/actualizeDepartNextPredictions/
```

Possible public domain surface:

```ts
deriveDepartNextActualizationIntent(tripUpdate): DepartNextActualizationIntent | null
```

Possible intent shape:

```ts
type DepartNextActualizationIntent = {
  vesselAbbrev: string;
  scheduleKey: string;
  actualDepartMs: number;
};
```

The intent should be produced only when:

- there is an existing active trip
- the previous active row was docked
- the next active row is not docked
- `LeftDockActual` is present
- the active row has a `ScheduleKey`

The boundary key can then be derived directly:

```text
buildBoundaryKey(activeVesselTripUpdate.ScheduleKey, "dep-dock")
```

This is more direct than using the most recent completed trip and its `NextScheduleKey`.

## Persistence Direction

The DB-facing code should be thin and should live near `eventsPredicted`, not in `vesselTrips/mutations.ts`.

The implementation planner should evaluate the best write strategy, but the preferred direction is:

1. Use the domain intent to identify the departure boundary key.
2. Load the existing ML prediction rows for that key and the depart-next types:

```text
PredictionSource = "ml"
PredictionType in ["AtDockDepartNext", "AtSeaDepartNext"]
```

3. Build actualized predicted rows by preserving the existing predicted time and setting:

```text
Actual = actualDepartMs
DeltaTotal = rounded minutes between EventPredictedTime and actualDepartMs
```

4. Feed those actualized rows into the same predicted-event write path as the rest of orchestrator timeline persistence, or otherwise guarantee they run after any same-ping projection that could rewrite the same rows.

Avoid a hidden standalone patch from trip persistence. If a standalone mutation remains necessary, its name and placement should make clear that it is an `eventsPredicted` actualization step, not a vessel-trip write.

## Ordering Hazard To Research

The next agent should pay special attention to `projectPredictedDockWriteBatchesInDb`:

```text
convex/functions/events/eventsPredicted/mutations.ts
```

Predicted dock write batches use `TargetKeys` and may delete existing rows in those target key scopes when they are not present in the incoming batch. This means an actualization patch can be undone if it happens before a later projection touching the same key.

The implementation plan should determine whether the actualized rows should be:

- merged into `predictedEvents` before `persistVesselTimelineWrites`
- appended as an additional predicted write batch after `updateTimeline`
- written by a separate explicit persistence helper after timeline predicted projection

The safest design is the one where the final write to `eventsPredicted` for the boundary includes the actualized fields.

## Non-Goals

This cleanup should not redesign the entire trip persistence layer.

It should not change the meaning of `AtDockObserved` or the trip lifecycle detector unless research uncovers a correctness issue.

It should not add a broad new abstraction over the orchestrator. A small domain module plus narrow DB helpers should be enough.

It should not keep relying on "most recent completed trip" unless there is a concrete edge case where the active trip's `ScheduleKey` is unavailable but the completed trip's `NextScheduleKey` is trustworthy.

## Suggested Research Checklist

Before implementation, inspect:

- `convex/functions/vesselOrchestrator/pipeline/runOrchestratorPing.ts`
- `convex/functions/vesselOrchestrator/pipeline/updateVesselTrip/persist.ts`
- `convex/functions/vesselOrchestrator/mutations.ts`
- `convex/functions/events/eventsPredicted/mutations.ts`
- `convex/domain/timelineRows/buildPredictedProjectionEffects.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/tripEvents.ts`
- `convex/domain/vesselOrchestration/updateTimeline/timelineHandoffFromTripUpdate.ts`

Questions to answer:

- Can actualization rows be represented as a normal `ConvexPredictedDockWriteBatch`?
- Does `updateTimeline` ever project the same current `dep-dock` boundary on the leave-dock ping?
- Should actualization happen before or after `updateVesselPredictions`?
- Are there cases where `activeVesselTripUpdate.ScheduleKey` is missing on leave-dock but actualization should still occur?
- Should the actual time be floored to seconds, as the current `resolveDepartNextLegContext` does?
- Which tests currently cover depart-next actualization, and which need to move from trip persistence tests to the new domain or events-predicted tests?

## Expected End State

After the cleanup, a reader of `runOrchestratorPing` should be able to see that depart-next actualization exists as a named stage or named intent.

`persistVesselTripWrites` should no longer call `setDepartNextActualsForMostRecentCompletedTripInDb`.

`functions/vesselTrips/mutations.ts` should no longer own logic that patches `eventsPredicted`.

The actualization rule should be easy to test without Convex:

```text
given existing active trip docked
and next active trip at sea with LeftDockActual
and next active trip has ScheduleKey
then derive depart-next actualization intent for ScheduleKey dep-dock
```

The DB-level tests should verify that existing `AtDockDepartNext` and `AtSeaDepartNext` ML rows for that boundary receive `Actual` and `DeltaTotal`, and that the rows are not lost during same-ping predicted-event projection.
