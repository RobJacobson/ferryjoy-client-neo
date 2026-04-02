## VesselTimeline Backend Row Contract Handoff

This note is for the next agent implementing the next `VesselTimeline`
backend step after:

- the `vesselLocations.Key` refactor
- the `vesselTrips` `at-dock` / `at-sea` lifecycle simplification

The purpose of this task is to move timeline row identity and active-row
attachment into the backend so the frontend can become as close to a
pure view as possible.

## Goal

Shift `VesselTimeline` from:

- backend provides boundary-event tables
- frontend reconstructs rows
- frontend guesses active row

to:

- backend provides stable timeline row identity
- backend provides active row attachment
- frontend mostly renders the result

The user explicitly wants the frontend resolver to become “as much as a
view as possible, with minimal logic, while keeping the model in the
backend.”

## Architectural Intent

The next target architecture should make these responsibilities backend-owned:

1. row identity
2. active-row attachment
3. interpretation of live vessel state relative to timeline rows

The frontend should keep only:

1. presentation
2. layout
3. animation
4. visual fallbacks that do not change domain identity

## Helpful Docs To Read First

- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/.cursor/rules/code-style.mdc`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/docs/vessel-timeline-resolver-handoff.md`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/docs/vessel-location-key-refactor-handoff.md`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/docs/vessel-trips-at-dock-at-sea-refactor-handoff.md`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/README.md`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselOrchestrator/README.md`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/README.md`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/docs/ARCHITECTURE.md`

Why these matter:

- `vessel-timeline-resolver-handoff.md` explains why the current client
  resolver is too complex and where same-terminal ambiguity comes from
- the two newer handoff notes explain the recent backend identity and
  lifecycle simplifications this task should build on
- the backend/frontend architecture READMEs show the current seam that
  now needs to be redrawn

## Current Problem

Today the frontend still does all of the following:

- merges schedule, actual, and predicted overlays
- rebuilds dock/sea segments from boundary adjacency
- inserts placeholder dock rows
- decides which row is active
- applies fallback logic such as:
  - nearest same-terminal dock row
  - scheduled window
  - terminal tail
  - edge fallback

Key current files:

- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/data/contexts/convex/ConvexVesselTimelineContext.tsx`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/utils/buildSegmentsFromBoundaryEvents.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/utils/resolveActiveStateFromTimeline.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/renderState/buildActiveIndicator.ts`

That means the frontend is still a domain resolver.

The backend currently stores:

- `eventsScheduled`
- `eventsActual`
- `eventsPredicted`

but it does not yet provide:

- stable row IDs
- backend-owned active row attachment

## Desired End State

The frontend should receive a backend-resolved timeline view model
something like:

- ordered rows
- each row has stable `rowId`
- each row knows its kind:
  - `dock`
  - `sea`
  - optionally `terminal-tail`
- row carries whatever event/time data is needed for rendering
- backend returns one active attachment:
  - `activeRowId`
  - and any minimal live subtitle / motion hints needed for the
    indicator

The frontend should not have to:

- guess row identity from terminal/time proximity
- infer same-terminal visit continuity
- use predictions to decide which row is active

## Important Design Constraint

The backend model should build on the newer simplified trip lifecycle:

- vessel is `at-dock` or `at-sea`
- trips roll forward on arrival
- trip `Key` is now better aligned across:
  - `vesselLocations`
  - `vesselTrips`
  - timeline events

This task should take advantage of that stronger identity model rather
than layering new heuristics on top of the old frontend logic.

## Core Questions This Task Must Answer

### 1. What is a timeline row’s identity?

This is the main design question.

A sea row maps naturally to a trip key.

A dock row is trickier. It is conceptually the dock stay around a
terminal visit, not just one boundary event.

The backend must choose a stable row identity model such as:

- a synthetic `rowId` for every dock and sea row
- row ID derived from boundary-event keys
- row ID derived from trip key plus row kind

Do not leave this ambiguous for the frontend to reconstruct.

### 2. How should dock rows map to trip identity?

Pick and document one clear rule.

Examples of plausible rules:

- dock row belongs to the upcoming trip key
- dock row belongs to the trip whose departure ends that dock stay
- dock row belongs to both arrival/departure boundary keys, but backend
  still emits one stable `rowId`

The user has not dictated the exact rule yet. Choose the simplest rule
that works with the new arrival-triggered rollover model and document
it clearly.

### 3. What should active attachment look like?

The frontend should not receive a vague “row match” contract that still
requires reconstruction.

Prefer something direct such as:

- `activeRowId`
- optional `activeKind`
- optional live subtitle
- optional indicator motion fields

If there is a legitimate no-row case, make it explicit. But do not
preserve broad fallback reasoning trees in the frontend.

## Recommended Scope

This should primarily be a backend read-model task plus a narrow
frontend contract adaptation.

### Backend work

- define row identity
- build rows server-side or in a backend domain helper
- build active-row attachment server-side
- expose a query contract for the frontend

### Frontend work

- consume backend rows and active row directly
- keep render-state and visual logic
- delete or drastically shrink the current resolver path if practical

If deleting the current resolver entirely is too much for one pass,
replace it with a thin adapter that trusts backend `activeRowId`.

## Files Likely To Matter

Backend domain/query files:

- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/README.md`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/normalizedEvents.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTimeline/queries.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTimeline/activeStateSchemas.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTimeline/schemas.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTimeline/mutations.ts`

Trip/location inputs likely needed by backend resolver:

- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselLocation/queries.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselLocation/schemas.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/queries.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/README.md`

Frontend files likely to shrink or adapt:

- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/data/contexts/convex/ConvexVesselTimelineContext.tsx`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/docs/ARCHITECTURE.md`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/utils/buildSegmentsFromBoundaryEvents.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/utils/resolveActiveStateFromTimeline.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/renderState/resolveActiveSegmentIndex.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/hooks/useVesselTimelineViewModel.ts`

## Recommended Implementation Shape

### 1. Introduce a backend row contract

Define a backend row schema that is closer to what the frontend
actually needs.

For example:

- `rowId`
- `kind`
- `tripKey`
- `startEvent`
- `endEvent`
- optional placeholder / tail metadata if still needed

Whether this is a persisted table or a query-built read model is an
implementation choice. Prefer the smaller change unless persistence is
clearly justified.

### 2. Build rows on the backend, not in the frontend

Move segment construction logic out of
`buildSegmentsFromBoundaryEvents.ts` and into a backend helper or query
composition layer.

The current adjacency rules:

- `arv-dock -> dep-dock` => dock
- `dep-dock -> arv-dock` => sea

are backend-domain logic, not presentation logic.

If placeholders or terminal tails remain necessary, backend should emit
them explicitly rather than expecting the client to synthesize them.

### 3. Build active attachment on the backend

Replace the current client-side active-state resolution with a backend
function that:

- consumes live vessel location
- consumes actual/predicted/scheduled rows
- chooses `activeRowId`

The current frontend fallback rules in
`resolveActiveStateFromTimeline.ts` are useful reference material, but
the goal is not to transplant the same complexity into the backend
unchanged.

Instead, use the newer stronger key/lifecycle model to simplify:

- use `vesselLocations.Key` and trip identity wherever possible
- reserve schedule-only fallback for true boundary cases

### 4. Keep frontend render logic minimal

The frontend should still own:

- layout sizing
- labels
- animation
- indicator position within the chosen row

But it should not own row identity or active-row selection.

## Recommended Invariants

The resulting system should aim to satisfy:

1. The backend emits one stable `rowId` per timeline row
2. The backend, not the frontend, decides which row is active
3. Predictions never determine row identity
4. Schedule remains structure, not authority for late-service attachment
5. The frontend never has to choose between same-terminal dock rows
6. Placeholder or terminal-tail behavior is explicit in the backend
   contract if it affects identity
7. `activeRowId` is sufficient for the frontend to place the indicator

## Testing Expectations

This task should include scenario tests, not just helper tests.

At minimum add/adjust coverage for:

### Case 1: Late arrival overlaps next scheduled cycle

- vessel arrives late
- delayed next trip should still map to the correct dock row
- backend should emit the correct `activeRowId`

### Case 2: Missing actuals, continued location history

- active row should remain coherent
- frontend should no longer need same-terminal guessing

### Case 3: First-seen docked vessel

- backend should emit stable row identity or explicit terminal-tail state

### Case 4: Terminal tail

- if used, terminal-tail row identity should be explicit and backend-owned

### Case 5: Placeholder behavior

- if placeholders remain part of the rendered model, verify they are
  emitted intentionally rather than synthesized client-side

Likely frontend tests to update:

- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/utils/tests/resolveActiveStateFromTimeline.test.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/utils/tests/buildSegmentsFromBoundaryEvents.test.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/renderState/tests/vesselTimelineRenderState.test.ts`

Likely new backend tests to add if a backend resolver/query is created.

## Documentation Expectations

If this lands, update at least:

- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/README.md`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/docs/ARCHITECTURE.md`

Those docs currently describe:

- frontend-built segments
- client-owned active-state resolution

That should no longer be true after this refactor.

## Non-Goals

Do not silently expand this task into:

- a full redesign of prediction precedence
- another major rewrite of `vesselTrips`
- historical backfill tooling
- extra status fields like `provisional` / `unknown` unless truly needed

This task is about moving the row model and active attachment into the
backend, not reopening every recent design decision.

## Bottom Line

Build a backend-owned `VesselTimeline` row contract:

- stable `rowId`
- backend-built rows
- backend-owned `activeRowId`

Then reduce the frontend to a mostly-render-only layer that trusts the
backend model instead of reconstructing and resolving it itself.
