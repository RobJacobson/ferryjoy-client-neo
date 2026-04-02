## VesselTimeline Frontend Migration Handoff

This note is for the next agent migrating the frontend to the new
backend-owned `VesselTimeline` row contract.

The backend now owns:

- timeline row identity
- row ordering and row structure
- placeholder / terminal-tail identity semantics
- `activeRowId`
- raw `live` vessel state

The frontend should now become as close to a pure view as possible.

## Goal

Replace the old frontend pipeline:

- fetch raw scheduled / actual / predicted event tables
- merge them client-side
- rebuild dock/sea segments client-side
- resolve active row client-side

with the new pipeline:

- fetch backend `VesselTimelineViewModel`
- render backend rows directly
- use backend `activeRowId`
- derive only presentation details locally

## Important Current Boundary

The backend contract has already been trimmed so it now carries domain
data only, not presentation-derived indicator UI.

Backend returns:

- `VesselAbbrev`
- `SailingDay`
- `ObservedAt`
- `rows`
- `activeRowId`
- `live`

It does **not** return a backend `activeIndicator`.

That means the frontend should derive:

- subtitle text
- animation flag
- speed formatting
- indicator positioning within the selected row

locally from:

- backend `live`
- backend `activeRowId`
- backend row data

## Helpful Docs To Read First

- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/.cursor/rules/code-style.mdc`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/docs/vessel-timeline-resolver-handoff.md`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/docs/vessel-timeline-backend-row-contract-handoff.md`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/docs/vessel-timeline-backend-contract-trim-handoff.md`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/README.md`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/docs/ARCHITECTURE.md`

Why these matter:

- the resolver handoff explains the old complexity this migration is
  supposed to delete
- the backend row-contract and trim handoffs explain the new server-side
  contract and why presentation logic should stay client-side
- the docs reflect the intended new architecture

## Current Obsolete Frontend Pieces

These files were central to the old resolver-era architecture and are
now architecturally obsolete or should become very thin adapters:

- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/data/contexts/convex/ConvexVesselTimelineContext.tsx`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/hooks/useVesselTimelineViewModel.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/utils/buildSegmentsFromBoundaryEvents.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/utils/resolveActiveStateFromTimeline.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/renderState/resolveActiveSegmentIndex.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/types/index.ts`

These files should either:

- be removed entirely
- be rewritten as thin adapters
- or be reduced to presentation-only helpers

## Backend Files To Read For The New Contract

- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTimeline/queries.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTimeline/schemas.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTimeline/activeStateSchemas.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/viewModel.ts`

Those define the shape the frontend should now consume.

## Recommended Migration Shape

### 1. Switch the data context to the backend view model

Update:

- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/data/contexts/convex/ConvexVesselTimelineContext.tsx`

Current behavior:

- fetches four separate queries
- merges rows client-side

Target behavior:

- fetch only `getVesselTimelineViewModel({ VesselAbbrev, SailingDay })`
- expose:
  - `rows`
  - `activeRowId`
  - `live`
  - `ObservedAt`

Any client-side reconstruction of boundary-event overlays should be
deleted.

### 2. Adapt the screen-level view-model hook

Update:

- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/hooks/useVesselTimelineViewModel.ts`

Current behavior:

- builds `segments`
- resolves active state
- asks render-state to map active state to an active segment

Target behavior:

- consume backend `rows` directly
- use backend `activeRowId` directly
- derive a selected row index from `rowId`
- locally derive indicator presentation from `live`

This hook should become much smaller.

### 3. Decide whether to reuse or replace render-state types

Check whether current render-state helpers can operate on backend rows
with only small renames/adapters.

The backend row shape is already close to semantic render input:

- `rowId`
- `kind`
- `startEvent`
- `endEvent`
- `durationMinutes`
- `placeholderReason`
- `rowEdge`

That may allow you to:

- map backend rows almost directly into render-state
- avoid reconstructing any intermediate segment layer

Prefer deleting layers rather than preserving them out of habit.

### 4. Keep indicator presentation local

Use:

- backend `live`
- backend `activeRowId`
- selected row

to derive:

- subtitle text
- whether animation should run
- any speed-related display values

Likely useful current file:

- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/renderState/buildActiveIndicator.ts`

This file should stay client-owned, but it may need to be adapted to
consume backend `rows` directly rather than old resolver-era state.

### 5. Remove or dramatically shrink the old resolver logic

Once the new context/hook path works:

- delete or retire `resolveActiveStateFromTimeline.ts`
- delete or retire `buildSegmentsFromBoundaryEvents.ts`
- delete or retire `resolveActiveSegmentIndex.ts`

If one of these survives, it should only be because it still serves a
pure view concern, not because it is resolving domain identity.

## Recommended Ownership Split

### Backend owns

- row identity
- active row selection
- placeholder and terminal-tail identity
- row timing payloads
- live state payload

### Frontend owns

- row layout
- labels
- indicator subtitle copy
- animation toggles
- speed formatting
- indicator placement within a chosen row
- empty/error/loading UI

This split is important. Do not reintroduce domain identity logic into
the frontend as part of the migration.

## Suggested Frontend Contract Shape

The context should probably expose something close to:

- `rows: VesselTimelineRow[]`
- `activeRowId: string | null`
- `live: VesselTimelineLiveState | null`
- `ObservedAt: Date | null`
- `IsLoading`
- `ErrorMessage`
- `Retry`

Keep it thin and backend-aligned.

## Testing Expectations

Update or replace frontend tests so they verify the new render path
without depending on the deleted resolver.

Likely tests to touch:

- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/renderState/tests/vesselTimelineRenderState.test.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/utils/tests/resolveActiveStateFromTimeline.test.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/utils/tests/buildSegmentsFromBoundaryEvents.test.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/utils/tests/VesselTimelineLifecycle.test.ts`

Recommended new cases:

### Case 1: Backend `activeRowId` selects the correct dock row

- no client-side same-terminal guessing should occur

### Case 2: Backend `activeRowId = null`

- timeline still renders rows
- indicator is absent
- live state remains available for future UX if needed

### Case 3: Terminal tail row

- frontend renders terminal tail from backend row metadata
- no synthetic terminal-tail inference remains client-side

### Case 4: Placeholder row

- frontend renders placeholder rows from backend metadata
- no client synthesis remains

### Case 5: Local indicator presentation

- subtitle/animation derive correctly from backend `live`
- no backend indicator payload is required

## Documentation Expectations

After migration, update at least:

- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/docs/ARCHITECTURE.md`

That doc should say, clearly:

- backend builds rows
- backend resolves `activeRowId`
- frontend renders rows and derives presentation only

## Non-Goals

Do not reopen these during this migration unless truly necessary:

- trip lifecycle semantics
- backend row identity rules
- prediction precedence design
- schedule inference behavior

Those have already been moved into backend work. This pass should
consume the new contract, not redesign it.

## Bottom Line

The migration should delete the old resolver-era client architecture and
replace it with a much thinner frontend:

- fetch backend `VesselTimelineViewModel`
- render backend `rows`
- trust backend `activeRowId`
- derive only presentation details locally

That is the intended final shape.
