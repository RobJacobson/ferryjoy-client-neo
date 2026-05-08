# Stage 19 Second Pass: Ruthless Sync And Reload Reduction Plan

Date: 2026-05-08

Audience: orchestrator and implementing agents.

This plans a **redo** of the size-reduction half of Stage 19. Functional fixes (for example removing duplicate scheduled materialization from the actual-only return path) stay good; presenting **13 LoC** net against a mis-scoped denominator is **not** an acceptable Stage 19 outcome under the PRD.

## Lesson: Do Not Use A Partial Old Denominator Against A Full Current Numerator

The earlier Stage 19 report compared **416** “old comparable” LoC against **~1,664–1,677** “scoped production” LoC.

That **416** sum (verified on **`events-old-reference`**) deliberately covered only:

```text
reseedVesselTimelineForDate.ts        93
vesselTimeline/mutations.ts          32
runReseedBoundaryEventsForSailingDay.ts  62
vesselTimeline/schemas.ts            73
vesselTimeline/sync/types.ts         14
buildReseedTimelineSlice.ts          142
                                  ----
                                   416
```

It **excludes**:

- **`fetchHistoryRecordsForDate.ts`** (45 lines old)
- **`loadTripIndexesForSailingDay.ts`** (53 lines old)
- **`syncWindowedVesselTimeline.ts`** (69 lines old)
- **`actions.ts`** cron and manual surfaces (84 lines old — not all attributable to single-day persistence)
- **`domain/timelineReseed`** production modules that implement seed, hydrate,
  normalize, merge, reconcile, and slice build — together **far larger than 416**:

```text
seedScheduledEvents.ts             234
hydrateWithHistory.ts              229
normalizeEventRecords.ts           101
buildReseedTimelineSlice.ts        142  (included in both lists)
mergeActualDockWritesIntoRows.ts    46
reconcileLiveLocations.ts          450
scheduleDepartureLookup.ts          30
index.ts                            13
                                   ----
                    subtotal (~1,247; buildReseed counted once)
```

So **current `convex/domain/events/reload.ts` at ~1,137 LoC roughly replaces that old timelineReseed production stack** (Stage 10 historical comparison ~1,142 vs summed old slice ~1,232).

**Any Stage 19 size story must use two denominators**:

1. **Functions-only shell** (~416 + fetched helpers if in scope — history fetch, trip load, window runner) versus **`convex/functions/events/sync/**/*.ts`** only.
2. **Domain row assembly** (old **`domain/timelineReseed`** prod sum) versus **`convex/domain/events/reload.ts`**.

Measuring **`reload.ts`** inside a bucket compared to **416 without timelineReseed** guarantees a fake “4x gap” narrative and incentivizes trivia like **13-line** deltas.

Agents must stop starting from “today’s tree and delete lines.” They must **re-derive the live path from `events-old-reference`**, list **forced deltas** (split tables, Convex validators, physical-only TripKey semantics, etc.), then implement only that.

## Old Baseline Flow (Authoritative)

From **`events-old-reference`**:

1. **Action** `reseedVesselTimelineForDate`: load identities, fetch schedule segments, **`buildSeedVesselTripEventsFromRawSegments`**, **`fetchHistoryRecordsForDate`**, **`hydrateSeededEventsWithHistory`**, then **`runMutation(reseedBoundaryEventsForSailingDay, { SailingDay, Events: hydratedEvents })`** — one payload type carrying **already hydrated boundary records**.
2. **Mutation** `runReseedBoundaryEventsForSailingDay`: load trip indexes and vessel locations, **`buildReseedTimelineSlice({ events, ... })`** → **scheduledRows, actualRows, counts**, then upsert scheduled and replace actual, **single mutation returns both counts**.

The **thin** functions layer was possible because heavy projection lived in **domain timelineReseed** and **hydration crossed the boundary as structured events**, not as a rebuilt schedule-plus-history Cartesian product inside the mutation.

## Current Flow (Problem Shape)

Roughly:

1. Action builds **`ConvexReloadDockData`** (numeric schedule + history) via **`buildConvexReloadDockDataFromFetchedSlices`**.
2. **Two internal mutations**: scheduled replaces from **`buildReloadScheduledDockRows`**; actual replace from **`buildReloadDockEventRows`** (still doing seed → hydrate-ish → actual assembly inside **`reload.ts`**).

That forces **`reload.ts`** to own **duplicate traversal** of the same schedule slice (scheduled path versus actual path) and keeps a **validators + payloads** machinery the old stack avoided at the persistence boundary (**events** crossed, not opaque numeric rows only).

Net: parity with behavior can exist while **architecture drifts thicker** than the old “hydrate once in action → slice once in mutation” seam.

## Forced Increments Versus Original (Must Be Listed Per Line Of Policy)

Anything below is **candidate** justification, not blanket permission:

- **`eventsScheduled` / `eventsActual` split** versus single **`vesselTimeline`** table forces **either** split mutations **or** one mutation that internally calls both table helpers (old already did both writes from **one** internal mutation — **prefer restoring one mutation** unless Convex or ownership rules forbid it).
- **Convex `v` validators** on `internalMutation` args: required if payloads stay Convex-shaped; disappears if payloads match validator-light doc shapes analogous to **`ConvexVesselTimelineEventRecord[]`** after action-side assembly.
- **Physical-only TripKey preservation** (`preserveAbsentTripKeys`): Stage 5 product constraint — **cannot** regress; does not by itself mandate **duplicate** builders.
- **Numeric epoch payloads**: convenience for validators; revisit if hydrated events boundary returns — may delete **`buildConvexReloadDockDataFromFetchedSlices`** outright.

Everything else owes a **caller-linked** reason or should be merged back toward the old contour.

## Ruthless Reduction Plan (Old-First Sequence)

Workers execute **in order**. No “trim current file” without old-flow citation per hunk.

### Phase 0 — Baseline receipts (blocking)

Produce a short LoC appendix with **`wc -l`** on **`events-old-reference`** paths:

- Old **functions shell** slice used for cron + manual + fetch + **`runReseedBoundaryEventsForSailingDay`**.
- Old **`domain/timelineReseed`** production files (**exclude tests**).

Produce the same **`wc -l`** appendix for:

- **`convex/functions/events/sync/**/*.ts`**
- **`convex/domain/events/reload.ts`**

Put **dual comparison tables** side by side **before** proposing edits.

### Phase 1 — Restore the persistence boundary contour

**Hypothesis aligned with original:** hydrate and normalize **scheduled boundary records once** before `internalMutation` (today’s action stack), persist with **one** internal mutation identical in shape to **`runReseedBoundaryEventsForSailingDay`** (single round-trip counts), and reduce **`reload.ts`** to a **slice builder role** analogous to **`buildReseedTimelineSlice`** (one pass outputs both row lists).

Concrete steps:

1. Define a **`ConvexHydratedReloadBoundaryEvent`** validator (narrow name TBD from old **`ConvexVesselTimelineEventRecord`**) scoped under **`reloadDockPayload`** or domain types per owner layering rules — **no** duplication of mutation imports in domain beyond agreed payload types.
2. Replace **`ConvexReloadDockData`** **mutation** payloads for persistence with **hydrated events + sailing day**, matching old **`reseedBoundaryEventsForSailingDay`** args shape.
3. Implement **`buildDockReloadSliceFromHydratedEvents`** (name TBD): **single** projection from hydrated events plus trip indexes plus locations → **`scheduledRows`**, **`actualRows`**, counts — deletes the **second** traversal currently implied by **`buildReloadScheduledDockRows`** versus **`buildReloadDockEventRows`**.

Risk control: staged PR with tests unchanged in behavior assertions; mutations may stay **thin** wrappers that call **`upsertScheduledRowsForSailingDay`** then **`replaceActualRowsForSailingDay`** inside **one** `internalMutation` for atomic day semantics matching old ordering.

Outcome metric: **`reload.ts` raw LoC** should move **toward** old **`buildReseedTimelineSlice` + merges + reconcile subset** summed — not stay as two parallel castles.

### Phase 2 — Action layer hydration honesty

Re-read old **`hydrateWithHistory`** and **`hydrateSeededEventsWithHistory`** on **`events-old-reference`**.

- Move **`buildConvexReloadDockDataFromFetchedSlices`**, **`reloadDockPayload` schedule/history validators**, or their replacements until **scheduled segments + identity resolution + history merge** reconstruct **exactly one** hydrate pipeline on the action side analogous to **old**.
- Goal: **`fetchHistoryRecordsForDate`** stays a single helper (old had ~45 LoC — already lean); **`buildConvexReloadDockDataFromFetchedSlices`** either **dies** because numeric payload boundary dies, or collapses inline if unavoidable.

Verification: **`runReloadDockEventsForSailingDay`** should read like **`reseedVesselTimelineForDate`** in control flow (**fetch → seed → hydrate → single mutation**).

### Phase 3 — Collapse file sprawl once boundary stable

Only after Phase 1–2:

- Merge **`reloadDockPayload.ts`** into **`mutations.ts`** **if** payloads shrink to **one** validator blob and layering stays clean.
- **`loadTripIndexesForSailingDay`**: parity with **53→48** LoC suggests little fat; reassess imports after **`reload.ts`** splits — optionally inline **if** LOC drops without hurting tests.
- Window runner and actions: revisit PRD bullets on whether **`reloadDockEventsWindow`** can fold into **`actions.ts`** without noise — **never** shrink before hydration unification (**Phase 1** dominates).

### Phase 4 — Tests and acceptance bar

Minimum:

- Preserve behavior tests for hydrate + physical-only preservation + mutation delegation.
- **Stage 21** owns broad test massacre; Phase 19 second pass touches tests only where persistence contract changes demand it.

Hard acceptance (**replace** naive “passed tests”) for this second pass:

- **Functions-only**: net production LoC in **`functions/events/sync` trends toward old shell + deltas** justified in a table (**target: double-digit percentage drop or explicit blocker** versus wrong 416-vs-all framing).
- **Domain**: **`reload.ts`** net drop **versus old timelineReseed production sum**, or blocker naming **specific** functions that cannot map smaller without product change.

Treat **explicit owner-signed blocker report** as success only if phases 0–3 prove **`replaceActualRowsForSailingDay`** + Convex constraints prevent old boundary shape restoration.

### Phase 5 — Documentation hygiene

After code acceptance:

- Update **`2026-05-06-events-old-code-first-stage-log.md`** Stage 19 row — either **completed second pass with honest baselines**, or **`partial / superseded`** with pointer here.
- Retire misleading “416 versus full scoped tree includes domain reload megafile” summaries from outdated handoffs (edit in place when touching those docs).

## What To Tell The Next Agent (One Paragraph)

Rebuild the static reload path starting from **`events-old-reference`**’s **action hydrate once → single internal mutation with hydrated events → one domain slice builder** shape. Quantify **`functions/sync`** versus old functions shell separately from **`reload.ts`** versus old **`domain/timelineReseed`** production totals. Prefer **merging persistence back into one internal mutation**, **replacing numeric dual-payload Convex validators** with hydrated event validators, **deleting duplicated schedule traversal** between scheduled and actual builders, and deleting **`buildConvexReloadDockDataFromFetchedSlices`** if the persistence boundary transforms. Until **dual denominator** receipts exist, **do not ship** marginal LoC deltas as Stage wins.
