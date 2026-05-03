# Handoff: Stage 1 — public vessel/day event-row queries

**Status:** Ready for implementation  
**Related:** [PRD: VesselTimeline client-owned event queries](./2026-05-03-vessel-timeline-client-event-queries-prd.md), [memo](./2026-05-03-vessel-timeline-client-owned-event-queries-memo.md)

This note records **owner decisions** that refine the PRD (camelCase args, explicit
ordering, stripping for all three tables, test placement, public access). Treat it
as the source of truth for Stage 1 if the PRD text disagrees.

---

## Objective

Add three **public** Convex `query` functions that return vessel/sailing-day
slices from `eventsScheduled`, `eventsActual`, and `eventsPredicted`, with
**stable ordering**, **metadata stripped** via `stripConvexMeta` from
`shared/stripConvexMeta`, and **camelCase** args. Do **not** change
`VesselTimeline` or any route timeline behavior yet.

---

## API surface (names)

Expose exactly these public queries (PRD names):

- `listScheduledDockEventsForVesselSailingDay`
- `listActualDockEventsForVesselSailingDay`
- `listPredictedDockEventsForVesselSailingDay`

Register with the **new** Convex function syntax: `query({ args, returns, handler })`.

---

## Arguments (camelCase)

All three:

```ts
args: {
  vesselAbbrev: v.string(),
  sailingDay: v.string(),
}
```

Handlers pass through to existing helpers using `{ vesselAbbrev, sailingDay }`.

**Note:** This differs from the current PRD Stage 1 snippet (`VesselAbbrev` /
`SailingDay`). Update the PRD when convenient so it stays aligned.

---

## Returns

- Each returns `v.array(...)` with the **existing row validators** from the
  respective module:
  - `eventsScheduledSchema`
  - `eventsActualSchema`
  - `eventsPredictedSchema`
- After reading from the DB, every element must be passed through
  **`stripConvexMeta`** before return (all three tables), so public payloads never
  include `_id` or `_creationTime`.
- **Do not** return `Doc<...>` from the public handlers.

---

## Data access

- Use **`withIndex("by_vessel_and_sailing_day", ...)`** with
  `.eq("VesselAbbrev", vesselAbbrev).eq("SailingDay", sailingDay)` (or
  equivalent).
- **No** route discovery, route filtering, terminal/window filtering, or
  dock-visit shaping.

---

## Ordering (explicit)

Apply **deterministic sort after `collect()`** (index order alone is insufficient):

1. **Scheduled:** sort with **`sortScheduledDockEvents`** from
   `convex/domain/timelineRows/scheduledSegmentResolvers.ts` (same ordering
   `mergeTimelineRows` applies to scheduled rows).
2. **Actual:** sort by `ScheduledDeparture` ascending, then **`EventKey`**
   ascending (lexicographic).
3. **Predicted:** sort by `ScheduledDeparture` ascending, then **`Key`**
   ascending (lexicographic).

Document the ordering briefly in TSDoc on each public query so client and tests
share expectations.

---

## Implementation structure

**Files to touch:**

- `convex/functions/events/eventsScheduled/queries.ts`
- `convex/functions/events/eventsActual/queries.ts`
- `convex/functions/events/eventsPredicted/queries.ts`

Keep existing exports (`queryScheduledDockEventsForVesselSailingDay`,
`loadActualDockEventsForVesselSailingDay`,
`loadPredictedDockEventsForVesselSailingDay`, plus
`loadPredictedRowsGroupedForTrips` where applicable) as **internal helpers**.

Add the new `query({...})` exports in the **same files**, delegating to helpers,
then **sort** + **strip**:

- **Scheduled:** `queryScheduledDockEventsForVesselSailingDay` already returns
  stripped rows; public handler = collect via helper → **sort** with
  `sortScheduledDockEvents` → return.
- **Actual / predicted:** helpers return docs; public handler = helper →
  **map(stripConvexMeta)** → **sort** → return.

---

## Barrels / API index

- `events*/index.ts` already does `export * from "./queries"`; new symbols should
  surface automatically.
- `convex/functions/index.ts` already namespaces `eventsScheduled`,
  `eventsActual`, `eventsPredicted`; **no change** unless something fails to
  export.

---

## Auth / visibility

**Fully public** for now: use the standard `query` builder, **no** `customQuery`
/ auth gate unless product later requires it.

---

## Lifecycle note

**`getVesselTimelineBackbone`:** no behavioral regression required in Stage 1;
intent is to **deprecate it once nothing needs it** (later stages). Do not remove
it in Stage 1.

---

## Tests (colocated)

Under each area, add tests in a **`tests/`** subdirectory, e.g.:

- `convex/functions/events/eventsScheduled/tests/listScheduledDockEventsForVesselSailingDay.test.ts`
- `convex/functions/events/eventsActual/tests/listActualDockEventsForVesselSailingDay.test.ts`
- `convex/functions/events/eventsPredicted/tests/listPredictedDockEventsForVesselSailingDay.test.ts`

**Coverage goals:**

- Handler uses the **`by_vessel_and_sailing_day`** index (mock `ctx.db.query` /
  chain like `loadBackboneInputs.test.ts` if that is the project pattern).
- Returned objects **omit** `_id` and `_creationTime`.
- **No** route/window/terminal filtering beyond vessel+day (assert mock was called
  with the right index and eqs).
- **Ordering:** small fixtures proving sort order for each table (especially
  scheduled vs `sortScheduledDockEvents`).

Prefer **direct tests of the handler logic** if you need to export a thin
internal `handler` or `runList…ForTest` — avoid widening public API without need;
follow existing Convex test patterns in this repo.

---

## Verification

- `bun run convex:typecheck`
- Confirm new functions appear under generated API for
  `api.functions.eventsScheduled` / `eventsActual` / `eventsPredicted` after
  codegen (as applicable in your workflow).

---

## Out of scope for Stage 1

- Client context, `VesselTimeline`, deleting `routeTimeline`, changing schemas,
  pagination.

---

## Document history

- **2026-05-03:** Initial handoff from Stage 1 clarifications (camelCase args,
  explicit ordering, `stripConvexMeta` for all three, colocated tests, fully
  public queries).
