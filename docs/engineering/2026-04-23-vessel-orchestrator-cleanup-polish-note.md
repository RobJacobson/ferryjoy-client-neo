# Vessel Orchestrator Cleanup Polish Note

**Date:** 2026-04-23

## Scope

This note summarizes the two latest polish passes on the current
`vesselOrchestrator` code shape (not refactor history), with emphasis on:

- small purpose-built shared helpers
- flat helper contracts
- lean stage/persistence shapes
- keeping test-only helpers out of runtime code paths
- quiet production logging defaults
- preserving hot-path cost invariants

## What Was Changed

### Pass 1

- Updated `convex/functions/vesselOrchestrator/testing.ts` to call the
  canonical runtime helper `buildOrchestratorPersistenceBundle(...)` when
  invoking `persistOrchestratorPing`.
- Removed duplicate inline persistence-payload assembly in `testing.ts`.
- Kept the persistence-bundle contract flat:
  `pingStartedAt`, `changedLocations`, `existingActiveTrips`, `tripRows`,
  `predictionRows`, and `mlTimelineOverlays`.

### Pass 2

- Updated `convex/functions/vesselOrchestrator/tests/persistenceBundle.test.ts`
  to import `buildOrchestratorPersistenceBundle` directly from
  `../persistenceBundle` instead of through `../testing`.
- Removed the `buildOrchestratorPersistenceBundle` re-export from
  `convex/functions/vesselOrchestrator/testing.ts`.
- Result: test-only compatibility module no longer acts as a pass-through for
  a production runtime helper.

## Why These Changes

- Removes residual duplication while preserving the existing orchestrator flow.
- Keeps one canonical persistence-bundle assembler in
  `convex/functions/vesselOrchestrator/persistenceBundle.ts`.
- Reduces wrapper noise and import indirection in tests.
- Keeps test-only seams in test helpers without widening runtime module
  contracts.

## Hot-Path Invariants Preserved

- One orchestrator snapshot query per ping.
- One WSF fetch per ping.
- Changed-vessel in-memory loop remains the orchestration style.
- Schedule continuity remains targeted/cached via `eventsScheduled` lookups.
- Prediction/timeline remains gated by material trip changes.
- One orchestrator-owned persistence mutation when writes are needed.
- No broad same-day schedule snapshot read.
- No per-vessel Convex mutation fan-out.
- Production logging remains quiet by default (errors/warnings focused).

## Verification Run

- `bun test convex/functions/vesselOrchestrator/tests/updateVesselLocations.test.ts`
- `bun test convex/functions/vesselOrchestrator/tests/persistenceBundle.test.ts`
- `bun test convex/functions/vesselOrchestrator/tests/predictionStagePolicy.test.ts convex/functions/vesselOrchestrator/tests/persistenceBundle.test.ts convex/functions/vesselOrchestrator/tests/tripStagePolicy.test.ts convex/functions/vesselOrchestrator/tests/updateVesselLocations.test.ts`
- `bun run convex:typecheck`
- lints checked for touched files (`testing.ts`, `persistenceBundle.test.ts`)

All checks passed.
