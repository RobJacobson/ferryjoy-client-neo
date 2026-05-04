# Events pipeline

This document outlines how dock-event rows reach `eventsScheduled`, `eventsActual`, and `eventsPredicted`, at the level of execution order and main branches. It complements `functions/vesselOrchestrator/VesselOrchestratorPipeline.md`: that file owns the full orchestrator ping contract; this file focuses on event-specific stages and the separate **DockReload** path that does not run through the orchestrator.

Two complementary **write** paths exist:

| Path | Cadence | Tables written |
|------|---------|----------------|
| **DockReload** | On demand (operator), cron window, or recovery | `eventsScheduled` (upsert day slice), `eventsActual` (replace day slice) |
| **DockEventLive** | Every orchestrator ping for vessels with trip updates | `eventsActual`, `eventsPredicted` (sparse upserts), plus optional depart-next patch on `eventsPredicted` |

`eventsPredicted` is **not** rebuilt by DockReload; it is maintained by DockEventLive and related prediction patches.

---

## Path A — DockReload (full sailing day)

### Entry points

- **Public actions** (`functions/events/sync/actions.ts`): `reloadDockEventsForCurrentSailingDay` (derives sailing day from the action clock, then calls the single-day helper) and `reloadDockEventsForSailingDay` (explicit `targetDate` string).
- **Internal actions:** `reloadDockEventsWindow` (consecutive calendar days from today; when the day count is omitted, the default matches legacy cron expectations) and `reloadDockEventsAtSailingDayBoundary` (runs the window reload only when the Pacific hour is 3; otherwise returns skip metadata as the normal idle path for off-hour ticks).

### Single-day happy path

**Action** — `runReloadDockEventsForSailingDay` in `functions/events/sync/reloadDockEventsForSailingDay.ts`.

1. Load identities for adapters: `loadVesselIdentities` and `loadTerminalIdentities` from `functions/vessels/actions` and `functions/terminals/actions`.
2. Fetch schedule: `fetchAndTransformScheduledTrips` (adapters) for the target sailing day; flatten route payloads to `scheduleSegments` as `RawWsfScheduleSegment` rows (Date-shaped instants).
3. Fetch vessel history: `fetchHistoryRecordsForDate` uses the schedule context to drive per-vessel history requests for that date.
4. Build the Convex wire payload: `buildConvexReloadDockDataFromFetchedSlices` converts Date instants to epoch ms in `ConvexReloadDockData`, consistent with other Convex numeric boundaries such as `ConvexVesselLocation`.
5. Run the internal mutation `internal.functions.events.sync.mutations.replaceDockEventsForSailingDay` with `{ ReloadDockData }` only; identity tables are read inside the mutation.

**Mutation** — `replaceDockEventsForSailingDayRows` in `functions/events/sync/replaceDockEventsForSailingDay.ts`.

6. Restore fetch-shaped rows: `mapConvexReloadDockDataToRawFetchShapes` maps epoch ms back to `Date` for domain code.
7. Load identity tables from the database: `vesselsIdentity` and `terminalsIdentity` (full collect; seed-sized tables).
8. Merge schedule and history into hydrated transitions: `buildHydratedTransitionsFromReloadInputs` in `domain/events/reload/`, which calls `buildScheduledDockEventRecords` and then `hydrateActualDockEvents`.
9. Load trip context for the sailing day: `loadTripIndexesForSailingDay` (segment to TripKey maps, active trips by vessel, physical-only trip list).
10. Load live locations: `vesselLocations` full `collect`, stripped of Convex metadata (one small snapshot row per fleet vessel).
11. Build rows for persistence: `buildDockEventRowsForSailingDayReload` in `domain/events/actual/reloadDockEventsForSailingDay.ts` — normalizes seams, builds scheduled rows, builds base actual rows from schedule and physical-only trips, runs `reconcileActualDockWritesFromLocations` against live samples, and merges patches via `mergeActualDockWritesIntoRows`.
12. Persist: `upsertScheduledRowsForSailingDay` (scheduled slice for that sailing day) and `replaceActualRowsForSailingDay` (day-wide replace with grandfather rules for ping-only rows that lack `ScheduleKey`).
13. Return `{ ScheduledCount, ActualCount }` to the action for logging and operator feedback.

### Multi-day branch

`runReloadDockEventsWindow` loops calendar days starting at `getSailingDay(now)`, calls `runReloadDockEventsForSailingDay` once per day, and aggregates totals plus per-day summaries.

### Cron branch

`reloadDockEventsAtSailingDayBoundary` returns `{ skipped: true, reason: outside_pacific_3am_window, ... }` and does not call adapters when the Pacific hour is not 3. When the hour is 3, it forwards to `runReloadDockEventsWindow` and returns `{ skipped: false, ...aggregates }`.

---

## Path B — DockEventLive (orchestrator sparse writes)

The orchestrator overview is in `VesselOrchestratorPipeline.md`. For **events** only, the relevant part is **Stages 5–6** of `runOrchestratorPing` in `functions/vesselOrchestrator/actions/ping/runOrchestratorPing.ts`. That slice runs for **changed** location rows after dedupe, and only when `updateVesselTrip` returns a non-null `VesselTripUpdate`.

### Stage 5 — Project event rows in action memory

**Input:** `pingStartedAt`, `tripUpdate`, and `enrichedActiveVesselTrip` (from the prediction pass when applicable). **Function:** `updateEvents` in `domain/vesselOrchestration/updateEvents/updateEvents.ts`.

**Internal chain:** (1) `eventHandoffFromTripUpdate(tripUpdate)` builds the persisted trip handoff used for projection. (2) **Prediction branches** via `predictedTripEventHandoffsFromInput`: there is always a **current** branch on `enrichedActiveVesselTrip`; when both `existingVesselTrip` and `completedVesselTrip` are present on the update, a **completed** branch is also emitted with a stable completed handoff key. (3) `projectEventsFromHandoff` merges ML-enriched trip overlays into the handoff, then `buildDockWritesFromTripHandoff` produces sparse **`actualEvents`** and **`predictedEvents`** (batch shape for predicted upserts).

In parallel (not part of the `updateEvents` return value), **leave-dock predicted patch:** `updateLeaveDockEventPatch(tripUpdate)` optionally supplies a payload that persistence uses for depart-next ML rows on `eventsPredicted`.

### Stage 6 — Atomic persistence per vessel

**Action:** `runPersistVesselUpdatesWithTripDeltas` invokes internal mutation `persistVesselUpdates` in `functions/vesselOrchestrator/mutations/orchestratorPersistMutations.ts`.

**Ordered writes inside one transaction:** `insertCompletedVesselTrip` when the trip update completes a leg; `upsertActiveVesselTrip`; `upsertActualDockRows` when `actualEvents.length > 0`; `upsertPredictedDockBatches` when `predictedEvents.length > 0`; `patchDepartNextMlRowsForDepBoundary` when `updateLeaveDockEventPatch` is present.

Failure policy for the overall ping matches the orchestrator pipeline doc: per-vessel try/catch in the action loop; one vessel’s `persistVesselUpdates` is all-or-nothing.

### Branch: no trip update

When `updateVesselTrip` returns `null`, Stages 3–6 are skipped for that vessel (no event mutations on that branch).

---

## Read path (subscriptions)

Public list queries under `functions/events/eventsScheduled`, `eventsActual`, and `eventsPredicted` expose vessel-plus-sailing-day slices for the app. They do not invoke reload or orchestrator code; they read whatever the write paths above last persisted.

---

## Invariants

- **DockReload** never writes `eventsPredicted`; it only refreshes scheduled and actual slices for the targeted sailing day(s).
- **DockEventLive** never performs a full-day replace; it applies sparse upserts keyed by physical event identity and batches as assembled by `updateEvents`.
- The reload mutation validates **`ConvexReloadDockData`** at the Convex boundary; domain stages after mapping consume Date-shaped adapter rows.
- Orchestrator event projection uses **the same ping’s** `tripUpdate` and enriched trip — no separate event read pass before `persistVesselUpdates`.
