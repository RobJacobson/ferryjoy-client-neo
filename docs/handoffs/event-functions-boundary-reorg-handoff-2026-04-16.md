# Handoff: Event Functions Boundary Reorganization

**Date:** 2026-04-16  
**Audience:** implementation agent  
**Goal:** Reorganize the event-table functions layer so the three event tables live under a shared `convex/functions/events/` subtree while enforcing a strict boundary: the database layer owns only Convex registration, validators, direct DB reads/writes, and persistence-oriented helpers. It must not own business logic.

## Required target structure

Create this subtree under `convex/functions/`:

```text
convex/functions/events/
  README.md
  shared/
  eventsActual/
  eventsPredicted/
  eventsScheduled/
```

Move the current folders into that structure:

- `convex/functions/events/eventsActual/` -> `convex/functions/events/eventsActual/`
- `convex/functions/events/eventsPredicted/` -> `convex/functions/events/eventsPredicted/`
- `convex/functions/events/eventsScheduled/` -> `convex/functions/events/eventsScheduled/`

Keep the Convex table names unchanged:

- `eventsActual`
- `eventsPredicted`
- `eventsScheduled`

## Boundary rules

### `convex/functions/events/**` may own

- Convex `query` / `mutation` / `internalQuery` / `internalMutation` registration
- validators
- direct `ctx.db` reads and writes
- persistence-only batching, diffing, row comparison, and query helpers
- local DB-facing types if they are not imported by domain

### `convex/functions/events/**` must not own

- segment inference
- schedule continuity rules
- sparse-write normalization policy
- event identity policy when it is domain/business semantics rather than DB plumbing
- prediction projection rules
- any logic that decides what rows *should* exist

### `convex/domain/**` must not import from `convex/functions/events/**`

This includes schema files. The desired end state is zero domain imports from the event functions layer.

### `convex/functions/events/**` must not import from `convex/domain/**`

The event DB layer should be fully persistence-oriented and independent of domain rules.

## Architectural consequences

The current implementation still has several boundary violations that must be removed.

### 1. `eventsScheduled` currently mixes DB access with business logic

Current issue:

- `convex/functions/events/eventsScheduled/queries.ts` imports `buildInferredScheduledSegment` and `findNextDepartureEvent` from `convex/domain/timelineRows/scheduledSegmentResolvers.ts`

Required change:

- event-table queries should return raw DB-backed rows or raw row collections only
- any interpretation of those rows into an inferred segment must move outside the DB layer
- adapters are the likely landing place for composing raw event reads with domain logic

### 2. `eventsActual` currently mixes DB mutation code with row-normalization logic

Current issue:

- `convex/functions/events/eventsActual/mutations.ts` imports `hasTripKeyOnActualDockWrite`, `isPersistableActualDockWrite`, `mergeActualDockWriteWithExistingRow`, and `buildActualDockEventFromWrite` from domain modules

Required change:

- move write normalization and persistability decisions out of the DB layer
- the mutation should receive already-normalized persistence-ready payloads, or use helpers that live strictly inside the persistence layer
- the mutation should be limited to dedupe, load existing rows, compare rows, insert/replace/skip

### 3. `eventsPredicted` still exposes helper logic through schema modules

Current issue:

- `predictedDockCompositeKey` lives in `convex/functions/events/eventsPredicted/schemas.ts`
- domain code imports that helper

Required change:

- schema files in the event functions layer should be validators/types only
- move `predictedDockCompositeKey` to a non-functions home if domain still needs it
- event DB mutations may use a persistence-local helper, but domain must not import it from functions

### 4. Event-specific shared helpers should not live in `convex/shared/`

Current issue:

- `convex/shared/actualDockRowsEqual.ts` is event-table persistence logic, not a truly generic helper

Required change:

- move event-table persistence helpers like this under `convex/functions/events/shared/`

## Implementation guidance

### Phase 1: move folders and repair import paths

1. Create `convex/functions/events/` and its `shared/` child.
2. Move the three event folders under it.
3. Update imports throughout the repo.
4. Update Convex generated API callsites that reference old module paths.

Expected path changes include:

- `internal.functions.events.eventsScheduled...` -> `internal.functions.events.eventsScheduled...`
- `functions/events/eventsActual/...` -> `functions/events/eventsActual/...`
- `functions/events/eventsPredicted/...` -> `functions/events/eventsPredicted/...`
- `functions/events/eventsScheduled/...` -> `functions/events/eventsScheduled/...`

### Phase 2: eliminate domain <-> event-functions cross-imports

After the move, there should be:

- zero imports from `convex/domain/**` into `convex/functions/events/**`
- zero imports from `convex/functions/events/**` into `convex/domain/**`

To achieve that:

1. Introduce domain-owned event contracts in a new location such as `convex/domain/events/`.
2. Update domain modules to use those contracts instead of importing event-function schemas.
3. Move or duplicate only the minimum type/contracts needed to sever the dependency cleanly.

### Phase 3: make `eventsScheduled` DB-only

Refactor `eventsScheduled` queries so they only perform DB access.

Allowed examples:

- load one scheduled departure row by key
- load same-day scheduled rows for one vessel
- load rows matching a DB index scope

Not allowed in this layer:

- finding the “next departure” by applying business semantics
- building inferred schedule segments

Move that interpretation into adapter or domain code that consumes the raw query results.

### Phase 4: make `eventsActual` DB-only

Refactor `eventsActual` mutations so they only perform DB reconciliation.

Allowed examples:

- dedupe by DB key
- fetch existing row
- compare current row with candidate row
- insert / replace / skip

Not allowed in this layer:

- deciding whether a sparse write is persistable
- filling omitted business fields from semantic rules
- constructing normalized rows from business-layer sparse facts

Move those concerns into domain or adapter code before the mutation call.

### Phase 5: make `eventsPredicted` schemas validator-only

Refactor `eventsPredicted/schemas.ts` so it exports only validators and types local to the DB layer.

Move cross-layer helper logic like `predictedDockCompositeKey` out of the functions layer if domain needs it.

### Phase 6: move event persistence helpers into `convex/functions/events/shared/`

Move helpers like `actualDockRowsEqual` into the new event-shared folder.

This shared folder is allowed only for persistence helpers shared by the three event tables. It is not a catch-all.

## Suggested landing zones

- Domain event contracts: `convex/domain/events/`
- Persistence-shared helpers: `convex/functions/events/shared/`
- Business interpretation of scheduled rows: adapter and domain modules that already own trip continuity / timeline semantics

## Files likely requiring updates

- `convex/schema.ts`
- `convex/functions/index.ts`
- `convex/functions/vesselTimeline/**`
- `convex/functions/vesselTrips/**`
- `convex/adapters/vesselTrips/processTick.ts`
- `convex/domain/timelineRows/**`
- `convex/domain/timelineReseed/**`
- `convex/domain/timelineBackbone/**`
- `convex/domain/vesselTrips/**`
- `convex/shared/actualDockRowsEqual.ts`

## Acceptance criteria

- `convex/functions/events/` exists with:
  - `eventsActual/`
  - `eventsPredicted/`
  - `eventsScheduled/`
  - `shared/`
- no files under `convex/functions/events/**` import from `convex/domain/**`
- no files under `convex/domain/**` import from `convex/functions/events/**`
- `eventsScheduled` performs DB reads only
- `eventsActual` performs DB reconciliation only
- `eventsPredicted` schema modules expose validators/types only
- event-table persistence helpers no longer live in `convex/shared/`
- runtime behavior remains unchanged

## Verification

Run and report:

- `bun run type-check`
- `bun run convex:typecheck`
- targeted tests for touched event/timeline/trip modules
- grep checks proving there are no remaining cross-imports between `convex/domain/**` and `convex/functions/events/**`

## Notes

- Keep PR scope focused on this boundary cleanup; do not broaden into unrelated architecture changes.
- Prefer small helper modules with explicit names over growing barrels or generic buckets.
