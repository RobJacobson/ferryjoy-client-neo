# Event functions

This subtree owns Convex-facing persistence modules for the event tables.

## Rules

- one folder per table
- `shared/` is only for persistence helpers shared across the event tables
- keep business policy in `convex/domain/`; mutation helpers may call pure
  domain planners and then apply the resulting DB operations

## Tables

- `eventsActual/`
- `eventsPredicted/`
- `eventsScheduled/`

## Pipelines

Two pipelines write into the event tables. They share table schemas but run on
different cadences and shapes of input.

### DockReload

Periodic full-day rebuild driven from `sync/`:

1. `reloadDockEventsForSailingDay` (action) loads vessel and terminal
   identities, fetches the WSF schedule slice, and calls the WSF history feed.
2. `buildConvexReloadDockDataFromFetchedSlices` converts the fetched Date
   payloads into `ConvexReloadDockData` (epoch milliseconds) so the mutation
   boundary stays numeric. This mirrors `ConvexVesselLocation` and
   `ConvexScheduledTrip`.
3. `replaceDockEventsForSailingDay` (internal mutation) restores Date
   instants, composes hydrated dock transitions from schedule and history,
   loads trip indexes, collects `vesselLocations` (full small snapshot), and persists scheduled rows via `upsertScheduledRowsForSailingDay`
   plus actual rows via `replaceActualRowsForSailingDay`.

Use this path for cron-backed boundary refreshes and operator-driven reloads.

### DockEventLive

High-frequency partial updates driven from `vesselOrchestrator/`:

1. The orchestrator ping pipeline upserts vessel locations, then proposes
   sparse actual writes via `reconcileActualDockWritesFromLocations` and
   batched predictions via `buildPredictedDockWriteBatch`.
2. `eventsActual/upsertActualDockRows` and
   `eventsPredicted/upsertPredictedDockBatches` apply those sparse writes;
   only the boundaries with new evidence change rows.

DockEventLive shares the actual and predicted table schemas with DockReload
but never replaces a full sailing day. The reconcile module that backs it
lives in `domain/events/actual/reconcileDockTransitionsFromLocations/`.

## Naming

- Reload payload type: `ConvexReloadDockData` (numeric).
- Fetch-layer schedule type: `RawWsfScheduleSegment` (Date instants).
- Domain event row alias: `DockTransitionRecord` (alias of
  `DockBoundaryEventRecord`).
