## VesselTimeline Backend Contract Trim Handoff

This note is for the next agent working on the `VesselTimeline`
frontend migration after the backend row-contract refactor.

The backend row-contract rewrite moved the architecture in the right
direction, but it likely pushed too much presentation logic into the
backend view model.

This note exists to correct that boundary before the frontend migration
cements it.

## Main Point

The backend should own the domain model.

The frontend should still own presentation.

That means:

### Backend-owned

- row identity
- row ordering
- row structure
- placeholder / terminal-tail identity semantics
- `activeRowId`
- raw live vessel state needed for rendering

### Frontend-owned

- indicator subtitle text
- whether the indicator animates
- speed label formatting
- indicator positioning within a selected row
- any purely visual copy or motion rules

## What To Trim

The new backend contract currently includes a compact
`activeIndicator` payload in:

- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTimeline/activeStateSchemas.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTimeline/schemas.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/viewModel.ts`

That payload includes presentation-derived values such as:

- `subtitle`
- `animate`
- `speedKnots`

These should not be part of the backend contract.

They are UX-layer derivations from:

- live vessel state
- selected row
- client display rules

Sending them from the backend is unnecessary coupling and wasted
bandwidth for something that is not domain state.

## Recommended Target Contract

The backend `VesselTimelineViewModel` should ideally expose only:

- `VesselAbbrev`
- `SailingDay`
- `ObservedAt`
- `rows`
- `activeRowId`
- `live`

That should be enough for the frontend to:

- know which row is active
- know the current live vessel state
- derive indicator text/animation locally

## Recommended Changes

### 1. Remove backend `activeIndicator`

Trim it from:

- backend schemas
- backend view-model builder
- backend tests

Primary files:

- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTimeline/activeStateSchemas.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTimeline/schemas.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/viewModel.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/tests/viewModel.test.ts`

### 2. Keep `live` as raw rendering input

The backend should still return live vessel fields such as:

- `AtDock`
- `InService`
- `Speed`
- terminal abbreviations
- distances
- timing fields

Those are legitimate inputs for client rendering decisions.

### 3. Let the frontend derive indicator presentation

Once the frontend is migrated to backend-owned rows and `activeRowId`,
it should locally derive:

- subtitle
- animation flag
- speed label

using the backend-provided `live` payload and selected row.

## Helpful Files To Read First

- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/docs/vessel-timeline-backend-row-contract-handoff.md`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/viewModel.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTimeline/schemas.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTimeline/activeStateSchemas.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/renderState/buildActiveIndicator.ts`

Why these matter:

- the row-contract handoff explains the broader backend-owned identity
  shift
- `buildActiveIndicator.ts` shows the kind of presentation logic that
  should remain client-side

## Non-Goal

Do not undo the backend row-contract work itself.

The correction here is narrow:

- keep backend-owned rows
- keep backend-owned `activeRowId`
- trim presentation-only fields

## Bottom Line

Before the frontend migration proceeds too far:

- slim the backend view model to domain data only
- remove `activeIndicator` from the backend contract
- let the frontend derive indicator UX from `live` + `activeRowId`

That preserves the architectural improvement without turning the backend
into a UI formatter.
