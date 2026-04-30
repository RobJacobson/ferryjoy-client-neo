# updateVesselTrip Rewrite PRD

Date: 2026-04-29

## Purpose

Rewrite `convex/domain/vesselOrchestration/updateVesselTrip` around the smallest
useful functional pipeline:

```text
previous active trip + current vessel location
  -> detect new-trip signal
  -> optionally complete the previous trip
  -> build the current active trip
  -> optionally enrich new-trip schedule fields
  -> suppress timestamp-only churn
  -> return VesselTripUpdate | null
```

The current folder has accumulated event bundles, builder seams, schedule
helpers, and tests that preserve implementation shape more than behavior. The
rewrite should recover the readability of the older pre-domain-layer trip
builder approach without reintroducing its mixed concerns around prediction,
persistence, and timeline projection.

## Source Material

Current authoritative folder:

- `convex/domain/vesselOrchestration/updateVesselTrip/`
- `convex/domain/vesselOrchestration/updateVesselTrip/README.md`
- `convex/functions/vesselOrchestrator/README.md`
- `convex/functions/vesselOrchestrator/VesselOrchestratorPipeline.md`

Historical contrast, not a model to copy or preserve:

- Branch: `pre-vessel-orchestration-refactor`
- Treat these files as archaeology. They are useful for understanding the older
  "derive inputs, build base trip, then enrich" mental model, but they are a
  historical anachronism relative to the current domain-layer design.
- Historical files of interest:
  - `convex/domain/vesselTrips/tripLifecycle/buildTrip.ts`
  - `convex/domain/vesselTrips/tripLifecycle/baseTripFromLocation.ts`
  - `convex/domain/vesselTrips/tripLifecycle/detectTripEvents.ts`
  - `convex/domain/vesselTrips/tripLifecycle/tripDerivation.ts`
  - `convex/domain/vesselTrips/tripLifecycle/buildCompletedTrip.ts`
  - `convex/domain/vesselTrips/tripLifecycle/processCompletedTrips.ts`
  - `convex/domain/vesselTrips/tripLifecycle/processCurrentTrips.ts`

Reference memo:

- `docs/engineering/2026-04-24-vessel-orchestrator-latest-comparison-memo.md`

## Product Contract

`updateVesselTrip` owns one durable domain question:

> Given `prevActiveTrip` and `currentVesselLocation`, what completed trip row, if
> any, and what current active trip row, if any, should the orchestrator persist?

Public API must remain:

```ts
updateVesselTrip(
  vesselLocation: ConvexVesselLocation,
  existingActiveTrip: ConvexVesselTrip | undefined,
  dbAccess: UpdateVesselTripDbAccess
): Promise<VesselTripUpdate | null>
```

`VesselTripUpdate` must remain compatible with downstream prediction,
actualization, timeline, and persistence code:

- `vesselAbbrev`
- `existingActiveTrip?`
- `activeVesselTripUpdate`
- `completedVesselTripUpdate?`

## Core Rules

New trip detection:

- A new trip is signaled when there is a previous active trip and:

```ts
previousActiveTrip.DepartingTerminalAbbrev !==
  currentVesselLocation.DepartingTerminalAbbrev
```

- Trust this terminal-abbreviation transition even if `AtDockObserved` has not
  yet flipped. WSF can lag on the formal dock signal; the terminal handoff is
  the authoritative lifecycle boundary for this code.

Phase state:

- Persist trip `AtDock` from `currentVesselLocation.AtDockObserved`, not raw
  `AtDock`.

First-seen vessel:

- Build a current active trip.
- Do not stamp `TripStart` for a first-seen trip merely because the
  vessel is currently docked; the true arrival happened before this pipeline
  had state.

Completed trip:

- When a new-trip signal exists, close the previous active trip.
- Set coverage close fields such as `TripEnd` and `TripEnd` from
  `currentVesselLocation.TimeStamp`.
- Set physical arrival fields such as `TripEnd` and `TripEnd` from
  `currentVesselLocation.TimeStamp` because the terminal transition is trusted
  arrival evidence.
- Backfill the completed row destination terminal from
  `currentVesselLocation.DepartingTerminalAbbrev` when the previous trip had no
  destination.

Current active trip:

- Always build the next active row as the merge of prior durable trip facts and
  current location facts, with explicit start/replacement exceptions.
- On a new-trip signal, start a replacement trip with a new `TripKey`,
  `TripStart`, `TripStart`, and `TripStart` equal to the current
  timestamp.
- On a continuing trip, preserve the existing `TripKey`, `TripStart`,
  `TripStart`, previous-terminal metadata, and prior physical boundary facts.
- On departure from dock, set `LeftDockActual` from
  `currentVesselLocation.LeftDock ?? currentVesselLocation.TimeStamp`.

Schedule lookups:

- Schedule lookup is allowed for new/replacement trips only.
- Continuing trips must not repeatedly query schedule data every 5 seconds when
  WSF fields are missing.
- Continuing trips may use complete authoritative WSF trip fields when present,
  otherwise carry existing trip schedule fields.
- New/replacement trips should use complete WSF fields first, then schedule
  resolution if WSF is incomplete and the vessel is in service.

Change suppression:

- If the candidate active trip differs from the previous active trip only by
  `TimeStamp`, return `null`.
- Completion rollover always returns both the completed row and replacement
  active row.
- Keep prediction fields out of persisted trip-row comparison by continuing to
  strip them before equality checks.

## Non-Goals

- Do not reintroduce ML prediction computation into `updateVesselTrip`.
- Do not move persistence into the domain folder.
- Do not introduce a broad schedule snapshot read for every ping.
- Do not preserve internal module names/tests when they encode the old design.
- Do not create a new "trip events" DTO that is passed through the pipeline.

## Target Module Map

The final folder should be close to this:

```text
updateVesselTrip/
  updateVesselTrip.ts
  lifecycleSignals.ts
  buildActiveTrip.ts
  completeTrip.ts
  scheduleForActiveTrip.ts
  tripComparison.ts
  stripTripPredictionsForStorage.ts
  tripLifecycle.ts
  types.ts
  README.md
  tests/
```

### `lifecycleSignals.ts`

Small standalone arrow functions only. Avoid returning a bundle.

Expected helpers:

- `isNewTrip(previousTrip, location): boolean`
- `didLeaveDock(previousTrip, location): boolean`
- `leftDockTimeForUpdate(previousTrip, location): number | undefined`

These helpers should be imported and called near the code that needs them.

### `completeTrip.ts`

Pure helper:

```ts
completeTrip(previousTrip, location): ConvexVesselTrip
```

Owns only the completed-row closeout.

### `buildActiveTrip.ts`

Pure helper:

```ts
buildActiveTrip({
  previousTrip,
  completedTrip,
  location,
  isNewTrip,
}): ConvexVesselTrip
```

Owns the base active row before schedule enrichment.

### `scheduleForActiveTrip.ts`

Owns schedule-facing fields for the active row.

Rules:

- Complete WSF destination + scheduled departure wins.
- Continuing trip with incomplete WSF carries prior schedule fields and does no
  schedule lookup.
- Replacement/new trip with incomplete WSF may perform one bounded schedule
  evidence read.

This module should replace the current split between `scheduleEnrichment.ts`
and `tripFields/` unless a small private subfolder remains clearly simpler.

### `tripLifecycle.ts`

Keep only downstream compatibility helpers for prediction/timeline:

- `buildCompletionTripEvents`
- `currentTripEvents`
- `TripLifecycleEventFlags`

These should derive from row diffs and should not drive the main pipeline.

## Desired Public Pipeline

`updateVesselTrip.ts` should read approximately like this:

```ts
const updateVesselTrip = async (location, previousTrip, dbAccess) => {
  try {
    const newTrip = isNewTrip(previousTrip, location);
    const completedTrip =
      newTrip && previousTrip ? completeTrip(previousTrip, location) : undefined;

    const baseActiveTrip = buildActiveTrip({
      previousTrip,
      completedTrip,
      location,
      isNewTrip: newTrip,
    });

    const activeTrip = await applyScheduleForActiveTrip({
      activeTrip: baseActiveTrip,
      previousTrip,
      completedTrip,
      location,
      isNewTrip: newTrip,
      dbAccess,
    });

    if (!completedTrip && isSameVesselTrip(previousTrip, activeTrip)) {
      return null;
    }

    return {
      vesselAbbrev: location.VesselAbbrev,
      existingActiveTrip: previousTrip,
      activeVesselTripUpdate: activeTrip,
      completedVesselTripUpdate: completedTrip,
    };
  } catch (error) {
    log and return null;
  }
};
```

Exact implementation may differ, but this should remain the review standard:
linear, data-oriented, and easy to read in one screen.

## Schedule Access (Stage 6)

Current `UpdateVesselTripDbAccess` exposes two targeted reads:

- `getScheduledSegmentByScheduleKey(scheduleKey)`
- `getScheduleRolloverDockEvents({ vesselAbbrev, timestamp })`

The domain resolver uses them in order: `NextScheduleKey` continuity first, then
schedule rollover as fallback. The fallback read only runs when the key lookup is
absent, missing, or terminal-mismatched. `InService` is the schedule-read gate;
there is no passenger-terminal check in this path.

Both reads are implemented as internal Convex queries under
`functions/vesselOrchestrator/pipeline/updateVesselTrip/queries.ts`, while the
domain remains Convex-free.

## Staged Implementation Plan

Current handoff note:

- Stage 6: `docs/engineering/2026-04-29-update-vessel-trip-rewrite-stage-6-handoff.md`

Completed handoff notes:

- Stage 1: `docs/engineering/2026-04-29-update-vessel-trip-rewrite-stage-1-handoff.md`
- Stage 2: `docs/engineering/2026-04-29-update-vessel-trip-rewrite-stage-2-handoff.md`
- Stage 3: `docs/engineering/2026-04-29-update-vessel-trip-rewrite-stage-3-handoff.md`
- Stage 4: `docs/engineering/2026-04-29-update-vessel-trip-rewrite-stage-4-handoff.md`
- Stage 5: `docs/engineering/2026-04-29-update-vessel-trip-rewrite-stage-5-handoff.md`

### Stage 1: Public Behavior Test Net

Goal: replace implementation-shaped tests with behavior-shaped tests before
rewriting the internals.

Worker scope:

- Add or rewrite tests that call only public `updateVesselTrip` and public
  compatibility helpers.
- Avoid spying on `detectTripEvents`, builders, or schedule internals.
- Preserve only tests that assert durable business behavior.

Minimum behavior cases:

- First-seen vessel creates an active trip without `TripStart`.
- Continuing timestamp-only churn returns `null`.
- Continuing ETA change returns an active trip update.
- Continuing dock-to-sea transition stamps `LeftDockActual`.
- Terminal abbreviation change completes prior trip and starts replacement.
- Terminal abbreviation change is trusted even when `AtDockObserved` is false.
- Continuing incomplete WSF fields do not schedule-read.
- Replacement incomplete WSF fields may schedule-read and infer current/next
  schedule fields.
- Out-of-service replacement trips skip schedule lookup.

Review checkpoint:

- Tests describe the desired contract, not the current architecture.
- The suite may fail before Stage 2 if it encodes new behavior. That is
  acceptable if failures are documented.

### Stage 2: New Pipeline Modules

Goal: implement the target module map while leaving old modules untouched until
the new path is wired.

Worker scope:

- Add `lifecycleSignals.ts`.
- Add `completeTrip.ts`.
- Add `buildActiveTrip.ts`.
- Add `scheduleForActiveTrip.ts`.
- Keep functions pure where possible.
- Reuse existing helpers for:
  - `calculateTimeDelta`
  - `generateTripKey`
  - `deriveTripIdentity`
  - `stripVesselTripPredictions`

Review checkpoint:

- No ML, prediction, timeline, or persistence logic enters these modules.
- No pass-around event bundle is introduced.
- Schedule lookup decisions are localized to `scheduleForActiveTrip.ts`.

### Stage 3: Wire `updateVesselTrip`

Goal: replace the current implementation path with the new linear reducer.

Worker scope:

- Rewrite `updateVesselTrip.ts` to use the new modules.
- Preserve the public API and error-isolation behavior.
- Keep `VesselTripUpdate` unchanged.
- Keep `tripComparison.ts` unless a small rename is clearly useful.

Review checkpoint:

- `updateVesselTrip.ts` is readable as a single linear pipeline.
- Completion rollover returns completed + active rows.
- No-op continuing updates return `null`.
- Existing orchestrator imports still compile.

### Stage 4: Compatibility Helper Audit

Goal: keep downstream prediction/timeline contracts working while removing
obsolete event-driven internals.

Worker scope:

- Keep or adjust `tripLifecycle.ts` exports:
  - `TripLifecycleEventFlags`
  - `buildCompletionTripEvents`
  - `currentTripEvents`
- Ensure `updateVesselPredictions`, `updateTimeline`, and
  `updateVesselActualizations` tests still pass.
- Delete or stop exporting old internal event modules once callers are gone.

Review checkpoint:

- Downstream consumers derive lifecycle facts from row diffs.
- The main trip pipeline does not depend on `TripLifecycleEventFlags`.

### Stage 5: Delete Obsolete Modules and Rewrite Docs

Goal: remove cruft once the new path is green.

Worker scope:

- Delete superseded modules:
  - `tripEvents.ts`
  - `tripBuilders.ts`
  - `basicTripRows.ts`
  - `scheduleEnrichment.ts`
  - `tripFields/` if fully replaced
- Delete obsolete implementation-shaped tests.
- Update `updateVesselTrip/README.md`.
- Update `convex/domain/vesselOrchestration/architecture.md` if its module map
  still mentions removed seams.

Review checkpoint:

- Folder map matches the new functional pipeline.
- Docs explain when schedule lookup happens and why continuing-trip fallback is
  intentionally omitted.

### Stage 6: Key-First Schedule Resolution

Goal: make `NextScheduleKey` continuity the primary new-trip schedule path, with
rollover search as an explicit fallback.

Worker scope:

- Add one internal query for key-backed segment lookup.
- Add one internal query for rollover current/next-day dock rows.
- Keep fallback reads replacement/new-trip-gated and `InService`-gated.

Review checkpoint:

- This stage must not reintroduce full-day schedule snapshot reads per ping.
- It must not cause continuing trips to poll schedule data every tick.

## Handoff Template For Worker Agents

Use this template for each stage:

```md
## Stage N Handoff

Branch: rewrite-update-vessel-trips

Read first:
- docs/engineering/2026-04-29-update-vessel-trip-rewrite-prd.md
- convex/domain/vesselOrchestration/updateVesselTrip/README.md
- relevant current test file(s)

Goal:
- ...

Files you may edit:
- ...

Files you should avoid unless necessary:
- ...

Behavior to preserve:
- ...

Verification:
- bun test <focused test files>
- bun run typecheck or project equivalent if practical

Return:
- Summary of changed files
- Tests run and results
- Any behavior questions or deviations from the PRD
```

## Review Rubric

Reject a stage if it:

- Introduces a new monolithic trip-event DTO for the main pipeline.
- Performs schedule reads for continuing trips with missing fields.
- Derives arrival completion from `AtDockObserved` instead of terminal
  abbreviation transition.
- Stamps first-seen `TripStart` without a real rollover boundary.
- Mixes prediction or persistence concerns back into trip row construction.
- Preserves old tests by shaping the new code around obsolete internals.

Approve a stage when:

- The code reads as data transformation.
- Each module answers one plain-language question.
- Expensive or conditional reads are visibly gated.
- Downstream public contracts stay stable.
- The tests describe ferry lifecycle behavior, not helper choreography.
