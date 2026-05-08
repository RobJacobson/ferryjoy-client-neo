# Events Old-Code-First Stage 19 Sync Internal Mutations And Reload Payload Validators Handoff

Date: 2026-05-08

## Stage Scope

Reduce or justify the dock-event reload **internal persistence** boundary: split
scheduled/actual internal mutations, Convex validators for action-to-mutation
payloads, and closely coupled sync helpers — without deleting public/manual
reload actions (`Stage 18`) and without rewriting cron boundary semantics
(`Stage 17`).

### Default editable files

- `convex/functions/events/sync/mutations.ts`
- `convex/functions/events/sync/reloadDockPayload.ts`
- `convex/functions/events/sync/reloadDockDataSchemas.ts` (removed; replaced by
  `reloadDockPayload.ts`)
- `convex/functions/events/sync/types.ts` (removed; result types colocated with
  sailing-day and window helpers)
- `convex/functions/events/sync/reloadDockEventsForSailingDay.ts` (also holds
  inlined epoch mapping and `fetchHistoryRecordsForDate`; former
  `buildConvexReloadDockDataFromFetchedSlices.ts` and
  `fetchHistoryRecordsForDate.ts` files removed)
- Trip index load logic lives in `mutations.ts` (former
  `loadTripIndexesForSailingDay.ts` inlined per Tier 2).
- Focused sync tests under `convex/functions/events/sync/tests/` that must
  change because of signature or import edits
- `convex/domain/events/reload.ts` **only when** a concrete reduction depends on
  it (same rule as parent handoff), plus its tests if touched
- This handoff note
- `docs/engineering/2026-05-06-events-old-code-first-stage-log.md`

### Do not edit in this stage (unless importing breaks)

- `convex/functions/events/sync/actions.ts` (manual/cron/public surface is
  frozen except trivial type re-exports moved next door)
- Cron wiring, `scripts/sync-dock-events.ts`, `package.json`
- Predicted events, realtime update paths
- Tables outside scheduled/actual for reasons unrelated to reload persistence

Scoped paths remain:
`convex/functions/events/**` and `convex/domain/events/**` plus import fixes only
when required — same as parent handoff.

## Required Reading

Read before touching production code:

- `docs/engineering/2026-05-06-events-old-code-first-size-reduction-prd.md`
- `docs/engineering/2026-05-06-events-old-code-first-stage-log.md` (Stages 5,
  10, 17, 18 notes and deferred observations)
- `docs/engineering/2026-05-08-events-old-code-first-final-stages-handoff.md`
  (Stage 19 section)
- `.cursor/rules/code-style.mdc`
- `docs/convex_rules.mdc`
- `docs/engineering/2026-05-07-events-old-code-first-stage-10-actual-static-reload-handoff.md`
- `docs/engineering/2026-05-08-events-old-code-first-stage-17-sync-cron-boundary-action-handoff.md`
- `docs/engineering/2026-05-08-events-old-code-first-stage-18-sync-manual-actions-handoff.md`

Baseline: **`events-old-reference`**. Trace the old vessel timeline **reseed
persistence slice** comparable to splitting schedule vs actual writes — not an
unrelated oversized file unless that file truly participated in the same
behavior. Do **not** use `events-current-reference` unless the owner asks.

## Facts Already Resolved In Current Tree (Use These; Do Not Re-Litigate Basics)

These answer several questions posed in the final-stages doc and avoid wasted
discovery time.

### 1. Who imports `reloadDockDataSchemas.ts`?

**Not** only `sync/mutations.ts`. As of handoff authoring, imports include:

- `convex/functions/events/sync/mutations.ts` — validators and Convex types on
  the mutation boundary
- `convex/functions/events/sync/buildConvexReloadDockDataFromFetchedSlices.ts`
  — return typing for numeric payload assembly
- `convex/domain/events/reload.ts` — **narrow type imports**
  (`ConvexReloadDockScheduleSegment`, `ConvexReloadDockHistoryRecord`) used for
  row builders that consume mutation-shaped rows
- `convex/domain/events/tests/reload.test.ts` — schedule segment fixture typing
- `convex/functions/events/sync/tests/reloadMutations.test.ts` — validators and
  inferred types for mutation tests

Therefore: merging validators blindly into **`mutations.ts`** **collides with the
layering resolutions** unless types live in a small shared scoped module or
domain-local duplication. Prefer an explicit LoC and readability verdict over a
dogmatic merge.

Exported sub-schemas (`reloadDockScheduleSegmentSchema`,
`reloadDockHistoryRecordSchema`) appear **unused outside**
`reloadDockDataSchemas.ts` itself — confirm with `rg` before deleting exports.

### 2. Who imports `sync/types.ts`?

Only sync-local orchestration modules:

- `convex/functions/events/sync/reloadDockEventsForSailingDay.ts` —
  `EventReloadResult`
- `convex/functions/events/sync/reloadDockEventsWindow.ts` —
  `WindowReloadResult`, `WindowReloadDayResult`
- `convex/functions/events/sync/actions.ts` — `EventReloadResult`,
  `WindowReloadDayResult` for handlers

No app or Convex module outside **`convex/functions/events/sync`** imports this
path in normal code. Consolidating next to **one caller** risks spreading
duplicate result types across three files unless you pick a single home (for
example a small result-types module co-located with `actions.ts`, or inlined
near the helpers with **one** authoritative export reused by actions).

### 3. Split persistence mutations are deliberate

Single-day reload runs **`replaceScheduledDockEventsForSailingDay`** then
**`reloadActualDockEventsForSailingDay`** from
`reloadDockEventsForSailingDay.ts`. That mirrors the staged table ownership in
`mutations.ts` comments. Reduction must **not** merge tables back into one
mutation unless behavior and live scheduling stay identical — out of scope
unless owner approves a contract change.

### 4. Stage 10 deferred observation (must address or explain)

`domain/events/reload.ts` **`buildReloadDockEventRows`** still computes
**`scheduledRows`** and **`scheduledCount`**, returned alongside actual rows via
the same **`buildScheduledDockEvents`** normalization path used downstream for
scheduled rows.

The scheduled reload path calls **`buildReloadScheduledDockRows`** separately in
`mutations.ts`, not from that return bundle. Actual reload **only consumes**
`actualRows` / `actualCount`. Removing duplicate scheduled work cleanly almost
always requires refactoring **`buildReloadDockEventRows`** and possibly who owns
scheduled assembly — staged as **canonical Stage 19 work** per final-stages doc.

Reject “tiny refactor” wins that leave this duplication untouched.

### 5. `buildConvexReloadDockDataFromFetchedSlices`

Single production caller:
`reloadDockEventsForSailingDay.ts`. It encapsulates Date to epoch-ms mapping for
validators. Decide with old-code comparison: inline into the runner **only if**
merged result is strictly smaller **and** no second caller appears soon; else
justify keeping the boundary.

### 6. `fetchHistoryRecordsForDate` vs `loadTripIndexesForSailingDay`

- **`fetchHistoryRecordsForDate`**: exactly **one** production caller
  (`reloadDockEventsForSailingDay.ts`). Tests spy on this module (
  `runReloadDockEventsForSailingDay.test.ts`). Inlining may force test hook
  edits or broader mocks — count that churn in Stage 21 test budget.
- **`loadTripIndexesForSailingDay`**: only **`reloadActualDockEventsForSailingDayRows`** in
  mutations. Indexes come from voyage tables using helpers re-exported from
  **`domain/events/reload`**. Inlining saves a file **only if** the mutation body
  stays clearer; preserve **physical-only TripKey** sourcing for Stage 5
  `preserveAbsentTripKeys`.

## Old-Code Baseline Trace (Mandatory First Step)

Starting points on **`events-old-reference`** (adapt names from that tree):

- Public/internal actions that reseeded timelines for **one sailing day** and/or
  **window**.
- Mutation or persistence layer that cleared/replaced persisted rows within the
  same logical operation (split or unified).
- Any validator or normalization step at the boundary between fetched adapter
  data and DB writes — note whether old code duplicated schedule assembly for
  actual hydration.

Deliverable from trace:

1. Ordered list from **entrypoint** (operator/cron analogue) → **normalized
   rows** → **write path(s)** → **counts returned**.
2. Whether old persistence was **single write** vs **scheduled then actual**.
3. Explicit note of **anything current must keep** that old did without (Convex
   validators, split mutations, TripKey preservation, numeric epoch payloads).

Compare **comparable slices** LoC-wise, not the entire timeline module graph
unless justified.

## Owner Resolutions — 2026-05-08

Orchestrator decisions for Stage 19. Prefer KISS over architectural purity unless
the alternative is clearly worse in LoC and readability.

### 1. Layering if validators move

Domain should **not** import from `functions/` when avoidable. The current
**`domain/events/reload.ts`** import from **`reloadDockDataSchemas.ts`** is a smell,
not a precedent to preserve.

If validators consolidate out of **`reloadDockDataSchemas.ts`**:

- **Preferred:** a small reload payload/type module under scoped Convex paths that
holds **only** the POJO/type boundary needed by sync and domain.
- **Acceptable:** duplicate a minimal domain-local input type when that stays
smaller and clearer than a shared module.
- **Avoid:** **`domain/events/reload.ts`** importing from **`sync/mutations.ts`**.

### 2. Primary optimization: scheduled build on the actual path

Removing duplicate scheduled-row construction from the actual reload path is
**explicitly in scope** (Stage 10 deferred lever). The agent may touch
**`domain/events/reload.ts`** even for a **~100+ line** diff when the change is
**targeted** at that removal while preserving scheduled reload semantics.

If the work **balloons** into a broad reload rewrite, stop and file a **blocker**
with the exact split needed. **Targeted `reload.ts` surgery is approved;
architecture excavation is not.**

### 3. Operator automation on internals

Assume **no** external operator automation calls
**`internal.functions.events.sync.mutations.*`**. The known live operator surface
is the public actions used by **`scripts/sync-dock-events.ts`**.

Changing internal mutation signatures or names is fine when all internal callers
update, **`bun run convex:codegen`** runs, and type checks pass.
**Still document API churn plainly** in the stage report.

### 4. `sync:dock-events` smoke

Treat **`bun run sync:dock-events`** as **manual-only** optional verification. Do not
assume a local Convex deployment exists.

Stage acceptance hangs on focused tests, type checks, and codegen when applicable.
Listing the smoke command as optional guidance is OK; blocking acceptance on it
is not.

## Investigation Checklist Before Edits

1. `rg`:
   `buildReloadDockEventRows|scheduledRows|reloadDockDataSchemas|ConvexReloadDock`
   across `convex/`.
2. Confirm **`buildReloadDockEventRows`** return field **`scheduledRows`** has **no**
alternate production or test consumer beyond the intended refactor target (exports,
re-exports, generated API).
3. Confirm **exact** dependents of **`reloadDockDataSchemas`** exports (types vs
validators).
4. Decide: keep numeric epoch boundary vs collapse types + validators differently
(per PRD skepticism toward separate files — must show net LoC drop or documented
parity).
5. If production LoC comparison shows **greater than ~3×** old comparable slice:
   produce **pre-edit plan per parent workflow**, wait for owner/orchestrator nod.
6. Count raw LoC for each touched file **before** edits (`wc -l` or equivalent).

## Hard Acceptance Constraints

Inherited from parent handoff plus Stage 17/18 posture:

1. Do **not** delete **`reloadDockEventsForCurrentSailingDay`** or
**`reloadDockEventsForSailingDay`** or **`reloadDockEventsWindow`** public/internal
parity required by **`scripts/sync-dock-events.ts`** and cron.
2. Do **not** remove Pacific hour-three guard or two UTC crons indirectly by
narrowing payloads those paths need.
3. Preserve **scheduled / actual pipeline separation unless unification deletes
measurable code** — no new generic “reload framework.”
4. Passing tests alone is insufficient: document **meaningful** reduction OR a
numbered **blocker** with identified follow-up (for example deferring domain work
behind approval).
5. Avoid drive-by churn in Stage 21 test files unless unavoidable; budget test
fixture moves when inlining mocked modules.

## Valid Outcomes (Pick One Loudly)

### Outcome Alpha — substantive reduction

Measurable production LoC down across the scoped sync + touched domain helpers,
preferably eliminating:

- dead scheduled work on the actual reload branch, **or**

- redundant file boundaries (**`types`** collapse, **`buildConvexReload...`**
merge, validators co-located with single consumer) **without** increasing domain
dependence on sloppy edges

Every retained extra line versus old baseline needs a **caller or behavior ID**.

### Outcome Beta — blocker report

Demonstrate comparability to **old analogous slice**, show current stack is near
minimal given Convex validators + split mutations + TripKey semantics, list the
exact lever deferred (often **breadth-beyond-approved `reload.ts` surgery**, not
targeted duplicate-scheduled removal). Provide LoC proof; no gratuitous churn.

Reject Outcome Gamma: shaving **< ~30–40 raw production lines** leaving the Stage
10 duplicate scheduled build in place unless documented as unavoidable despite
the owner resolutions above.

## Required Worker Deliverable Sections

Mirror Stage 17/18 reports:

1. Old trace summary — files, LoC counted, behavioral bullet list.

2. Current call graph ascii or bullet (single-day reload path through two
internal mutations).

3. LoC tables: old slice | before | after — production and tests separately when
tests move.

4. Delta table (“extra vs old”) with **Keep** / **Delete** / **Deferred** rows.

5. Answer explicitly to final-stages “Questions Stage 19 Must Answer”; cite `rg`.

6. If touching **`domain/events/reload.ts`**: explain why refusal is impossible
within sync-only scope.

7. Verification commands run plus results.

### Verification (run smallest sensible set)

```sh
bun test convex/functions/events/sync/tests/reloadMutations.test.ts
bun test convex/functions/events/sync/tests/runReloadDockEventsForSailingDay.test.ts
bun test convex/functions/events/sync/tests/runReloadDockEventsWindow.test.ts
bun test convex/domain/events/tests/reload.test.ts
bun run type-check
bun run convex:typecheck
```

After any Convex function export or validator shape change affecting generated
routing:

```sh
bun run convex:codegen
```

Optional manual operator smoke (**not required** for stage acceptance):

```sh
bun run sync:dock-events
```

## Recommendation To Implementing Agent

**Primary win target:** refactor **`buildReloadDockEventRows`** / call sites so the
actual internal mutation stops paying for **`scheduledRows`**, keeping scheduled
replacement via **`buildReloadScheduledDockRows`** as today — align with deferred
Stage 10 note once layering is sane.

**Secondary:** **`sync/types.ts`** is safely collapsible compared to validators
because dependents are intra-folder only — pick one readable home.

**Tertiary:** Split **validators** versus **payload types** per **Owner resolutions**:
types may live in a small scoped shared module or as minimal domain-local dupes;
validators may sit in **`mutations.ts`** or beside that module; **never** have
**`domain/events/reload.ts`** import **`sync/mutations.ts`**. Trimming dead
**`reloadDockDataSchemas`** exports counts as partial credit only when bundled with
real duplication removal (for example the duplicate scheduled build).

Do not churn **`actions.ts`** line counts as Stage 19 success.

## References

Parent summary:
`docs/engineering/2026-05-08-events-old-code-first-final-stages-handoff.md` §
Stage 19.

## Stage 19 Implementation Report (2026-05-07)

### 1. Old trace summary (events-old-reference)

- Entrypoint: `convex/functions/vesselTimeline/actions.ts` (`syncVesselTimelineManual` / explicit-date action) calls `reseedVesselTimelineForDate`.
- Fetch + normalize: `convex/functions/vesselTimeline/sync/reseedVesselTimelineForDate.ts` fetches schedule + history and builds hydrated boundary events in memory.
- Write path: `convex/functions/vesselTimeline/mutations.ts` calls internal `reseedBoundaryEventsForSailingDay`.
- Persistence split: `convex/functions/vesselTimeline/reseed/runReseedBoundaryEventsForSailingDay.ts` writes scheduled rows with `upsertScheduledRowsForSailingDay`, then writes actual rows with `replaceActualRowsForSailingDay`.
- Counts returned: same internal mutation returns both `ScheduledCount` and `ActualCount`.
- Current-only behaviors retained: Convex validator payload boundary, TripKey preservation for physical-only actual rows, and numeric epoch payloads at the action adapter boundary.

### 2. Current call graph (single-day reload) — Stage 19b

- `runReloadDockEventsForSailingDay`: fetch schedule + history, numeric epoch conversion inline, `buildHydratedDockBoundaryEventsForReload` in the action, then **one** `runMutation` to `reseedDockEventsForSailingDay` with `{ SailingDay, Events }`.
- `reseedDockEventsForSailingDay`: trip index load (inlined from former `loadTripIndexesForSailingDay.ts`), `buildReloadDockSliceFromHydratedEvents`, `upsertScheduledRowsForSailingDay`, `replaceActualRowsForSailingDay` with `preserveAbsentTripKeys`.

### 3. LoC tables (dual baseline, Stage 19b)

**Domain:** old `timelineReseed` production files sum ~1,245 vs `reload.ts` ~1,168 lines (see stage log).

**Shell:** all `convex/functions/events/sync/*.ts` production lines ~519 after Tier 2–3 (trip indexes in `mutations.ts`; history + epoch maps in `reloadDockEventsForSailingDay.ts`).

### 4. Delta table (extra vs old)

| Item | Decision | Note |
| --- | --- | --- |
| Split scheduled + actual internal mutations | Delete | Replaced by single `reseedDockEventsForSailingDay` (Stage 19b). |
| Trip index helper module | Delete | Inlined into `mutations.ts`; single caller only. |
| Payload boundary (`reloadDockPayload.ts`) | Keep | `reseedDockEventsForSailingDayArgsSchema` validates hydrated `Events` array. |
| `buildConvexReloadDockDataFromFetchedSlices` | Delete | Inlined into `reloadDockEventsForSailingDay.ts`. |
| `fetchHistoryRecordsForDate.ts` | Delete | Same; `fetchHistoryRecordsForDate` exported from sailing-day module for tests. |
| TripKey preservation for physical-only actual rows | Keep | Same `preserveAbsentTripKeys` set as before. |

### 5. Final-stages Stage 19 question answers (updated)

1. Validators: mutation accepts only `SailingDay` + `Events` (boundary records); WSF segment/history validators removed from mutation boundary.
2. Duplicate scheduled work: one slice builder `buildReloadDockSliceFromHydratedEvents` drives both tables.
3. Shell vs 416 narrow slice: remaining delta is domain logic in `reload.ts`, inlined adapter conversions on the action side, and sync action/cron surface — see dual-baseline row in stage log.

### 6. Why `domain/events/reload.ts` still matters

Hydration and slice assembly remain domain-owned; unifying the mutation removed duplicate identity reads and duplicate internal mutations but not the core transform size. Full old `timelineReseed` folder LoC is the honest domain baseline.

### 7. Verification run (Stage 19b)

- `bun test convex/functions/events/sync/tests/` passed.
- `bun test convex/domain/events/tests/reload.test.ts` passed.
- `bun run type-check` passed.
- `bun run convex:typecheck` passed.
- `bun run convex:codegen` passed.
