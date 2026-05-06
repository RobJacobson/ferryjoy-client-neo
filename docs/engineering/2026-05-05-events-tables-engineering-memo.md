# Events Tables Engineering Memo

## Summary

The three dock-event tables are the lowest-level event persistence surfaces in the system:

- `eventsScheduled`: planned dock boundary rows derived from official schedule data.
- `eventsActual`: observed dock boundary rows derived from physical evidence and trip context.
- `eventsPredicted`: predicted dock boundary rows derived from ETA and ML prediction data.

These tables are intentionally close to storage. They should not become an orchestration layer, a generic event framework, or a domain architecture showcase.

## Purpose Of Each Table

### `eventsScheduled`

Stores the planned dock boundaries for a vessel and sailing day. These rows form the schedule backbone that UI timelines, trip resolution, and reload logic can read.

Expected write pattern:

- Full-day replacement for a sailing day.
- Rows absent from a fresh schedule slice are deleted.
- Rows present and changed are replaced.
- Rows unchanged are left alone.

Expected read pattern:

- List by `VesselAbbrev` and `SailingDay`.
- Return stable chronological ordering.

### `eventsActual`

Stores observed dock boundaries. In realtime, these are emitted through the `VesselOrchestrator` path after upstream DTO/domain processing. In static reload, history and current location evidence may also create or refresh actual rows.

Expected write pattern:

- Sparse upsert by physical `EventKey`.
- Incoming duplicates collapse by `EventKey`.
- Rows are inserted, replaced, or skipped.
- Reload should not blindly delete physical-only observations that should survive the schedule refresh.

Expected read pattern:

- List by `VesselAbbrev` and `SailingDay`.
- Return stable chronological ordering.

### `eventsPredicted`

Stores ETA and ML predictions for dock boundaries. These are maintained by realtime prediction/event projection, not by the static schedule reload.

Expected write pattern:

- Sparse batch reconciliation by vessel and sailing day.
- Reconcile only targeted dock boundary keys.
- Delete stale rows for targeted keys.
- Insert, replace, or skip incoming prediction rows.
- Patch depart-next ML rows when an actual departure boundary confirms them.

Expected read pattern:

- List by `VesselAbbrev` and `SailingDay`.
- Provide grouped prediction rows for trip joins if still required by current callers.

## Current Problem

The event-table code has grown far beyond the intended level of abstraction. On the current reference branch, the scoped implementation under `convex/functions/events` and `convex/domain/events` is about 9,528 lines across 90 files.

The Apr 25 scoped reference was about 982 lines across 22 files. A broader fair baseline that includes related old timeline-row helpers was about 3,594 lines. The current implementation is still much larger.

The growth came from:

- Moving table-local mutation decisions into domain/planner modules.
- Splitting small readable functions into many single-purpose files.
- Adding compatibility re-export layers.
- Creating nested `domain/events` directories for purity concerns.
- Mirroring function schemas and types in domain code.
- Adding tests around internal decomposition rather than only behavior.

Some added code is valuable, especially behavior tests, public list queries, and real reload/prediction behavior. The problem is not that code was added; the problem is that the architecture no longer matches the low-level table role.

## Architectural Boundary

### `functions/events`

Owns Convex-facing table modules:

- Schemas and validators.
- Public queries.
- Internal mutation helpers.
- Static reload actions and internal mutations under `sync`.
- Table-local reconciliation logic.

Table-local reconciliation means insert/update/delete decisions for one event table. That logic usually belongs beside the mutation, not in `domain`.

### `domain/events`

Optional. Should contain only event business logic that is easier to understand outside a Convex function or is reused by multiple callers.

Appropriate domain code:

- Build dock boundary facts from schedule segments.
- Build prediction event facts from trip/ML DTOs.
- Infer actual event facts from physical location evidence.
- Resolve schedule seams or boundary ordering when reused outside one query.

Inappropriate domain code:

- Convex table persistence plans.
- Compatibility type barrels.
- Schema mirrors.
- Generic event abstractions.
- Deep nested helper folders.

### Shared Logic With VesselOrchestrator

Realtime data reaches event tables through `VesselOrchestrator`. In that path, fetched data is processed by `VesselOrchestrator` domain functions, passed through `VesselOrchestrator` function code, and then persisted into event tables.

Static reload should not reinvent a realtime transformation if the same DTO-level ferry logic already exists. If a transformation is truly useful to both realtime and static reload, move it to a neutral shared domain location. Do not make event-table modules depend on `functions/vesselOrchestrator`.

This refactor must not rewrite VesselOrchestrator internals.

## Minimum Required Function Signatures

Implementing agents must confirm all callers before editing. The following signatures are the expected minimum current surface.

### `convex/functions/events/eventsScheduled/queries.ts`

```ts
listScheduledDockEventsForVesselSailingDay: query({
  args: {
    vesselAbbrev: v.string(),
    sailingDay: v.string(),
  },
  returns: v.array(eventsScheduledSchema),
})
```

Optional internal reader if callers require it:

```ts
readScheduledDockEventsForVesselSailingDay(
  ctx,
  args: { vesselAbbrev: string; sailingDay: string }
): Promise<ConvexScheduledDockEvent[]>
```

### `convex/functions/events/eventsScheduled/mutations.ts`

```ts
upsertScheduledRowsForSailingDay(
  ctx: MutationCtx,
  SailingDay: string,
  nextRows: ConvexScheduledDockEvent[]
): Promise<void>
```

Required behavior:

- Load existing rows by sailing day.
- Delete stale keys.
- Insert missing keys.
- Replace changed keys.
- Skip unchanged keys.

### `convex/functions/events/eventsActual/queries.ts`

```ts
listActualDockEventsForVesselSailingDay: query({
  args: {
    vesselAbbrev: v.string(),
    sailingDay: v.string(),
  },
  returns: v.array(eventsActualSchema),
})
```

Optional internal reader if callers require it:

```ts
readActualDockEventsForVesselSailingDay(
  ctx,
  args: { vesselAbbrev: string; sailingDay: string }
): Promise<ConvexActualDockEvent[]>
```

### `convex/functions/events/eventsActual/mutations.ts`

```ts
upsertActualDockRows(
  ctx: MutationCtx,
  rows: ConvexActualDockEvent[]
): Promise<void>
```

Required behavior:

- Deduplicate rows by `EventKey`.
- Insert new rows.
- Replace changed rows.
- Skip unchanged rows.

Reload-specific actual behavior may live in `sync` or a small actual helper, but must remain explicit and tested.

### `convex/functions/events/eventsPredicted/queries.ts`

```ts
listPredictedDockEventsForVesselSailingDay: query({
  args: {
    vesselAbbrev: v.string(),
    sailingDay: v.string(),
  },
  returns: v.array(eventsPredictedSchema),
})
```

Optional internal readers if callers require them:

```ts
readPredictedDockEventsForVesselSailingDay(
  ctx,
  args: { vesselAbbrev: string; sailingDay: string }
): Promise<ConvexPredictedDockEvent[]>
```

```ts
loadPredictedRowsGroupedForTrips(
  ctx,
  trips: { VesselAbbrev: string; SailingDay?: string }[]
): Promise<Map<string, Map<string, ConvexPredictedDockEvent>>>
```

### `convex/functions/events/eventsPredicted/mutations.ts`

```ts
upsertPredictedDockBatches(
  ctx: MutationCtx,
  batches: ReadonlyArray<{
    VesselAbbrev: string;
    SailingDay: string;
    TargetKeys: string[];
    Rows: ConvexPredictedDockWriteRow[];
  }>
): Promise<void>
```

```ts
patchDepartNextMlRowsForDepBoundary(
  ctx: MutationCtx,
  depKey: string,
  actualMs: number
): Promise<boolean>
```

Required behavior:

- Merge batches by vessel and sailing day.
- Reconcile only `TargetKeys`.
- Delete stale targeted predictions.
- Insert new prediction rows.
- Replace changed prediction rows.
- Skip unchanged prediction rows.
- Patch depart-next ML rows with actual time and delta.

### `convex/functions/events/sync/actions.ts`

```ts
reloadDockEventsForCurrentSailingDay: action({ args: {} })
```

```ts
reloadDockEventsForSailingDay: action({
  args: { targetDate: v.string() }
})
```

```ts
reloadDockEventsWindow: internalAction({
  args: { daysToSync: v.optional(v.number()) }
})
```

```ts
reloadDockEventsAtSailingDayBoundary: internalAction({
  args: { daysToSync: v.optional(v.number()) }
})
```

Required behavior:

- Manual current-day reload.
- Manual explicit-day reload.
- Internal multi-day reload window.
- Internal Pacific 3am boundary-gated reload.

### `convex/functions/events/sync/mutations.ts`

```ts
replaceDockEventsForSailingDay: internalMutation({
  args: { ReloadDockData: reloadDockDataSchema },
  returns: v.object({
    ScheduledCount: v.number(),
    ActualCount: v.number(),
  }),
})
```

```ts
replaceScheduledDockEventsForSailingDay: internalMutation({
  args: { ReloadDockScheduleData: reloadDockScheduleDataSchema },
  returns: v.object({
    ScheduledCount: v.number(),
  }),
})
```

```ts
reloadActualDockEventsForSailingDay: internalMutation({
  args: { ReloadDockData: reloadDockDataSchema },
  returns: v.object({
    ActualCount: v.number(),
  }),
})
```

Required behavior:

- Scheduled reload can run independently.
- Actual reload can run independently.
- Combined reload writes scheduled and actual rows.
- Static reload does not rebuild `eventsPredicted`.

## Implementation Guidance For Agents

Before implementing a stage, create a small checklist:

- Required function name.
- Required input and output.
- Existing callers.
- Required database indexes.
- Existing behavior tests to preserve.
- Whether domain code is needed.

Then implement the smallest direct function that satisfies the checklist.

Default placement:

- Queries stay in `functions/events/<table>/queries.ts`.
- Mutations stay in `functions/events/<table>/mutations.ts`.
- Table schemas stay in `functions/events/<table>/schemas.ts`.
- Sync actions and reload mutations stay in `functions/events/sync`.
- Domain code is optional and must be justified.

## Suggested Task Decomposition

1. Inventory required callers and generated API references.
2. Rebuild all three query modules.
3. Rebuild `eventsScheduled` mutations.
4. Rebuild `eventsPredicted` mutations.
5. Rebuild `eventsActual` mutations.
6. Rebuild `sync` actions and internal mutations.
7. Decide whether any `domain/events/{actual,predicted,scheduled}.ts` files are truly needed.
8. Port or rewrite behavior tests.
9. Delete obsolete files.
10. Run final audit.

## Final Audit Checklist

- Current LoC and file count.
- Final LoC and file count.
- Remaining `domain/events` files and justification.
- Remaining cross-table shared code and justification.
- Query tests passing.
- Mutation tests passing.
- Sync/reload tests passing.
- Typecheck passing.
- VesselOrchestrator callers compile without internal refactor.
