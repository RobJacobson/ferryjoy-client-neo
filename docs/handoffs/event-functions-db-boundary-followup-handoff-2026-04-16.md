# Handoff: Event Functions DB Boundary Follow-Up

**Date:** 2026-04-16  
**Audience:** implementation agent  
**Goal:** Complete the event-layer boundary cleanup so that **all database operations for `eventsScheduled`, `eventsActual`, and `eventsPredicted` live under `convex/functions/events/**`**. The previous reorganization moved the folders and cleaned up the import graph, but the DB operation boundary is still incomplete.

## Summary

The current repo state is improved but not yet at the intended architecture.

### What is already correct

- The event tables now live under:
  - `convex/functions/events/eventsScheduled/`
  - `convex/functions/events/eventsActual/`
  - `convex/functions/events/eventsPredicted/`
- `convex/functions/events/shared/` exists.
- There are no remaining imports from `convex/domain/**` into `convex/functions/events/**`.
- There are no remaining imports from `convex/functions/events/**` into `convex/domain/**`.
- `eventsScheduled` query logic no longer imports domain business logic.

### What is still wrong

The event-table **DB operations are still scattered outside** `convex/functions/events/**`.

That means the architecture is currently only half-finished:

- the import boundary is clean
- the DB operation boundary is not yet centralized

## Required architectural rule

The intended rule for this follow-up is:

- **All reads/writes for `eventsScheduled`, `eventsActual`, and `eventsPredicted` belong under `convex/functions/events/**`.**
- Other functions-layer modules may orchestrate by calling event-layer queries/mutations.
- Domain code must remain pure and must not access `ctx.db` for these tables.
- `convex/functions/events/**` may contain only:
  - Convex registration
  - validators
  - direct `ctx.db` reads/writes
  - persistence-oriented comparison/reconciliation helpers
- `convex/functions/events/**` must not contain business logic.

## Findings to address

### 1. `eventsActual` has no query surface yet

Current state:

- `convex/functions/events/eventsActual/` contains:
  - `index.ts`
  - `mutations.ts`
  - `schemas.ts`

There is no `queries.ts` file for table reads.

Why this matters:

- Reads for `eventsActual` still happen elsewhere.
- That means callers are bypassing the new event-table layer.

### 2. `eventsPredicted` has no query surface yet

Current state:

- `convex/functions/events/eventsPredicted/` contains:
  - `identity.ts`
  - `index.ts`
  - `mutations.ts`
  - `schemas.ts`

There is no `queries.ts` file for table reads.

Why this matters:

- `eventsPredicted` reads still happen in domain and in other function modules.
- This violates the intended “all event-table DB operations live under `convex/functions/events/**`” rule.

### 3. `vesselTimeline` still directly queries all three event tables

Current issue:

- `convex/functions/vesselTimeline/queries.ts` directly queries:
  - `eventsScheduled`
  - `eventsActual`
  - `eventsPredicted`

Why this matters:

- `vesselTimeline` is still acting as an event-table read layer.
- That responsibility should now belong to the event subtree.

Required change:

- Move those raw table reads into:
  - `convex/functions/events/eventsScheduled/queries.ts`
  - `convex/functions/events/eventsActual/queries.ts`
  - `convex/functions/events/eventsPredicted/queries.ts`
- Leave `vesselTimeline/queries.ts` as the orchestration wrapper that calls event-table queries and then passes plain rows to domain.

### 4. Domain still directly queries `eventsPredicted`

Current issue:

- `convex/domain/vesselTrips/read/enrichTripsWithPredictions.ts` directly calls:
  - `ctx.db.query("eventsPredicted")`

Why this matters:

- This is the clearest remaining architectural violation.
- Domain should not perform DB operations for event tables.

Required change:

- Split this module into:
  - a pure domain enrichment function that accepts already-loaded predicted rows
  - a functions-layer query wrapper that performs the DB reads under `convex/functions/events/eventsPredicted/queries.ts` or an adjacent functions-layer caller

Recommended shape:

- Domain owns the merge/join logic.
- Functions own the DB access.

### 5. `vesselTrips` still patches `eventsPredicted` directly

Current issue:

- `convex/functions/vesselTrips/mutations.ts` directly queries and patches `eventsPredicted` in `patchDepartNextPredictionActuals`.

Why this matters:

- Table-specific predicted-row mutation logic should live in the `eventsPredicted` module.

Required change:

- Move that logic into `convex/functions/events/eventsPredicted/mutations.ts`.
- Expose it as an internal mutation or internal helper local to that module.
- `vesselTrips/mutations.ts` should call the event-layer mutation instead of touching the table directly.

### 6. `vesselTimeline` still owns scheduled/actual table reconciliation writes

Current issue:

- `convex/functions/vesselTimeline/mutations.ts` still directly reads/writes:
  - `eventsScheduled`
  - `eventsActual`

Why this matters:

- Those are table-specific DB reconciliation routines.
- They should live in the corresponding event modules, not in `vesselTimeline`.

Required change:

- Add `convex/functions/events/eventsScheduled/mutations.ts` for scheduled-row replacement/reconciliation.
- Expand `convex/functions/events/eventsActual/mutations.ts` to own the sailing-day replacement/supersession path now in `vesselTimeline/mutations.ts`.
- Leave `vesselTimeline/mutations.ts` as an orchestrator that invokes event-table mutations after domain has produced persistence-ready rows.

### 7. `eventsActual/schemas.ts` still exposes stale sparse-write contracts

Current issue:

- `convex/functions/events/eventsActual/schemas.ts` still defines:
  - `actualDockWriteSchema`
  - `ConvexActualDockWrite`
  - `ConvexActualDockWriteWithTripKey`
  - `ConvexActualDockWritePersistable`

But the mutation now accepts only normalized `eventsActualSchema` rows.

Why this matters:

- This DB-layer surface is now misleading.
- It suggests the event DB layer still accepts sparse business-layer writes.

Required change:

- Remove these write-oriented validators/types from the functions-layer schema if they are no longer used there.
- Keep only persisted-row validators/types in the event DB layer.
- If sparse write contracts are still needed, keep them under domain-owned event contracts instead.

## Implementation plan

### Phase 1: add missing query modules

Create:

- `convex/functions/events/eventsActual/queries.ts`
- `convex/functions/events/eventsPredicted/queries.ts`

Add only raw DB query operations needed by current callers.

Likely queries:

#### `eventsActual`

- load rows by vessel/day
- load row by `EventKey`
- load rows by sailing day if needed by reseed/replacement callers

#### `eventsPredicted`

- load rows by vessel/day
- load row(s) by key/type/source
- load rows by key scope if that helps current callers

Keep these query modules DB-only.

### Phase 2: move event-table reads out of `vesselTimeline`

Refactor `convex/functions/vesselTimeline/queries.ts`:

- remove direct reads of `eventsScheduled`, `eventsActual`, `eventsPredicted`
- call event-table query surfaces instead
- keep only orchestration and response assembly in `vesselTimeline`

### Phase 3: remove event-table DB access from domain

Refactor `convex/domain/vesselTrips/read/enrichTripsWithPredictions.ts`:

- remove direct `ctx.db` use
- make the enrichment logic pure
- pass preloaded predicted rows into the pure domain function from a functions-layer query wrapper

Possible approach:

1. Rename current domain module to something like `mergeTripsWithPredictions.ts`
2. Make it accept:
   - trips
   - predicted rows preloaded by vessel/day scope
3. Create or update a functions-layer query wrapper in `convex/functions/vesselTrips/queries.ts` that:
   - loads trips
   - loads predicted rows via `eventsPredicted/queries.ts`
   - calls the pure domain joiner

### Phase 4: move predicted-row patching into `eventsPredicted`

Refactor `convex/functions/vesselTrips/mutations.ts`:

- remove direct `eventsPredicted` patch/query logic
- move it into `convex/functions/events/eventsPredicted/mutations.ts`

Suggested new internal surface:

- `actualizeDepartNextMlPredictions`

Inputs:

- departure boundary key
- actual timestamp

Behavior:

- find matching ML depart-next predicted rows
- patch `Actual` and `DeltaTotal` when appropriate

### Phase 5: move scheduled/actual replacement logic into event modules

Refactor `convex/functions/vesselTimeline/mutations.ts`:

- remove direct table reconciliation for `eventsScheduled`
- remove direct table reconciliation for `eventsActual`

Add/expand:

- `convex/functions/events/eventsScheduled/mutations.ts`
- `convex/functions/events/eventsActual/mutations.ts`

Suggested event-level mutations:

#### `eventsScheduled`

- replace scheduled rows for one sailing day

#### `eventsActual`

- replace actual rows for one sailing day while retaining allowed physical-only rows
- keep the current row comparison and supersession behavior intact

Then `vesselTimeline/mutations.ts` should orchestrate by calling these mutations rather than touching the tables directly.

### Phase 6: clean up stale schema surfaces

In `convex/functions/events/eventsActual/schemas.ts`:

- remove sparse-write validators/types that are no longer used by the DB layer
- leave only persisted-row validators/types and any validators strictly required by event DB mutations

Do the same kind of cleanup in other event modules if new refactors make their schema files broader than necessary.

## Acceptance criteria

- `eventsActual/queries.ts` exists and owns `eventsActual` reads
- `eventsPredicted/queries.ts` exists and owns `eventsPredicted` reads
- `vesselTimeline/queries.ts` no longer directly queries event tables
- `convex/domain/**` contains no direct DB operations against `eventsScheduled`, `eventsActual`, or `eventsPredicted`
- `vesselTrips/mutations.ts` no longer directly patches `eventsPredicted`
- `vesselTimeline/mutations.ts` no longer directly reconciles `eventsScheduled` or `eventsActual`
- event-table DB operations are centralized under `convex/functions/events/**`
- runtime behavior remains unchanged

## Verification checklist

Run and report:

- `bun run type-check`
- `bun run convex:typecheck`
- targeted tests for:
  - vessel timeline backbone query
  - trip prediction enrichment
  - depart-next prediction actualization
  - timeline reseed / replacement flows
- grep checks:
  - no `ctx.db.query("eventsPredicted")` inside `convex/domain/**`
  - no direct `eventsScheduled` / `eventsActual` reads in `convex/functions/vesselTimeline/queries.ts`
  - no direct `eventsPredicted` patch/query logic in `convex/functions/vesselTrips/mutations.ts`

## Suggested grep starting points

- `query("eventsActual"`
- `query("eventsPredicted"`
- `query("eventsScheduled"`
- `patch("eventsPredicted"` or `.patch(`
- `replace("eventsActual"` / `insert("eventsActual"`
- `replace("eventsScheduled"` / `insert("eventsScheduled"`

## Non-goals

- Do not re-open the domain/functions import boundary cleanup unless required by the new work.
- Do not move business logic into `convex/functions/events/**`.
- Do not change event semantics or table schemas unless strictly necessary for the DB-layer boundary.
