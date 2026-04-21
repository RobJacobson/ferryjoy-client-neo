# Vessel Orchestrator Cost-Reduction Memo

**Date:** 2026-04-21  
**Audience:** Engineers and coding agents working in `convex/functions/vesselOrchestrator`, `convex/functions/vesselLocationsUpdates`, `convex/functions/vesselTrips`, `convex/functions/events`, and related domain modules.

## 0. Implementation status (2026-04-21 follow-up pass)

The first near-term cost-reduction step in this memo has now been implemented.

### What was validated against the live code

- The memo’s main diagnosis was correct: the hot-path bandwidth problem was
  still `getScheduleSnapshotForPing`, not `getOrchestratorModelData`.
- `getScheduleSnapshotForPing` in
  [`convex/functions/vesselOrchestrator/queries.ts`](../../convex/functions/vesselOrchestrator/queries.ts)
  was still rereading same-day `eventsScheduled` rows and grouping them by
  vessel on every ping.
- The trip continuity path did not need the full raw `eventsScheduled`
  boundary payload on every tick. It only needed:
  - direct schedule lookup by segment key / `ScheduleKey`
  - ordered per-vessel same-day departure continuity data
- The second major issue in the memo also remains true after this pass:
  `updateVesselOrchestrator` still fans out into multiple persistence
  mutations and should be collapsed next.

### What was implemented

#### 1. Added a compact materialized schedule read model

- Added a new table:
  `vesselOrchestratorScheduleSnapshots`
- Added the supporting Convex schema and validators in:
  - [`convex/schema.ts`](../../convex/schema.ts)
  - [`convex/functions/vesselOrchestrator/schemas.ts`](../../convex/functions/vesselOrchestrator/schemas.ts)
- Added
  [`materializeScheduleSnapshot.ts`](../../convex/functions/vesselOrchestrator/materializeScheduleSnapshot.ts)
  to build the compact schedule snapshot from scheduled boundary rows.

The materialized snapshot now stores only:

- `SailingDay`
- `UpdatedAt`
- `scheduledDepartureBySegmentKey`
  - inferred segment metadata keyed by `ScheduleKey`
- `scheduledDeparturesByVesselAbbrev`
  - ordered same-day departure rows per vessel, reduced to:
    - `Key`
    - `ScheduledDeparture`
    - `TerminalAbbrev`

This replaces the prior “group full `eventsScheduled` rows by vessel” hot-path
payload shape.

#### 2. Materialized the snapshot inside scheduled boundary replacement

- Updated
  [`convex/functions/events/eventsScheduled/mutations.ts`](../../convex/functions/events/eventsScheduled/mutations.ts)
  so `upsertScheduledRowsForSailingDay` now also replaces or inserts the
  compact orchestrator snapshot for that sailing day in the same mutation.

This means the compact schedule read model is now maintained when scheduled
boundary rows are replaced, instead of being rebuilt on every orchestrator
ping.

#### 3. Switched the orchestrator hot path to the compact read model

- Updated
  [`convex/functions/vesselOrchestrator/queries.ts`](../../convex/functions/vesselOrchestrator/queries.ts)
  so `getScheduleSnapshotForPing` now reads from
  `vesselOrchestratorScheduleSnapshots` by sailing day.
- Removed the per-ping fan-out to per-vessel `eventsScheduled` queries from the
  orchestrator hot path.
- Added an empty fallback return when no compact snapshot exists yet for the
  sailing day, so the trip pipeline continues to behave safely.

#### 4. Narrowed the shared trip schedule contract to what continuity needs

- Updated the shared `ScheduleSnapshot` and `ScheduledSegmentTables` types in:
  - [`convex/domain/vesselOrchestration/shared/scheduleSnapshot/scheduleSnapshotTypes.ts`](../../convex/domain/vesselOrchestration/shared/scheduleSnapshot/scheduleSnapshotTypes.ts)
  - [`convex/domain/vesselOrchestration/shared/scheduleContinuity/types.ts`](../../convex/domain/vesselOrchestration/shared/scheduleContinuity/types.ts)
- Replaced the old helper
  `getScheduledDockEventsForVesselAndSailingDay` with
  [`getScheduledDeparturesForVesselAndSailingDay`](../../convex/domain/vesselOrchestration/shared/scheduleContinuity/getScheduledDeparturesForVesselAndSailingDay.ts).
- Updated trip schedule continuity and final-schedule attachment code to use:
  - inferred segment lookup rows from `scheduledDepartureBySegmentKey`
  - ordered departure continuity rows from
    `scheduledDeparturesByVesselAbbrev`

Files updated on that path included:

- [`convex/domain/vesselOrchestration/shared/scheduleSnapshot/createScheduledSegmentTablesFromSnapshot.ts`](../../convex/domain/vesselOrchestration/shared/scheduleSnapshot/createScheduledSegmentTablesFromSnapshot.ts)
- [`convex/domain/vesselOrchestration/updateVesselTrips/continuity/resolveDockedScheduledSegment.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/continuity/resolveDockedScheduledSegment.ts)
- [`convex/domain/vesselOrchestration/updateVesselTrips/scheduleTripAdapters.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/scheduleTripAdapters.ts)

### What this accomplished

- The orchestrator no longer reads grouped raw `eventsScheduled` rows on every
  ping.
- The schedule hot path now reads one compact sailing-day snapshot instead of a
  per-vessel grouped boundary blob.
- The new read model keeps the current cleaner trip continuity pipeline shape
  while removing oversized hot-path schedule payloads.
- The work was kept inside the current Convex architecture, as intended.

### What is still not done

- The orchestrator write path is still fragmented across multiple child
  mutations.
- Prediction work still runs broader than it should.
- Timeline persistence still runs through separate mutation boundaries.
- `vesselLocationsUpdates` still needs the lightweight periodic safety refresh
  path described later in this memo.

### Verification completed

- Ran `bun run convex:codegen`
- Ran targeted tests covering:
  - schedule snapshot narrowing
  - trip schedule continuity
  - final schedule attachment
  - trip compute behavior
  - location dedupe writes

## 1. Purpose

Document where Vessel Orchestrator started, where it stands now, and the
desired near-term end state for reducing Convex function calls and database
bandwidth on the orchestrator hot path.

This memo is intentionally focused on **what we should do now inside the
current Convex architecture**. It does **not** evaluate alternative platforms or
long-term backend replacements.

## 2. Executive summary

The current Vessel Orchestrator refactor improved modularity and concern
boundaries, but it also increased the number of Convex function boundaries on
the hot path and introduced a schedule read model that is too large to load on
every ping.

The highest-priority issue is not `getOrchestratorModelData`. The highest-
priority issue is `getScheduleSnapshotForPing`, which currently returns a large
same-day grouped schedule blob on every ping. In live dev data, that payload is
roughly **233 KB per ping** for **772 `eventsScheduled` rows** on sailing day
`2026-04-22`.

The second major issue is function-call fan-out: one orchestrator action now
fans into multiple child queries and mutations for locations, trips,
predictions, and timeline projection. The previous stable model was closer to
the minimum viable shape: **one action + one query + one mutation** per tick.

The recommended near-term direction is:

1. materialize a compact schedule read model outside the hot path
2. collapse the orchestrator write path into one persistence mutation
3. stop running prediction and timeline persistence for unchanged vessels
4. keep `vesselLocationsUpdates`, but harden it with a periodic safety refresh

## 3. Why this matters

Vessel Orchestrator is the main backend loop for the entire app.

- It runs every ~15 seconds today.
- It is expected to run every ~5 seconds once stabilized.
- It owns the live ferry state used downstream by trips, predictions, timeline,
  and user-facing read models.

Because it is the app’s hottest path, even small per-ping inefficiencies scale
directly into:

- more Convex function calls
- more database I/O
- more reactive churn downstream
- higher production cost risk

## 4. Where we started

## 4.1 Pre-refactor shape

Before the recent refactor, the orchestrator was much more monolithic.

The main flow was conceptually:

1. fetch WSF vessel locations once
2. read the current backend state needed for trip processing
3. compute trip outcomes in a more tightly coupled flow
4. persist locations and trip/prediction side effects with fewer Convex
   boundaries

Notable traits of the earlier system:

- fewer Convex function calls per tick
- more logic concentrated in a single orchestration path
- less separation between domain and function-layer persistence concerns
- fewer clean interfaces, but a cheaper runtime profile

The older stable behavior was roughly:

- **1 action**
- **1 query**
- **1 mutation**

That is still the right optimization target for the core hot path.

## 4.2 Pre-refactor read/write model

The old system used fewer intermediate read models and generally relied on
larger, less formalized in-process orchestration.

Broadly:

- read one current-state snapshot
- process one WSF feed batch
- persist one combined set of writes

This was less elegant architecturally, but cheaper operationally.

## 5. Where we stand now

## 5.1 Current high-level pipeline

The current orchestrator in
[`convex/functions/vesselOrchestrator/actions.ts`](../../convex/functions/vesselOrchestrator/actions.ts)
runs sequentially:

1. `getOrchestratorModelData`
2. WSF fetch and location normalization
3. `getAllVesselUpdateTimeStampsInternal`
4. `bulkUpsertLocationsAndUpdates`
5. `getScheduleSnapshotForPing`
6. trip computation
7. trip persistence via multiple trip mutations
8. prediction model preload
9. prediction proposal upsert
10. actual event projection mutation
11. predicted event projection mutation

This shape is cleaner from a concern-boundary standpoint, but too expensive on
the hot path.

## 5.2 Current runtime findings

These data points came from local code inspection, Convex MCP reads against the
dev deployment, and the provided Convex dashboard screenshots.

### Convex dashboard snapshot

For Apr 19-27, 2026 in dev:

- Function calls: about **46K**
- Database bandwidth: about **1.39 GB**
- Action compute: about **0.10 GB-hours**

Top function-call offenders in the dashboard included:

- `functions/vesselOrchestrator/queries.getOrchestratorModelData` at about
  **4.9K**
- `functions/vesselOrchestrator/actions.updateVesselOrchestrator` at about
  **4.9K**
- `functions/vesselOrchestrator/queries.getScheduleSnapshotForPing` at about
  **4.8K**
- trip/location/prediction/timeline mutations clustered below that

Top database-bandwidth offenders included:

- `functions/vesselOrchestrator/queries.getScheduleSnapshotForPing` at about
  **850 MB**
- `functions/scheduledTrips/mutations.replaceScheduledTripsForSailingDay` at
  about **116 MB**
- `functions/vesselTrips/mutations.upsertVesselTripsBatch` at about **85 MB**
- `functions/vesselLocationsUpdates/mutations.bulkUpsertLocationsAndUpdates` at
  about **70 MB**
- `functions/vesselLocation/mutations.bulkUpsert` at about **69 MB**
- `functions/vesselOrchestrator/queries.getOrchestratorModelData` at about
  **48 MB**

### Live table counts from dev deployment

At inspection time:

- `vesselsIdentity`: **21**
- `terminalsIdentity`: **22**
- `activeVesselTrips`: **21**
- `vesselLocations`: **21**
- `vesselLocationsUpdates`: **21**
- `eventsScheduled`: **2324**
- `eventsActual`: **358**
- `eventsPredicted`: **63**
- `vesselTripPredictions`: **829**
- `modelParameters`: **360**

### Measured payload sizes from dev deployment

Approximate JSON payload sizes:

- `getOrchestratorModelData` equivalent payload:
  - **16,392 bytes**
  - `21` vessels + `22` terminals + `21` active trips
- `vesselLocationsUpdates` full helper-table read:
  - **2,164 bytes**
  - `21` rows
- `getScheduleSnapshotForPing` equivalent payload:
  - **233,356 bytes**
  - `772` rows for latest sailing day `2026-04-22`

Representative average document sizes:

- `activeVesselTrips`: about **626 bytes per row**
- `vesselLocations`: about **581 bytes per row**
- `vesselLocationsUpdates`: about **179 bytes per row**
- sampled `eventsScheduled`: about **378 bytes per row**

### Schedule snapshot detail

For sailing day `2026-04-22`, current per-vessel event counts included:

- `KIT`: `94`
- `KIS`: `84`
- `CHZ`: `76`
- `CAT`: `66`
- `TOK`: `64`
- several vessels at `0`

This confirms the problem: the “single big schedule blob” strategy eliminated
many per-vessel child lookups, but replaced them with a payload that is too
large to read every 5-15 seconds.

### Model parameter preload

`modelParameters` currently contains:

- **360 rows**
- **36 pair keys**
- about **324 KB** total when read as one full table

The current prediction preload is already selective by pair and model type,
which is good. The remaining issue is that we often compute prediction work for
more trips than materially changed in the current ping.

## 5.3 Current table relationships

This is the practical data flow for the hot path:

- `vesselsIdentity`
  - canonical vessel identity snapshot from backend
  - used to normalize WSF vessel payloads
- `terminalsIdentity`
  - canonical terminal identity snapshot
  - used to normalize locations and trip identity
- `vesselLocations`
  - one live row per vessel
  - current physical vessel snapshot
- `vesselLocationsUpdates`
  - narrow helper table for dedupe
  - stores `VesselAbbrev`, latest `TimeStamp`, and linked live location id
- `activeVesselTrips`
  - one authoritative active trip row per vessel
- `completedVesselTrips`
  - completed trip history
- `eventsScheduled`
  - normalized schedule boundary rows
  - currently overused on the hot path as a per-ping grouped blob
- `vesselTripPredictions`
  - per-trip prediction storage for compare-then-write semantics
- `eventsActual`
  - normalized actual event projection
- `eventsPredicted`
  - normalized predicted event projection
- `modelParameters`
  - prediction model coefficients keyed by terminal pair and model type

From an operational standpoint, the orchestrator’s real dependency graph is:

1. identities
2. live locations
3. trip lifecycle
4. prediction rows
5. timeline/event projections

The code should optimize for that order.

## 6. Current problems, ranked by concern

## 6.1 `getScheduleSnapshotForPing` is too large for the hot path

Severity: **highest**

[`convex/functions/vesselOrchestrator/queries.ts`](../../convex/functions/vesselOrchestrator/queries.ts)
currently:

- rereads `vesselsIdentity`
- fans out to per-vessel `eventsScheduled` loads
- returns full grouped event rows for all vessels on the sailing day

This is the single biggest bandwidth problem in the current loop.

## 6.2 The orchestrator hot path crosses too many Convex function boundaries

Severity: **very high**

[`updateVesselOrchestrator`](../../convex/functions/vesselOrchestrator/actions.ts)
is now logically clean but operationally fragmented.

The action is orchestrating a sequence that should conceptually be:

- read data
- process data
- save data

Instead, it performs a chain of child queries and mutations that each create a
new billed function context.

## 6.3 Trip persistence still fans out into multiple child mutations

Severity: **high**

[`persistVesselTripWriteSet`](../../convex/functions/vesselOrchestrator/persistVesselTripWriteSet.ts)
calls separate mutation bindings for:

- completed trip rollover
- active trip batch upsert
- leave-dock actualization

This preserves clean function ownership, but it is not cost-optimal for the hot
path.

## 6.4 Prediction work is broader than it needs to be

Severity: **high**

The current prediction stage runs over the full `activeTrips` set returned from
the trip step, then relies on compare-and-skip in
[`batchUpsertProposals`](../../convex/functions/vesselTripPredictions/mutations.ts)
to avoid writes.

That helps storage churn, but it does not avoid:

- the query to preload model context
- the prediction compute pass
- the prediction mutation call itself

for unchanged vessels.

## 6.5 Event projection mutations still do per-row read/compare work

Severity: **medium**

[`projectActualDockWrites`](../../convex/functions/events/eventsActual/mutations.ts)
and
[`projectPredictedDockWriteBatches`](../../convex/functions/events/eventsPredicted/mutations.ts)
do the right thing semantically, but they still incur read/compare costs inside
separate mutations.

This is acceptable if called rarely, but not ideal inside the core ping loop.

## 6.6 `getOrchestratorModelData` is bigger than necessary, but is not the main issue

Severity: **medium**

`getOrchestratorModelData` currently returns whole vessel identities, terminal
identities, and active trip rows. It should eventually become a narrower
projection.

However, at about **16 KB per ping**, it is much smaller than the schedule
snapshot and should not be treated as the first optimization target.

## 6.7 The helper dedupe table needs a lightweight safety mechanism

Severity: **medium-low**

`vesselLocationsUpdates` is a good optimization and should be kept.

It is not a hard single point of failure because
[`bulkUpsertLocationsAndUpdates`](../../convex/functions/vesselLocationsUpdates/mutations.ts)
already has fallback behavior when helper rows are missing.

Still, the system would benefit from a simple periodic “force refresh all live
rows” safety pass so a stale helper table cannot drift forever.

## 7. Desired end state

The desired near-term end state is still within Convex and still within the
current general architecture.

The hot path should trend toward:

1. **one action**
2. **one small orchestrator-owned read query**
3. **one targeted schedule/model query**
4. **one orchestrator persistence mutation**

In the best case, the targeted schedule/model query can also be folded into the
primary read query once the schedule read model is materially reduced.

## 7.1 Desired read model shape

The orchestrator should own a small set of **purpose-built projections**, not
one giant “load everything” blob and not many tiny child lookups.

Recommended projections:

- `getOrchestratorCoreState`
  - only the fields needed to normalize locations and compute trip deltas
- `getOrchestratorScheduleState`
  - compact, precomputed schedule continuity structure
  - not raw grouped `eventsScheduled` rows
- `getPredictionModelContextForChangedTrips`
  - already partly true today; should be fed only changed trip scopes

## 7.2 Desired write model shape

The action should produce one **write set** and pass it to one internal
mutation, conceptually:

- changed live locations
- trip completions
- active trip upserts
- depart-next actualization intents
- prediction proposal rows
- actual event rows
- predicted event batches

That mutation can still use plain TypeScript helpers internally, but it should
be one Convex mutation boundary for the hot path.

## 7.3 Desired schedule strategy

The orchestrator should not rebuild or reload a full same-day grouped schedule
blob every ping.

Instead, schedule changes should materialize a compact lookup table or compact
read model once, outside the hot path. The ping loop should read only that
compact structure.

## 7.4 Desired prediction strategy

Predictions should run only for:

- completed handoff replacement trips
- materially changed active trips

If no trip rows materially changed, the prediction stage should skip both its
read and write steps.

## 8. Recommended implementation order

1. Replace `getScheduleSnapshotForPing` with a compact materialized schedule
   read model.
2. Collapse trip/prediction/timeline persistence into one internal mutation for
   the hot path.
3. Restrict prediction and timeline work to changed vessels only.
4. Add a periodic full refresh safety pass for live vessel locations.
5. Narrow `getOrchestratorModelData` after the larger wins land.

## 9. Key conclusions

- The current helper-table approach for location dedupe is good and worth
  keeping.
- The current schedule snapshot approach is the biggest immediate mistake on the
  hot path.
- The current function-call fan-out is the second-biggest issue.
- The right fix is not “let every child concern read its own data again.”
- The right fix is a middle ground:
  - a few orchestrator-owned, purpose-built projections
  - one orchestrator persistence mutation
  - no giant same-day grouped schedule blob

## 10. References

### Internal code references

- [`convex/functions/vesselOrchestrator/actions.ts`](../../convex/functions/vesselOrchestrator/actions.ts)
- [`convex/functions/vesselOrchestrator/queries.ts`](../../convex/functions/vesselOrchestrator/queries.ts)
- [`convex/functions/vesselLocationsUpdates/mutations.ts`](../../convex/functions/vesselLocationsUpdates/mutations.ts)
- [`convex/functions/vesselOrchestrator/persistVesselTripWriteSet.ts`](../../convex/functions/vesselOrchestrator/persistVesselTripWriteSet.ts)
- [`convex/functions/vesselTrips/mutations.ts`](../../convex/functions/vesselTrips/mutations.ts)
- [`convex/functions/events/eventsActual/mutations.ts`](../../convex/functions/events/eventsActual/mutations.ts)
- [`convex/functions/events/eventsPredicted/mutations.ts`](../../convex/functions/events/eventsPredicted/mutations.ts)
- [`convex/schema.ts`](../../convex/schema.ts)

### Internal process and guidance documents

- Convex MCP instructions:
  [`docs/convex-mcp-cheat-sheet.md`](../convex-mcp-cheat-sheet.md)
- Convex project rules and best practices:
  [`docs/convex_rules.mdc`](../convex_rules.mdc)

### Relevant Convex documentation

- Convex functions overview:
  [docs.convex.dev/functions](https://docs.convex.dev/functions)
- Convex actions best practices:
  [docs.convex.dev/functions/actions](https://docs.convex.dev/functions/actions)
- Convex database overview:
  [docs.convex.dev/database](https://docs.convex.dev/database)
- Convex reading-data guidance:
  [docs.convex.dev/database/reading-data](https://docs.convex.dev/database/reading-data)
- Convex realtime overview:
  [docs.convex.dev/realtime](https://docs.convex.dev/realtime)
- Convex limits and billing semantics:
  [docs.convex.dev/production/state/limits](https://docs.convex.dev/production/state/limits)
- Convex pricing:
  [www.convex.dev/pricing](https://www.convex.dev/pricing)

### Related Convex component references

- Components overview:
  [docs.convex.dev/components/understanding](https://docs.convex.dev/components/understanding)
- Components usage:
  [docs.convex.dev/components/using](https://docs.convex.dev/components/using)
- Components product page:
  [www.convex.dev/components](https://www.convex.dev/components)
- Action Cache component:
  [www.convex.dev/components/action-cache](https://www.convex.dev/components/action-cache)
