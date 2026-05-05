# Event functions

This subtree owns Convex-facing persistence modules for the event tables.

Execution outline (DockReload vs DockEventLive, reload mutation stages, and orchestrator event projection): see **EventsPipeline.md** in this folder.

## Rules

- one folder per table
- `shared/` is only for persistence helpers shared across the event tables
- keep business policy in `convex/domain/`; mutation helpers may call pure domain planners and then apply the resulting DB operations
- table folders may also contain table-local planners when the decision depends
  only on already-loaded rows and candidate rows; mutations still own Convex reads
  and writes

## Tables

- `eventsActual/`
- `eventsPredicted/`
- `eventsScheduled/`

## Pipelines

Two pipelines write into the event tables. They share table schemas but run on different cadences and shapes of input.

### DockReload

Periodic full-day rebuild driven from `sync/`:

1. `reloadDockEventsForSailingDay` (action) loads vessel and terminal identities, fetches the WSF schedule slice, and calls the WSF history feed.
2. `buildConvexReloadDockDataFromFetchedSlices` converts the fetched Date payloads into `ConvexReloadDockData` (epoch milliseconds) so the mutation boundary stays numeric. This mirrors `ConvexVesselLocation` and `ConvexScheduledTrip`.
3. `replaceScheduledDockEventsForSailingDay` persists only the scheduled slice, then `reloadActualDockEventsForSailingDay` composes hydrated dock transitions from numeric schedule and history rows, loads trip indexes, collects `vesselLocations` (full small snapshot), and upserts actual rows via `upsertActualDockRows`.

Use this path for cron-backed boundary refreshes and operator-driven reloads.

### DockEventLive

High-frequency partial updates driven from `vesselOrchestrator/`:

1. The orchestrator ping pipeline upserts vessel locations, then proposes sparse actual writes via `reconcileActualDockWritesFromLocations` and batched predictions via `buildPredictedDockWriteBatch`.
2. `eventsActual/upsertActualDockRows` and `eventsPredicted/upsertPredictedDockBatches` apply those sparse writes; only the boundaries with new evidence change rows.

DockEventLive shares the actual and predicted table schemas with DockReload but never replaces a full sailing day. The reconcile module that backs it lives in `domain/events/actual/reconcileDockTransitionsFromLocations/`.

## Naming

- Reload payload type: `ConvexReloadDockData` (numeric).
- Fetch-layer schedule type: `RawWsfScheduleSegment` (Date instants).
- Domain event row alias: `DockTransitionRecord` (alias of `DockBoundaryEventRecord`).
