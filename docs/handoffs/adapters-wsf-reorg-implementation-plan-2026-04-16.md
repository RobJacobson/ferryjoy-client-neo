# Implementation plan: `convex/adapters` reorg (flat + `Wsf` + role folders)

**Date:** 2026-04-16  
**Audience:** implementers  
**Canonical intent:** [backend-layering-actions-and-domain-memo-2026-04-16.md](./backend-layering-actions-and-domain-memo-2026-04-16.md) (adapter section + task list)

## Goal

Remove `convex/adapters/wsf/`, adopt **`fetch/`**, **`resolve/`**, **`pipelines/`**, **`utils/`** under `convex/adapters/`, use **`Wsf`** in filenames, consolidate **`scheduledTrips/`** into fewer **`fetch/`** modules plus **one** **`pipelines/WsfScheduledTrips.ts`**, update barrels and all imports.

## Target layout (illustrative)

```
convex/adapters/
  README.md
  index.ts
  vesselTrips/processTick.ts          # unchanged unless you choose to move later
  fetch/
    WsfFetchVesselLocations.ts
    WsfFetchVesselPings.ts
    WsfFetchVesselIdentities.ts
    WsfFetchTerminalIdentities.ts
    WsfFetchTerminalsAndMates.ts
    WsfFetchScheduledTrips*.ts        # merged from current scheduledTrips/* fetch pieces
  resolve/
    WsfResolveVessel.ts
    WsfResolveTerminal.ts
    WsfResolveVesselHistory.ts
    WsfResolveScheduleSegment.ts
  pipelines/
    WsfScheduledTrips.ts
    WsfBuildTerminalsTopology.ts      # from buildTerminalsTopologyFromSchedule.ts
  utils/
    WsfRetryOnce.ts
```

Exact split of “how many `WsfFetchScheduledTrips*` files” is a judgment call: **prefer fewer, longer files** with private helpers over many one-liner modules.

## Phase 1 — Scaffold and mechanical moves

1. Create `fetch/`, `resolve/`, `pipelines/`, `utils/`.
2. Move each module from `adapters/wsf/` into the right folder and rename with **`Wsf`** in the basename.
3. Fix **relative imports** between adapter files.
4. Replace **`convex/adapters/wsf/index.ts`** with **`convex/adapters/index.ts`** (or expand an existing root barrel) exporting the same public surface types and functions.

## Phase 2 — Scheduled trips consolidation

1. Move **`retryOnce.ts`** → **`utils/WsfRetryOnce.ts`** (or similar).
2. Fold **`fetchRouteSchedule`**, **`fetchActiveRoutes`**, **`downloadRawWsfScheduleData`**, and related fetch helpers into **`fetch/`** module(s) that own **fetch + transform** toward adapter/backend DTOs.
3. Move **`fetchAndTransformScheduledTrips`** orchestration into **`pipelines/WsfScheduledTrips.ts`**; keep **`createScheduledTripFromRawSegment`**, **`types`**, etc. either next to the pipeline file or inside **`fetch/`** as appropriate—minimize new folders.
4. Update **`scheduledTrips/index.ts`** consumers: either re-export from **`adapters/index.ts`** or import **`pipelines/WsfScheduledTrips`** directly.

## Phase 3 — Import sweep

Grep for `adapters/wsf` and update:

- `convex/functions/**`
- `convex/domain/timelineReseed/**`
- `convex/domain/ml/**` (only if paths referenced)
- Tests and `scripts/check-vessel-availability-*.ts`
- Root **`README.md`**, **`convex/functions/vesselOrchestrator/README.md`**, **`convex/functions/scheduledTrips/README.md`**
- Historical handoffs (or add a one-line pointer to the memo)

Run Convex dev or `bunx convex codegen` as needed so generated API paths stay consistent.

## Phase 4 — Verification

- `bun run check:fix`
- `bun run type-check`
- `bun run convex:typecheck`
- `bun test` (at least Convex tests touching adapters)

## Explicitly out of scope (follow-up tasks in memo)

- **`fetchHistoryRecordsForDate`** → adapter `fetch/` (still in `functions/vesselTimeline` today).
- **`loadWsfTrainingData`** → remove `ws-dottie` from **`domain/ml/training/data/loadTrainingData.ts`**.
- Optional: move **`domain/ml/training/actions.ts`** to **`functions/`**.

## Risk notes

- **Large diff** from import path changes—prefer one focused PR or two (Phase 1–2 vs Phase 3 docs).
- **`scheduledTrips`** merge is the highest conflict risk; keep behavior identical; rely on existing tests.
