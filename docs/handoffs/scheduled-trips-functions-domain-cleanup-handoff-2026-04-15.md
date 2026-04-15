# Handoff: ScheduledTrips `functions` / `domain` cleanup (mirror VesselTrips)

**Date:** 2026-04-15  
**Audience:** implementation agent  
**Goal:** Apply the same architectural cleanup that landed for `convex/functions/vesselTrips`: keep **business rules** in `convex/domain/scheduledTrips`, and **Convex entrypoints + I/O** (queries, mutations, actions, fetch/persistence wiring) in `convex/functions/scheduledTrips`, with a small, intentional public surface.

This note does **not** prescribe every file move; it points to the canonical docs and the current code map so the next agent can draft a concrete plan.

---

## Reference implementation (done): VesselTrips

Use the post-refactor layout as the pattern:

- Thin Convex surface: [`convex/functions/vesselTrips/actions.ts`](../../convex/functions/vesselTrips/actions.ts), [`mutations.ts`](../../convex/functions/vesselTrips/mutations.ts), [`queries.ts`](../../convex/functions/vesselTrips/queries.ts), [`schemas.ts`](../../convex/functions/vesselTrips/schemas.ts)
- Module overview: [`convex/functions/vesselTrips/README.md`](../../convex/functions/vesselTrips/README.md)
- Domain boundary rules: [`convex/domain/README.md`](../../convex/domain/README.md)

---

## Current ScheduledTrips split (high level)

**Domain (transform / business rules)** — [`convex/domain/scheduledTrips/`](../../convex/domain/scheduledTrips/)

- Pipeline entry: `runScheduleTransformPipeline`, `classifyDirectSegments`, `calculateTripEstimates`, `officialCrossingTimes`, `grouping`, prefetch row helpers (`applyPrefetchSchedulePolicies`, `buildInitialScheduledTripRow`), etc.
- Described in domain README: [`convex/domain/README.md`](../../convex/domain/README.md) (bullet `scheduledTrips/`)

**Functions (Convex + WSF I/O)** — [`convex/functions/scheduledTrips/`](../../convex/functions/scheduledTrips/)

- Module overview: [`convex/functions/scheduledTrips/README.md`](../../convex/functions/scheduledTrips/README.md)
- Top-level: `actions.ts`, `mutations.ts`, `queries.ts`, `schemas.ts`, `index.ts`
- Sync pipeline: [`sync/`](../../convex/functions/scheduledTrips/sync/) — `fetchAndTransform.ts`, `persistence.ts`, `sync.ts`, `fetching/*`
- Architecture note for this folder: [`convex/functions/scheduledTrips/sync/README.md`](../../convex/functions/scheduledTrips/sync/README.md)

**Quality review context (scheduled trips coverage gap called out):**

- [`docs/handoffs/convex-domain-boundary-reorg-quality-review-2026-04-14.md`](convex-domain-boundary-reorg-quality-review-2026-04-14.md)

---

## Suggested direction for the next agent

1. **Inventory** what in `functions/scheduledTrips` is still “substantive logic” vs thin wrappers (compare to [`sync/README.md`](../../convex/functions/scheduledTrips/sync/README.md) claims).
2. **Move or consolidate** pure transforms/tests into `convex/domain/scheduledTrips/` (and `convex/domain/scheduledTrips/tests/`) per [`convex/domain/README.md`](../../convex/domain/README.md) import rules.
3. **Keep** WSF download, raw segment mapping, and atomic DB replace in the functions layer unless you deliberately introduce domain “ports” — the sync README already frames that split.
4. **Normalize the public surface**: decide whether `index.ts` / deep `sync/*` paths remain for Convex registration only, or whether the folder should mirror the VesselTrips “four top-level files + README” story (may require moving/renaming while preserving Convex module paths — run `bun run convex:codegen` after edits).
5. **Run** `bun run check:fix`, `bun run type-check`, `bun run convex:typecheck`, and relevant `bun test` targets.

---

## All relevant `*.md` files (links)

### Convex backend — domain & rules

- [`convex/domain/README.md`](../../convex/domain/README.md)
- [`convex/domain/ml/readme-ml.md`](../../convex/domain/ml/readme-ml.md) (ScheduledTrips chain fields, `runScheduleTransformPipeline`, schema pointers)

### Convex backend — scheduled trips (functions)

- [`convex/functions/scheduledTrips/README.md`](../../convex/functions/scheduledTrips/README.md)
- [`convex/functions/scheduledTrips/sync/README.md`](../../convex/functions/scheduledTrips/sync/README.md)

### Convex backend — related modules

- [`convex/functions/vesselOrchestrator/README.md`](../../convex/functions/vesselOrchestrator/README.md) (links scheduled trips sync doc)
- [`convex/functions/vesselTrips/README.md`](../../convex/functions/vesselTrips/README.md) (completed refactor pattern)
- [`convex/domain/ml/README.md`](../../convex/domain/ml/README.md) (if touching ML docs cross-refs)

### Repository root

- [`README.md`](../../README.md) (project structure, `sync:scheduled-trips` scripts)

### Frontend — ScheduledTrips UI

- [`src/features/TimelineFeatures/ScheduledTrips/README.md`](../../src/features/TimelineFeatures/ScheduledTrips/README.md)

### Handoffs & architecture (timeline, trips, boundaries)

- [`docs/handoffs/convex-domain-boundary-reorg-quality-review-2026-04-14.md`](convex-domain-boundary-reorg-quality-review-2026-04-14.md)
- [`docs/handoffs/convex-functions-domain-boundary-reorg-memo-2026-04-14.md`](convex-functions-domain-boundary-reorg-memo-2026-04-14.md)
- [`docs/handoffs/vessel-trip-and-timeline-redesign-spec-2026-04-12.md`](vessel-trip-and-timeline-redesign-spec-2026-04-12.md)
- [`docs/handoffs/vessel-timeline-module-boundary-handoff-2026-04-13.md`](vessel-timeline-module-boundary-handoff-2026-04-13.md)
- [`docs/handoffs/vesseltimeline-reconciliation-memo-2026-04-14.md`](vesseltimeline-reconciliation-memo-2026-04-14.md)
- [`docs/handoffs/vessel-trip-timestamp-glossary-2026-04-15.md`](vessel-trip-timestamp-glossary-2026-04-15.md)
- [`docs/handoffs/trip-timestamp-semantics-prd-2026-04-14.md`](trip-timestamp-semantics-prd-2026-04-14.md)
- [`docs/handoffs/trip-timestamp-semantics-memo-2026-04-14.md`](trip-timestamp-semantics-memo-2026-04-14.md)

### Misc

- [`docs/convex-mcp-cheat-sheet.md`](../convex-mcp-cheat-sheet.md) (mentions `scheduledTrips` table)

---

## Files to read first (non-markdown)

If the next agent needs code anchors beyond Markdown:

- [`convex/domain/scheduledTrips/runScheduleTransformPipeline.ts`](../../convex/domain/scheduledTrips/runScheduleTransformPipeline.ts)
- [`convex/functions/scheduledTrips/sync/fetchAndTransform.ts`](../../convex/functions/scheduledTrips/sync/fetchAndTransform.ts)
- [`convex/functions/scheduledTrips/schemas.ts`](../../convex/functions/scheduledTrips/schemas.ts)

---

## Checklist before closing the task

- [x] Domain vs functions boundary matches [`convex/domain/README.md`](../../convex/domain/README.md).
- [x] Tests: substantive logic under `convex/domain/**/tests/`; functions tests limited to validators/wiring where appropriate (same convention as domain README).
- [x] Docs updated if paths or ownership changed (at minimum `sync/README.md` and this handoff’s “relevant md” list if new READMEs appear).
