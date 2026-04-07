# Handoff: Vessel timeline sync — missing actual arrivals (CAT / triangle route)

## Status

**Unresolved.** Prior attempts improved matching heuristics, but **production behavior is still wrong** for Cathlamet (CAT) on the Fauntleroy–Vashon–Southworth triangle: many **scheduled arrival** rows show no **actual arrival** time in the Vessel Timeline UI, while some times (e.g. certain Vashon arrivals) do show. The **root cause has not been proven** end-to-end.

**Unit tests** for `mergeSeededEventsWithHistory` may **pass locally** while still **failing to represent real WSF payloads**, terminal tables, or downstream mutation behavior. Treat tests as **regression guards for the pure merge function**, not as proof the full pipeline is correct.

---

## Symptom summary (from product / user reports)

- After clearing `eventsActual` / `eventsScheduled` / `eventsPredicted` and running the manual sync, **departure** actuals often appear; **arrival** actuals are **intermittent**.
- CAT on the **triangle** route: failures reported at scheduled arrivals such as **2:10 PM, 2:50 PM, 3:40 PM**; **1:55 PM and 3:20 PM** sometimes work (pattern suggested **Vashon vs Southworth/Fauntleroy**, but this is **not verified** against raw API data).
- Screenshots in prior threads show **stopwatch missing on `arv-dock` rows** while `dep-dock` rows have actuals.

---

## What “sync” actually does (full path)

Manual entrypoint:

- Script: [`scripts/sync-vessel-timeline.ts`](../../scripts/sync-vessel-timeline.ts) → Convex action `syncVesselTimelineManual` / `syncVesselTimelineForDateManual`.
- Action: [`convex/functions/vesselTimeline/actions.ts`](../../convex/functions/vesselTimeline/actions.ts)  
  - Fetches schedule via `fetchAndTransformScheduledTrips` → `buildSeedVesselTripEventsFromRawSegments` (direct segments only).  
  - Fetches WSF vessel history per vessel name appearing on the schedule → `mergeSeededEventsWithHistory`.  
  - Calls internal mutation `replaceBoundaryEventsForSailingDay`.

Replace mutation (important — **not covered by history unit tests**):

- [`convex/functions/vesselTimeline/mutations.ts`](../../convex/functions/vesselTimeline/mutations.ts)  
  - Builds `baseActualRows` from hydrated in-memory events.  
  - Then merges **`buildActualBoundaryPatchesForSailingDay`** using **live `vesselLocations`**.  
  - **`mergeActualBoundaryPatchesIntoRows`** can add/override per-key actuals.

So even if `mergeSeededEventsWithHistory` is correct, **final `eventsActual` can differ** after location patches. Any investigation must confirm whether gaps are introduced **before** or **after** that merge.

---

## Core domain code (history → actual times)

| Concern | File |
|--------|------|
| Merge schedule seed + WSF history into `EventActualTime` on boundary records | [`convex/domain/vesselTimeline/events/history.ts`](../../convex/domain/vesselTimeline/events/history.ts) |
| Direct-only schedule segments used as merge targets | [`convex/domain/vesselTimeline/events/seed.ts`](../../convex/domain/vesselTimeline/events/seed.ts) (`getDirectRawSeedSegments` + `classifyDirectSegments`) |
| Segment / boundary keys (Pacific date + `HH:MM` + terminals) | [`convex/shared/keys.ts`](../../convex/shared/keys.ts) (`buildSegmentKey`, `buildBoundaryKey`) |
| History terminal resolution (names, aliases, abbrev) | [`convex/shared/scheduleIdentity.ts`](../../convex/shared/scheduleIdentity.ts) (`resolveHistoryTerminalAbbrev`) |
| Sailing day filter on history rows | [`convex/shared/time.ts`](../../convex/shared/time.ts) (`getSailingDay`) |
| Pure merge of scheduled + actual rows for queries | [`convex/domain/vesselTimeline/timelineEvents.ts`](../../convex/domain/vesselTimeline/timelineEvents.ts) |

**Arrival** actuals in history merge use WSF **`EstArrival`** as a proxy for `arv-dock`, not a separate “actual arrival” field, unless backfill logic invents a time from dock continuity.

---

## Prior hypotheses (not validated as root cause)

1. **History rows with `Arriving: null`** — entire row was skipped until inference from a unique direct segment at the same departure signature; may still miss cases with ambiguous or missing schedule rows.
2. **Trip key mismatch** — `buildSegmentKey` uses Pacific **minute**; schedule `DepartingTime` vs history `ScheduledDepart` skew → **fuzzy window** (currently 8 minutes in `history.ts`) added; may still miss larger skew or wrong-day edge cases.
3. **Terminal string mismatch** — history sends **abbreviations** (`SOU`, `FAU`) vs DB `TerminalName`; **`resolveHistoryTerminalAbbrev`** was extended to try `TerminalAbbrev` after name/alias.
4. **Backfill only paired consecutive sorted rows** — replaced with **backward scan** + scoring to skip noise rows and prefer rows with `EstArrival` / explicit `Arriving`.
5. **Unverified:** live **`vesselLocations` patches** overwriting or omitting `arv-dock` keys; **indirect** schedule classification dropping segments; **Convex data** for terminals/vessels not matching WSF strings in **deployment**; **UI** reading a different field than `EventActualTime` for arrivals.

---

## Why unit tests may mislead

- Tests live in [`convex/domain/vesselTimeline/tests/history.test.ts`](../../convex/domain/vesselTimeline/tests/history.test.ts).
- Fixtures use a **tiny** `backendVessels` / `backendTerminals` list and **hand-authored** `RawWsfScheduleSegment` / `VesselHistory` shapes. They **do not** pull real WSF responses or the **production** `terminals` / `vessels` tables.
- They only assert behavior of **`mergeSeededEventsWithHistory`**, not:
  - `replaceBoundaryEventsForSailingDay` + location patches,
  - cron / orchestrator writes,
  - or client rendering.

If “tests are broken,” verify: `bun test convex/domain/vesselTimeline/tests/history.test.ts` and whether failures are environmental (Bun/Convex versions) or assertion drift.

---

## Recommended investigation plan (for the next agent)

1. **Reproduce on a single sailing day + vessel**  
   Run `sync:vessel-timeline:date` for the failing date; in Convex dashboard, query `eventsScheduled` / `eventsActual` for CAT and compare **Keys** for a missing `arv-dock` vs a working one.

2. **Log in the action (temporary)**  
   In `syncVesselTimelineForDate`, after `mergeSeededEventsWithHistory`, log counts of events with `EventType === "arv-dock"` and `EventActualTime` set; compare to raw history record count with `EstArrival` for CAT.

3. **Diff keys**  
   For one missing arrival, compute expected `buildBoundaryKey(buildSegmentKey(...), "arv-dock")` from schedule segment vs from history row; confirm they match **character-for-character**.

4. **Inspect post-mutation merge**  
   Trace [`mergeActualBoundaryPatchesIntoRows`](../../convex/functions/vesselTimeline/mergeActualBoundaryPatchesIntoRows.ts) output for the same `Key` — see if `baseActualRows` had arrival and patches removed it (or vice versa).

5. **Capture raw WSF samples**  
   Save real `VesselHistory` JSON for CAT for the failing day (terminal strings, `ScheduledDepart`, `EstArrival`, row order). Compare to what `normalizeHistoryRecord` accepts (`getSailingDay`, terminal resolution, `actualDeparture`/`arrivalProxy` rules).

6. **Confirm `getDirectRawSeedSegments` contains the leg**  
   If a triangle leg is classified **indirect**, it may not seed timeline events at all — UI would not show that skeleton; if UI shows the row, this may be fine, but worth confirming for failing legs.

---

## Key documentation (read order)

| Doc | Path |
|-----|------|
| Vessel timeline backend domain | [`convex/domain/vesselTimeline/README.md`](../../convex/domain/vesselTimeline/README.md) |
| Vessel orchestrator / trip vs timeline | [`convex/functions/vesselOrchestrator/README.md`](../../convex/functions/vesselOrchestrator/README.md) |
| Client timeline architecture | [`src/features/VesselTimeline/docs/ARCHITECTURE.md`](../../src/features/VesselTimeline/docs/ARCHITECTURE.md) |
| Convex MCP / dev cheat sheet | [`docs/convex-mcp-cheat-sheet.md`](../convex-mcp-cheat-sheet.md) |
| Convex rules (queries, actions, etc.) | [`docs/convex_rules.mdc`](../convex_rules.mdc) |

Trip / timeline update pipeline (orchestrator path, separate from manual sync):

- [`convex/functions/vesselTrips/updates/README.md`](../../convex/functions/vesselTrips/updates/README.md)

---

## Commands reference

```bash
# History merge unit tests only
bun test convex/domain/vesselTimeline/tests/history.test.ts

# Manual sync (requires CONVEX_URL / dev deployment)
bun run sync:vessel-timeline
bun run sync:vessel-timeline:date -- 2026-04-06

# Repo checks (per project conventions)
bun run check:fix && bun run type-check && bun run convex:typecheck
```

---

## Related external package

Vessel history types and fetch helpers come from **`ws-dottie/wsf-vessels`** (see imports of `VesselHistory`, `fetchVesselHistoriesByVesselAndDates` in `vesselTimeline/actions.ts`). Inspect that package’s schema if WSF adds fields or changes semantics.

---

## Deliverable for closure

A short **root-cause note** (which layer failed: key mismatch, terminal resolution, sailing day, direct/indirect classification, replace mutation / location patches, or UI) plus a **test strategy**: either **recorded fixture** from real WSF + real `loadBackendTerminals` snapshot, or an **integration** test that runs the action against a dev deployment with logged payloads.
